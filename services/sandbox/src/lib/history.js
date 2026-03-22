/**
 * In-memory request history (per-session).
 */

export const MAX_HISTORY_PER_SESSION = 50;
export const MAX_SESSIONS = 1000;
export const SESSION_TTL_MS = 3_600_000; // 1 hour
export const requestHistory = new Map(); // sessionId -> { entries: [], lastAccess: Date.now() }

// Evict expired sessions every 5 minutes
export const historyEvictionTimer = setInterval(() => {
  const now = Date.now();
  for (const [id, session] of requestHistory) {
    if (now - session.lastAccess > SESSION_TTL_MS) {
      requestHistory.delete(id);
    }
  }
}, 300_000);
historyEvictionTimer.unref();
