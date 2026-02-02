const express = require("express");
const { prisma } = require("../lib/common");
const authorize = require("../middleware/authorize");

const router = express.Router();

// List modules
router.get("/", async (req, res) => {
  try {
    const list = await prisma.modules.findMany({ orderBy: { id: "asc" } });
    return res.json(list);
  } catch (err) {
    return res.status(500).json({ error: "Failed to fetch modules" });
  }
});

// Get module by id
router.get("/:id", async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0)
    return res.status(400).json({ error: "Invalid id" });

  try {
    const item = await prisma.modules.findUnique({ where: { id } });
    if (!item) return res.status(404).json({ error: "Module not found" });
    return res.json(item);
  } catch (err) {
    return res.status(500).json({ error: "Failed to fetch module" });
  }
});

// Create module
router.post("/", authorize("modules"), async (req, res) => {
  try {
    if (!req.user || !req.user.userId) {
      return res.status(401).json({ error: "Login required" });
    }
    // Accept either `module_name` (legacy) or `name` (new)
    const { module_name, name, description, active } = req.body;
    const moduleName = module_name ?? name;
    if (!moduleName) return res.status(400).json({ error: "name is required" });

    const created = await prisma.modules.create({
      data: {
        name: moduleName,
        description: description ?? "",
        active: typeof active === "boolean" ? active : true,
        created_by: { connect: { id: Number(req.user.userId) } },
      },
    });
    return res.status(201).json(created);
  } catch (err) {
    console.error(err);
    if (err && err.code === "P2002")
      return res.status(400).json({ error: "name must be unique" });
    return res.status(500).json({ error: "Failed to create module" });
  }
});

// Update module
router.put("/:id", authorize("modules"), async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0)
    return res.status(400).json({ error: "Invalid id" });

  try {
    // Accept either `module_name` (legacy) or `name` (new)
    const { module_name, name, description, active } = req.body;
    const updatedData = {
      ...(module_name !== undefined ? { name: module_name } : {}),
      ...(name !== undefined ? { name } : {}),
      ...(description !== undefined ? { description } : {}),
      ...(active !== undefined ? { active: Boolean(active) } : {}),
    };

    const updated = await prisma.modules.update({
      where: { id },
      data: updatedData,
    });
    return res.json(updated);
  } catch (err) {
    if (err && err.code === "P2002")
      return res.status(400).json({ error: "name must be unique" });
    if (err && err.code === "P2025")
      return res.status(404).json({ error: "Module not found" });
    return res.status(500).json({ error: "Failed to update module" });
  }
});

// Delete module
router.delete("/:id", authorize("modules"), async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0)
    return res.status(400).json({ error: "Invalid id" });

  try {
    await prisma.modules.delete({ where: { id } });
    return res.json({ message: "Module deleted" });
  } catch (err) {
    if (err && err.code === "P2025")
      return res.status(404).json({ error: "Module not found" });
    return res.status(500).json({ error: "Failed to delete module" });
  }
});

module.exports = router;
