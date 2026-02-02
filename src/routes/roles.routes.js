const express = require("express");
const { prisma, prismaErrorDetail } = require("../lib/common");

const adminOnly = require("../middleware/adminOnly");
const router = express.Router();

// List roles
router.get("/", async (req, res) => {
  try {
    const list = await prisma.roles.findMany({ orderBy: { id: "asc" } });
    return res.json(list);
  } catch (err) {
    return res.status(500).json({ error: "Failed to fetch roles" });
  }
});

// Get role by id
router.get("/:id", async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0)
    return res.status(400).json({ error: "Invalid id" });

  try {
    const item = await prisma.roles.findUnique({ where: { id } });
    if (!item) return res.status(404).json({ error: "Role not found" });
    return res.json(item);
  } catch (err) {
    return res.status(500).json({ error: "Failed to fetch role" });
  }
});

// Create role (admin only)
router.post("/", adminOnly(), async (req, res) => {
  try {
    if (!req.user || !req.user.userId) {
      return res.status(401).json({ error: "Login required" });
    }
    // Accept `name` only (legacy `role`/`role_name` removed)
    const { name, description, active, status } = req.body;
    const roleValue = name;
    if (!roleValue) return res.status(400).json({ error: "name is required" });

    // allow either `active` or legacy `status`; default true
    const isActive =
      typeof active === "boolean"
        ? active
        : typeof status === "boolean"
        ? status
        : true;

    // write into DB field `name` for the role label
    const created = await prisma.roles.create({
      data: {
        name: roleValue,
        description: description ?? "",
        active: isActive,
        created_by:
          req.user && req.user.userId
            ? { connect: { id: Number(req.user.userId) } }
            : undefined,
      },
    });
    return res.status(201).json(created);
  } catch (err) {
    if (err && err.code === "P2002")
      return res.status(400).json({ error: "name must be unique" });
    const detail = prismaErrorDetail(err);
    console.log("Role creation error detail:", detail);
    if (detail) return res.status(400).json({ error: detail });
    return res.status(500).json({
      error: err && err.message ? String(err.message) : "Failed to create role",
    });
  }
});

// Update role (admin only)
router.put("/:id", adminOnly(), async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0)
    return res.status(400).json({ error: "Invalid id" });

  try {
    const { name, description, active, status } = req.body;

    // prefer explicit `active`, fall back to legacy `status` if present
    const activeField =
      active !== undefined
        ? { active: Boolean(active) }
        : status !== undefined
        ? { active: Boolean(status) }
        : {};

    const updatedData = {
      ...(name !== undefined ? { name: name } : {}),
      ...(description !== undefined ? { description } : {}),
      ...activeField,
    };

    const updated = await prisma.roles.update({
      where: { id },
      data: updatedData,
    });
    return res.json(updated);
  } catch (err) {
    if (err && err.code === "P2002")
      return res.status(400).json({ error: "name must be unique" });
    if (err && err.code === "P2025")
      return res.status(404).json({ error: "Role not found" });
    const detail = prismaErrorDetail(err);
    if (detail) return res.status(400).json({ error: detail });
    return res.status(500).json({
      error: err && err.message ? String(err.message) : "Failed to update role",
    });
  }
});

// Delete role (admin only)
router.delete("/:id", adminOnly(), async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0)
    return res.status(400).json({ error: "Invalid id" });

  try {
    await prisma.roles.delete({ where: { id } });
    return res.json({ message: "Role deleted" });
  } catch (err) {
    if (err && err.code === "P2025")
      return res.status(404).json({ error: "Role not found" });
    const detail = prismaErrorDetail(err);
    if (detail) return res.status(400).json({ error: detail });
    return res.status(500).json({
      error: err && err.message ? String(err.message) : "Failed to delete role",
    });
  }
});

module.exports = router;
