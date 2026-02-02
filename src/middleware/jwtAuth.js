const jwt = require("jsonwebtoken");
const { prisma } = require("../lib/common");
const logger = require("../lib/logger");

/**
 * JWT auth middleware.
 * Expects header: Authorization: Bearer <token>
 * On success sets `req.user = { userId, role_id, company_id, role, iat, exp }`
 */
module.exports = async function (req, res, next) {
  const rawAuth = (req.headers.authorization || req.headers.Authorization || "")
    .toString()
    .trim();
  if (!rawAuth)
    return res.status(401).json({ error: "Missing Authorization header" });

  // Accept case-insensitive "Bearer", tolerate extra spaces and optional surrounding quotes
  const match = rawAuth.match(/^\s*Bearer\s+(.+)\s*$/i);
  if (!match) {
    const errorId =
      typeof randomUUID === "function"
        ? randomUUID()
        : `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

    // Log full rawAuth server-side for debugging (do NOT return it to clients in prod)
    logger.warn("Invalid Authorization header format", {
      errorId,
      rawAuth,
      method: req.method,
      route: req.originalUrl,
    });

    const isProd = process.env.NODE_ENV === "production";
    const tokenPart = rawAuth.split(/\s+/).slice(1).join(" ");
    const headerPreview =
      (rawAuth.split(/\s+/)[0] || "<missing-scheme>") +
      " " +
      (tokenPart ? "<redacted>" : "<missing-token>");

    const response = { error: "Invalid Authorization header format", errorId };
    if (!isProd)
      response.details = `Header received: '${headerPreview}' — expected 'Bearer <token>'`;

    return res.status(401).json(response);
  }

  let token = match[1].trim();
  if (
    (token.startsWith('"') && token.endsWith('"')) ||
    (token.startsWith("'") && token.endsWith("'"))
  ) {
    token = token.slice(1, -1);
  }

  const JWT_SECRET = process.env.JWT_SECRET || "dev_jwt_secret";
  try {
    const payload = jwt.verify(token, JWT_SECRET);

    // payload should contain userId; fetch the live user to get company_id and role
    if (!payload || !payload.userId)
      return res.status(401).json({ error: "Invalid token payload" });

    const userRec = await prisma.users.findUnique({
      where: { id: Number(payload.userId) },
      include: { role: true },
    });

    if (!userRec)
      return res.status(401).json({ error: "Invalid token (user not found)" });

    // normalize role name from schema: prefer `name` or `role`
    const roleNameRaw =
      (userRec.role && userRec.role.name) ||
      (userRec.role && userRec.role.role) ||
      null;

    req.user = {
      userId: userRec.id,
      role_id: userRec.role_id,
      company_id: userRec.company_id ?? null,
      role: roleNameRaw ? String(roleNameRaw).trim().toLowerCase() : null,
      iat: payload.iat,
      exp: payload.exp,
    };

    return next();
  } catch (err) {
    logger.error("jwtAuth error:", {
      message: err?.message,
      code: err?.code,
      meta: err?.meta,
    });
    return res.status(401).json({ error: "Invalid or expired token" });
  }
};
