const { isAdminRole } = require("../lib/common");
const logger = require("../lib/logger");

module.exports = function adminOnly() {
  return async function (req, res, next) {
    const user = req.user;
    if (!user) return res.status(401).json({ error: "Unauthenticated" });
    const roleId = user.role_id || user.roleId || null;
    if (!roleId) return res.status(403).json({ error: "Forbidden" });

    try {
      if (await isAdminRole(roleId)) return next();
    } catch (err) {
      logger.error("adminOnly isAdminRole check failed:", {
        message: err?.message,
        code: err?.code,
        meta: err?.meta,
      });
    }

    return res.status(403).json({ error: "Forbidden" });
  };
};
