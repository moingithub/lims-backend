const JSZip = require("jszip");
const fs = require("fs");
const path = require("path");
const { prisma } = require("./common");
const { buildAnalysisReport } = require("./buildAnalysisReport");

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

function componentKey(value) {
  return String(value || "")
    .replace(/\*$/, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

function populateComponents(xml, componentTable) {
  const aliases = new Map([
    ["h2s", "h2s"],
    ["nitrogen", "n2"],
    ["carbon dioxide", "co2"],
    ["methane", "c1"],
    ["ethane", "c2"],
    ["propane", "c3"],
    ["iso-butane", "ic4"],
    ["n-butane", "nc4"],
    ["iso-pentane", "ic5"],
    ["n-pentane", "nc5"],
    ["hexanes plus", "c6+"],
  ]);
  const values = new Map(
    (componentTable || []).map((row) => [
      aliases.get(componentKey(row.component)) || componentKey(row.component),
      asNumber(row.mole_pct),
    ]),
  );

  const labels = [
    [26, "h2s"],
    [27, "nitrogen"],
    [28, "carbon dioxide"],
    [29, "methane"],
    [30, "ethane"],
    [31, "propane"],
    [32, "iso-butane"],
    [33, "n-butane"],
    [34, "iso-pentane"],
    [35, "n-pentane"],
    [36, "hexanes plus"],
  ];
  for (const [row, label] of labels) {
    const key = aliases.get(label) || label;
    xml = setCellValue(xml, `C${row}`, values.get(key) ?? null);
  }
  return xml;
}

async function createAnalysisReportWorkbook(sampleCheckinId) {
  const checkin = await prisma.sample_checkin.findUnique({
    where: { id: sampleCheckinId },
    include: {
      company: { select: { name: true } },
      company_contact: { select: { name: true } },
    },
  });
  if (!checkin) return null;

  const report = await buildAnalysisReport(sampleCheckinId);
  const reportInfo = report.report_information;
  const sample = report.sample_information;
  const customer = report.customer_information;
  let reportXml = await JSZip.loadAsync(
    await fs.promises.readFile(TEMPLATE_PATH),
  ).then((zip) =>
    zip
      .file("xl/worksheets/sheet2.xml")
      .async("string")
      .then((xml) => ({ zip, xml })),
  );
  let { zip, xml } = reportXml;
  let sharedStrings = await zip.file("xl/sharedStrings.xml").async("string");

  const values = new Map([
    ["B8", reportInfo.method],
    ["B9", reportInfo.analysis_number],
    ["B10", reportInfo.cylinder_number],
    ["H7", customer.company_name || checkin.company?.name],
    ["H8", customer.contact_person || checkin.company_contact?.name],
    [
      "H11",
      checkin.work_order_number
        ? `Work Order: ${checkin.work_order_number}`
        : null,
    ],
    ["C13", sample.producer],
    ["G13", sample.sampled_by],
    ["C14", sample.well_lease],
    ["G14", excelDateSerial(sample.sample_date)],
    ["C15", sample.meter_number],
    ["G15", asNumber(checkin.pressure)],
    ["H15", checkin.pressure_unit],
    ["G16", asNumber(sample.sample_temperature)],
    ["G17", asNumber(sample.amb_temp)],
    ["F18", sample.flow_rate],
    ["I18", asNumber(sample.field_h2s)],
    ["I19", sample.sample_type],
    ["C20", sample.remarks],
  ]);
  for (const [address, value] of values) {
    if (typeof value === "string" && value !== "") {
      const added = addSharedString(sharedStrings, value);
      sharedStrings = added.xml;
      xml = setCellValue(xml, address, value, added.index);
    } else {
      xml = setCellValue(xml, address, value ?? null);
    }
  }
  xml = populateComponents(xml, report.component_table);
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
