const express = require("express");
const { prisma } = require("../lib/common");
const router = express.Router();

// Helper: generate invoice_number like INV-20260309-0001
async function generateInvoiceNumber() {
  const datePart = new Date().toISOString().slice(0, 10).replace(/-/g, "");
  const prefix = `INV-${datePart}-`;
  const last = await prisma.invoice_headers.findFirst({
    where: { invoice_number: { startsWith: prefix } },
    orderBy: { invoice_number: "desc" },
    select: { invoice_number: true },
  });
  const seq = last
    ? String(Number(last.invoice_number.split("-")[2]) + 1).padStart(4, "0")
    : "0001";
  return `${prefix}${seq}`;
}

// POST /invoices — create invoice with lines
router.post("/", async (req, res) => {
  const {
    company_id,
    invoice_date,
    service_start_date,
    service_end_date,
    po_number,
    location,
    authorized_by,
    miles,
    rate_per_mile,
    mileage_fee,
    miscellaneous_charges,
    hourly_fee,
    subtotal,
    tax_amount,
    total_amount,
    status,
    payment_status,
    invoiceLines = [],
  } = req.body;

  if (!company_id || !invoice_date) {
    return res
      .status(400)
      .json({ error: "company_id and invoice_date are required" });
  }

  try {
    const invoice_number = await generateInvoiceNumber();

    const invoice = await prisma.invoice_headers.create({
      data: {
        company_id,
        invoice_number,
        invoice_date: new Date(invoice_date),
        service_start_date: service_start_date
          ? new Date(service_start_date)
          : null,
        service_end_date: service_end_date ? new Date(service_end_date) : null,
        po_number,
        location,
        authorized_by,
        miles,
        rate_per_mile,
        mileage_fee: mileage_fee ?? Number(miles) * Number(rate_per_mile),
        miscellaneous_charges,
        hourly_fee,
        subtotal,
        tax_amount,
        total_amount,
        status,
        payment_status,
        invoiceLines: {
          create: invoiceLines.map((line) => ({
            sample_checkin_id: line.sample_checkin_id,
            analysis_number: String(line.analysis_number),
            description: line.description,
            service_date: line.service_date
              ? new Date(line.service_date)
              : null,
            report_number: line.report_number,
            analysis_method: line.analysis_method,
            quantity: line.quantity,
            unit_price: line.unit_price,
            amount: line.amount,
          })),
        },
      },
      include: { invoiceLines: true },
    });

    res.status(201).json(invoice);
  } catch (err) {
    if (err.code === "P2002") {
      return res.status(400).json({
        error: "Unique constraint violation",
        detail: err.meta?.target,
      });
    }
    if (err.code === "P2003") {
      return res.status(400).json({
        error: "Foreign key constraint failed",
        detail: err.meta?.field_name,
      });
    }
    res
      .status(500)
      .json({ error: "Failed to create invoice", detail: err.message });
  }
});

// GET /invoices/list — invoice list view
router.get("/list", async (req, res) => {
  try {
    const invoices = await prisma.invoice_list.findMany({
      orderBy: { invoice_date: "desc" },
    });
    res.json(invoices);
  } catch (err) {
    res
      .status(500)
      .json({ error: "Failed to fetch invoice list", detail: err.message });
  }
});

// GET /invoices — list all invoices
router.get("/", async (req, res) => {
  try {
    const invoices = await prisma.invoice_headers.findMany({
      orderBy: { created_at: "desc" },
      include: {
        company: { select: { id: true, name: true } },
        invoiceLines: true,
      },
    });
    res.json(invoices);
  } catch (err) {
    res
      .status(500)
      .json({ error: "Failed to fetch invoices", detail: err.message });
  }
});

// GET /invoices/:id — get single invoice with lines
router.get("/:id", async (req, res) => {
  const id = Number(req.params.id);
  if (isNaN(id)) return res.status(400).json({ error: "Invalid id" });
  try {
    const invoice = await prisma.invoice_headers.findUnique({
      where: { id },
      include: {
        company: { select: { id: true, name: true } },
        invoiceLines: true,
      },
    });
    if (!invoice) return res.status(404).json({ error: "Invoice not found" });
    res.json(invoice);
  } catch (err) {
    res
      .status(500)
      .json({ error: "Failed to fetch invoice", detail: err.message });
  }
});

// PUT /invoices/:id — update invoice header + replace lines
router.put("/:id", async (req, res) => {
  const id = Number(req.params.id);
  if (isNaN(id)) return res.status(400).json({ error: "Invalid id" });

  const {
    company_id,
    invoice_date,
    service_start_date,
    service_end_date,
    po_number,
    location,
    authorized_by,
    miles,
    rate_per_mile,
    mileage_fee,
    miscellaneous_charges,
    hourly_fee,
    subtotal,
    tax_amount,
    total_amount,
    status,
    payment_status,
    invoiceLines,
  } = req.body;

  try {
    const existing = await prisma.invoice_headers.findUnique({
      where: { id },
      select: { payment_status: true },
    });
    if (!existing) return res.status(404).json({ error: "Invoice not found" });
    if (existing.payment_status === "Paid")
      return res.status(400).json({ error: "Cannot edit a paid invoice" });

    const updated = await prisma.$transaction(async (tx) => {
      const header = await tx.invoice_headers.update({
        where: { id },
        data: {
          company_id,
          invoice_date: invoice_date ? new Date(invoice_date) : undefined,
          service_start_date: service_start_date
            ? new Date(service_start_date)
            : undefined,
          service_end_date: service_end_date
            ? new Date(service_end_date)
            : undefined,
          po_number,
          location,
          authorized_by,
          miles,
          rate_per_mile,
          mileage_fee,
          miscellaneous_charges,
          hourly_fee,
          subtotal,
          tax_amount,
          total_amount,
          status,
          payment_status,
        },
      });

      if (Array.isArray(invoiceLines)) {
        const keepNumbers = invoiceLines.map((l) => String(l.analysis_number));

        // Prune removed lines first to free up unique slots (analysis_number, sample_checkin_id)
        await tx.invoice_lines.deleteMany({
          where: { invoice_id: id, analysis_number: { notIn: keepNumbers } },
        });

        // Upsert each line by analysis_number
        for (const line of invoiceLines) {
          await tx.invoice_lines.upsert({
            where: { analysis_number: String(line.analysis_number) },
            update: {
              invoice_id: id,
              sample_checkin_id: line.sample_checkin_id,
              description: line.description,
              service_date: line.service_date
                ? new Date(line.service_date)
                : null,
              report_number: line.report_number,
              analysis_method: line.analysis_method,
              quantity: line.quantity,
              unit_price: line.unit_price,
              amount: line.amount,
            },
            create: {
              invoice_id: id,
              sample_checkin_id: line.sample_checkin_id,
              analysis_number: String(line.analysis_number),
              description: line.description,
              service_date: line.service_date
                ? new Date(line.service_date)
                : null,
              report_number: line.report_number,
              analysis_method: line.analysis_method,
              quantity: line.quantity,
              unit_price: line.unit_price,
              amount: line.amount,
            },
          });
        }
      }

      return tx.invoice_headers.findUnique({
        where: { id },
        include: { invoiceLines: true },
      });
    });

    res.json(updated);
  } catch (err) {
    if (err.code === "P2025") {
      return res.status(404).json({ error: "Invoice not found" });
    }
    if (err.code === "P2002") {
      return res.status(400).json({
        error: "Unique constraint violation",
        detail: err.meta?.target,
      });
    }
    res
      .status(500)
      .json({ error: "Failed to update invoice", detail: err.message });
  }
});

// PUT /invoices/:id/payment-status — update payment status
router.put("/:id/payment-status", async (req, res) => {
  const id = Number(req.params.id);
  if (isNaN(id)) return res.status(400).json({ error: "Invalid id" });

  const { payment_status } = req.body;
  if (!payment_status)
    return res.status(400).json({ error: "payment_status is required" });

  try {
    const existing = await prisma.invoice_headers.findUnique({
      where: { id },
      select: { id: true },
    });
    if (!existing) return res.status(404).json({ error: "Invoice not found" });

    const updated = await prisma.invoice_headers.update({
      where: { id },
      data: { payment_status },
      select: { id: true, invoice_number: true, payment_status: true },
    });
    res.json(updated);
  } catch (err) {
    res
      .status(500)
      .json({ error: "Failed to update payment status", detail: err.message });
  }
});

// DELETE /invoices/:id — delete invoice (lines cascade)
router.delete("/:id", async (req, res) => {
  const id = Number(req.params.id);
  if (isNaN(id)) return res.status(400).json({ error: "Invalid id" });
  try {
    const existing = await prisma.invoice_headers.findUnique({
      where: { id },
      select: { payment_status: true },
    });
    if (!existing) return res.status(404).json({ error: "Invoice not found" });
    if (existing.payment_status === "Paid")
      return res.status(400).json({ error: "Cannot delete a paid invoice" });

    await prisma.invoice_headers.delete({ where: { id } });
    res.json({ message: "Invoice deleted" });
  } catch (err) {
    if (err.code === "P2025") {
      return res.status(404).json({ error: "Invoice not found" });
    }
    res
      .status(500)
      .json({ error: "Failed to delete invoice", detail: err.message });
  }
});

module.exports = router;
