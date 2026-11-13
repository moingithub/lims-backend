const express = require("express");
const {
  prisma,
  prismaErrorDetail,
  sendDeleteErrorResponse,
  getAllowedValuesFromConstraints,
  normalizeToAllowed,
} = require("../lib/common");
const authorize = require("../middleware/authorize");

const router = express.Router();
const DEFAULT_CYLINDER_STATUS = "Clean Cylinder";

async function resolveAllowedCylinderStatus() {
  return (
    (await getAllowedValuesFromConstraints("cylinders", "status")) || [
      "Clean Cylinder",
      "Checked Out",
      "Checked In",
    ]
  );
}

async function validateCylinderStatus(status, { required = false } = {}) {
  const raw =
    status === undefined || status === null ? "" : String(status).trim();
  if (!raw) {
    if (required) {
      return { error: "status is required" };
    }
    return { value: DEFAULT_CYLINDER_STATUS };
  }
  const allowed = await resolveAllowedCylinderStatus();
  const finalStatus = normalizeToAllowed(raw, allowed);
  if (!allowed.includes(finalStatus)) {
    return {
      error:
        allowed.length > 0
          ? `Invalid status. Allowed: ${allowed.join(", ")}`
          : "Invalid status",
    };
  }
  return { value: finalStatus };
}

// List cylinders
router.get("/", async (req, res) => {
  try {
    const list = await prisma.cylinders.findMany({ orderBy: { id: "asc" } });
    return res.json(list);
  } catch (err) {
    return res.status(500).json({ error: "Failed to fetch cylinders" });
  }
});

// Get cylinder by id
router.get("/:id", async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0)
    return res.status(400).json({ error: "Invalid id" });
  try {
    const item = await prisma.cylinders.findUnique({ where: { id } });
    if (!item) return res.status(404).json({ error: "Cylinder not found" });
    return res.json(item);
  } catch (err) {
    return res.status(500).json({ error: "Failed to fetch cylinder" });
  }
});

// Create cylinder
router.post("/", authorize("cylinders"), async (req, res) => {
  try {
    if (!req.user || !req.user.userId) {
      return res.status(401).json({ error: "Login required" });
    }
    const { cylinder_number, cylinder_type, track_inventory, status, active } =
      req.body || {};

    if (!cylinder_number || !cylinder_type) {
      return res.status(400).json({
        error: "cylinder_number and cylinder_type are required",
      });
    }

    // Normalize and validate cylinder_type against DB CHECK constraint
    const allowedCylinderTypes =
      (await getAllowedValuesFromConstraints("cylinders", "cylinder_type")) ||
      [];
    const finalCylinderType = normalizeToAllowed(
      cylinder_type,
      allowedCylinderTypes,
    );
    if (!allowedCylinderTypes.includes(finalCylinderType)) {
      return res.status(400).json({
        error:
          allowedCylinderTypes.length > 0
            ? `Invalid cylinder_type. Allowed: ${allowedCylinderTypes.join(
                ", ",
              )}`
            : "Invalid cylinder_type",
      });
    }

    const statusResult = await validateCylinderStatus(status);
    if (statusResult.error) {
      return res.status(400).json({ error: statusResult.error });
    }

    const created = await prisma.cylinders.create({
      data: {
        cylinder_number,
        cylinder_type: finalCylinderType,
        track_inventory:
          typeof track_inventory === "boolean" ? track_inventory : true,
        status: statusResult.value,
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
      return res.status(400).json({ error: "cylinder_number must be unique" });
    const detail = prismaErrorDetail(err);
    console.log("ERR", err);
    if (detail) return res.status(400).json({ error: detail });
    return res.status(500).json({ error: "Failed to create cylinder" });
  }
});

// Update cylinder
router.put("/:id", authorize("cylinders"), async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0)
    return res.status(400).json({ error: "Invalid id" });

  try {
    const { cylinder_number, cylinder_type, track_inventory, status, active } =
      req.body || {};

    const updates = {};
    if (cylinder_number !== undefined)
      updates.cylinder_number = cylinder_number;
    if (typeof track_inventory !== "undefined")
      updates.track_inventory = Boolean(track_inventory);
    if (typeof active !== "undefined") updates.active = Boolean(active);

    if (cylinder_type !== undefined) {
      const allowedCylinderTypes =
        (await getAllowedValuesFromConstraints("cylinders", "cylinder_type")) ||
        [];
      const finalCylinderType = normalizeToAllowed(
        cylinder_type,
        allowedCylinderTypes,
      );
      if (!allowedCylinderTypes.includes(finalCylinderType)) {
        return res.status(400).json({
          error:
            allowedCylinderTypes.length > 0
              ? `Invalid cylinder_type. Allowed: ${allowedCylinderTypes.join(
                  ", ",
                )}`
              : "Invalid cylinder_type",
        });
      }
      updates.cylinder_type = finalCylinderType;
    }

    if (status !== undefined) {
      const statusResult = await validateCylinderStatus(status, {
        required: true,
      });
      if (statusResult.error) {
        return res.status(400).json({ error: statusResult.error });
      }
      updates.status = statusResult.value;
    }

    const updated = await prisma.cylinders.update({
      where: { id },
      data: updates,
    });
    return res.json(updated);
  } catch (err) {
    if (err && err.code === "P2002")
      return res.status(400).json({ error: "cylinder_number must be unique" });
    if (err && err.code === "P2025")
      return res.status(404).json({ error: "Cylinder not found" });
    const detail = prismaErrorDetail(err);
    if (detail) return res.status(400).json({ error: detail });
    return res.status(500).json({ error: "Failed to update cylinder" });
  }
});

// Delete cylinder
router.delete("/:id", authorize("cylinders"), async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0)
    return res.status(400).json({ error: "Invalid id" });

  try {
    await prisma.cylinders.delete({ where: { id } });
    return res.json({ message: "Cylinder deleted" });
  } catch (err) {
    return sendDeleteErrorResponse(res, err, {
      notFoundLabel: "Cylinder",
      inUseName: "cylinder",
      fallbackError: "Failed to delete cylinder",
    });
  }
});

module.exports = router;
