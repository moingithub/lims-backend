const { prisma } = require("./common");
const {
  ANALYSIS_RESULT_METRIC_TYPES,
} = require("./insertAnalysisResultMetrics");

function blank(value) {
  if (value === undefined || value === null) return "";
  if (typeof value === "string") return value;
  return value;
}

function blankNumber(value) {
  if (value === undefined || value === null || value === "") return "";
  const num = Number(value);
  return Number.isFinite(num) ? num : "";
}

function sumNumericField(rows, field) {
  let total = 0;
  let hasValue = false;
  for (const row of rows) {
    const num = Number(row?.[field]);
    if (!Number.isFinite(num)) continue;
    total += num;
    hasValue = true;
  }
  if (!hasValue) return "";
  return total.toFixed(4);
}

function buildComponentTotals(componentTable) {
  const rows = Array.isArray(componentTable) ? componentTable : [];
  return {
    mole_pct: sumNumericField(rows, "mole_pct"),
    wt_pct: sumNumericField(rows, "wt_pct"),
    gpm: sumNumericField(rows, "gpm"),
  };
}

function formatSamplePressure(pressure, pressureUnit) {
  const p = blank(pressure);
  if (!p) return "";
  const unit = blank(pressureUnit);
  return unit ? `${p} ${unit}` : p;
}

function formatSampleTime(value) {
  if (value == null || value === "") return "";
  const time = String(value).trim();
  const match = /^(\d{1,2}):(\d{2})(?::(\d{2}))?$/.exec(time);
  if (!match) return time;

  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  const seconds = match[3];
  if (hours > 23 || minutes > 59 || (seconds != null && Number(seconds) > 59)) {
    return time;
  }

  const period = hours >= 12 ? "PM" : "AM";
  const formattedHours = hours % 12 || 12;
  const formattedMinutes = `${minutes}`.padStart(2, "0");
  return `${formattedHours}:${formattedMinutes}${seconds != null ? `:${seconds}` : ""} ${period}`;
}

function emptyAnalysisMetricGroup() {
  return {
    dry: { ideal: "", real: "" },
    wet: { ideal: "", real: "" },
  };
}

function buildAnalysisMetricGroup(metricRow) {
  if (!metricRow) return emptyAnalysisMetricGroup();
  return {
    dry: {
      ideal: blankNumber(metricRow.dry_ideal),
      real: blankNumber(metricRow.dry_real),
    },
    wet: {
      ideal: blankNumber(metricRow.wet_ideal),
      real: blankNumber(metricRow.wet_real),
    },
  };
}

function buildAnalysisResultsFromMetrics(metricRows) {
  const byMetric = new Map(metricRows.map((row) => [row.metric, row]));
  const analysisResults = {};
  for (const metric of ANALYSIS_RESULT_METRIC_TYPES) {
    analysisResults[metric] = buildAnalysisMetricGroup(byMetric.get(metric));
  }
  return analysisResults;
}

function emptyAnalysisResults() {
  return buildAnalysisResultsFromMetrics([]);
}

function formatAnalyzedOn(value) {
  if (value == null) return "";
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toISOString();
}

async function fetchMachineReportSection(checkin) {
  const importMachineReportId = checkin.import_machine_report_id ?? null;
  const analysisPosition = checkin.analysis_position ?? null;

  if (importMachineReportId == null || analysisPosition == null) {
    return {
      method: "",
      analyzed_on: "",
      analyzed_by: "",
      base_condition: "",
      physical_constant: "",
      component_table: [],
      analysis_results: emptyAnalysisResults(),
    };
  }

  const [importReport, rows, gasComponents, metricRows] = await Promise.all([
    prisma.import_machine_reports.findUnique({
      where: { id: importMachineReportId },
      select: {
        method_name: true,
        analyzed_by: true,
        base_condition: true,
        physical_constant: true,
      },
    }),
    prisma.machine_report_results.findMany({
      where: {
        import_machine_report_id: importMachineReportId,
        analysis_position: analysisPosition,
      },
    }),
    prisma.gas_component_master.findMany({
      where: { is_active: true },
      orderBy: [{ display_order: "asc" }, { component_code: "asc" }],
    }),
    prisma.analysis_result_metrics.findMany({
      where: {
        import_machine_report_id: importMachineReportId,
        analysis_position: analysisPosition,
      },
    }),
  ]);

  const method =
    blank(importReport?.method_name) ||
    blank(rows.find((row) => row.method_name)?.method_name);

  const analyzedOn = formatAnalyzedOn(
    rows.find((row) => row.sample_time != null)?.sample_time,
  );

  const orderMap = new Map(
    gasComponents.map((component, index) => [
      component.component_code,
      component.display_order ?? index,
    ]),
  );

  const componentTable = rows
    .sort((a, b) => {
      const orderA = orderMap.get(a.component) ?? 9999;
      const orderB = orderMap.get(b.component) ?? 9999;
      if (orderA !== orderB) return orderA - orderB;
      return String(a.component).localeCompare(String(b.component));
    })
    .map((row) => ({
      component: blank(row.component_description) || blank(row.component),
      mole_pct: blankNumber(row.mol_pct),
      wt_pct: blankNumber(row.wt_pct),
      gpm: blankNumber(row.gpm),
    }));

  return {
    method,
    analyzed_on: analyzedOn,
    analyzed_by: blank(importReport?.analyzed_by),
    base_condition: blank(importReport?.base_condition),
    physical_constant: blank(importReport?.physical_constant),
    component_table: componentTable,
    analysis_results: buildAnalysisResultsFromMetrics(metricRows),
  };
}

async function buildAnalysisReport(sampleCheckinId) {
  const checkin = await prisma.sample_checkin.findUnique({
    where: { id: sampleCheckinId },
    include: {
      company: { select: { name: true, phone: true, email: true } },
      company_contact: { select: { name: true, phone: true, email: true } },
    },
  });

  if (!checkin) return null;

  const machineReport = await fetchMachineReportSection(checkin);

  return {
    sample_checkin_id: checkin.id,
    customer_information: {
      company_name: blank(checkin.company?.name),
      phone: blank(checkin.company?.phone || checkin.company_contact?.phone),
      email: blank(checkin.company?.email || checkin.company_contact?.email),
      contact_person: blank(checkin.company_contact?.name),
    },
    report_information: {
      method: machineReport.method,
      analysis_number: blank(checkin.analysis_number),
      cylinder_number: blank(checkin.cylinder_number),
      analyzed_on: machineReport.analyzed_on,
      analyzed_by:
        blank(checkin.analyzed_by) || blank(machineReport.analyzed_by),
    },
    sample_information: {
      producer: blank(checkin.producer),
      well_lease: blank(checkin.well_name),
      meter_number: blank(checkin.meter_number),
      sample_type: blank(checkin.sample_type),
      remarks: blank(checkin.remarks),
      sampled_by: blank(checkin.sampled_by),
      sample_date: formatAnalyzedOn(checkin.sample_date),
      sample_pressure: formatSamplePressure(
        checkin.pressure,
        checkin.pressure_unit,
      ),
      pressure_measured: blank(checkin.pressure_measured),
      sample_temperature: blank(checkin.temperature),
      amb_temp: blank(checkin.amb_temp),
      sample_time: formatSampleTime(checkin.sample_time),
      sample_method: "",
      field_h2s: blankNumber(checkin.field_h2s),
      flow_rate: blank(checkin.flow_rate),
    },
    base_conditions: {
      base_condition:
        blank(checkin.base_condition) || blank(machineReport.base_condition),
      physical_constant:
        blank(checkin.physical_constant) ||
        blank(machineReport.physical_constant),
    },
    component_table: machineReport.component_table,
    component_totals: buildComponentTotals(machineReport.component_table),
    analysis_results: machineReport.analysis_results,
    gpm_summary: {
      // User Excel imports store C2+/C3+ on the gpm metric dry_real / wet_real
      c2_plus: blankNumber(machineReport.analysis_results?.gpm?.dry?.real),
      c3_plus: blankNumber(machineReport.analysis_results?.gpm?.wet?.real),
    },
  };
}

module.exports = {
  buildAnalysisReport,
  blank,
  blankNumber,
  buildComponentTotals,
  formatSampleTime,
};
