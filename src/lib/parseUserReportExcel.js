const ExcelJS = require("exceljs");

const SOURCE_MACHINE = "User Excel";
const DEFAULT_ANALYSIS_POSITION = 1;

const COMPONENT_NAME_TO_CODE = {
  "h2s*": "H2S",
  h2s: "H2S",
  nitrogen: "N2",
  "carbon dioxide": "CO2",
  methane: "C1",
  ethane: "C2",
  propane: "C3",
  "iso-butane": "IC4",
  isobutane: "IC4",
  "n-butane": "NC4",
  "iso-pentane": "IC5",
  isopentane: "IC5",
  "n-pentane": "NC5",
  "hexanes plus": "C6+",
  "hexane plus": "C6+",
  "c6+": "C6+",
};

function cellValue(ws, addr) {
  const cell = ws.getCell(addr);
  let value = cell.value;
  if (value && typeof value === "object") {
    if (value.result !== undefined) value = value.result;
    else if (value.richText) {
      value = value.richText.map((part) => part.text || "").join("");
    } else if (value.text !== undefined) {
      value = value.text;
    } else if (value instanceof Date) {
      return value;
    }
  }
  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed === "" ? null : trimmed;
  }
  return value === undefined ? null : value;
}

function toNumber(value) {
  if (value === undefined || value === null || value === "") return null;
  if (typeof value === "number" && Number.isFinite(value)) return value;
  const num = Number(String(value).replace(/,/g, "").trim());
  return Number.isFinite(num) ? num : null;
}

function toString(value) {
  if (value === undefined || value === null) return "";
  if (value instanceof Date) return value.toISOString();
  return String(value).trim();
}

/** Excel serial date (1900 system) → Date, or pass through Date */
function excelSerialToDate(value) {
  if (value instanceof Date && !Number.isNaN(value.getTime())) return value;
  const serial = toNumber(value);
  if (serial == null) return null;
  // Excel epoch: 1899-12-30 (accounts for Excel's 1900 leap-year bug offset)
  const utcDays = Math.floor(serial - 25569);
  const date = new Date(utcDays * 86400 * 1000);
  return Number.isNaN(date.getTime()) ? null : date;
}

function resolveComponentCode(name) {
  if (!name) return null;
  const key = String(name).trim().toLowerCase();
  return COMPONENT_NAME_TO_CODE[key] || null;
}

function parsePressureBase(text) {
  const match = String(text || "").match(/([\d.]+)\s*psia/i);
  return match ? toNumber(match[1]) : null;
}

/**
 * Parse the "Report" sheet of a user Excel gas analysis workbook.
 * @param {string} filePath
 * @returns {Promise<object>}
 */
async function parseUserReportExcel(filePath) {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(filePath);
  const ws = workbook.getWorksheet("Report");
  if (!ws) {
    const err = new Error('Worksheet "Report" not found in Excel file');
    err.status = 400;
    throw err;
  }

  const method = toString(cellValue(ws, "B8"));
  const analysisNumber = toString(cellValue(ws, "B9"));
  const cylinderNumber = toString(cellValue(ws, "B10"));
  const analyzedOn = excelSerialToDate(cellValue(ws, "E8"));
  const analyzedBy = toString(cellValue(ws, "E10"));
  const sampleDate = excelSerialToDate(cellValue(ws, "G14"));

  const components = [];
  for (let row = 25; row <= 35; row += 1) {
    const label = toString(cellValue(ws, `A${row}`));
    if (!label) continue;
    const code = resolveComponentCode(label);
    if (!code) continue;
    components.push({
      component: code,
      component_description: label.replace(/\*$/, "").trim(),
      mol_pct: toNumber(cellValue(ws, `C${row}`)),
      wt_pct: toNumber(cellValue(ws, `E${row}`)),
      gpm: toNumber(cellValue(ws, `G${row}`)),
    });
  }

  if (components.length === 0) {
    const err = new Error("No component rows found on Report sheet");
    err.status = 400;
    throw err;
  }

  const baseConditionText = toString(cellValue(ws, "A21"));
  const physicalConstantText = toString(cellValue(ws, "E21"));

  return {
    source_machine: SOURCE_MACHINE,
    method_name: method || null,
    analysis_number: analysisNumber || null,
    cylinder_number: cylinderNumber || null,
    analyzed_on: analyzedOn,
    analyzed_by: analyzedBy || null,
    sample_date: sampleDate,
    pressure_base: parsePressureBase(baseConditionText),
    customer_information: {
      company_name: toString(cellValue(ws, "H7")),
      contact_person: toString(cellValue(ws, "H8")).replace(/^Attn:\s*/i, ""),
      address_line1: toString(cellValue(ws, "H9")),
      address_line2: toString(cellValue(ws, "H10")),
    },
    sample_information: {
      producer: toString(cellValue(ws, "C13")),
      well_lease: toString(cellValue(ws, "C14")),
      meter_number: toString(cellValue(ws, "C15")),
      sample_type: toString(cellValue(ws, "C16")),
      sampled_by: toString(cellValue(ws, "G13")),
      sample_pressure: toNumber(cellValue(ws, "G15")),
      sample_pressure_unit: toString(cellValue(ws, "H15")) || null,
      sample_temperature: toString(cellValue(ws, "G16")),
      sample_method: toString(cellValue(ws, "G17")),
      field_h2s: toNumber(cellValue(ws, "I17")),
      flow_rate: [toString(cellValue(ws, "F18")), toString(cellValue(ws, "G18"))]
        .filter(Boolean)
        .join(" "),
    },
    base_conditions: {
      base_condition: baseConditionText.replace(/^Base Condition:\s*/i, ""),
      physical_constant: physicalConstantText.replace(
        /^Physical Constants per\s*/i,
        "",
      ),
    },
    components,
    analysis_results: {
      gross_heating_value: {
        dry_ideal: toNumber(cellValue(ws, "A40")),
        dry_real: toNumber(cellValue(ws, "A41")),
        wet_ideal: toNumber(cellValue(ws, "B40")),
        wet_real: toNumber(cellValue(ws, "B41")),
      },
      specific_gravity: {
        dry_ideal: toNumber(cellValue(ws, "E40")),
        dry_real: toNumber(cellValue(ws, "E41")),
        wet_ideal: toNumber(cellValue(ws, "F40")),
        wet_real: toNumber(cellValue(ws, "F41")),
      },
      compressibility_factor: {
        dry_ideal: toNumber(cellValue(ws, "H40")),
        dry_real: null,
        wet_ideal: toNumber(cellValue(ws, "I40")),
        wet_real: null,
      },
    },
    gpm_summary: {
      c2_plus: toNumber(cellValue(ws, "B44")),
      c3_plus: toNumber(cellValue(ws, "B45")),
    },
    analysis_position: DEFAULT_ANALYSIS_POSITION,
  };
}

module.exports = {
  SOURCE_MACHINE,
  DEFAULT_ANALYSIS_POSITION,
  parseUserReportExcel,
  excelSerialToDate,
  resolveComponentCode,
};
