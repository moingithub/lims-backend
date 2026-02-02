// Simple configurable logger.
// Enable detailed error logs by setting environment variable `ENABLE_ERROR_LOGS=true`.
const enabled =
  String(process.env.ENABLE_ERROR_LOGS || "").toLowerCase() === "true";

function error(...args) {
  if (!enabled) return;
  // Use console.error when enabled to preserve stack traces where available
  console.error(...args);
}

function warn(...args) {
  if (!enabled) return;
  console.warn(...args);
}

function info(...args) {
  if (!enabled) return;
  console.info(...args);
}

module.exports = { error, warn, info };
