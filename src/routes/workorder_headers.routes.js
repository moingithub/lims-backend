const express = require("express");
const { prisma } = require("../lib/common");
const router = express.Router();
// router initialization moved to top, remove duplicate

// Update workorder_header by work_order_number
router.put("/by-number/:work_order_number", async (req, res) => {
  const work_order_number = req.params.work_order_number;
  if (!work_order_number)
    return res.status(400).json({ error: "work_order_number is required" });
  try {
    const {
      company_id,
      work_order_date,
      work_order_number: new_work_order_number,
      cylinders,
      mileage_fee,
      miscellaneous_charges,
      hourly_fee,
      status,
      created_by_id,
      created_at,
      updated_at,
    } = req.body;

    // Validate new work_order_number exists in sample_checkin if updating
    if (
      new_work_order_number !== undefined &&
      new_work_order_number !== work_order_number
    ) {
      const exists = await prisma.sample_checkin.findFirst({
        where: { work_order_number: new_work_order_number },
        select: { id: true },
      });
      if (!exists) {
        return res.status(400).json({
          error: "work_order_number does not exist in sample_checkin",
        });
      }
    }

    const updated = await prisma.workorder_headers.update({
      where: { work_order_number },
      data: {
        company_id,
        work_order_date,
        work_order_number: new_work_order_number ?? work_order_number,
        cylinders,
        mileage_fee,
        miscellaneous_charges,
        hourly_fee,
        status,
        created_by_id,
        created_at,
        updated_at,
      },
    });
    res.json(updated);
  } catch (err) {
    if (
      err.code === "P2002" &&
      err.meta &&
      err.meta.target &&
      err.meta.target.includes("work_order_number")
    ) {
      return res.status(400).json({
        error: "Unique constraint failed on the fields: (work_order_number)",
      });
    }
    if (err.code === "P2025") {
      return res.status(404).json({ error: "workorder_header not found" });
    }
    res.status(500).json({
      error: "Failed to update workorder_header",
      detail: err.message,
    });
  }
});
// Duplicate require and router initialization removed

// Update workorder_header by work_order_number
router.put("/by-number/:work_order_number", async (req, res) => {
  const work_order_number = req.params.work_order_number;
  if (!work_order_number)
    return res.status(400).json({ error: "work_order_number is required" });
  try {
    const {
      company_id,
      work_order_date,
      work_order_number: new_work_order_number,
      cylinders,
      mileage_fee,
      miscellaneous_charges,
      hourly_fee,
      status,
      created_by_id,
      created_at,
      updated_at,
    } = req.body;

    // Validate new work_order_number exists in sample_checkin if updating
    if (
      new_work_order_number !== undefined &&
      new_work_order_number !== work_order_number
    ) {
      const exists = await prisma.sample_checkin.findFirst({
        where: { work_order_number: new_work_order_number },
        select: { id: true },
      });
      if (!exists) {
        return res.status(400).json({
          error: "work_order_number does not exist in sample_checkin",
        });
      }
    }

    const updated = await prisma.workorder_headers.update({
      where: { work_order_number },
      data: {
        company_id,
        work_order_date,
        work_order_number: new_work_order_number ?? work_order_number,
        cylinders,
        mileage_fee,
        miscellaneous_charges,
        hourly_fee,
        status,
        created_by_id,
        created_at,
        updated_at,
      },
    });
    res.json(updated);
  } catch (err) {
    if (
      err.code === "P2002" &&
      err.meta &&
      err.meta.target &&
      err.meta.target.includes("work_order_number")
    ) {
      return res.status(400).json({
        error: "Unique constraint failed on the fields: (work_order_number)",
      });
    }
    if (err.code === "P2025") {
      return res.status(404).json({ error: "workorder_header not found" });
    }
    res.status(500).json({
      error: "Failed to update workorder_header",
      detail: err.message,
    });
  }
});

// Get workorder_header by work_order_number
router.get("/by-number/:work_order_number", async (req, res) => {
  const work_order_number = req.params.work_order_number;
  if (!work_order_number)
    return res.status(400).json({ error: "work_order_number is required" });
  try {
    const item = await prisma.workorder_headers.findUnique({
      where: { work_order_number },
    });
    if (!item) return res.status(404).json({ error: "Not found" });
    res.json(item);
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch workorder_header" });
  }
});

// List workorder_headers for invoice
router.get("/for_invoice", async (req, res) => {
  try {
    // Fetch workorder_headers where status is 'Submitted'
    const headers = await prisma.workorder_headers.findMany({
      where: { status: "Submitted" },
      include: {
        company: { select: { name: true } },
      },
    });

    // For each header, fetch sample_checkin items
    const result = await Promise.all(
      headers.map(async (header) => {
        // Fetch sample_checkin items for this work_order_number
        const items = await prisma.sample_checkin.findMany({
          where: { work_order_number: header.work_order_number },
          select: {
            id: true,
            cylinder_number: true,
            analysis_number: true,
            meter_number: true,
            well_name: true,
            rushed: true,
            created_by: true,
            analysis_type_id: true,
            analysis_pricing: {
              select: {
                analysis_type: true,
                standard_rate: true,
                rushed_rate: true,
                sample_fee: true,
              },
            },
          },
        });

        // Map items to required format
        const mappedItems = items.map((item) => {
          // Calculate price
          const price = item.rushed
            ? Number(item.analysis_pricing?.rushed_rate || 0)
            : Number(item.analysis_pricing?.standard_rate || 0);
          const sampleFee = Number(item.analysis_pricing?.sample_fee || 0);
          return {
            id: item.id,
            cylinder_number: item.cylinder_number,
            analysis_number: item.analysis_number,
            analysis_type: item.analysis_pricing?.analysis_type || null,
            meter_number: item.meter_number,
            well_name: item.well_name,
            rushed: Boolean(item.rushed),
            price: price + sampleFee,
          };
        });

        // Calculate total amount
        const amount = mappedItems.reduce((sum, i) => sum + (i.price || 0), 0);

        // Status logic: if status is 'Pending', return 'Price Verified'
        let status = header.status;
        if (status === "Pending") status = "Price Verified";

        return {
          id: header.id,
          work_order_number: header.work_order_number,
          company_id: header.company_id,
          company_name: header.company?.name || null,
          date: header.work_order_date
            ? header.work_order_date.toISOString().split("T")[0]
            : null,
          cylinders: header.cylinders,
          amount,
          status,
          mileage_fee: header.mileage_fee,
          miscellaneous_charges: header.miscellaneous_charges,
          hourly_fee: header.hourly_fee,
          billing_reference_type: header.billing_reference_type || null,
          billing_reference_number: header.billing_reference_number || null,
          created_by: header.created_by_id,
          items: mappedItems,
        };
      }),
    );
    res.json(result);
  } catch (err) {
    res.status(500).json({
      error: "Failed to fetch workorder_headers for invoice",
      detail: err.message,
    });
  }
});

// List all workorder_headers
router.get("/", async (req, res) => {
  try {
    const items = await prisma.workorder_headers.findMany();
    res.json(items);
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch workorder_headers" });
  }
});

// Get workorder_header by id
router.get("/:id", async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0)
    return res.status(400).json({ error: "Invalid id" });
  try {
    const item = await prisma.workorder_headers.findUnique({ where: { id } });
    if (!item) return res.status(404).json({ error: "Not found" });
    res.json(item);
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch workorder_header" });
  }
});

// Create workorder_header
router.post("/", async (req, res) => {
  try {
    const {
      company_id,
      work_order_date,
      work_order_number,
      cylinders,
      mileage_fee,
      miscellaneous_charges,
      hourly_fee,
      status,
      created_by_id,
      created_at,
      updated_at,
    } = req.body;

    // Validate work_order_number exists in sample_checkin
    const exists = await prisma.sample_checkin.findFirst({
      where: { work_order_number: work_order_number },
      select: { id: true },
    });
    if (!exists) {
      return res
        .status(400)
        .json({ error: "work_order_number does not exist in sample_checkin" });
    }

    const created = await prisma.workorder_headers.create({
      data: {
        company_id,
        work_order_date,
        work_order_number,
        cylinders,
        mileage_fee,
        miscellaneous_charges,
        hourly_fee,
        status,
        created_by_id,
        created_at,
        updated_at,
      },
    });
    res.status(201).json(created);
  } catch (err) {
    if (
      err.code === "P2002" &&
      err.meta &&
      err.meta.target &&
      err.meta.target.includes("work_order_number")
    ) {
      return res.status(400).json({
        error: "Unique constraint failed on the fields: (work_order_number)",
      });
    }
    res.status(500).json({
      error: "Failed to create workorder_header",
      detail: err.message,
    });
  }
});

// Update workorder_header
router.put("/:id", async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0)
    return res.status(400).json({ error: "Invalid id" });
  try {
    const {
      company_id,
      work_order_date,
      work_order_number,
      cylinders,
      mileage_fee,
      miscellaneous_charges,
      hourly_fee,
      status,
      created_by_id,
      created_at,
      updated_at,
    } = req.body;

    // Validate work_order_number exists in sample_checkin
    if (work_order_number !== undefined) {
      const exists = await prisma.sample_checkin.findFirst({
        where: { work_order_number: work_order_number },
        select: { id: true },
      });
      if (!exists) {
        return res.status(400).json({
          error: "work_order_number does not exist in sample_checkin",
        });
      }
    }

    const updated = await prisma.workorder_headers.update({
      where: { id },
      data: {
        company_id,
        work_order_date,
        work_order_number,
        cylinders,
        mileage_fee,
        miscellaneous_charges,
        hourly_fee,
        status,
        created_by_id,
        created_at,
        updated_at,
      },
    });
    res.json(updated);
  } catch (err) {
    if (
      err.code === "P2002" &&
      err.meta &&
      err.meta.target &&
      err.meta.target.includes("work_order_number")
    ) {
      return res.status(400).json({
        error: "Unique constraint failed on the fields: (work_order_number)",
      });
    }
    res.status(500).json({
      error: "Failed to update workorder_header",
      detail: err.message,
    });
  }
});

// Delete workorder_header
router.delete("/:id", async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0)
    return res.status(400).json({ error: "Invalid id" });
  try {
    await prisma.workorder_headers.delete({ where: { id } });
    res.json({ message: "Deleted" });
  } catch (err) {
    res.status(500).json({
      error: "Failed to delete workorder_header",
      detail: err.message,
    });
  }
});

// Delete workorder_header by work_order_number
router.delete("/by-number/:work_order_number", async (req, res) => {
  const work_order_number = req.params.work_order_number;
  if (!work_order_number)
    return res.status(400).json({ error: "work_order_number is required" });
  try {
    const deleted = await prisma.workorder_headers.delete({
      where: { work_order_number },
    });
    res.json({ message: "Deleted", deleted });
  } catch (err) {
    if (err.code === "P2025") {
      return res.status(404).json({ error: "workorder_header not found" });
    }
    res.status(500).json({
      error: "Failed to delete workorder_header",
      detail: err.message,
    });
  }
});

module.exports = router;
