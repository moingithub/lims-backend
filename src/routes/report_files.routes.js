const express = require("express");
const fs = require("fs");
const path = require("path");
const { prisma } = require("../lib/common");
const {
  createAnalysisReportWorkbook,
} = require("../lib/exportAnalysisReportWorkbook");
const authorize = require("../middleware/authorize");
const logger = require("../lib/logger");

const router = express.Router();
const TEMPLATE_DIRECTORY = path.resolve(
  __dirname,
  "..",
  "..",
  "report_templates",
);
const EXCEL_CONTENT_TYPE =
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

function isCustomerWithCompany(req) {
  return (
    req.user &&
    typeof req.user.role === "string" &&
    req.user.role.trim().toLowerCase() === "customer" &&
    req.user.company_id !== undefined &&
    req.user.company_id !== null
  );
}

router.post("/", authorize("sample_checkin"), async (req, res) => {
  const sampleCheckinId = Number(req.body?.sample_checkin);
  if (!Number.isInteger(sampleCheckinId) || sampleCheckinId <= 0) {
    return res.status(400).json({ error: "Invalid sample_checkin" });
  }

  const templateName = req.body?.report_template_name;
  if (
    typeof templateName !== "string" ||
    !templateName.trim() ||
    path.basename(templateName) !== templateName
  ) {
    return res.status(400).json({ error: "Invalid report_template_name" });
  }

  if (
    !Object.prototype.hasOwnProperty.call(req.body || {}, "pressure_measured")
  ) {
    return res.status(400).json({ error: "pressure_measured is required" });
  }

  const pressureMeasured =
    req.body.pressure_measured == null || req.body.pressure_measured === ""
      ? null
      : String(req.body.pressure_measured).trim() || null;

  try {
    const existing = await prisma.sample_checkin.findUnique({
      where: { id: sampleCheckinId },
      select: { id: true, company_id: true, analysis_number: true },
    });
    if (!existing) {
      return res.status(404).json({ error: "Sample check-in not found" });
    }

    if (
      isCustomerWithCompany(req) &&
      Number(existing.company_id) !== Number(req.user.company_id)
    ) {
      return res.status(403).json({ error: "Forbidden" });
    }

    const templatePath = path.join(TEMPLATE_DIRECTORY, templateName);
    const resolvedTemplatePath = path.resolve(templatePath);
    if (
      path.dirname(resolvedTemplatePath) !== TEMPLATE_DIRECTORY ||
      path.extname(templateName).toLowerCase() !== ".xlsx"
    ) {
      return res.status(400).json({ error: "Invalid report_template_name" });
    }

    try {
      await fs.promises.access(resolvedTemplatePath, fs.constants.R_OK);
    } catch (err) {
      if (err.code === "ENOENT") {
        return res.status(404).json({ error: "Report template not found" });
      }
      throw err;
    }

    await prisma.sample_checkin.update({
      where: { id: sampleCheckinId },
      data: { pressure_measured: pressureMeasured },
    });

    const workbookBuffer = await createAnalysisReportWorkbook(sampleCheckinId, {
      templatePath: resolvedTemplatePath,
      pressureMeasured,
    });

    const fileName = `${existing.analysis_number}-${templateName}`;

    res.set({
      "Content-Type": EXCEL_CONTENT_TYPE,
      "Content-Disposition": `attachment; filename="${fileName}"`,
      "Content-Length": workbookBuffer.length,
      "Access-Control-Expose-Headers": "Content-Disposition",
    });
    return res.send(workbookBuffer);
  } catch (err) {
    logger.error("Failed to update pressure and download report template", {
      message: err?.message,
      code: err?.code,
      meta: err?.meta,
      sampleCheckinId,
      templateName,
    });
    return res.status(500).json({
      error: "Failed to update pressure and download report template",
    });
  }
});

module.exports = router;
