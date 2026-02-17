const express = require("express");
const { prisma, prismaErrorDetail } = require("../lib/common");
const authorize = require("../middleware/authorize");

const router = express.Router();

function isCustomerWithCompany(req) {
  return (
    req &&
    req.user &&
    typeof req.user.role === "string" &&
    req.user.role.trim().toLowerCase() === "customer" &&
    req.user.company_id !== undefined &&
    req.user.company_id !== null
  );
}

// List companies
router.get("/", async (req, res) => {
  try {
    if (isCustomerWithCompany(req)) {
      const list = await prisma.companies.findMany({
        where: { id: Number(req.user.company_id) },
      });
      return res.json(list);
    }

    const list = await prisma.companies.findMany({ orderBy: { id: "asc" } });
    return res.json(list);
  } catch (err) {
    return res.status(500).json({ error: "Failed to fetch companies" });
  }
});

// Get company by id
router.get("/:id", async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0)
    return res.status(400).json({ error: "Invalid id" });

  try {
    if (isCustomerWithCompany(req)) {
      if (Number(req.user.company_id) !== id)
        return res.status(403).json({ error: "Forbidden" });
    }

    const item = await prisma.companies.findUnique({ where: { id } });
    if (!item) return res.status(404).json({ error: "Company not found" });
    return res.json(item);
  } catch (err) {
    return res.status(500).json({ error: "Failed to fetch company" });
  }
});

// Create company
router.post("/", authorize("companies"), async (req, res) => {
  try {
    if (!req.user || !req.user.userId) {
      return res.status(401).json({ error: "Login required" });
    }
    const {
      code,
      name,
      phone,
      email,
      billing_ref,
      billing_ref_no,
      billing_address,
      active,
    } = req.body;

    if (!code || !name) {
      return res.status(400).json({ error: "code and name are required" });
    }

    const created = await prisma.companies.create({
      data: {
        code,
        name,
        phone,
        email,
        billing_ref: billing_ref ?? null,
        billing_ref_no: billing_ref_no ?? null,
        billing_address: billing_address ?? null,
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
      return res.status(400).json({ error: "code or name must be unique" });
    const detail = prismaErrorDetail(err);
    if (detail) return res.status(400).json({ error: detail });
    return res.status(500).json({ error: "Failed to create company" });
  }
});

// Update company
router.put("/:id", authorize("companies"), async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0)
    return res.status(400).json({ error: "Invalid id" });

  try {
    if (isCustomerWithCompany(req)) {
      if (Number(req.user.company_id) !== id)
        return res.status(403).json({ error: "Forbidden" });
    }

    const {
      code,
      name,
      phone,
      email,
      billing_ref,
      billing_ref_no,
      billing_address,
      active,
    } = req.body;

    const updated = await prisma.companies.update({
      where: { id },
      data: {
        ...(code !== undefined ? { code } : {}),
        ...(name !== undefined ? { name } : {}),
        ...(phone !== undefined ? { phone } : {}),
        ...(email !== undefined ? { email } : {}),
        ...(billing_ref !== undefined ? { billing_ref } : {}),
        ...(billing_ref_no !== undefined ? { billing_ref_no } : {}),
        ...(billing_address !== undefined ? { billing_address } : {}),
        ...(active !== undefined ? { active: Boolean(active) } : {}),
      },
    });

    return res.json(updated);
  } catch (err) {
    if (err && err.code === "P2002")
      return res.status(400).json({ error: "code or name must be unique" });
    if (err && err.code === "P2025")
      return res.status(404).json({ error: "Company not found" });
    const detail = prismaErrorDetail(err);
    if (detail) return res.status(400).json({ error: detail });
    return res.status(500).json({ error: "Failed to update company" });
  }
});

// Delete company
router.delete("/:id", authorize("companies"), async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0)
    return res.status(400).json({ error: "Invalid id" });

  try {
    if (isCustomerWithCompany(req)) {
      if (Number(req.user.company_id) !== id)
        return res.status(403).json({ error: "Forbidden" });
    }

    await prisma.companies.delete({ where: { id } });
    return res.json({ message: "Company deleted" });
  } catch (err) {
    if (err && err.code === "P2025")
      return res.status(404).json({ error: "Company not found" });
    const detail = prismaErrorDetail(err);
    if (detail) return res.status(400).json({ error: detail });
    return res.status(500).json({ error: "Failed to delete company" });
  }
});

module.exports = router;
