const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();
// simple in-memory cache for roleId -> isAdmin
const adminRoleCache = new Map();
// in-memory cache for enum-like allowed values discovered from DB check constraints
const allowedValuesCache = new Map(); // key: `${table}.${column}` -> Array<string>

// in-memory permissions cache
// structure: {
//   byRole: Map<roleId, Set<moduleId>>,
//   moduleNameToId: Map<moduleName, moduleId>,
//   lastLoaded: Date|null
// }
const permissionsCache = {
  byRole: new Map(),
  moduleNameToId: new Map(),
  lastLoaded: null,
};

async function loadPermissionsCache(force = false) {
  if (permissionsCache.lastLoaded && !force) return permissionsCache;
  try {
    const rows = await prisma.role_modules.findMany({
      where: { active: true },
      include: { module: true },
    });
    const byRole = new Map();
    const moduleNameToId = new Map();
    for (const r of rows) {
      const rid = Number(r.role_id);
      const mid = Number(r.module_id);
      if (!byRole.has(rid)) byRole.set(rid, new Set());
      byRole.get(rid).add(mid);
      if (r.module) {
        const mname =
          (r.module.name && String(r.module.name)) ||
          (r.module.module && String(r.module.module)) ||
          null;
        if (mname) moduleNameToId.set(mname.toLowerCase(), mid);
      }
    }
    permissionsCache.byRole = byRole;
    permissionsCache.moduleNameToId = moduleNameToId;
    permissionsCache.lastLoaded = new Date();
    return permissionsCache;
  } catch (err) {
    const logger = require("./logger");
    logger.error("loadPermissionsCache failed:", {
      message: err?.message,
      code: err?.code,
      meta: err?.meta,
    });
    // leave previous cache intact on error
    return permissionsCache;
  }
}

function clearPermissionsCache() {
  permissionsCache.byRole.clear();
  permissionsCache.moduleNameToId.clear();
  permissionsCache.lastLoaded = null;
}

async function getRolePermissions(roleId) {
  if (!roleId) return new Set();
  await loadPermissionsCache();
  const s = permissionsCache.byRole.get(Number(roleId));
  return s ? new Set(s) : new Set();
}

async function resolveModuleIdentifier(identifier) {
  // identifier may be a number (module id) or string (module name)
  if (!identifier && identifier !== 0) return null;
  // numeric string or number
  if (typeof identifier === "number") return Number(identifier);
  const maybeNum = Number(identifier);
  if (!Number.isNaN(maybeNum) && String(identifier).trim() !== "")
    return maybeNum;
  // otherwise treat as module name
  await loadPermissionsCache();
  const m = permissionsCache.moduleNameToId.get(
    String(identifier).toLowerCase()
  );
  return m || null;
}

async function isAdminRole(roleId) {
  if (!roleId) return false;
  if (adminRoleCache.has(roleId)) return adminRoleCache.get(roleId);
  try {
    const role = await prisma.roles.findUnique({
      where: { id: Number(roleId) },
    });
    const roleNameRaw = (role && role.name) || (role && role.role) || null;
    const isAdmin =
      !!roleNameRaw &&
      typeof roleNameRaw === "string" &&
      ["admin", "administrator"].includes(roleNameRaw.trim().toLowerCase());
    adminRoleCache.set(roleId, isAdmin);
    return isAdmin;
  } catch (err) {
    const logger = require("./logger");
    logger.error("isAdminRole error:", {
      message: err?.message,
      code: err?.code,
      meta: err?.meta,
    });
    return false;
  }
}

function clearAdminRoleCache() {
  adminRoleCache.clear();
}

/**
 * Inspect Postgres check constraints for a table/column and extract allowed values
 * when the constraint is of the shape: column = ANY (ARRAY['A', 'B', ...]).
 * Returns an array of strings or null when not found.
 */
async function getAllowedValuesFromConstraints(tableName, columnName) {
  const key = `${String(tableName)}.${String(columnName)}`;
  if (allowedValuesCache.has(key)) return allowedValuesCache.get(key);
  try {
    // Query all CHECK constraints for the table; avoid schema assumptions
    const rows = await prisma.$queryRaw`
      SELECT c.conname AS name, pg_get_constraintdef(c.oid) AS def
      FROM pg_constraint c
      JOIN pg_class t ON t.oid = c.conrelid
      WHERE c.contype = 'c' AND t.relname = ${String(tableName)}
    `;
    for (const r of rows) {
      const def = String(r.def || "");
      // Must reference the column
      if (!def.toLowerCase().includes(String(columnName).toLowerCase()))
        continue;
      // Try to extract values inside ARRAY[ ... ]
      const m = def.match(/ARRAY\[(.+?)\]/);
      if (!m || !m[1]) continue;
      const rawItems = m[1].split(",");
      const values = rawItems
        .map((x) => {
          const s = String(x).trim();
          const q = s.match(/'([^']+)'/); // capture content inside single quotes
          return q ? q[1] : s.replace(/::[a-zA-Z0-9_]+/g, "");
        })
        .filter((v) => v && v.length > 0);
      if (values.length) {
        allowedValuesCache.set(key, values);
        return values;
      }
    }
    return null;
  } catch (err) {
    const logger = require("./logger");
    logger.warn("getAllowedValuesFromConstraints failed:", {
      message: err?.message,
      code: err?.code,
    });
    return null;
  }
}

/**
 * Given an input string and a list of allowed values, return the canonical
 * allowed value using case-insensitive matching. If none match, return the
 * original input (caller should validate inclusion).
 */
function normalizeToAllowed(input, allowed) {
  const s = String(input ?? "").trim();
  for (const v of allowed || []) {
    if (String(v).toLowerCase() === s.toLowerCase()) return v;
  }
  return s;
}

/**
 * Normalize common Prisma errors into friendly messages suitable for API responses.
 * Returns a short string explanation or null when no friendly mapping is available.
 */
function prismaErrorDetail(err) {
  if (!err || !err.code) return null;

  // Helper: extract a probable column name (like "module_id") from various Prisma meta shapes
  function extractColumnNameFromMeta(meta) {
    if (!meta) return null;
    // Sometimes constraint contains the column name: e.g. "role_modules_module_id_fkey"
    if (meta.constraint) {
      const c = String(meta.constraint).toLowerCase();
      const m = c.match(/([a-z0-9_]+_id)/);
      if (m) return m[1];
      // fallback: try to find something that looks like a column name
      const m2 = c.match(/([a-z0-9_]+)(?:_fkey)?$/);
      if (m2)
        return m2[1].endsWith("_fkey") ? m2[1].replace(/_fkey$/, "") : m2[1];
    }
    // Prisma sometimes provides `target` as an array of column names
    if (meta.target) {
      if (Array.isArray(meta.target) && meta.target.length)
        return String(meta.target[0]).toLowerCase();
      return String(meta.target).toLowerCase();
    }
    return null;
  }

  // Normalize a column name like "module_id" -> "module" (entity)
  function columnToEntity(col) {
    if (!col) return null;
    const s = String(col).toLowerCase();
    // if it's like "something_id", strip the suffix
    if (s.endsWith("_id")) return s.replace(/_id$/, "");
    return s;
  }

  // Foreign key violation (missing related record)
  if (err.code === "P2003") {
    const col = extractColumnNameFromMeta(err.meta);
    if (col) {
      const entity = columnToEntity(col) || col;
      // preserve the original column name in message (e.g. module_id)
      return `${col} does not refer to an existing ${entity}`;
    }
    return "A referenced record does not exist";
  }

  // Unique constraint violation
  if (err.code === "P2002") {
    const target = err.meta && err.meta.target ? err.meta.target : null;
    if (Array.isArray(target))
      return `Unique constraint violated on: ${target.join(", ")}`;
    if (typeof target === "string" && target.length)
      return `Unique constraint violated on: ${target}`;
    return "Unique constraint violated";
  }

  // Record not found for update/delete
  if (err.code === "P2025") {
    return "The record to update or delete was not found";
  }

  // Prisma client invocation/runtime messages (missing args etc.) can include
  // a long invocation trace. Detect common patterns and return a short
  // friendly message instead of exposing the full invocation text.
  if (err.message && typeof err.message === "string") {
    // e.g. "Argument `name` is missing."
    const m = err.message.match(/Argument `([^`]+)` is missing/i);
    if (m && m[1]) return `Missing required field: ${m[1]}`;

    // Fallback: if message contains 'is missing' or 'Missing required'
    const m2 = err.message.match(/missing[: ]+`?([a-z0-9_]+)`?/i);
    if (m2 && m2[1]) return `Missing required field: ${m2[1]}`;
  }

  return null;
}

module.exports = {
  prisma,
  isAdminRole,
  clearAdminRoleCache,
  prismaErrorDetail,
  getAllowedValuesFromConstraints,
  normalizeToAllowed,
  // permissions cache helpers
  loadPermissionsCache,
  clearPermissionsCache,
  getRolePermissions,
  resolveModuleIdentifier,
};
