// Duplicate require removed: express is already declared above
const express = require("express");
const {
  prisma,
  prismaErrorDetail,
  getAllowedValuesFromConstraints,
  normalizeToAllowed,
} = require("../lib/common");
const authorize = require("../middleware/authorize");

const router = express.Router();

// Update work order lines fields in sample_checkin
router.put("/update_wo_lines/:id", async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0)
    return res.status(400).json({ error: "Invalid id" });
  try {
    const existing = await prisma.sample_checkin.findUnique({ where: { id } });
    if (!existing)
      return res.status(404).json({ error: "Sample check-in not found" });

    const {
      analysis_type_id,
      rushed,
      standard_rate,
      applied_rate,
      sample_fee,
      h2_pop_fee,
      spot_composite_fee,
    } = req.body;

    const updates = {};
    if (analysis_type_id !== undefined)
      updates.analysis_type_id = Number(analysis_type_id);
    if (rushed !== undefined) updates.rushed = Boolean(rushed);
    if (standard_rate !== undefined)
      updates.standard_rate = Number(standard_rate);
    if (applied_rate !== undefined) updates.applied_rate = Number(applied_rate);
    if (sample_fee !== undefined) updates.sample_fee = Number(sample_fee);
    if (h2_pop_fee !== undefined) updates.h2_pop_fee = Number(h2_pop_fee);
    if (spot_composite_fee !== undefined)
      updates.spot_composite_fee = Number(spot_composite_fee);

    const updated = await prisma.sample_checkin.update({
      where: { id },
      data: updates,
    });
    return res.json({ message: "Update successful", updated });
  } catch (err) {
    return res.status(500).json({
      error: "Failed to update work order lines",
      detail: err.message,
    });
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

// List sample check-ins with optional filters
router.get("/", async (req, res) => {
  try {
    const where = {};
    if (isCustomerWithCompany(req)) {
      where.company_id = Number(req.user.company_id);
    } else if (req.query.company_id !== undefined) {
      const v = Number(req.query.company_id);
      if (Number.isInteger(v) && v > 0) where.company_id = v;
    }
    if (req.query.status) where.status = String(req.query.status);
    if (req.query.analysis_number)
      where.analysis_number = String(req.query.analysis_number);

    const list = await prisma.sample_checkin.findMany({
      where,
      orderBy: { id: "asc" },
    });
    return res.json(list);
  } catch (err) {
    return res.status(500).json({ error: "Failed to fetch sample check-ins" });
  }
});

// List work orders derived from sample check-ins
router.get("/workorders", async (req, res) => {
  try {
    const where = {};
    if (isCustomerWithCompany(req)) {
      where.company_id = Number(req.user.company_id);
    } else if (req.query.company_id !== undefined) {
      const v = Number(req.query.company_id);
      if (Number.isInteger(v) && v > 0) where.company_id = v;
    }
    if (req.query.status) where.status = String(req.query.status);

    const rows = await prisma.sample_checkin.findMany({
      where,
      orderBy: { created_at: "desc" },
      select: {
        id: true,
        work_order_number: true,
        well_name: true,
        meter_number: true,
        created_at: true,
        status: true,
        cylinder_number: true,
        rushed: true,
        company: { select: { name: true } },
        analysis_pricing: {
          select: { standard_rate: true, rushed_rate: true, sample_fee: true },
        },
      },
    });

    const now = new Date();
    const toNumber = (v) => {
      if (v == null) return 0;
      if (typeof v === "object" && typeof v.toNumber === "function")
        return v.toNumber();
      return Number(v);
    };

    const workOrderCounts = rows.reduce((acc, r) => {
      const key = r.work_order_number ?? `__no_work_order_${r.id}`;
      acc.set(key, (acc.get(key) || 0) + 1);
      // PUT endpoint to update specific fields in sample_checkin
      return acc;
    }, new Map());

    const list = rows.map((r) => {
      const workOrderKey = r.work_order_number ?? `__no_work_order_${r.id}`;
      const baseRate = r.rushed
        ? toNumber(r.analysis_pricing?.rushed_rate)
        : toNumber(r.analysis_pricing?.standard_rate);
      const sampleFee = toNumber(r.analysis_pricing?.sample_fee);
      const amount = baseRate + sampleFee;
      const isPending =
        typeof r.status === "string" &&
        r.status.trim().toLowerCase() === "pending";
      const pendingSince = isPending
        ? Math.max(
            0,
            Math.floor(
              (now.getTime() - new Date(r.created_at).getTime()) /
                (1000 * 60 * 60 * 24),
            ),
          )
        : null;

      return {
        id: r.id,
        work_order_number: r.work_order_number ?? null,
        company: r.company?.name ?? null,
        well_name: r.well_name ?? null,
        meter_number: r.meter_number ?? null,
        date: r.created_at,
        pending_since: pendingSince,
        cylinders: workOrderCounts.get(workOrderKey) ?? 0,
        amount,
        status: r.status ?? null,
      };
    });

    return res.json(list);
  } catch (err) {
    return res.status(500).json({ error: "Failed to fetch work orders" });
  }
});

// Get work order details for edit by work order number
router.get("/workorders/by-number/:work_order_number", async (req, res) => {
  const workOrderNumber = String(req.params.work_order_number || "").trim();
  if (!workOrderNumber)
    return res.status(400).json({ error: "work_order_number is required" });
  try {
    const workOrderSample = await prisma.sample_checkin.findFirst({
      where: isCustomerWithCompany(req)
        ? {
            work_order_number: workOrderNumber,
            company_id: Number(req.user.company_id),
          }
        : { work_order_number: workOrderNumber },
      orderBy: { created_at: "asc" },
      select: {
        id: true,
        work_order_number: true,
        well_name: true,
        meter_number: true,
        created_at: true,
        status: true,
        company_id: true,
        company: { select: { name: true } },
      },
    });

    if (!workOrderSample)
      return res.status(404).json({ error: "Work order not found" });

    const where = isCustomerWithCompany(req)
      ? {
          work_order_number: workOrderSample.work_order_number,
          company_id: Number(req.user.company_id),
        }
      : { work_order_number: workOrderSample.work_order_number };

    const items = await prisma.sample_checkin.findMany({
      where,
      orderBy: { id: "asc" },
      select: {
        id: true,
        cylinder_number: true,
        analysis_number: true,
        cost_code: true,
        rushed: true,
        well_name: true,
        meter_number: true,
        standard_rate: true,
        applied_rate: true,
        sample_fee: true,
        h2_pop_fee: true,
        spot_composite_fee: true,
        analysis_type_id: true,
        analysis_pricing: { select: { analysis_type: true } },
      },
    });

    const toNumber = (v) => {
      if (v == null) return 0;
      if (typeof v === "object" && typeof v.toNumber === "function")
        return v.toNumber();
      return Number(v);
    };

    const line_items = items.map((item) => {
      const rate = toNumber(item.standard_rate); // Use standard_rate as rate
      return {
        id: item.id,
        cylinder_number: item.cylinder_number ?? null,
        analysis_number: item.analysis_number ?? null,
        cc_number: item.cost_code ?? null,
        rushed: Boolean(item.rushed ?? false),
        well_name: item.well_name ?? null,
        meter_number: item.meter_number ?? null,
        analysis_type_id: item.analysis_type_id ?? null,
        analysis_type: item.analysis_pricing?.analysis_type ?? null,
        rate: rate,
        standard_rate: toNumber(item.standard_rate),
        applied_rate: toNumber(item.applied_rate),
        sample_fee: toNumber(item.sample_fee),
        h2_pop_fee: toNumber(item.h2_pop_fee),
        spot_composite_fee: toNumber(item.spot_composite_fee),
        amount:
          rate +
          toNumber(item.sample_fee) +
          toNumber(item.h2_pop_fee) +
          toNumber(item.spot_composite_fee),
      };
    });

    // Fetch workorder_headers for this work_order_number
    let wh = null;
    if (workOrderSample.work_order_number) {
      wh = await prisma.workorder_headers.findUnique({
        where: { work_order_number: workOrderSample.work_order_number },
        select: {
          mileage_fee: true,
          miscellaneous_charges: true,
          hourly_fee: true,
        },
      });
    }

    const work_order = {
      id: workOrderSample.id,
      work_order_number: workOrderSample.work_order_number ?? null,
      company: workOrderSample.company?.name ?? null,
      date: workOrderSample.created_at,
      status: workOrderSample.status ?? null,
      mileage_fee: wh?.mileage_fee ?? 0,
      miscellaneous_charges: wh?.miscellaneous_charges ?? 0,
      hourly_fee: wh?.hourly_fee ?? 0,
    };

    return res.json({ work_order, line_items });
  } catch (err) {
    console.error("Error in /workorders/by-number/:work_order_number:", err);
    return res
      .status(500)
      .json({ error: "Failed to fetch work order", detail: err.message });
  }
});

// Get by id
router.get("/:id", async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0)
    return res.status(400).json({ error: "Invalid id" });
  try {
    const item = await prisma.sample_checkin.findUnique({ where: { id } });
    if (!item)
      return res.status(404).json({ error: "Sample check-in not found" });
    if (isCustomerWithCompany(req)) {
      if (Number(item.company_id) !== Number(req.user.company_id))
        return res.status(403).json({ error: "Forbidden" });
    }
    return res.json(item);
  } catch (err) {
    return res.status(500).json({ error: "Failed to fetch sample check-in" });
  }
});

// Create sample check-in
router.post("/", authorize("sample_checkin"), async (req, res) => {
  try {
    if (!req.user || !req.user.userId) {
      return res.status(401).json({ error: "Login required" });
    }
    const {
      company_id,
      company_contact_id,
      analysis_type_id,
      area_id,
      customer_cylinder,
      rushed,
      sampled_by_lab,
      cylinder_id,
      cylinder_number,
      analysis_number,
      producer,
      well_name,
      meter_number,
      sample_type,
      flow_rate,
      pressure,
      pressure_unit,
      temperature,
      field_h2s,
      cost_code,
      checkin_type,
      invoice_ref_name,
      invoice_ref_value,
      remarks,
      scanned_tag_image,
      work_order_number,
      status,
    } = req.body || {};

    // Required core fields
    let companyId = company_id;
    if (isCustomerWithCompany(req)) companyId = Number(req.user.company_id);
    if (companyId == null)
      return res.status(400).json({ error: "company_id is required" });
    if (company_contact_id == null)
      return res.status(400).json({ error: "company_contact_id is required" });
    if (analysis_type_id == null)
      return res.status(400).json({ error: "analysis_type_id is required" });
    if (!analysis_number)
      return res.status(400).json({ error: "analysis_number is required" });
    if (!sample_type)
      return res.status(400).json({ error: "sample_type is required" });
    if (!checkin_type)
      return res.status(400).json({ error: "checkin_type is required" });
    if (!status) return res.status(400).json({ error: "status is required" });

    const isCustomerCylinder = Boolean(customer_cylinder ?? false);
    if (isCustomerCylinder) {
      if (!cylinder_number)
        return res.status(400).json({ error: "cylinder_number is required" });
    } else if (cylinder_id == null) {
      return res.status(400).json({ error: "cylinder_id is required" });
    }

    let compId = Number(companyId);
    const contactId = Number(company_contact_id);
    const analysisId = Number(analysis_type_id);
    const cylId = cylinder_id != null ? Number(cylinder_id) : null;
    const areaId = area_id != null ? Number(area_id) : null;
    if (!Number.isInteger(compId) || compId <= 0)
      return res.status(400).json({ error: "Invalid company_id" });
    if (!Number.isInteger(contactId) || contactId <= 0)
      return res.status(400).json({ error: "Invalid company_contact_id" });
    if (!Number.isInteger(analysisId) || analysisId <= 0)
      return res.status(400).json({ error: "Invalid analysis_type_id" });
    if (cylId != null && (!Number.isInteger(cylId) || cylId <= 0))
      return res.status(400).json({ error: "Invalid cylinder_id" });
    if (areaId != null && (!Number.isInteger(areaId) || areaId <= 0))
      return res.status(400).json({ error: "Invalid area_id" });

    // If area provided, ensure it exists and align company_id accordingly
    if (areaId != null) {
      const area = await prisma.company_areas.findUnique({
        where: { id: areaId },
      });
      if (!area)
        return res.status(400).json({ error: "area_id does not exist" });
      // For customers, area must belong to their company
      if (isCustomerWithCompany(req)) {
        if (Number(area.company_id) !== Number(req.user.company_id)) {
          return res
            .status(400)
            .json({ error: "area_id belongs to a different company" });
        }
        compId = Number(req.user.company_id);
      } else {
        // For non-customers, prefer area.company_id to keep consistency
        if (Number(area.company_id) !== compId) {
          compId = Number(area.company_id);
        }
      }
    }

    // Normalize and validate sample_type against DB constraint (dynamic from CHECK)
    const allowedSampleTypes =
      (await getAllowedValuesFromConstraints(
        "sample_checkin",
        "sample_type",
      )) || [];
    const finalSampleType = normalizeToAllowed(sample_type, allowedSampleTypes);
    if (!allowedSampleTypes.includes(finalSampleType)) {
      return res.status(400).json({
        error:
          allowedSampleTypes.length > 0
            ? `Invalid sample_type. Allowed: ${allowedSampleTypes.join(", ")}`
            : "Invalid sample_type",
      });
    }

    // Normalize and validate pressure_unit against DB constraint (dynamic)
    let finalPressureUnit = null;
    if (pressure_unit != null) {
      const allowedPressureUnits =
        (await getAllowedValuesFromConstraints(
          "sample_checkin",
          "pressure_unit",
        )) || [];
      finalPressureUnit = normalizeToAllowed(
        pressure_unit,
        allowedPressureUnits,
      );
      if (!allowedPressureUnits.includes(finalPressureUnit)) {
        return res.status(400).json({
          error:
            allowedPressureUnits.length > 0
              ? `Invalid pressure_unit. Allowed: ${allowedPressureUnits.join(
                  ", ",
                )}`
              : "Invalid pressure_unit",
        });
      }
    }

    // Normalize and validate checkin_type against DB constraint (dynamic)
    const allowedCheckinTypes =
      (await getAllowedValuesFromConstraints(
        "sample_checkin",
        "checkin_type",
      )) || [];
    const finalCheckinType = normalizeToAllowed(
      checkin_type,
      allowedCheckinTypes,
    );
    if (!allowedCheckinTypes.includes(finalCheckinType)) {
      return res.status(400).json({
        error:
          allowedCheckinTypes.length > 0
            ? `Invalid checkin_type. Allowed: ${allowedCheckinTypes.join(", ")}`
            : "Invalid checkin_type",
      });
    }

    // Validate existence and relationships (after possible compId adjustment)
    const [company, contact, analysis, cylinder] = await Promise.all([
      prisma.companies.findUnique({ where: { id: compId } }),
      prisma.company_contacts.findUnique({ where: { id: contactId } }),
      prisma.analysis_pricing.findUnique({ where: { id: analysisId } }),
      !isCustomerCylinder && cylId != null
        ? prisma.cylinders.findUnique({ where: { id: cylId } })
        : null,
    ]);
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
    if (!analysis)
      return res.status(400).json({ error: "analysis_type_id does not exist" });
    if (!isCustomerCylinder && cylId != null && !cylinder)
      return res.status(400).json({ error: "cylinder_id does not exist" });

    const finalCylinderNumber = isCustomerCylinder
      ? String(cylinder_number)
      : String(cylinder.cylinder_number);
    const finalCylinderId = isCustomerCylinder ? null : cylId;

    const created = await prisma.sample_checkin.create({
      data: {
        company: { connect: { id: compId } },
        company_contact: { connect: { id: contactId } },
        analysis_pricing: { connect: { id: analysisId } },
        cylinder:
          finalCylinderId != null
            ? { connect: { id: finalCylinderId } }
            : undefined,
        company_area: areaId != null ? { connect: { id: areaId } } : undefined,
        customer_cylinder: isCustomerCylinder,
        rushed: Boolean(rushed ?? false),
        sampled_by_lab: Boolean(sampled_by_lab ?? false),
        analysis_number: String(analysis_number),
        producer: producer ?? null,
        well_name: well_name ?? null,
        meter_number: meter_number ?? null,
        sample_type: finalSampleType,
        flow_rate: flow_rate ?? null,
        pressure: pressure ?? null,
        pressure_unit: finalPressureUnit,
        temperature: temperature ?? null,
        field_h2s: field_h2s ?? null,
        cost_code: cost_code ?? null,
        checkin_type: finalCheckinType,
        invoice_ref_name: invoice_ref_name ?? null,
        invoice_ref_value: invoice_ref_value ?? null,
        remarks: remarks ?? null,
        scanned_tag_image: scanned_tag_image ?? null,
        work_order_number: work_order_number ?? null,
        status: String(status),
        cylinder_number: finalCylinderNumber,
        created_by: { connect: { id: Number(req.user.userId) } },
      },
    });
    return res.status(201).json(created);
  } catch (err) {
    if (err && err.code === "P2002") {
      // Unique on analysis_number
      return res.status(400).json({ error: "Duplicate analysis_number" });
    }
    const detail = prismaErrorDetail(err);

    if (detail) return res.status(400).json({ error: detail });
    return res.status(500).json({ error: "Failed to create sample check-in" });
  }
});

// Update sample check-in
router.put("/:id", authorize("sample_checkin"), async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0)
    return res.status(400).json({ error: "Invalid id" });
  try {
    const existing = await prisma.sample_checkin.findUnique({ where: { id } });
    if (!existing)
      return res.status(404).json({ error: "Sample check-in not found" });
    if (isCustomerWithCompany(req)) {
      if (Number(existing.company_id) !== Number(req.user.company_id))
        return res.status(403).json({ error: "Forbidden" });
    }

    const updates = {};
    const {
      company_id,
      company_contact_id,
      analysis_type_id,
      area_id,
      customer_cylinder,
      rushed,
      sampled_by_lab,
      cylinder_id,
      cylinder_number,
      analysis_number,
      producer,
      well_name,
      meter_number,
      sample_type,
      flow_rate,
      pressure,
      pressure_unit,
      temperature,
      field_h2s,
      cost_code,
      checkin_type,
      invoice_ref_name,
      invoice_ref_value,
      remarks,
      scanned_tag_image,
      work_order_number,
      status,
    } = req.body || {};

    const validateFK = async (model, idVal, name) => {
      const v = Number(idVal);
      if (!Number.isInteger(v) || v <= 0) return `${name} invalid`;
      const obj = await prisma[model].findUnique({ where: { id: v } });
      return obj ? null : `${name} does not exist`;
    };

    if (company_id !== undefined) {
      const errMsg = await validateFK("companies", company_id, "company_id");
      if (errMsg) return res.status(400).json({ error: errMsg });
      if (
        isCustomerWithCompany(req) &&
        Number(company_id) !== Number(req.user.company_id)
      )
        return res
          .status(403)
          .json({ error: "Forbidden to change company_id" });
      updates.company_id = Number(company_id);
    }

    if (company_contact_id !== undefined) {
      const errMsg = await validateFK(
        "company_contacts",
        company_contact_id,
        "company_contact_id",
      );
      if (errMsg) return res.status(400).json({ error: errMsg });
      const compId = updates.company_id ?? existing.company_id;
      const contact = await prisma.company_contacts.findUnique({
        where: { id: Number(company_contact_id) },
      });
      if (Number(contact.company_id) !== Number(compId))
        return res
          .status(400)
          .json({ error: "company_contact does not belong to company_id" });
      updates.company_contact_id = Number(company_contact_id);
    }

    if (analysis_type_id !== undefined) {
      const errMsg = await validateFK(
        "analysis_pricing",
        analysis_type_id,
        "analysis_type_id",
      );
      if (errMsg) return res.status(400).json({ error: errMsg });
      updates.analysis_type_id = Number(analysis_type_id);
    }

    if (area_id !== undefined) {
      if (area_id === null) {
        updates.area_id = null;
      } else {
        const errMsg = await validateFK("company_areas", area_id, "area_id");
        if (errMsg) return res.status(400).json({ error: errMsg });
        const compId = updates.company_id ?? existing.company_id;
        const area = await prisma.company_areas.findUnique({
          where: { id: Number(area_id) },
        });
        if (Number(area.company_id) !== Number(compId))
          return res
            .status(400)
            .json({ error: "area_id does not belong to company_id" });
        updates.area_id = Number(area_id);
      }
    }

    if (cylinder_id !== undefined) {
      if (cylinder_id === null) {
        updates.cylinder_id = null;
      } else {
        const errMsg = await validateFK(
          "cylinders",
          cylinder_id,
          "cylinder_id",
        );
        if (errMsg) return res.status(400).json({ error: errMsg });
        updates.cylinder_id = Number(cylinder_id);
      }
    }

    if (customer_cylinder !== undefined)
      updates.customer_cylinder = Boolean(customer_cylinder);

    if (cylinder_number !== undefined)
      updates.cylinder_number = cylinder_number ?? null;

    const nextCustomerCylinder =
      updates.customer_cylinder ?? existing.customer_cylinder ?? false;
    const nextCylinderId =
      updates.cylinder_id !== undefined
        ? updates.cylinder_id
        : existing.cylinder_id;
    const nextCylinderNumber =
      updates.cylinder_number !== undefined
        ? updates.cylinder_number
        : existing.cylinder_number;

    if (!nextCylinderNumber)
      return res.status(400).json({ error: "cylinder_number is required" });
    if (!nextCustomerCylinder && nextCylinderId == null) {
      return res.status(400).json({ error: "cylinder_id is required" });
    }

    if (analysis_number !== undefined)
      updates.analysis_number = String(analysis_number);
    if (producer !== undefined) updates.producer = producer ?? null;
    if (well_name !== undefined) updates.well_name = well_name ?? null;
    if (meter_number !== undefined) updates.meter_number = meter_number ?? null;
    if (sample_type !== undefined) {
      const allowedSampleTypes =
        (await getAllowedValuesFromConstraints(
          "sample_checkin",
          "sample_type",
        )) || [];
      const finalSampleType = normalizeToAllowed(
        sample_type,
        allowedSampleTypes,
      );
      if (!allowedSampleTypes.includes(finalSampleType)) {
        return res.status(400).json({
          error:
            allowedSampleTypes.length > 0
              ? `Invalid sample_type. Allowed: ${allowedSampleTypes.join(", ")}`
              : "Invalid sample_type",
        });
      }
      updates.sample_type = finalSampleType;
    }
    if (flow_rate !== undefined) updates.flow_rate = flow_rate ?? null;
    if (pressure !== undefined) updates.pressure = pressure ?? null;
    if (pressure_unit !== undefined) {
      const allowedPressureUnits =
        (await getAllowedValuesFromConstraints(
          "sample_checkin",
          "pressure_unit",
        )) || [];
      const finalPressureUnit = normalizeToAllowed(
        pressure_unit,
        allowedPressureUnits,
      );
      if (!allowedPressureUnits.includes(finalPressureUnit)) {
        return res.status(400).json({
          error:
            allowedPressureUnits.length > 0
              ? `Invalid pressure_unit. Allowed: ${allowedPressureUnits.join(
                  ", ",
                )}`
              : "Invalid pressure_unit",
        });
      }
      updates.pressure_unit = finalPressureUnit;
    }
    if (temperature !== undefined) updates.temperature = temperature ?? null;
    if (field_h2s !== undefined) updates.field_h2s = field_h2s ?? null;
    if (cost_code !== undefined) updates.cost_code = cost_code ?? null;
    if (checkin_type !== undefined) {
      const allowedCheckinTypes =
        (await getAllowedValuesFromConstraints(
          "sample_checkin",
          "checkin_type",
        )) || [];
      const finalCheckinType = normalizeToAllowed(
        checkin_type,
        allowedCheckinTypes,
      );
      if (!allowedCheckinTypes.includes(finalCheckinType)) {
        return res.status(400).json({
          error:
            allowedCheckinTypes.length > 0
              ? `Invalid checkin_type. Allowed: ${allowedCheckinTypes.join(
                  ", ",
                )}`
              : "Invalid checkin_type",
        });
      }
      updates.checkin_type = finalCheckinType;
    }
    if (invoice_ref_name !== undefined)
      updates.invoice_ref_name = invoice_ref_name ?? null;
    if (invoice_ref_value !== undefined)
      updates.invoice_ref_value = invoice_ref_value ?? null;
    if (remarks !== undefined) updates.remarks = remarks ?? null;
    if (scanned_tag_image !== undefined)
      updates.scanned_tag_image = scanned_tag_image ?? null;
    if (work_order_number !== undefined)
      updates.work_order_number = work_order_number ?? null;
    if (status !== undefined) updates.status = String(status);

    const updated = await prisma.sample_checkin.update({
      where: { id },
      data: updates,
    });
    return res.json(updated);
  } catch (err) {
    if (err && err.code === "P2002") {
      return res.status(400).json({ error: "Duplicate analysis_number" });
    }
    if (err && err.code === "P2025")
      return res.status(404).json({ error: "Sample check-in not found" });
    const detail = prismaErrorDetail(err);
    if (detail) return res.status(400).json({ error: detail });

    return res.status(500).json({ error: "Failed to update sample check-in" });
  }
});

// Delete sample check-in
router.delete("/:id", authorize("sample_checkin"), async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0)
    return res.status(400).json({ error: "Invalid id" });
  try {
    const existing = await prisma.sample_checkin.findUnique({ where: { id } });
    if (!existing)
      return res.status(404).json({ error: "Sample check-in not found" });
    if (isCustomerWithCompany(req)) {
      if (Number(existing.company_id) !== Number(req.user.company_id))
        return res.status(403).json({ error: "Forbidden" });
    }
    await prisma.sample_checkin.delete({ where: { id } });
    return res.json({ message: "Sample check-in deleted" });
  } catch (err) {
    if (err && err.code === "P2025")
      return res.status(404).json({ error: "Sample check-in not found" });
    const detail = prismaErrorDetail(err);
    if (detail) return res.status(400).json({ error: detail });
    return res.status(500).json({ error: "Failed to delete sample check-in" });
  }
});

module.exports = router;

// Update status by work_order_number

// Update status by work_order_number via URL param
router.put("/update_status_by_wo/:work_order_number", async (req, res) => {
  const work_order_number = String(req.params.work_order_number || '').trim();
  const { status } = req.body;
  if (!work_order_number || !status) {
    return res.status(400).json({ error: "work_order_number (URL) and status (body) are required." });
  }
  try {
    const updated = await prisma.sample_checkin.updateMany({
      where: { work_order_number },
      data: { status },
    });
    if (updated.count === 0) {
      return res.status(404).json({ error: "No record found for the given work_order_number." });
    }
    res.json({ message: "Status updated successfully.", count: updated.count });
  } catch (error) {
    res.status(500).json({ error: "Failed to update status.", details: error.message });
  }
});
