const express = require("express");
const { prisma, prismaErrorDetail } = require("../lib/common");
const authorize = require("../middleware/authorize");
const logger = require("../lib/logger");

const router = express.Router();

function parseRequiredInt(value, fieldName) {
  const num = Number(value);
  if (!Number.isInteger(num)) {
    const err = new Error(`${fieldName} must be an integer`);
    err.status = 400;
    throw err;
  }
  return num;
}

function parseOptionalDecimal(value) {
  if (value === undefined || value === null || value === "") return null;
  const num = Number(value);
  if (!Number.isFinite(num)) {
    const err = new Error("Invalid molecular_weight");
    err.status = 400;
    throw err;
  }
  return num;
}

function trimOptionalText(value) {
  if (value === undefined || value === null) return null;
  const trimmed = String(value).trim();
  return trimmed || null;
}

function trimRequiredText(value, fieldName, maxLength) {
  const trimmed = String(value ?? "").trim();
  if (!trimmed) {
    const err = new Error(`${fieldName} is required`);
    err.status = 400;
    throw err;
  }
  if (maxLength && trimmed.length > maxLength) {
    const err = new Error(`${fieldName} must be at most ${maxLength} characters`);
    err.status = 400;
    throw err;
  }
  return trimmed;
}

// List gas components
router.get("/", async (req, res) => {
  try {
    const activeOnly = String(req.query.active_only || "").toLowerCase() === "true";
    const list = await prisma.gas_component_master.findMany({
      where: activeOnly ? { is_active: true } : undefined,
      orderBy: [{ display_order: "asc" }, { component_code: "asc" }],
    });
    return res.json(list);
  } catch (err) {
    return res.status(500).json({ error: "Failed to fetch gas components" });
  }
});

// Get by id
router.get("/:id", async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) {
    return res.status(400).json({ error: "Invalid id" });
  }

  try {
    const item = await prisma.gas_component_master.findUnique({
      where: { component_id: id },
    });
    if (!item) {
      return res.status(404).json({ error: "Gas component not found" });
    }
    return res.json(item);
  } catch (err) {
    return res.status(500).json({ error: "Failed to fetch gas component" });
  }
});

// Create gas component
router.post("/", authorize("gas_component_master"), async (req, res) => {
  try {
    if (!req.user?.userId) {
      return res.status(401).json({ error: "Login required" });
    }

    const {
      component_code,
      component_name,
      chemical_formula,
      calculation_formula,
      comments,
      display_order,
      is_active,
      molecular_weight,
      has_gpm,
    } = req.body || {};

    const created = await prisma.gas_component_master.create({
      data: {
        component_code: trimRequiredText(component_code, "component_code", 10),
        component_name: trimRequiredText(component_name, "component_name", 100),
        chemical_formula: trimOptionalText(chemical_formula)?.slice(0, 50) ?? null,
        calculation_formula: trimOptionalText(calculation_formula),
        comments: trimOptionalText(comments),
        display_order: parseRequiredInt(display_order, "display_order"),
        is_active: typeof is_active === "boolean" ? is_active : true,
        molecular_weight: parseOptionalDecimal(molecular_weight),
        has_gpm: typeof has_gpm === "boolean" ? has_gpm : false,
      },
    });
    return res.status(201).json(created);
  } catch (err) {
    if (err?.status === 400) {
      return res.status(400).json({ error: err.message });
    }
    if (err?.code === "P2002") {
      return res.status(400).json({ error: "component_code must be unique" });
    }
    const detail = prismaErrorDetail(err);
    if (detail) return res.status(400).json({ error: detail });
    logger.error("create gas_component_master failed:", {
      message: err?.message,
      code: err?.code,
      meta: err?.meta,
    });
    return res.status(500).json({ error: "Failed to create gas component" });
  }
});

// Update gas component
router.put("/:id", authorize("gas_component_master"), async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) {
    return res.status(400).json({ error: "Invalid id" });
  }

  try {
    const {
      component_code,
      component_name,
      chemical_formula,
      calculation_formula,
      comments,
      display_order,
      is_active,
      molecular_weight,
      has_gpm,
    } = req.body || {};

    const updateData = {};
    if (component_code !== undefined) {
      updateData.component_code = trimRequiredText(
        component_code,
        "component_code",
        10,
      );
    }
    if (component_name !== undefined) {
      updateData.component_name = trimRequiredText(
        component_name,
        "component_name",
        100,
      );
    }
    if (chemical_formula !== undefined) {
      updateData.chemical_formula =
        trimOptionalText(chemical_formula)?.slice(0, 50) ?? null;
    }
    if (calculation_formula !== undefined) {
      updateData.calculation_formula = trimOptionalText(calculation_formula);
    }
    if (comments !== undefined) {
      updateData.comments = trimOptionalText(comments);
    }
    if (display_order !== undefined) {
      updateData.display_order = parseRequiredInt(display_order, "display_order");
    }
    if (is_active !== undefined) {
      updateData.is_active = Boolean(is_active);
    }
    if (molecular_weight !== undefined) {
      updateData.molecular_weight = parseOptionalDecimal(molecular_weight);
    }
    if (has_gpm !== undefined) {
      updateData.has_gpm = Boolean(has_gpm);
    }

    const updated = await prisma.gas_component_master.update({
      where: { component_id: id },
      data: updateData,
    });
    return res.json(updated);
  } catch (err) {
    if (err?.status === 400) {
      return res.status(400).json({ error: err.message });
    }
    if (err?.code === "P2002") {
      return res.status(400).json({ error: "component_code must be unique" });
    }
    if (err?.code === "P2025") {
      return res.status(404).json({ error: "Gas component not found" });
    }
    const detail = prismaErrorDetail(err);
    if (detail) return res.status(400).json({ error: detail });
    logger.error("update gas_component_master failed:", {
      message: err?.message,
      code: err?.code,
      meta: err?.meta,
    });
    return res.status(500).json({ error: "Failed to update gas component" });
  }
});

// Delete gas component
router.delete("/:id", authorize("gas_component_master"), async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) {
    return res.status(400).json({ error: "Invalid id" });
  }

  try {
    await prisma.gas_component_master.delete({ where: { component_id: id } });
    return res.json({ message: "Gas component deleted" });
  } catch (err) {
    if (err?.code === "P2025") {
      return res.status(404).json({ error: "Gas component not found" });
    }
    return res.status(500).json({ error: "Failed to delete gas component" });
  }
});

module.exports = router;
