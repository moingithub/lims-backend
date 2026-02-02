const express = require("express");
const {
  prisma,
  prismaErrorDetail,
  getAllowedValuesFromConstraints,
  normalizeToAllowed,
} = require("../lib/common");
const authorize = require("../middleware/authorize");

const router = express.Router();

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
    const {
      cylinder_number,
      cylinder_type,
      track_inventory,
      location,
      active,
    } = req.body || {};

    if (!cylinder_number || !cylinder_type || !location) {
      return res.status(400).json({
        error: "cylinder_number, cylinder_type and location are required",
      });
    }

    // Normalize and validate cylinder_type against DB CHECK constraint
    const allowedCylinderTypes =
      (await getAllowedValuesFromConstraints("cylinders", "cylinder_type")) ||
      [];
    const finalCylinderType = normalizeToAllowed(
      cylinder_type,
      allowedCylinderTypes
    );
    if (!allowedCylinderTypes.includes(finalCylinderType)) {
      return res.status(400).json({
        error:
          allowedCylinderTypes.length > 0
            ? `Invalid cylinder_type. Allowed: ${allowedCylinderTypes.join(
                ", "
              )}`
            : "Invalid cylinder_type",
      });
    }

    // Normalize and validate location against DB CHECK constraint
    const allowedLocations =
      (await getAllowedValuesFromConstraints("cylinders", "location")) || [];
    const finalLocation = normalizeToAllowed(location, allowedLocations);
    if (!allowedLocations.includes(finalLocation)) {
      return res.status(400).json({
        error:
          allowedLocations.length > 0
            ? `Invalid location. Allowed: ${allowedLocations.join(", ")}`
            : "Invalid location",
      });
    }

    const created = await prisma.cylinders.create({
      data: {
        cylinder_number,
        cylinder_type: finalCylinderType,
        track_inventory:
          typeof track_inventory === "boolean" ? track_inventory : true,
        location: finalLocation,
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
    const {
      cylinder_number,
      cylinder_type,
      track_inventory,
      location,
      active,
    } = req.body || {};

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
        allowedCylinderTypes
      );
      if (!allowedCylinderTypes.includes(finalCylinderType)) {
        return res.status(400).json({
          error:
            allowedCylinderTypes.length > 0
              ? `Invalid cylinder_type. Allowed: ${allowedCylinderTypes.join(
                  ", "
                )}`
              : "Invalid cylinder_type",
        });
      }
      updates.cylinder_type = finalCylinderType;
    }

    if (location !== undefined) {
      const allowedLocations =
        (await getAllowedValuesFromConstraints("cylinders", "location")) || [];
      const finalLocation = normalizeToAllowed(location, allowedLocations);
      if (!allowedLocations.includes(finalLocation)) {
        return res.status(400).json({
          error:
            allowedLocations.length > 0
              ? `Invalid location. Allowed: ${allowedLocations.join(", ")}`
              : "Invalid location",
        });
      }
      updates.location = finalLocation;
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
    if (err && err.code === "P2025")
      return res.status(404).json({ error: "Cylinder not found" });
    return res.status(500).json({ error: "Failed to delete cylinder" });
  }
});

module.exports = router;
