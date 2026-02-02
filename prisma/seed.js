// backend/prisma/seed.js
require("dotenv").config();
const { PrismaClient } = require("@prisma/client");
const bcrypt = require("bcrypt");

const prisma = new PrismaClient();

// Defaults requested
const ADMIN_NAME = process.env.ADMIN_NAME || "admin";
const ADMIN_EMAIL = process.env.ADMIN_EMAIL || "admin@lims.com";
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "admin123!";
// we'll determine admin role id after upserting roles
const ADMIN_COMPANY_ID = process.env.ADMIN_COMPANY_ID
  ? Number(process.env.ADMIN_COMPANY_ID)
  : null;

// If your schema uses a different field name for roles/modules change these keys.
// e.g., if your roles table uses "role_name" instead of "name", set roleKey = "role_name".
const roleKey = "name";
const moduleKey = "name";

// role descriptions to use when seeding
const roleDescriptions = {
  Admin: "Full System Access",
  Employee: "Lab Operation Access",
  Customer: "Access to their company data",
};

async function upsertRole(roleName) {
  // Use upsert by unique field - ensure the DB has a unique constraint on the chosen key.
  const where = {};
  where[roleKey] = roleName;

  const create = {
    [roleKey]: roleName,
    description: roleDescriptions[roleName] || "Default auto-created role",
    active: true,
  };
  // update does nothing if it already exists
  const update = {};

  return prisma.roles.upsert({
    where,
    create,
    update,
  });
}

async function upsertRoles(names) {
  const results = [];
  for (const n of names) {
    const r = await upsertRole(n);
    results.push(r);
  }
  return results;
}

async function upsertAdminUser(roleId, companyId = null) {
  const hashed = await bcrypt.hash(ADMIN_PASSWORD, 10);
  const companyPart = companyId ? { company_id: companyId } : {};
  console.log("Seeding admin with company_id:", companyId);
  return prisma.users.upsert({
    where: { email: ADMIN_EMAIL },
    update: {
      name: ADMIN_NAME,
      password: hashed,
      role_id: roleId,
      active: true,
      ...companyPart,
    },
    create: {
      name: ADMIN_NAME,
      email: ADMIN_EMAIL,
      password: hashed,
      role_id: roleId,
      active: true,
      ...companyPart,
    },
  });
}

async function getOrCreateDefaultCompany() {
  const code = process.env.DEFAULT_COMPANY_CODE || "DEFAULT";
  const name = process.env.DEFAULT_COMPANY_NAME || "Default Company";
  const phone = process.env.DEFAULT_COMPANY_PHONE || "";
  const billing_address = process.env.DEFAULT_COMPANY_BILLING_ADDRESS || "";
  const where = { code };
  return prisma.companies.upsert({
    where,
    create: {
      code,
      name,
      phone,
      email: "",
      billing_address,
      active: true,
    },
    update: {},
  });
}

async function ensureAdminHasAllModules(roleId, createdByUserId) {
  const modules = await prisma.modules.findMany();
  for (const m of modules) {
    // find existing mapping
    const existing = await prisma.role_modules.findFirst({
      where: { role_id: roleId, module_id: m.id },
    });
    if (!existing) {
      await prisma.role_modules.create({
        data: {
          role: { connect: { id: roleId } },
          module: { connect: { id: m.id } },
          active: true,
          created_by: { connect: { id: createdByUserId } },
        },
      });
    }
  }
}

async function createDefaultModulesIfEmpty(createdByUserId = 1) {
  const count = await prisma.modules.count();
  if (count === 0) {
    const defaultModuleNames = [
      "Dashboard",
      "Cylinder Check-Out",
      "Sample Check-In",
      "Work Orders",
      "Generate Invoice",
      "Invoices",
      "Analysis Pricing",
      "Cylinder Master",
      "Company Master",
      "Contacts",
      "Company Areas",
      "Import Machine Report",
      "Cylinder Inventory",
      "Analysis Reports",
      "Pending Work Orders",
      "Roles",
      "Users",
      "Modules",
      "Role Module",
    ];
    for (const n of defaultModuleNames) {
      const where = {};
      where[moduleKey] = n;
      await prisma.modules.upsert({
        where,
        create: {
          [moduleKey]: n,
          description: n,
          created_by: { connect: { id: createdByUserId } },
          active: true,
        },
        update: {},
      });
    }
  }
}

async function main() {
  console.log("Seeding database with default admin user...");

  // ensure the three fixed roles exist
  const fixedRoles = ["Admin", "Employee", "Customer"];
  const roles = await upsertRoles(fixedRoles);

  // find admin role id (case-insensitive match)
  const adminRole = roles.find((r) => String(r.name).toLowerCase() === "admin");
  const roleId = adminRole ? adminRole.id : roles[0].id;

  // ensure admin user exists with specified defaults
  let companyId = ADMIN_COMPANY_ID;
  if (!companyId) {
    const company = await getOrCreateDefaultCompany();
    companyId = company.id;
  } else {
    const existing = await prisma.companies.findUnique({
      where: { id: companyId },
    });
    if (!existing) {
      console.warn(
        `ADMIN_COMPANY_ID=${companyId} was provided but no company found; creating default company instead.`
      );
      const company = await getOrCreateDefaultCompany();
      companyId = company.id;
    }
  }

  const adminUser = await upsertAdminUser(roleId, companyId);

  // seed modules using the real admin id as created_by
  await createDefaultModulesIfEmpty(adminUser.id);

  // Ensure API-identifier modules exist for newly added routes
  // These names should match authorize("<name>") usage in routers
  const apiModules = [
    "company_areas",
    "company_contacts",
    "cylinders",
    "analysis_pricing",
    "cylinder_checkout",
  ];
  for (const modName of apiModules) {
    const where = {};
    where[moduleKey] = modName;
    await prisma.modules.upsert({
      where,
      create: {
        [moduleKey]: modName,
        description: modName,
        created_by: { connect: { id: adminUser.id } },
        active: true,
      },
      update: {},
    });
  }

  // ensure role_modules mapping for admin role (grant admin all modules)
  await ensureAdminHasAllModules(roleId, adminUser.id);

  // --- Seed initial records for newly created models ---
  // company_areas (unique: company_id + area)
  try {
    const defaultArea = await prisma.company_areas.findFirst({
      where: { company_id: companyId, area: "HQ" },
    });
    if (!defaultArea) {
      await prisma.company_areas.create({
        data: {
          company: { connect: { id: companyId } },
          area: "HQ",
          region: "NA",
          description: "Headquarters",
          active: true,
          created_by: { connect: { id: adminUser.id } },
        },
      });
    }
  } catch (e) {
    console.warn("Seed: company_areas skipped:", e?.message || e);
  }

  // company_contacts (unique: company_id + name)
  let contactJohn = null;
  try {
    contactJohn = await prisma.company_contacts.findFirst({
      where: { company_id: companyId, name: "John Doe" },
    });
    if (!contactJohn) {
      contactJohn = await prisma.company_contacts.create({
        data: {
          company: { connect: { id: companyId } },
          name: "John Doe",
          phone: "+1-555-0001",
          email: "john.doe@example.com",
          active: true,
          created_by: { connect: { id: adminUser.id } },
        },
      });
    }
  } catch (e) {
    console.warn("Seed: company_contacts skipped:", e?.message || e);
  }

  // cylinders (unique: cylinder_number)
  let cyl1 = null;
  try {
    cyl1 = await prisma.cylinders.upsert({
      where: { cylinder_number: "CYL-0001" },
      create: {
        cylinder_number: "CYL-0001",
        // per additional-db-scripts.sql: cylinder_type IN ('Gas','Liquid')
        cylinder_type: "Gas",
        track_inventory: true,
        // per additional-db-scripts.sql: location IN ('Clean Cylinder','Checked Out','Checked In')
        location: "Clean Cylinder",
        active: true,
        created_by: { connect: { id: adminUser.id } },
      },
      update: {},
    });
  } catch (e) {
    console.warn("Seed: cylinders skipped:", e?.message || e);
  }

  // analysis_pricing (unique: analysis_type)
  try {
    await prisma.analysis_pricing.upsert({
      where: { analysis_type: "Water Hardness" },
      create: {
        analysis_type: "Water Hardness",
        description: "Standard water hardness analysis",
        standard_rate: "100.00",
        rushed_rate: "150.00",
        sample_fee: "25.00",
        active: true,
        created_by: { connect: { id: adminUser.id } },
      },
      update: {},
    });
  } catch (e) {
    console.warn("Seed: analysis_pricing skipped:", e?.message || e);
  }

  // cylinder_checkout (unique: cylinder_id + is_returned) -> create an OPEN checkout if none
  try {
    if (cyl1 && contactJohn) {
      const openCheckout = await prisma.cylinder_checkout.findFirst({
        where: { cylinder_id: cyl1.id, is_returned: false },
      });
      if (!openCheckout) {
        await prisma.cylinder_checkout.create({
          data: {
            cylinder_id: cyl1.id,
            company_id: companyId,
            company_contact_id: contactJohn.id,
            is_returned: false,
            created_by: { connect: { id: adminUser.id } },
          },
        });
      }
    }
  } catch (e) {
    console.warn("Seed: cylinder_checkout skipped:", e?.message || e);
  }

  // sample_checkin (requires relations + created_by)
  try {
    const analysis = await prisma.analysis_pricing.findUnique({
      where: { analysis_type: "Water Hardness" },
    });
    const area = await prisma.company_areas.findFirst({
      where: { company_id: companyId, area: "HQ" },
    });
    if (analysis && contactJohn && cyl1) {
      const existingCheckin = await prisma.sample_checkin.findFirst({
        where: { analysis_number: "AN-0001" },
      });
      if (!existingCheckin) {
        await prisma.sample_checkin.create({
          data: {
            company: { connect: { id: companyId } },
            company_contact: { connect: { id: contactJohn.id } },
            analysis_pricing: { connect: { id: analysis.id } },
            cylinder: { connect: { id: cyl1.id } },
            company_area: area ? { connect: { id: area.id } } : undefined,
            customer_cylinder: false,
            rushed: false,
            sampled_by_lab: false,
            analysis_number: "AN-0001",
            producer: "Demo Producer",
            well_name: "Well-001",
            meter_number: "MTR-001",
            // per additional-db-scripts.sql: sample_type IN ('Spot','Composite')
            sample_type: "Spot",
            flow_rate: "10 scfh",
            pressure: "100",
            // per additional-db-scripts.sql: pressure_unit IN ('PSIG','PSIA')
            pressure_unit: "PSIG",
            temperature: "25 C",
            field_h2s: "0 ppm",
            cost_code: "CC-001",
            // per additional-db-scripts.sql: checkin_type IN ('Cylinder','Sample')
            checkin_type: "Cylinder",
            invoice_ref_name: "WO",
            invoice_ref_value: "WO-0001",
            remarks: "Initial demo check-in",
            work_order_number: "WO-0001",
            status: "Pending",
            created_by: { connect: { id: adminUser.id } },
          },
        });
      }
    }
  } catch (e) {
    console.warn("Seed: sample_checkin skipped:", e?.message || e);
  }

  console.log("Seeding complete.");
  console.log(`Admin user: ${ADMIN_EMAIL}`);
  console.log(
    "Remember to change the default password or set ADMIN_PASSWORD via env."
  );
}

main()
  .catch((e) => {
    console.error("Seed error:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
