/**
 * Structured JSON logging utility.
 */
export function log(level, message, data = {}) {
  console.log(JSON.stringify({ timestamp: new Date().toISOString(), level, message, ...data }));
}
