const fs = require("fs");
const JSZip = require("jszip");

async function removeCalculationChain(filePath) {
  const zip = await JSZip.loadAsync(await fs.promises.readFile(filePath));
  const relationshipsFile = zip.file("xl/_rels/workbook.xml.rels");
  const contentTypesFile = zip.file("[Content_Types].xml");

  if (!relationshipsFile || !contentTypesFile) return;

  const relationships = await relationshipsFile.async("string");
  const contentTypes = await contentTypesFile.async("string");

  zip.file(
    "xl/_rels/workbook.xml.rels",
    relationships.replace(
      /<Relationship\b[^>]*Type="[^" ]*\/calcChain"[^>]*\/>\s*/g,
      "",
    ),
  );
  zip.file(
    "[Content_Types].xml",
    contentTypes.replace(
      /<Override\b[^>]*PartName="\/xl\/calcChain\.xml"[^>]*\/>\s*/g,
      "",
    ),
  );
  zip.remove("xl/calcChain.xml");

  await fs.promises.writeFile(
    filePath,
    await zip.generateAsync({ type: "nodebuffer", compression: "DEFLATE" }),
  );
}

module.exports = { removeCalculationChain };
