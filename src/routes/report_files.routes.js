const express = require("express");
const fs = require("fs");
const path = require("path");
const { prisma, prismaErrorDetail, buildAnalysisReportDownloadFileName } = require("../lib/common");
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

function normalizePressureMeasured(value) {
  if (value == null || value === "") return null;
  return String(value).trim() || null;
}

function normalizeOptionalString(value) {
  if (value == null || value === "") return null;
  return String(value).trim() || null;
}

function parseOptionalDate(value, fieldName) {
  if (value === undefined) return undefined;
  if (value === null || value === "") return null;
  let date;
  if (value instanceof Date) {
    date = value;
  } else if (typeof value === "string") {
    const dayMonthYear = value.trim().match(/^(\d{2})-(\d{2})-(\d{4})$/);
    date = dayMonthYear
      ? new Date(
          Date.UTC(
            Number(dayMonthYear[3]),
            Number(dayMonthYear[2]) - 1,
            Number(dayMonthYear[1]),
          ),
        )
      : new Date(value);
  } else {
    date = new Date(value);
  }
  if (Number.isNaN(date.getTime())) {
    const err = new Error(`Invalid ${fieldName}`);
    err.status = 400;
    throw err;
  }
  return date;
}

const REPORT_FILE_PATCH_FIELD_NAMES = [
  "pressure_measured",
  "status",
  "instrument",
  "analyzed_on",
  "analyzed_by",
  "effective_start_date",
  "effective_end_date",
];

function buildReportFileCheckinUpdateData(body) {
  const data = {};
  let hasAny = false;

  if (Object.prototype.hasOwnProperty.call(body, "pressure_measured")) {
    data.pressure_measured = normalizePressureMeasured(body.pressure_measured);
    hasAny = true;
  }
  if (Object.prototype.hasOwnProperty.call(body, "status")) {
    const status = body.status == null ? "" : String(body.status).trim();
    if (!status) {
      return { error: { status: 400, body: { error: "status cannot be empty" } } };
    }
    data.status = status;
    hasAny = true;
  }
  if (Object.prototype.hasOwnProperty.call(body, "instrument")) {
    data.instrument = normalizeOptionalString(body.instrument);
    hasAny = true;
  }
  if (Object.prototype.hasOwnProperty.call(body, "analyzed_by")) {
    data.analyzed_by = normalizeOptionalString(body.analyzed_by);
    hasAny = true;
  }

  for (const field of [
    "analyzed_on",
    "effective_start_date",
    "effective_end_date",
  ]) {
    if (!Object.prototype.hasOwnProperty.call(body, field)) continue;
    try {
      data[field] = parseOptionalDate(body[field], field);
      hasAny = true;
    } catch (err) {
      if (err?.status === 400) {
        return { error: { status: 400, body: { error: err.message } } };
      }
      throw err;
    }
  }

  return { data, hasAny };
}

async function assertSampleCheckinAccess(req, sampleCheckinId, extraSelect = {}) {
  const existing = await prisma.sample_checkin.findUnique({
    where: { id: sampleCheckinId },
    select: { id: true, company_id: true, ...extraSelect },
  });
  if (!existing) {
    return { error: { status: 404, body: { error: "Sample check-in not found" } } };
  }
  if (
    isCustomerWithCompany(req) &&
    Number(existing.company_id) !== Number(req.user.company_id)
  ) {
    return { error: { status: 403, body: { error: "Forbidden" } } };
  }
  return { existing };
}

router.get("/", authorize("sample_checkin"), async (req, res) => {
  try {
    const where = {};
    if (isCustomerWithCompany(req)) {
      where.company_id = Number(req.user.company_id);
    }

    const rows = await prisma.report_file_list.findMany({
      where,
      orderBy: { sample_checkin_id: "desc" },
    });
    return res.json(rows);
  } catch (err) {
    logger.error("Failed to fetch report file list", {
      message: err?.message,
      code: err?.code,
      meta: err?.meta,
    });
    return res.status(500).json({
      error: "Failed to fetch report file list",
      detail: prismaErrorDetail(err),
    });
  }
});

router.patch(
  "/:sample_checkin_id",
  authorize("sample_checkin"),
  async (req, res) => {
    const sampleCheckinId = Number(req.params.sample_checkin_id);
    if (!Number.isInteger(sampleCheckinId) || sampleCheckinId <= 0) {
      return res.status(400).json({ error: "Invalid sample_checkin_id" });
    }

    const body = req.body || {};
    const buildResult = buildReportFileCheckinUpdateData(body);
    if (buildResult.error) {
      return res
        .status(buildResult.error.status)
        .json(buildResult.error.body);
    }
    if (!buildResult.hasAny) {
      return res.status(400).json({
        error: `At least one of ${REPORT_FILE_PATCH_FIELD_NAMES.join(", ")} is required`,
      });
    }
    const data = buildResult.data;

    try {
      const access = await assertSampleCheckinAccess(req, sampleCheckinId);
      if (access.error) {
        return res.status(access.error.status).json(access.error.body);
      }

      await prisma.sample_checkin.update({
        where: { id: sampleCheckinId },
        data,
      });

      const row = await prisma.report_file_list.findFirst({
        where: { sample_checkin_id: sampleCheckinId },
      });
      if (!row) {
        return res.status(404).json({
          error: "Updated check-in not found in report file list",
        });
      }
      return res.json(row);
    } catch (err) {
      logger.error("Failed to update report file check-in", {
        message: err?.message,
        code: err?.code,
        meta: err?.meta,
        sampleCheckinId,
      });
      const isProd = process.env.NODE_ENV === "production";
      return res.status(500).json({
        error: "Failed to update report file check-in",
        detail: prismaErrorDetail(err) ?? (!isProd ? err?.message : null),
      });
    }
  },
);

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

  try {
    const access = await assertSampleCheckinAccess(req, sampleCheckinId, {
      analysis_number: true,
      well_name: true,
      meter_number: true,
      sample_date: true,
    });
    if (access.error) {
      return res.status(access.error.status).json(access.error.body);
    }
    const existing = access.existing;

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

    const workbookBuffer = await createAnalysisReportWorkbook(sampleCheckinId, {
      templatePath: resolvedTemplatePath,
    });

    const fileName = buildAnalysisReportDownloadFileName(existing);

    res.set({
      "Content-Type": EXCEL_CONTENT_TYPE,
      "Content-Disposition": `attachment; filename="${fileName}"`,
      "Content-Length": workbookBuffer.length,
      "Access-Control-Expose-Headers": "Content-Disposition",
    });
    return res.send(workbookBuffer);
  } catch (err) {
    logger.error("Failed to generate report file", {
      message: err?.message,
      code: err?.code,
      meta: err?.meta,
      sampleCheckinId,
      templateName,
    });
    const message = err?.message || "";
    if (/Cell [A-Z]+\d+ not found/i.test(message)) {
      return res.status(400).json({
        error: message,
        hint:
          "Report template must match the unified cell layout (e.g. B13 for Producer). Try GA 2261 Report Release 2.0.xlsx or re-save the template with cell B13.",
      });
    }
    const isProd = process.env.NODE_ENV === "production";
    return res.status(500).json({
      error: "Failed to generate report file",
      detail: isProd ? undefined : message || err?.message,
    });
  }
});

module.exports = router;
