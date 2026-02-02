const express = require("express");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const { randomUUID } = require("crypto");
const { prisma } = require("../lib/common");
const logger = require("../lib/logger");

const router = express.Router();

// POST /login - authenticate user
router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body || {};
    if (!email || !password)
      return res.status(400).json({ error: "email and password are required" });

    const user = await prisma.users.findUnique({ where: { email } });
    if (!user) return res.status(401).json({ error: "Invalid credentials" });

    // Compare provided password with stored hashed password
    const match = await bcrypt.compare(password, user.password);
    if (!match) return res.status(401).json({ error: "Invalid credentials" });

    if (!user.active)
      return res.status(403).json({ error: "User account is inactive" });

    // Load role info
    const role = await prisma.roles.findUnique({ where: { id: user.role_id } });

    // Load active permissions for this role and include module details
    const permissions = await prisma.role_modules.findMany({
      where: { role_id: user.role_id, active: true },
      include: { module: true },
    });

    // Redact password from response
    const safeUser = { ...user };
    delete safeUser.password;

    // Sign a JWT token. Use environment variable JWT_SECRET in production.
    const JWT_SECRET = process.env.JWT_SECRET || "dev_jwt_secret";
    // include company_id (if present) so clients can have it; server jwtAuth will still re-load from DB
    const tokenPayload = {
      userId: user.id,
      role_id: user.role_id,
      company_id: user.company_id || null,
    };
    const token = jwt.sign(tokenPayload, JWT_SECRET, { expiresIn: "8h" });

    return res.json({ user: safeUser, role, permissions, token });
  } catch (error) {
    const errorId =
      typeof randomUUID === "function"
        ? randomUUID()
        : `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const email = req?.body?.email || null;
    const isProd = process.env.NODE_ENV === "production";

    logger.error("POST /auth/login error", {
      errorId,
      message: error?.message,
      code: error?.code,
      meta: error?.meta,
      stack: error?.stack,
      route: "/auth/login",
      body: { email },
    });

    const response = { error: "Failed to authenticate", errorId };
    if (!isProd) response.details = error?.message;
    return res.status(500).json(response);
  }
});

module.exports = router;
