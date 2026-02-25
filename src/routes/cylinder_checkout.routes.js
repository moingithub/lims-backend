const express = require("express");
const { prisma, prismaErrorDetail } = require("../lib/common");
const authorize = require("../middleware/authorize");

const router = express.Router();

// GET /open - fetch open checkouts from the view
router.get("/open", async (req, res) => {
  try {
    // Optionally, restrict by company if customer
    let where = {};
    if (isCustomerWithCompany(req)) {
      where.company_name = req.user.company_name || undefined;
    }
    // Prisma exposes views as model-like objects
    const openCheckouts = await prisma.open_checkout.findMany({
      where,
      orderBy: { id: "asc" },
    });
    return res.json(openCheckouts);
  } catch (err) {
    return res.status(500).json({ error: "Failed to fetch open checkouts" });
  }
});

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

// List cylinder checkouts (optional filter by is_returned via query param)
router.get("/", async (req, res) => {
  try {
    const where = {};
    if (isCustomerWithCompany(req)) {
      where.company_id = Number(req.user.company_id);
    }
    if (req.query.is_returned !== undefined) {
      const v = String(req.query.is_returned).trim().toLowerCase();
      if (["true", "false"].includes(v)) where.is_returned = v === "true";
    }
    const list = await prisma.cylinder_checkout.findMany({
      where,
      orderBy: { id: "asc" },
    });
    return res.json(list);
  } catch (err) {
    return res
      .status(500)
      .json({ error: "Failed to fetch cylinder checkouts" });
  }
});

// Get by id
router.get("/:id", async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0)
    return res.status(400).json({ error: "Invalid id" });
  try {
    const item = await prisma.cylinder_checkout.findUnique({ where: { id } });
    if (!item) return res.status(404).json({ error: "Checkout not found" });
    if (isCustomerWithCompany(req)) {
      if (Number(item.company_id) !== Number(req.user.company_id))
        return res.status(403).json({ error: "Forbidden" });
    }
    return res.json(item);
  } catch (err) {
    return res.status(500).json({ error: "Failed to fetch checkout" });
  }
});

// Create checkout
router.post("/", authorize("cylinder_checkout"), async (req, res) => {
  try {
    if (!req.user || !req.user.userId) {
      return res.status(401).json({ error: "Login required" });
    }
    const {
      cylinder_id,
      company_id,
      company_contact_id,
      is_returned,
      returned_at,
      active, // ignored: no active field on model, but tolerate input
    } = req.body || {};

    // Required foreign keys
    if (cylinder_id == null || company_contact_id == null) {
      return res
        .status(400)
        .json({ error: "cylinder_id and company_contact_id are required" });
    }

    let companyIdToUse = company_id;
    if (isCustomerWithCompany(req))
      companyIdToUse = Number(req.user.company_id);
    if (companyIdToUse == null) {
      return res.status(400).json({ error: "company_id is required" });
    }

    const cylId = Number(cylinder_id);
    const compId = Number(companyIdToUse);
    const contactId = Number(company_contact_id);
    if (!Number.isInteger(cylId) || cylId <= 0)
      return res.status(400).json({ error: "Invalid cylinder_id" });
    if (!Number.isInteger(compId) || compId <= 0)
      return res.status(400).json({ error: "Invalid company_id" });
    if (!Number.isInteger(contactId) || contactId <= 0)
      return res.status(400).json({ error: "Invalid company_contact_id" });

    // Validate existence
    const [cylinder, company, contact] = await Promise.all([
      prisma.cylinders.findUnique({ where: { id: cylId } }),
      prisma.companies.findUnique({ where: { id: compId } }),
      prisma.company_contacts.findUnique({ where: { id: contactId } }),
    ]);
    if (!cylinder)
      return res.status(400).json({ error: "cylinder_id does not exist" });
    if (!company)
      return res.status(400).json({ error: "company_id does not exist" });
    if (!contact)
      return res
        .status(400)
        .json({ error: "company_contact_id does not exist" });
    if (Number(contact.company_id) !== compId) {
      return res
        .status(400)
        .json({ error: "company_contact does not belong to company_id" });
    }

    // If creating as returned, ensure returned_at present
    let returnedAtToUse = returned_at ?? null;
    const isReturnedFlag =
      typeof is_returned === "boolean" ? is_returned : false;
    if (isReturnedFlag && !returnedAtToUse) returnedAtToUse = new Date();

    // Business rule: only one open checkout per cylinder (is_returned=false)
    if (!isReturnedFlag) {
      const existingOpen = await prisma.cylinder_checkout.findFirst({
        where: { cylinder_id: cylId, is_returned: false },
      });
      if (existingOpen) {
        return res.status(400).json({ error: "Open checkout already exists" });
      }
    }

    const created = await prisma.cylinder_checkout.create({
      data: {
        cylinder_id: cylId,
        company_id: compId,
        company_contact_id: contactId,
        is_returned: isReturnedFlag,
        returned_at: returnedAtToUse,
        created_by:
          req.user && req.user.userId
            ? { connect: { id: Number(req.user.userId) } }
            : undefined,
      },
    });
    return res.status(201).json(created);
  } catch (err) {
    if (err && err.code === "P2002") {
      // Unique on [cylinder_id, is_returned]
      return res.status(400).json({
        error: "Duplicate checkout for this cylinder",
      });
    }
    const detail = prismaErrorDetail(err);
    if (detail) return res.status(400).json({ error: detail });
    return res.status(500).json({ error: "Failed to create checkout" });
  }
});

// Update checkout (allow marking returned, changing contact)
router.put("/:id", authorize("cylinder_checkout"), async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0)
    return res.status(400).json({ error: "Invalid id" });
  try {
    const existing = await prisma.cylinder_checkout.findUnique({
      where: { id },
    });
    if (!existing) return res.status(404).json({ error: "Checkout not found" });

    if (isCustomerWithCompany(req)) {
      if (Number(existing.company_id) !== Number(req.user.company_id))
        return res.status(403).json({ error: "Forbidden" });
    }

    const {
      cylinder_id,
      company_id,
      company_contact_id,
      is_returned,
      returned_at,
    } = req.body || {};

    const updates = {};
    // cylinder change validation
    if (cylinder_id !== undefined) {
      const newCylId = Number(cylinder_id);
      if (!Number.isInteger(newCylId) || newCylId <= 0)
        return res.status(400).json({ error: "Invalid cylinder_id" });
      const cyl = await prisma.cylinders.findUnique({
        where: { id: newCylId },
      });
      if (!cyl)
        return res.status(400).json({ error: "cylinder_id does not exist" });
      updates.cylinder_id = newCylId;
    }

    // company change validation
    if (company_id !== undefined) {
      const newCompId = Number(company_id);
      if (!Number.isInteger(newCompId) || newCompId <= 0)
        return res.status(400).json({ error: "Invalid company_id" });
      if (
        isCustomerWithCompany(req) &&
        Number(req.user.company_id) !== newCompId
      )
        return res.status(403).json({ error: "Forbidden to change company" });
      const comp = await prisma.companies.findUnique({
        where: { id: newCompId },
      });
      if (!comp)
        return res.status(400).json({ error: "company_id does not exist" });
      updates.company_id = newCompId;
    }

    // contact change validation
    if (company_contact_id !== undefined) {
      const newContactId = Number(company_contact_id);
      if (!Number.isInteger(newContactId) || newContactId <= 0)
        return res.status(400).json({ error: "Invalid company_contact_id" });
      const contact = await prisma.company_contacts.findUnique({
        where: { id: newContactId },
      });
      if (!contact)
        return res
          .status(400)
          .json({ error: "company_contact_id does not exist" });
      const compId = updates.company_id ?? existing.company_id;
      if (Number(contact.company_id) !== Number(compId)) {
        return res
          .status(400)
          .json({ error: "company_contact does not belong to company_id" });
      }
      updates.company_contact_id = newContactId;
    }

    // returned flags
    if (is_returned !== undefined) {
      updates.is_returned = Boolean(is_returned);
      if (updates.is_returned && returned_at === undefined) {
        updates.returned_at = new Date();
      }
    }
    if (returned_at !== undefined) {
      updates.returned_at = returned_at ? new Date(returned_at) : null;
    }

    const updated = await prisma.cylinder_checkout.update({
      where: { id },
      data: updates,
    });
    return res.json(updated);
  } catch (err) {
    if (err && err.code === "P2002") {
      return res
        .status(400)
        .json({ error: "Unique constraint on cylinder_id, is_returned" });
    }
    if (err && err.code === "P2025")
      return res.status(404).json({ error: "Checkout not found" });
    const detail = prismaErrorDetail(err);
    if (detail) return res.status(400).json({ error: detail });
    return res.status(500).json({ error: "Failed to update checkout" });
  }
});

// Delete checkout
router.delete("/:id", authorize("cylinder_checkout"), async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0)
    return res.status(400).json({ error: "Invalid id" });
  try {
    const existing = await prisma.cylinder_checkout.findUnique({
      where: { id },
    });
    if (!existing) return res.status(404).json({ error: "Checkout not found" });
    if (isCustomerWithCompany(req)) {
      if (Number(existing.company_id) !== Number(req.user.company_id))
        return res.status(403).json({ error: "Forbidden" });
    }
    await prisma.cylinder_checkout.delete({ where: { id } });
    return res.json({ message: "Checkout deleted" });
  } catch (err) {
    if (err && err.code === "P2025")
      return res.status(404).json({ error: "Checkout not found" });
    const detail = prismaErrorDetail(err);
    if (detail) return res.status(400).json({ error: detail });
    return res.status(500).json({ error: "Failed to delete checkout" });
  }
});

module.exports = router;
