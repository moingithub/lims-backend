const JSZip = require("jszip");
const fs = require("fs");
const path = require("path");
const { prisma } = require("./common");
const { formatSampleTime } = require("./buildAnalysisReport");

const TEMPLATE_PATH = path.join(
  __dirname,
  "..",
  "..",
  "uploads",
  "user_reports",
  "Import Report Template-V2.xlsx",
);

function asDate(value) {
  if (value == null || value === "") return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function asNumber(value) {
  if (value == null || value === "") return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function xmlEscape(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function excelDateSerial(value) {
  const date = value instanceof Date ? value : asDate(value);
  if (!date) return null;
  return (date.getTime() - Date.UTC(1899, 11, 30)) / 86400000;
}

/** M-D-YY or M-D-YY H:mm for report cells */
function formatDisplayDateTime(value) {
  const date = asDate(value);
  if (!date) return null;
  const month = date.getUTCMonth() + 1;
  const day = date.getUTCDate();
  const year = String(date.getUTCFullYear()).slice(-2);
  const hours = date.getUTCHours();
  const minutes = date.getUTCMinutes();
  const base = `${month}-${day}-${year}`;
  if (hours === 0 && minutes === 0) return base;
  return `${base} ${hours}:${String(minutes).padStart(2, "0")}`;
}

function formatSampleDateTime(sampleDate, sampleTime) {
  const date = asDate(sampleDate);
  if (!date) return null;
  const month = date.getUTCMonth() + 1;
  const day = date.getUTCDate();
  const year = String(date.getUTCFullYear()).slice(-2);
  const timePart = formatSampleTime(sampleTime);
  const datePart = `${month}-${day}-${year}`;
  return timePart ? `${datePart} ${timePart}` : datePart;
}

function normalizePressureUnit(unit) {
  if (unit == null || unit === "") return null;
  return String(unit).trim().toLowerCase();
}

function formatEffectiveReportDate(value) {
  if (value == null || value === "") return "N/A";
  return excelDateSerial(value) ?? formatDisplayDateTime(value);
}

function flowRateNumeric(flowRate) {
  if (flowRate == null || flowRate === "") return null;
  return asNumber(flowRate) ?? (String(flowRate).trim() || null);
}

function cellXml(address, value, attributes, sharedStringIndex) {
  const baseAttributes = attributes
    .replace(/\s+t="[^"]*"/g, "")
    .replace(/\s+xml:space="[^"]*"/g, "")
    .replace(/\/\s*$/, "");
  if (value === null || value === undefined || value === "") {
    return `<c${baseAttributes}/>`;
  }
  if (typeof value === "number" && Number.isFinite(value)) {
    return `<c${baseAttributes}><v>${value}</v></c>`;
  }
  return `<c${baseAttributes} t="s"><v>${sharedStringIndex}</v></c>`;
}

function setCellValue(xml, address, value, sharedStringIndex) {
  const addressIndex = xml.indexOf(`r="${address}"`);
  if (addressIndex < 0)
    throw new Error(`Cell ${address} not found in Report sheet`);

  const start = xml.lastIndexOf("<c", addressIndex);
  const closingTag = xml.indexOf("</c>", addressIndex);
  const selfClosingTag = xml.indexOf("/>", addressIndex);
  const end =
    closingTag >= 0 && (selfClosingTag < 0 || closingTag < selfClosingTag)
      ? closingTag + 4
      : selfClosingTag + 2;
  const cell = xml.slice(start, end);
  const attributes = cell.slice(2, cell.indexOf(">"));

  return `${xml.slice(0, start)}${cellXml(
    address,
    value,
    attributes,
    sharedStringIndex,
  )}${xml.slice(end)}`;
}

function setCellValueIfPresent(xml, address, value, sharedStringIndex) {
  if (xml.indexOf(`r="${address}"`) < 0) return xml;
  return setCellValue(xml, address, value, sharedStringIndex);
}

function addSharedString(xml, value) {
  const uniqueCountMatch = xml.match(/\buniqueCount="(\d+)"/);
  const countMatch = xml.match(/\bcount="(\d+)"/);
  const uniqueCount = uniqueCountMatch ? Number(uniqueCountMatch[1]) : 0;
  const count = countMatch ? Number(countMatch[1]) : uniqueCount;
  const text = xmlEscape(value);
  const entry = `<si><t xml:space="preserve">${text}</t></si>`;
  return {
    index: uniqueCount,
    xml: xml
      .replace(/<\/sst>$/, `${entry}</sst>`)
      .replace(/\buniqueCount="\d+"/, `uniqueCount="${uniqueCount + 1}"`)
      .replace(/\bcount="\d+"/, `count="${count + 1}"`),
  };
}

function applyCellUpdates(xml, sharedStrings, entries) {
  for (const { address, value, optional } of entries) {
    const write = (x, v, idx) =>
      optional ? setCellValueIfPresent(x, address, v, idx) : setCellValue(x, address, v, idx);

    if (typeof value === "string" && value !== "") {
      const added = addSharedString(sharedStrings, value);
      sharedStrings = added.xml;
      xml = write(xml, value, added.index);
    } else {
      xml = write(xml, value ?? null);
    }
  }
  return { xml, sharedStrings };
}

async function createAnalysisReportWorkbook(
  sampleCheckinId,
  { templatePath = TEMPLATE_PATH } = {},
) {
  const checkin = await prisma.sample_checkin.findUnique({
    where: { id: sampleCheckinId },
    include: {
      company: { select: { name: true, billing_address: true } },
      company_contact: { select: { name: true } },
      analysis_pricing: { select: { analysis_type: true } },
    },
  });
  if (!checkin) return null;

  let reportXml = await JSZip.loadAsync(
    await fs.promises.readFile(templatePath),
  ).then((zip) =>
    zip
      .file("xl/worksheets/sheet2.xml")
      .async("string")
      .then((xml) => ({ zip, xml })),
  );
  let { zip, xml } = reportXml;
  let sharedStrings = await zip.file("xl/sharedStrings.xml").async("string");

  const addressLines = String(checkin.company?.billing_address || "")
    .split(",")
    .map((line) => line.trim())
    .filter(Boolean);

  const measured = checkin.pressure_measured;
  const pressureUnit = normalizePressureUnit(checkin.pressure_unit);
  const method = checkin.analysis_pricing?.analysis_type ?? null;
  const analyzedOnValue =
    excelDateSerial(checkin.analyzed_on) ??
    formatDisplayDateTime(checkin.analyzed_on);

  const entries = [
    { address: "B7", value: method },
    { address: "B8", value: checkin.analysis_number },
    { address: "B9", value: checkin.cylinder_number },
    { address: "E7", value: analyzedOnValue },
    { address: "E8", value: checkin.analyzed_by },
    { address: "H7", value: checkin.company?.name },
    { address: "H8", value: checkin.company_contact?.name },
    { address: "H9", value: addressLines[0] ?? null },
    {
      address: "H10",
      value:
        addressLines.length > 2
          ? addressLines.slice(1).join(", ")
          : addressLines[1] ?? null,
    },
    { address: "B13", value: checkin.producer },
    { address: "B14", value: checkin.well_name },
    { address: "B15", value: checkin.meter_number },
    { address: "B16", value: checkin.instrument },
    { address: "B17", value: analyzedOnValue },
    { address: "B18", value: checkin.remarks },
    { address: "E13", value: asNumber(checkin.pressure) ?? checkin.pressure },
    { address: "F13", value: pressureUnit, optional: true },
    {
      address: "E14",
      value: asNumber(checkin.temperature) ?? checkin.temperature,
    },
    { address: "E15", value: asNumber(checkin.amb_temp) ?? checkin.amb_temp },
    { address: "E16", value: flowRateNumeric(checkin.flow_rate) },
    { address: "E17", value: asNumber(measured) ?? measured },
    { address: "F17", value: pressureUnit, optional: true },
    {
      address: "E19",
      value: formatEffectiveReportDate(checkin.effective_start_date),
    },
    { address: "H13", value: checkin.sampled_by },
    {
      address: "H14",
      value: formatSampleDateTime(checkin.sample_date, checkin.sample_time),
    },
    { address: "H16", value: checkin.sample_type },
    { address: "H17", value: asNumber(checkin.field_h2s) },
    {
      address: "H19",
      value: formatEffectiveReportDate(checkin.effective_end_date),
    },
    { address: "B21", value: checkin.base_condition },
  ];

  ({ xml, sharedStrings } = applyCellUpdates(xml, sharedStrings, entries));

  zip.file("xl/worksheets/sheet2.xml", xml);
  zip.file("xl/sharedStrings.xml", sharedStrings);
  const workbookRelationships = await zip
    .file("xl/_rels/workbook.xml.rels")
    .async("string");
  zip.file(
    "xl/_rels/workbook.xml.rels",
    workbookRelationships.replace(
      /<Relationship\b[^>]*Type="[^"]*\/calcChain"[^>]*\/>(?:\r?\n)?/g,
      "",
    ),
  );
  const contentTypes = await zip.file("[Content_Types].xml").async("string");
  zip.file(
    "[Content_Types].xml",
    contentTypes.replace(
      /<Override\b[^>]*PartName="\/xl\/calcChain\.xml"[^>]*\/>(?:\r?\n)?/g,
      "",
    ),
  );
  zip.remove("xl/calcChain.xml");
  return zip.generateAsync({ type: "nodebuffer", compression: "DEFLATE" });
}

module.exports = {
  TEMPLATE_PATH,
  createAnalysisReportWorkbook,
};
