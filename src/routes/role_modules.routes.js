const express = require("express");
const {
  prisma,
  prismaErrorDetail,
  clearPermissionsCache,
} = require("../lib/common");
const adminOnly = require("../middleware/adminOnly");

const router = express.Router();
const logger = require("../lib/logger");

// GET / - list role_modules (optional filters: role_id, module_id)
router.get("/", async (req, res) => {
  try {
    const { role_id, module_id } = req.query;
    const where = {};
    if (role_id) where.role_id = Number(role_id);
    if (module_id) where.module_id = Number(module_id);

    const items = await prisma.role_modules.findMany({
      where,
      include: { role: true, module: true },
    });
    res.json(items);
  } catch (error) {
    const details = {
      message: error?.message,
      code: error?.code,
      meta: error?.meta,
    };
    logger.error("GET /role_modules error:", details);
    res.status(500).json({ error: "Failed to fetch role_modules", ...details });
  }
});

// GET /:id - get single
router.get("/:id", async (req, res) => {
  try {
    const id = Number(req.params.id);
    const item = await prisma.role_modules.findUnique({
      where: { id },
      include: { role: true, module: true },
    });
    if (!item) return res.status(404).json({ error: "Not found" });
    res.json(item);
  } catch (error) {
    const details = {
      message: error?.message,
      code: error?.code,
      meta: error?.meta,
    };
    logger.error("GET /role_modules/:id error:", details);
    res.status(500).json({ error: "Failed to fetch role_module", ...details });
  }
});

// POST / - create
router.post("/", adminOnly(), async (req, res) => {
  try {
    if (!req.user || !req.user.userId) {
      return res.status(401).json({ error: "Login required" });
    }
    const { role_id, module_id, active = true } = req.body;
    const created = await prisma.role_modules.create({
      data: {
        role_id: Number(role_id),
        module_id: Number(module_id),
        active: active === undefined ? true : Boolean(active),
        created_by: { connect: { id: Number(req.user.userId) } },
      },
      include: { role: true, module: true },
    });
    // refresh permissions cache so authorize() sees the new mapping
    try {
      clearPermissionsCache();
    } catch (e) {
      logger.error("Failed to clear permissions cache after create:", {
        message: e?.message,
      });
    }
    res.status(201).json(created);
  } catch (error) {
    const details = {
      message: error?.message,
      code: error?.code,
      meta: error?.meta,
    };
    logger.error("POST /role_modules error:", details);
    const detail = prismaErrorDetail(error);
    const payload = { error: "Failed to create role_module", ...details };
    if (detail) payload.detail = detail;
    return res.status(500).json(payload);
  }
});

// PUT /:id - update
router.put("/:id", adminOnly(), async (req, res) => {
  try {
    const id = Number(req.params.id);
    const { role_id, module_id, active } = req.body;
    const updated = await prisma.role_modules.update({
      where: { id },
      data: {
        role_id: role_id !== undefined ? Number(role_id) : undefined,
        module_id: module_id !== undefined ? Number(module_id) : undefined,
        active: active !== undefined ? Boolean(active) : undefined,
      },
      include: { role: true, module: true },
    });
    try {
      clearPermissionsCache();
    } catch (e) {
      logger.error("Failed to clear permissions cache after update:", {
        message: e?.message,
      });
    }
    res.json(updated);
  } catch (error) {
    const details = {
      message: error?.message,
      code: error?.code,
      meta: error?.meta,
    };
    logger.error("PUT /role_modules/:id error:", details);
    if (error.code === "P2025")
      return res.status(404).json({ error: "Not found" });
    const detail = prismaErrorDetail(error);
    const payload = { error: "Failed to update role_module", ...details };
    if (detail) payload.detail = detail;
    res.status(500).json(payload);
  }
});

// DELETE /:id - delete
router.delete("/:id", adminOnly(), async (req, res) => {
  try {
    const id = Number(req.params.id);
    await prisma.role_modules.delete({ where: { id } });
    try {
      clearPermissionsCache();
    } catch (e) {
      logger.error("Failed to clear permissions cache after delete:", {
        message: e?.message,
      });
    }
    res.status(204).end();
  } catch (error) {
    const details = {
      message: error?.message,
      code: error?.code,
      meta: error?.meta,
    };
    logger.error("DELETE /role_modules/:id error:", details);
    if (error.code === "P2025")
      return res.status(404).json({ error: "Not found" });
    res.status(500).json({ error: "Failed to delete role_module", ...details });
  }
});

module.exports = router;
