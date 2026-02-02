const {
  isAdminRole,
  getRolePermissions,
  resolveModuleIdentifier,
} = require("../lib/common");

const logger = require("../lib/logger");

/**
 * authorize middleware
 * Usage: authorize('module_name') or authorize(moduleId)
 * The middleware checks if the authenticated user's role has an active mapping
 * to the given module (from `role_modules`). Admin roles bypass the check.
 */
module.exports = function authorize(moduleIdentifier) {
  return async function (req, res, next) {
    const user = req.user;
    if (!user) return res.status(401).json({ error: "Unauthenticated" });

    const roleId = user.role_id || user.roleId || null;
    if (!roleId) return res.status(403).json({ error: "Forbidden" });

    try {
      if (await isAdminRole(roleId)) return next();
    } catch (err) {
      logger.error("authorize isAdminRole check failed:", {
        message: err?.message,
        code: err?.code,
        meta: err?.meta,
      });
      // fall through to permission checks
    }

    let moduleId = null;
    try {
      moduleId = await resolveModuleIdentifier(moduleIdentifier);
    } catch (err) {
      logger.error("authorize.resolveModuleIdentifier failed:", {
        message: err?.message,
        code: err?.code,
        meta: err?.meta,
      });
    }

    if (!moduleId) return res.status(403).json({ error: "Forbidden" });

    try {
      const perms = await getRolePermissions(roleId);
      if (perms && perms.has(Number(moduleId))) return next();
    } catch (err) {
      logger.error("authorize getRolePermissions failed:", {
        message: err?.message,
        code: err?.code,
        meta: err?.meta,
      });
    }

    return res.status(403).json({ error: "Forbidden" });
  };
};
