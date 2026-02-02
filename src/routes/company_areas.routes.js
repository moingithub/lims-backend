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

// List company areas
router.get("/", async (req, res) => {
  try {
    const where = {};
    if (isCustomerWithCompany(req)) {
      where.company_id = Number(req.user.company_id);
    }
    const list = await prisma.company_areas.findMany({
      where,
      orderBy: { id: "asc" },
    });
    return res.json(list);
  } catch (err) {
    return res.status(500).json({ error: "Failed to fetch company areas" });
  }
});

// Get company area by id
router.get("/:id", async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0)
    return res.status(400).json({ error: "Invalid id" });

  try {
    const item = await prisma.company_areas.findUnique({ where: { id } });
    if (!item) return res.status(404).json({ error: "Company area not found" });

    if (isCustomerWithCompany(req)) {
      if (Number(item.company_id) !== Number(req.user.company_id)) {
        return res.status(403).json({ error: "Forbidden" });
      }
    }

    return res.json(item);
  } catch (err) {
    return res.status(500).json({ error: "Failed to fetch company area" });
  }
});

// Create company area
router.post("/", authorize("company_areas"), async (req, res) => {
  try {
    if (!req.user || !req.user.userId) {
      return res.status(401).json({ error: "Login required" });
    }
    const { company_id, area, region, description, active } = req.body || {};

    if (!area || !region || !description) {
      return res
        .status(400)
        .json({ error: "area, region and description are required" });
    }

    let companyIdToUse = company_id;
    if (isCustomerWithCompany(req)) {
      companyIdToUse = Number(req.user.company_id);
    }

    if (companyIdToUse == null) {
      return res.status(400).json({ error: "company_id is required" });
    }

    const companyId = Number(companyIdToUse);
    if (!Number.isInteger(companyId) || companyId <= 0)
      return res.status(400).json({ error: "Invalid company_id" });

    // Ensure company exists
    const company = await prisma.companies.findUnique({
      where: { id: companyId },
    });
    if (!company)
      return res.status(400).json({ error: "company_id does not exist" });

    const created = await prisma.company_areas.create({
      data: {
        company: { connect: { id: companyId } },
        area,
        region,
        description,
        active: typeof active === "boolean" ? active : true,
        created_by:
          req.user && req.user.userId
            ? { connect: { id: Number(req.user.userId) } }
            : undefined,
      },
    });

    return res.status(201).json(created);
  } catch (err) {
    if (err && err.code === "P2002") {
      return res
        .status(400)
        .json({ error: "Area already exists for this company" });
    }
    if (err && err.code === "P2003") {
      const detail = prismaErrorDetail(err);
      return res
        .status(400)
        .json({ error: detail || "Invalid reference to related record" });
    }
    if (err && err.code === "P2011") {
      const detail = prismaErrorDetail(err);
      return res
        .status(400)
        .json({ error: detail || "Null constraint violated on a field" });
    }
    const detail = prismaErrorDetail(err);
    if (detail) return res.status(400).json({ error: detail });
    return res.status(500).json({ error: "Failed to create company area" });
  }
});

// Update company area
router.put("/:id", authorize("company_areas"), async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0)
    return res.status(400).json({ error: "Invalid id" });

  try {
    const existing = await prisma.company_areas.findUnique({ where: { id } });
    if (!existing)
      return res.status(404).json({ error: "Company area not found" });

    if (isCustomerWithCompany(req)) {
      if (Number(existing.company_id) !== Number(req.user.company_id)) {
        return res.status(403).json({ error: "Forbidden" });
      }
    }

    const { company_id, area, region, description, active } = req.body || {};

    // If changing company_id, validate
    if (company_id !== undefined && company_id !== null) {
      const newCompanyId = Number(company_id);
      if (!Number.isInteger(newCompanyId) || newCompanyId <= 0)
        return res.status(400).json({ error: "Invalid company_id" });
      if (isCustomerWithCompany(req)) {
        if (Number(req.user.company_id) !== newCompanyId) {
          return res
            .status(403)
            .json({ error: "Forbidden to change to another company" });
        }
      }
      const company = await prisma.companies.findUnique({
        where: { id: newCompanyId },
      });
      if (!company)
        return res.status(400).json({ error: "company_id does not exist" });
    }

    const updated = await prisma.company_areas.update({
      where: { id },
      data: {
        ...(company_id !== undefined
          ? { company: { connect: { id: Number(company_id) } } }
          : {}),
        ...(area !== undefined ? { area } : {}),
        ...(region !== undefined ? { region } : {}),
        ...(description !== undefined ? { description } : {}),
        ...(active !== undefined ? { active: Boolean(active) } : {}),
      },
    });

    return res.json(updated);
  } catch (err) {
    if (err && err.code === "P2002") {
      return res
        .status(400)
        .json({ error: "Area already exists for this company" });
    }
    if (err && err.code === "P2003") {
      const detail = prismaErrorDetail(err);
      return res
        .status(400)
        .json({ error: detail || "Invalid reference to related record" });
    }
    if (err && err.code === "P2025")
      return res.status(404).json({ error: "Company area not found" });
    if (err && err.code === "P2011") {
      const detail = prismaErrorDetail(err);
      return res
        .status(400)
        .json({ error: detail || "Null constraint violated on a field" });
    }
    const detail = prismaErrorDetail(err);
    if (detail) return res.status(400).json({ error: detail });
    return res.status(500).json({ error: "Failed to update company area" });
  }
});

// Delete company area
router.delete("/:id", authorize("company_areas"), async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0)
    return res.status(400).json({ error: "Invalid id" });

  try {
    const existing = await prisma.company_areas.findUnique({ where: { id } });
    if (!existing)
      return res.status(404).json({ error: "Company area not found" });

    if (isCustomerWithCompany(req)) {
      if (Number(existing.company_id) !== Number(req.user.company_id)) {
        return res.status(403).json({ error: "Forbidden" });
      }
    }

    await prisma.company_areas.delete({ where: { id } });
    return res.json({ message: "Company area deleted" });
  } catch (err) {
    if (err && err.code === "P2025")
      return res.status(404).json({ error: "Company area not found" });
    const detail = prismaErrorDetail(err);
    if (detail) return res.status(400).json({ error: detail });
    return res.status(500).json({ error: "Failed to delete company area" });
  }
});

module.exports = router;
