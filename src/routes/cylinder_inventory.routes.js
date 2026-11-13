const express = require("express");
const { prisma } = require("../lib/common");
const router = express.Router();

const KNOWN_CYLINDER_STATUSES = new Set([
  "Clean Cylinder",
  "Checked Out",
  "Checked In",
]);

function normalizeInventoryStatus(status) {
  if (status == null || String(status).trim() === "") return "Unknown";
  const text = String(status).trim();
  return KNOWN_CYLINDER_STATUSES.has(text) ? text : "Unknown";
}

// GET /api/cylinder-inventory
router.get("/", async (req, res) => {
  try {
    const cylinders = await prisma.cylinders.findMany({
      where: { active: true },
      orderBy: { id: "asc" },
    });

    const checkouts = await prisma.cylinder_checkout.findMany({
      where: { is_returned: false },
    });

    const companies = await prisma.companies.findMany();
    const companyMap = {};
    companies.forEach((c) => {
      companyMap[c.id] = c;
    });

    const checkoutMap = {};
    checkouts.forEach((co) => {
      checkoutMap[co.cylinder_id] = co;
    });

    const now = new Date();
    const result = cylinders.map((cyl) => {
      const checkout = checkoutMap[cyl.id];
      let issued_to = "";
      let since_days = "";
      let email = "";
      let status = normalizeInventoryStatus(cyl.status);
      if (checkout) {
        const company = companyMap[checkout.company_id];
        issued_to = company ? company.name : "";
        email = company ? company.email || "" : "";
        status = "Checked Out";
        since_days = Math.floor(
          (now - checkout.created_at) / (1000 * 60 * 60 * 24),
        );
      }
      return {
        id: cyl.id,
        cylinder_number: cyl.cylinder_number,
        cylinder_type: cyl.cylinder_type,
        status,
        issued_to,
        since_days,
        email,
      };
    });
    res.json(result);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch cylinder inventory" });
  }
});

module.exports = router;
