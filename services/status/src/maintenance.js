/**
 * Scheduled maintenance windows.
 *
 * Configure via MAINTENANCE_JSON env var (JSON array) or
 * a JSON file at MAINTENANCE_FILE path (default: /data/maintenance.json).
 *
 * Format: [{ "id": "m1", "serviceId": "facilitator", "title": "Planned upgrade",
 *            "startAt": "2026-03-21T02:00:00Z", "endAt": "2026-03-21T04:00:00Z" }]
 */

import { readFile } from "node:fs/promises";

const MAINTENANCE_FILE = process.env.MAINTENANCE_FILE || "/data/maintenance.json";
let windows = [];

export async function loadMaintenance() {
  // Try env var first
  const envJson = process.env.MAINTENANCE_JSON;
  if (envJson) {
    try {
      windows = JSON.parse(envJson);
      return;
    } catch {
      console.error("Invalid MAINTENANCE_JSON env var");
    }
  }
  // Try file
  try {
    const raw = await readFile(MAINTENANCE_FILE, "utf-8");
    windows = JSON.parse(raw);
  } catch {
    windows = [];
  }
}

export function getMaintenanceWindows() {
  return windows;
}

export function getUpcoming() {
  const now = Date.now();
  return windows.filter((w) => new Date(w.endAt).getTime() > now);
}

export function getActive() {
  const now = Date.now();
  return windows.filter((w) => {
    const start = new Date(w.startAt).getTime();
    const end = new Date(w.endAt).getTime();
    return now >= start && now <= end;
  });
}

export function isInMaintenance(serviceId) {
  return getActive().some((w) => w.serviceId === serviceId || w.serviceId === "*");
}
