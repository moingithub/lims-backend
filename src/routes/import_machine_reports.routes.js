const express = require("express");
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const { prisma, prismaErrorDetail } = require("../lib/common");
const authorize = require("../middleware/authorize");
const {
  parseMachineReportJson,
  isJsonMachineReportFile,
} = require("../lib/parseMachineReportJson");
const {
  buildComponentMasterMap,
  buildFieldH2sByPosition,
  prependH2sRows,
  computeDerivedFields,
  applyComponentDescriptions,
} = require("../lib/computeMachineReportFields");

const router = express.Router();

const UPLOAD_DIR = path.join(
  __dirname,
  "..",
  "..",
  "uploads",
  "machine_reports",
);
const ALLOWED_SOURCE_MACHINES = ["Inficon GC", "Scion GC"];
const ALLOWED_MIME_TYPES = new Set([
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.ms-excel",
  "text/csv",
  "application/csv",
  "application/json",
  "text/json",
  "application/octet-stream",
]);
const ALLOWED_EXTENSIONS = new Set([
  ".xlsx",
  ".xls",
  ".csv",
  ".json",
  ".fusion-data",
]);
const MAX_FILE_SIZE = 10 * 1024 * 1024;

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
    const name = file.originalname.toLowerCase();
    const ext = path.extname(name).toLowerCase();
    if (
      ALLOWED_EXTENSIONS.has(ext) ||
      name.endsWith(".fusion-data") ||
      ALLOWED_MIME_TYPES.has(file.mimetype)
    ) {
      cb(null, true);
    } else {
      cb(
        new Error(
          "Only Excel, CSV, JSON, or FUSION-DATA (.fusion-data) files are allowed",
        ),
        false,
      );
    }
  },
  limits: { fileSize: MAX_FILE_SIZE },
});

const VALID_STATUSES = new Set(["Imported", "Validated", "Error", "Archived"]);

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

function mapRecord(row) {
  return {
    id: row.id,
    import_id: row.import_id,
    source_machine: row.source_machine,
    status: row.status,
    file_name: row.file_name,
    method_name: row.method_name ?? null,
    result_count: row._count?.results ?? row.result_count ?? undefined,
    uploaded_by: row.created_by?.name || "Unknown",
    imported_date_time: row.created_at.toISOString(),
    created_by: row.created_by_id,
  };
}

async function importMachineReportFromFile({
  filePath,
  originalName,
  sourceMachine,
  createdById,
}) {
  let parsed = null;
  if (isJsonMachineReportFile(originalName)) {
    const content = fs.readFileSync(filePath, "utf8");
    parsed = parseMachineReportJson(content);
  }

  return prisma.$transaction(async (tx) => {
    const import_id = await generateImportId(tx);
    const created = await tx.import_machine_reports.create({
      data: {
        import_id,
        source_machine: sourceMachine,
        status: "Imported",
        file_name: originalName,
        stored_file_name: path.basename(filePath),
        method_name: parsed?.method_name ?? null,
        created_by_id: createdById,
      },
      include: {
        created_by: { select: { id: true, name: true } },
        _count: { select: { results: true } },
      },
    });

    if (parsed?.results?.length) {
      const positions = [
        ...new Set(parsed.results.map((row) => row.analysis_position)),
      ];
      const checkins = await tx.sample_checkin.findMany({
        where: { analysis_position: { in: positions } },
        select: {
          analysis_position: true,
          field_h2s: true,
          analysis_number: true,
        },
      });
      const fieldH2sByPosition = buildFieldH2sByPosition(
        checkins,
        parsed.results,
      );
      const gasComponents = await tx.gas_component_master.findMany({
        where: { is_active: true },
      });
      const componentMasterMap = buildComponentMasterMap(gasComponents);
      const resultsWithH2s = prependH2sRows(parsed.results, fieldH2sByPosition);
      const resultsWithDerived = computeDerivedFields(
        resultsWithH2s,
        componentMasterMap,
      );
      const resultsWithDescriptions = applyComponentDescriptions(
        resultsWithDerived,
        componentMasterMap,
      );
      await tx.machine_report_results.createMany({
        data: resultsWithDescriptions.map((row) => ({
          import_machine_report_id: created.id,
          analysis_position: row.analysis_position,
          sample_time: row.sample_time,
          sample_name: row.sample_name,
          component: row.component,
          component_description: row.component_description,
          method_name: row.method_name,
          normalized_concentration: row.normalized_concentration,
          concentration: row.concentration,
          normalized: row.normalized,
          mol_pct: row.mol_pct,
          wt_pct: row.wt_pct,
          gpm: row.gpm,
        })),
      });
    }

    return tx.import_machine_reports.findUnique({
      where: { id: created.id },
      include: {
        created_by: { select: { id: true, name: true } },
        _count: { select: { results: true } },
      },
    });
  });
}

// List import records
router.get("/", async (_req, res) => {
  try {
    const rows = await prisma.import_machine_reports.findMany({
      orderBy: { created_at: "desc" },
      include: {
        created_by: { select: { id: true, name: true } },
        _count: { select: { results: true } },
      },
    });
    return res.json(rows.map(mapRecord));
  } catch (err) {
    return res.status(500).json({
      error: "Failed to fetch import machine reports",
      detail: prismaErrorDetail(err),
    });
  }
});

// Upload machine report file
router.post(
  "/",
  authorize("import_machine_report"),
  upload.single("file"),
  async (req, res) => {
    if (!req.user?.userId) {
      return res.status(401).json({ error: "Login required" });
    }
    if (!req.file) {
      return res.status(400).json({ error: "File is required" });
    }

    const sourceMachine = String(req.body?.source_machine || "").trim();
    if (!sourceMachine) {
      if (req.file.path) fs.unlinkSync(req.file.path);
      return res.status(400).json({ error: "source_machine is required" });
    }
    if (!ALLOWED_SOURCE_MACHINES.includes(sourceMachine)) {
      if (req.file.path) fs.unlinkSync(req.file.path);
      return res.status(400).json({ error: "Invalid source_machine" });
    }

    try {
      const created = await importMachineReportFromFile({
        filePath: req.file.path,
        originalName: req.file.originalname,
        sourceMachine,
        createdById: Number(req.user.userId),
      });
      return res.status(201).json(mapRecord(created));
    } catch (err) {
      if (req.file?.path && fs.existsSync(req.file.path)) {
        fs.unlinkSync(req.file.path);
      }
      if (err instanceof SyntaxError || err.message?.includes("JSON")) {
        return res.status(400).json({
          error: "Invalid machine report JSON",
          detail: err.message,
        });
      }
      if (
        err.message?.includes("No machine report results") ||
        err.message?.includes("missing detectors")
      ) {
        return res.status(400).json({
          error: "Invalid machine report JSON",
          detail: err.message,
        });
      }
      return res.status(500).json({
        error: "Failed to upload machine report",
        detail: prismaErrorDetail(err),
      });
    }
  },
);

// Update status (archive, validate, etc.)
router.put(
  "/:id/status",
  authorize("import_machine_report"),
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
      const existing = await prisma.import_machine_reports.findUnique({
        where: { id },
      });
      if (!existing) {
        return res.status(404).json({ error: "Import record not found" });
      }

      const updated = await prisma.import_machine_reports.update({
        where: { id },
        data: { status },
        include: { created_by: { select: { id: true, name: true } } },
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

// Delete import record and stored file
router.delete("/:id", authorize("import_machine_report"), async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) {
    return res.status(400).json({ error: "Invalid id" });
  }

  try {
    const existing = await prisma.import_machine_reports.findUnique({
      where: { id },
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
