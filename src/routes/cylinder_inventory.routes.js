const express = require("express");
const { prisma } = require("../lib/common");
const router = express.Router();

// Status logic from user
const getStatusFromLocation = (location) => {
  switch (location) {
    case "Clean Cylinder":
      return "Available";
    case "Checked Out":
      return "In Use";
    case "Checked In":
      return "In Use";
    default:
      return "Unknown";
  }
};

// GET /api/cylinder-inventory
router.get("/", async (req, res) => {
  try {
    // Get all cylinders
    const cylinders = await prisma.cylinders.findMany({
      orderBy: { id: "asc" },
    });

    // Get all active checkouts (not returned)
    const checkouts = await prisma.cylinder_checkout.findMany({
      where: { is_returned: false },
    });

    // Get all companies (for lookup)
    const companies = await prisma.companies.findMany();
    const companyMap = {};
    companies.forEach((c) => {
      companyMap[c.id] = c;
    });

    // Map cylinder id to checkout
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
      let location = cyl.location;
      if (checkout) {
        const company = companyMap[checkout.company_id];
        issued_to = company ? company.name : "";
        email = company ? company.email || "" : "";
        location = "Checked Out";
        const since = Math.floor(
          (now - checkout.created_at) / (1000 * 60 * 60 * 24),
        );
        since_days = since;
      }
      return {
        id: cyl.id,
        cylinder_number: cyl.cylinder_number,
        cylinder_type: cyl.cylinder_type,
        location,
        status: getStatusFromLocation(location),
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
