const express = require("express");
const { prisma, prismaErrorDetail } = require("../lib/common");
const authorize = require("../middleware/authorize");

const router = express.Router();

// List analysis pricing
router.get("/", async (req, res) => {
  try {
    const list = await prisma.analysis_pricing.findMany({
      orderBy: { id: "asc" },
    });
    return res.json(list);
  } catch (err) {
    return res.status(500).json({ error: "Failed to fetch analysis pricing" });
  }
});

// Get by id
router.get("/:id", async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0)
    return res.status(400).json({ error: "Invalid id" });

  try {
    const item = await prisma.analysis_pricing.findUnique({ where: { id } });
    if (!item)
      return res.status(404).json({ error: "Analysis pricing not found" });
    return res.json(item);
  } catch (err) {
    return res.status(500).json({ error: "Failed to fetch analysis pricing" });
  }
});

// Create analysis pricing
router.post("/", authorize("analysis_pricing"), async (req, res) => {
  try {
    if (!req.user || !req.user.userId) {
      return res.status(401).json({ error: "Login required" });
    }
    const {
      analysis_type,
      description,
      standard_rate,
      rushed_rate,
      sample_fee,
      active,
    } = req.body || {};

    if (
      !analysis_type ||
      standard_rate == null ||
      rushed_rate == null ||
      sample_fee == null
    ) {
      return res.status(400).json({
        error:
          "analysis_type, standard_rate, rushed_rate and sample_fee are required",
      });
    }

    const created = await prisma.analysis_pricing.create({
      data: {
        analysis_type,
        description: description ?? null,
        standard_rate: standard_rate,
        rushed_rate: rushed_rate,
        sample_fee: sample_fee,
        active: typeof active === "boolean" ? active : true,
        created_by:
          req.user && req.user.userId
            ? { connect: { id: Number(req.user.userId) } }
            : undefined,
      },
    });
    return res.status(201).json(created);
  } catch (err) {
    if (err && err.code === "P2002")
      return res.status(400).json({ error: "analysis_type must be unique" });
    const detail = prismaErrorDetail(err);
    if (detail) return res.status(400).json({ error: detail });
    return res.status(500).json({ error: "Failed to create analysis pricing" });
  }
});

// Update analysis pricing
router.put("/:id", authorize("analysis_pricing"), async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0)
    return res.status(400).json({ error: "Invalid id" });

  try {
    const {
      analysis_type,
      description,
      standard_rate,
      rushed_rate,
      sample_fee,
      active,
    } = req.body || {};

    const updated = await prisma.analysis_pricing.update({
      where: { id },
      data: {
        ...(analysis_type !== undefined ? { analysis_type } : {}),
        ...(description !== undefined ? { description } : {}),
        ...(standard_rate !== undefined ? { standard_rate } : {}),
        ...(rushed_rate !== undefined ? { rushed_rate } : {}),
        ...(sample_fee !== undefined ? { sample_fee } : {}),
        ...(active !== undefined ? { active: Boolean(active) } : {}),
      },
    });
    return res.json(updated);
  } catch (err) {
    if (err && err.code === "P2002")
      return res.status(400).json({ error: "analysis_type must be unique" });
    if (err && err.code === "P2025")
      return res.status(404).json({ error: "Analysis pricing not found" });
    const detail = prismaErrorDetail(err);
    if (detail) return res.status(400).json({ error: detail });
    return res.status(500).json({ error: "Failed to update analysis pricing" });
  }
});

// Delete analysis pricing
router.delete("/:id", authorize("analysis_pricing"), async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0)
    return res.status(400).json({ error: "Invalid id" });

  try {
    await prisma.analysis_pricing.delete({ where: { id } });
    return res.json({ message: "Analysis pricing deleted" });
  } catch (err) {
    if (err && err.code === "P2025")
      return res.status(404).json({ error: "Analysis pricing not found" });
    return res.status(500).json({ error: "Failed to delete analysis pricing" });
  }
});

module.exports = router;
