const express = require("express");
const bcrypt = require("bcrypt");
const { prisma, prismaErrorDetail } = require("../lib/common");
const authorize = require("../middleware/authorize");
// Helper to remove sensitive/metadata fields from user objects before sending to clients
function sanitizeUser(user) {
  if (!user) return user;
  const { password, created_at, updated_at, ...safe } = user;
  return safe;
}

const router = express.Router();

// helper: is the current request a customer and has a company_id
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

// GET all users
router.get("/", async (req, res) => {
  try {
    const where = {};
    if (isCustomerWithCompany(req)) {
      where.company_id = Number(req.user.company_id);
    }
    const users = await prisma.users.findMany({
      where,
      orderBy: { id: "asc" },
    });
    return res.json(users.map(sanitizeUser));
  } catch (error) {
    return res.status(500).json({ error: "Failed to fetch users" });
  }
});

// GET user by ID
router.get("/:id", async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0)
    return res.status(400).json({ error: "Invalid id" });

  try {
    const user = await prisma.users.findUnique({ where: { id } });
    if (!user) return res.status(404).json({ error: "User not found" });

    if (isCustomerWithCompany(req)) {
      if (Number(user.company_id) !== Number(req.user.company_id)) {
        return res.status(403).json({ error: "Forbidden" });
      }
    }

    return res.json(sanitizeUser(user));
  } catch (error) {
    return res.status(500).json({ error: "Failed to fetch user" });
  }
});

// CREATE user
router.post("/", authorize("users"), async (req, res) => {
  try {
    if (!req.user || !req.user.userId) {
      return res.status(401).json({ error: "Login required" });
    }
    const { name, email, password, role_id, active } = req.body;

    if (!name || !email || !password || role_id == null) {
      return res
        .status(400)
        .json({ error: "name, email, password and role_id are required" });
    }

    const roleId = Number(role_id);
    if (!Number.isInteger(roleId) || roleId <= 0)
      return res.status(400).json({ error: "Invalid role_id" });

    const role = await prisma.roles.findUnique({ where: { id: roleId } });
    if (!role) return res.status(400).json({ error: "role_id does not exist" });

    const SALT_ROUNDS = 10;
    const hashedPassword = await bcrypt.hash(password, SALT_ROUNDS);

    // Base data for new user
    const data = {
      name,
      email,
      password: hashedPassword,
      role: { connect: { id: roleId } },
      active: typeof active === "boolean" ? active : true,
    };

    // If the creating user is a customer, force the new user's company to match creator's
    let companyIdToSet;
    if (isCustomerWithCompany(req)) {
      companyIdToSet = Number(req.user.company_id);
    } else if (
      req.body.company_id !== undefined &&
      req.body.company_id !== null
    ) {
      companyIdToSet = Number(req.body.company_id);
    }
    if (companyIdToSet !== undefined) {
      if (!Number.isInteger(companyIdToSet) || companyIdToSet <= 0) {
        return res.status(400).json({ error: "Invalid company_id" });
      }
      const company = await prisma.companies.findUnique({
        where: { id: companyIdToSet },
      });
      if (!company) {
        return res.status(400).json({ error: "company_id does not exist" });
      }
      data.company = { connect: { id: companyIdToSet } };
    }

    const created = await prisma.users.create({
      data: {
        ...data,
        created_by_id: Number(req.user.userId),
      },
    });

    return res.status(201).json(sanitizeUser(created));
  } catch (error) {
    // console.error(error);
    if (error && error.code === "P2002") {
      const target = (error.meta && error.meta.target) || [];
      const tarr = Array.isArray(target) ? target : [target];
      if (tarr.some((t) => String(t).toLowerCase() === "email")) {
        return res.status(400).json({ error: "Email already exists" });
      }
      if (tarr.some((t) => String(t).toLowerCase() === "name")) {
        return res.status(400).json({ error: "Name already exists" });
      }
      const detail = prismaErrorDetail(error);
      if (detail) return res.status(400).json({ error: detail });
      return res.status(400).json({ error: "Unique constraint violated" });
    }
    const detail = prismaErrorDetail(error);
    if (detail) return res.status(400).json({ error: detail });
    return res.status(500).json({ error: "Failed to create user" });
  }
});

// UPDATE user
router.put("/:id", authorize("users"), async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0)
    return res.status(400).json({ error: "Invalid id" });

  try {
    // ensure target exists and enforce company scoping for customers
    const existing = await prisma.users.findUnique({
      where: { id },
      include: { role: true },
    });
    if (!existing) return res.status(404).json({ error: "User not found" });
    if (isCustomerWithCompany(req)) {
      if (Number(existing.company_id) !== Number(req.user.company_id)) {
        return res.status(403).json({ error: "Forbidden" });
      }
    }

    const { name, email, password, role_id, active, company_id } = req.body;

    if (role_id !== undefined && role_id !== null) {
      const roleId = Number(role_id);
      if (!Number.isInteger(roleId) || roleId <= 0)
        return res.status(400).json({ error: "Invalid role_id" });
      const role = await prisma.roles.findUnique({ where: { id: roleId } });
      if (!role)
        return res.status(400).json({ error: "role_id does not exist" });
    }

    // Prevent non-admin from changing admin user's sensitive fields; keep password restriction
    const targetRoleName =
      (existing.role && (existing.role.name || existing.role.role)) || null;
    const isTargetAdmin =
      !!targetRoleName &&
      String(targetRoleName).trim().toLowerCase() === "admin";
    const requesterIsAdmin =
      req.user &&
      typeof req.user.role === "string" &&
      String(req.user.role).trim().toLowerCase() === "admin";

    if (isTargetAdmin) {
      // Only block sensitive field changes if requester is not admin
      if (!requesterIsAdmin) {
        if (
          (name !== undefined && name !== existing.name) ||
          (role_id !== undefined &&
            Number(role_id) !== Number(existing.role_id)) ||
          (company_id !== undefined &&
            Number(company_id) !== Number(existing.company_id))
        ) {
          return res.status(403).json({
            error:
              "Modifying admin user's name, role or company_id is not allowed",
          });
        }
      }
      // Prevent changing admin password via this endpoint for anyone
      if (password !== undefined) {
        return res.status(403).json({
          error:
            "Modifying admin user's password via this endpoint is not allowed",
        });
      }
    }

    // Customers should not be able to change company_id to a different company
    if (isCustomerWithCompany(req) && company_id !== undefined) {
      if (Number(company_id) !== Number(req.user.company_id)) {
        return res.status(403).json({ error: "Forbidden to change company" });
      }
    }

    // Pre-validate company_id existence to avoid misleading P2025 (User not found)
    if (company_id !== undefined && company_id !== null) {
      const cid = Number(company_id);
      if (!Number.isInteger(cid) || cid <= 0) {
        return res.status(400).json({ error: "Invalid company_id" });
      }
      const company = await prisma.companies.findUnique({ where: { id: cid } });
      if (!company) {
        return res.status(400).json({ error: "company_id does not exist" });
      }
    }

    const SALT_ROUNDS = 10;
    let passwordPart = {};
    if (password !== undefined) {
      const hashed = await bcrypt.hash(password, SALT_ROUNDS);
      passwordPart = { password: hashed };
    }

    const updated = await prisma.users.update({
      where: { id },
      data: {
        ...(name !== undefined ? { name } : {}),
        ...(email !== undefined ? { email } : {}),
        ...passwordPart,
        ...(role_id !== undefined
          ? { role: { connect: { id: Number(role_id) } } }
          : {}),
        ...(active !== undefined ? { active: Boolean(active) } : {}),
        ...(company_id !== undefined
          ? company_id === null
            ? { company: { disconnect: true } }
            : { company: { connect: { id: Number(company_id) } } }
          : {}),
      },
    });

    return res.json(sanitizeUser(updated));
  } catch (error) {
    if (error && error.code === "P2002") {
      const target = (error.meta && error.meta.target) || [];
      const tarr = Array.isArray(target) ? target : [target];
      if (tarr.some((t) => String(t).toLowerCase() === "email")) {
        return res.status(400).json({ error: "Email already exists" });
      }
      if (tarr.some((t) => String(t).toLowerCase() === "name")) {
        return res.status(400).json({ error: "Name already exists" });
      }
      const detail = prismaErrorDetail(error);
      if (detail) return res.status(400).json({ error: detail });
      return res.status(400).json({ error: "Unique constraint violated" });
    }
    if (error && error.code === "P2025")
      return res.status(404).json({ error: "User not found" });
    const detail = prismaErrorDetail(error);
    if (detail) return res.status(400).json({ error: detail });
    return res.status(500).json({ error: "Failed to update user" });
  }
});

// CHANGE PASSWORD (self-service or admin for non-admin users)
router.post("/:id/change-password", authorize("users"), async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0)
    return res.status(400).json({ error: "Invalid id" });

  const { current_password, new_password } = req.body || {};
  if (!new_password)
    return res.status(400).json({ error: "new_password is required" });

  try {
    const existing = await prisma.users.findUnique({
      where: { id },
      include: { role: true },
    });
    if (!existing) return res.status(404).json({ error: "User not found" });

    if (isCustomerWithCompany(req)) {
      if (Number(existing.company_id) !== Number(req.user.company_id)) {
        return res.status(403).json({ error: "Forbidden" });
      }
    }

    const requesterId = req.user && req.user.userId;
    if (!requesterId) return res.status(401).json({ error: "Unauthorized" });

    const requesterIsAdmin =
      req.user &&
      typeof req.user.role === "string" &&
      String(req.user.role).trim().toLowerCase() === "admin";

    // If changing own password, require current_password
    if (Number(requesterId) === Number(id)) {
      if (!current_password)
        return res.status(400).json({ error: "current_password is required" });
      const matches = await bcrypt.compare(current_password, existing.password);
      if (!matches)
        return res.status(403).json({ error: "Current password is incorrect" });
    } else {
      // Not changing own password: only admin can change others, and not for admin target
      if (!requesterIsAdmin)
        return res.status(403).json({ error: "Forbidden" });
      const targetRoleName =
        (existing.role && (existing.role.name || existing.role.role)) || null;
      const isTargetAdmin =
        !!targetRoleName &&
        String(targetRoleName).trim().toLowerCase() === "admin";
      if (isTargetAdmin)
        return res.status(403).json({
          error: "Changing another admin user's password is not allowed",
        });
    }

    const SALT_ROUNDS = 10;
    const hashed = await bcrypt.hash(new_password, SALT_ROUNDS);

    await prisma.users.update({ where: { id }, data: { password: hashed } });
    return res.json({ message: "Password changed" });
  } catch (error) {
    return res.status(500).json({ error: "Failed to change password" });
  }
});

// DELETE user
router.delete("/:id", authorize("users"), async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0)
    return res.status(400).json({ error: "Invalid id" });

  try {
    const existing = await prisma.users.findUnique({
      where: { id },
      include: { role: true },
    });
    if (!existing) return res.status(404).json({ error: "User not found" });
    if (isCustomerWithCompany(req)) {
      if (Number(existing.company_id) !== Number(req.user.company_id)) {
        return res.status(403).json({ error: "Forbidden" });
      }
    }

    // Prevent deleting the root admin user only
    const targetRoleName =
      (existing.role && (existing.role.name || existing.role.role)) || null;
    const isTargetAdmin =
      !!targetRoleName &&
      String(targetRoleName).trim().toLowerCase() === "admin";
    const isRootAdminName =
      existing &&
      typeof existing.name === "string" &&
      String(existing.name).trim().toLowerCase() === "admin";
    if (isTargetAdmin && isRootAdminName)
      return res
        .status(403)
        .json({ error: "Deleting admin user is not allowed" });

    const deleted = await prisma.users.delete({ where: { id } });
    return res.json({ message: "User deleted", user: sanitizeUser(deleted) });
  } catch (error) {
    if (error && error.code === "P2025")
      return res.status(404).json({ error: "User not found" });
    return res.status(500).json({ error: "Failed to delete user" });
  }
});

module.exports = router;
