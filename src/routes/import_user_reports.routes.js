const express = require("express");
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const { prisma, prismaErrorDetail } = require("../lib/common");
const authorize = require("../middleware/authorize");
const {
  SOURCE_MACHINE,
  DEFAULT_ANALYSIS_POSITION,
  parseUserReportExcel,
} = require("../lib/parseUserReportExcel");
const {
  insertUserReportAnalysisResultMetrics,
} = require("../lib/insertAnalysisResultMetrics");

const router = express.Router();

const UPLOAD_DIR = path.join(__dirname, "..", "..", "uploads", "user_reports");
const ALLOWED_MIME_TYPES = new Set([
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.ms-excel",
  "application/octet-stream",
]);
const ALLOWED_EXTENSIONS = new Set([".xlsx", ".xls"]);
const MAX_FILE_SIZE = 10 * 1024 * 1024;
const VALID_STATUSES = new Set(["Imported", "Validated", "Error", "Archived"]);

if (!fs.existsSync(UPLOAD_DIR)) {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}

const upload = multer({
  storage: multer.diskStorage({
    destination: UPLOAD_DIR,
    filename: (_req, file, cb) => {
      cb(null, `${Date.now()}-${file.originalname}`);
    },
  }),
  fileFilter: (_req, file, cb) => {
    const ext = path.extname(file.originalname.toLowerCase()).toLowerCase();
    if (ALLOWED_EXTENSIONS.has(ext) || ALLOWED_MIME_TYPES.has(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error("Only Excel (.xlsx, .xls) files are allowed"), false);
    }
  },
  limits: { fileSize: MAX_FILE_SIZE },
});

const IMPORT_RECORD_INCLUDE = {
  created_by: { select: { id: true, name: true } },
  company: { select: { name: true } },
  _count: { select: { results: true } },
};

function parseOptionalInt(value, fieldName) {
  if (value === undefined || value === null || value === "") return undefined;
  const num = Number(value);
  if (!Number.isInteger(num) || num <= 0) {
    const err = new Error(`Invalid ${fieldName}`);
    err.status = 400;
    throw err;
  }
  return num;
}

async function resolveCompanyPressureSettings(companyId) {
  const company = await prisma.companies.findUnique({
    where: { id: companyId },
    select: {
      pressure_base: true,
      pressure_base_factor: true,
    },
  });
  if (!company) {
    const err = new Error("company_id does not exist");
    err.status = 400;
    throw err;
  }
  return {
    pressureBase: Number(company.pressure_base),
    pressureBaseFactor: Number(company.pressure_base_factor),
  };
}

async function generateImportId(client = prisma) {
  const last = await client.import_machine_reports.findFirst({
    orderBy: { id: "desc" },
    select: { import_id: true },
  });
  if (!last?.import_id) return "IMP-001";
  const match = last.import_id.match(/^IMP-(\d+)$/);
  const next = match ? Number(match[1]) + 1 : 1;
  return `IMP-${String(next).padStart(3, "0")}`;
}

function mapRecord(row, extras = {}) {
  return {
    id: row.id,
    import_id: row.import_id,
    source_machine: row.source_machine,
    status: row.status,
    file_name: row.file_name,
    method_name: row.method_name ?? null,
    company_id: row.company_id ?? null,
    company_name: row.company?.name ?? null,
    pressure_base: row.pressure_base ?? null,
    pressure_base_factor: row.pressure_base_factor ?? null,
    result_count: row._count?.results ?? row.result_count ?? undefined,
    uploaded_by: row.created_by?.name || "Unknown",
    imported_date_time: row.created_at.toISOString(),
    created_by: row.created_by_id,
    ...extras,
  };
}

async function importUserReportFromFile({
  filePath,
  originalName,
  createdById,
  companyId,
  pressureBase,
  pressureBaseFactor,
  sampleCheckinId,
}) {
  const parsed = await parseUserReportExcel(filePath);
  const analysisPosition =
    parsed.analysis_position ?? DEFAULT_ANALYSIS_POSITION;

  return prisma.$transaction(async (tx) => {
    let checkin = null;
    if (sampleCheckinId != null) {
      checkin = await tx.sample_checkin.findUnique({
        where: { id: sampleCheckinId },
        select: {
          id: true,
          analysis_number: true,
          analysis_position: true,
          company_id: true,
        },
      });
      if (!checkin) {
        const err = new Error("sample_checkin_id does not exist");
        err.status = 400;
        throw err;
      }
    } else if (parsed.analysis_number) {
      checkin = await tx.sample_checkin.findUnique({
        where: { analysis_number: String(parsed.analysis_number) },
        select: {
          id: true,
          analysis_number: true,
          analysis_position: true,
          company_id: true,
        },
      });
    }

    const resolvedCompanyId = companyId ?? checkin?.company_id ?? null;
    const resolvedPosition = checkin?.analysis_position ?? analysisPosition;

    const import_id = await generateImportId(tx);
    const created = await tx.import_machine_reports.create({
      data: {
        import_id,
        source_machine: SOURCE_MACHINE,
        status: "Imported",
        file_name: originalName,
        stored_file_name: path.basename(filePath),
        method_name: parsed.method_name,
        ...(resolvedCompanyId != null
          ? {
              company_id: resolvedCompanyId,
              pressure_base:
                pressureBase ?? parsed.pressure_base ?? 0,
              pressure_base_factor: pressureBaseFactor ?? 0,
            }
          : parsed.pressure_base != null
            ? { pressure_base: parsed.pressure_base }
            : {}),
        created_by_id: createdById,
      },
      include: IMPORT_RECORD_INCLUDE,
    });

    await tx.machine_report_results.createMany({
      data: parsed.components.map((row) => ({
        import_machine_report_id: created.id,
        analysis_position: resolvedPosition,
        sample_time: parsed.analyzed_on,
        sample_name: parsed.analysis_number,
        component: row.component,
        component_description: row.component_description || row.component,
        method_name: parsed.method_name,
        normalized_concentration: null,
        concentration: null,
        normalized: row.mol_pct,
        mol_pct: row.mol_pct,
        wt_pct: row.wt_pct,
        gpm: row.gpm,
        dry_gross_ideal: null,
        wet_sample_ideal: null,
      })),
    });

    await insertUserReportAnalysisResultMetrics(tx, {
      import_machine_report_id: created.id,
      analysis_position: resolvedPosition,
      analysisResults: parsed.analysis_results,
      gpmSummary: parsed.gpm_summary,
    });

    let linkedSampleCheckinId = null;
    if (checkin) {
      await tx.sample_checkin.update({
        where: { id: checkin.id },
        data: {
          import_machine_report_id: created.id,
          analysis_position: resolvedPosition,
        },
      });
      linkedSampleCheckinId = checkin.id;
    }

    const record = await tx.import_machine_reports.findUnique({
      where: { id: created.id },
      include: IMPORT_RECORD_INCLUDE,
    });

    return {
      record,
      linked_sample_checkin_id: linkedSampleCheckinId,
      analysis_number: parsed.analysis_number,
      analysis_position: resolvedPosition,
    };
  });
}

// List user Excel import records only
router.get("/", async (_req, res) => {
  try {
    const rows = await prisma.import_machine_reports.findMany({
      where: { source_machine: SOURCE_MACHINE },
      orderBy: { created_at: "desc" },
      include: IMPORT_RECORD_INCLUDE,
    });
    return res.json(rows.map((row) => mapRecord(row)));
  } catch (err) {
    return res.status(500).json({
      error: "Failed to fetch import user reports",
      detail: prismaErrorDetail(err),
    });
  }
});

// Upload user Excel report → existing result/metrics tables
router.post(
  "/",
  authorize("import_user_report"),
  upload.single("file"),
  async (req, res) => {
    if (!req.user?.userId) {
      return res.status(401).json({ error: "Login required" });
    }
    if (!req.file) {
      return res.status(400).json({ error: "File is required" });
    }

    try {
      const companyId = parseOptionalInt(req.body?.company_id, "company_id");
      const sampleCheckinId = parseOptionalInt(
        req.body?.sample_checkin_id,
        "sample_checkin_id",
      );

      let pressureBase;
      let pressureBaseFactor;
      if (companyId != null) {
        const companyPressure = await resolveCompanyPressureSettings(companyId);
        pressureBase = companyPressure.pressureBase;
        pressureBaseFactor = companyPressure.pressureBaseFactor;
      }

      const result = await importUserReportFromFile({
        filePath: req.file.path,
        originalName: req.file.originalname,
        createdById: Number(req.user.userId),
        companyId,
        pressureBase,
        pressureBaseFactor,
        sampleCheckinId,
      });

      return res.status(201).json(
        mapRecord(result.record, {
          linked_sample_checkin_id: result.linked_sample_checkin_id,
          analysis_number: result.analysis_number,
          analysis_position: result.analysis_position,
        }),
      );
    } catch (err) {
      if (req.file?.path && fs.existsSync(req.file.path)) {
        fs.unlinkSync(req.file.path);
      }
      if (err?.status === 400) {
        return res.status(400).json({ error: err.message });
      }
      if (err?.name === "PrismaClientValidationError") {
        return res.status(400).json({
          error: "Invalid user report import data",
          detail: err.message,
        });
      }
      return res.status(500).json({
        error: "Failed to upload user report",
        detail: prismaErrorDetail(err),
      });
    }
  },
);

router.put(
  "/:id/status",
  authorize("import_user_report"),
  async (req, res) => {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) {
      return res.status(400).json({ error: "Invalid id" });
    }

    const status = String(req.body?.status || "").trim();
    if (!VALID_STATUSES.has(status)) {
      return res.status(400).json({ error: "Invalid status" });
    }

    try {
      const existing = await prisma.import_machine_reports.findFirst({
        where: { id, source_machine: SOURCE_MACHINE },
      });
      if (!existing) {
        return res.status(404).json({ error: "Import record not found" });
      }

      const updated = await prisma.import_machine_reports.update({
        where: { id },
        data: { status },
        include: IMPORT_RECORD_INCLUDE,
      });
      return res.json(mapRecord(updated));
    } catch (err) {
      return res.status(500).json({
        error: "Failed to update import record status",
        detail: prismaErrorDetail(err),
      });
    }
  },
);

router.delete("/:id", authorize("import_user_report"), async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) {
    return res.status(400).json({ error: "Invalid id" });
  }

  try {
    const existing = await prisma.import_machine_reports.findFirst({
      where: { id, source_machine: SOURCE_MACHINE },
    });
    if (!existing) {
      return res.status(404).json({ error: "Import record not found" });
    }

    await prisma.import_machine_reports.delete({ where: { id } });

    const filePath = path.join(UPLOAD_DIR, existing.stored_file_name);
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }

    return res.json({ message: "Import record deleted" });
  } catch (err) {
    return res.status(500).json({
      error: "Failed to delete import record",
      detail: prismaErrorDetail(err),
    });
  }
});

module.exports = router;
