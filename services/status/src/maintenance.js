/**
 * Scheduled maintenance windows.
 *
 * Configure via MAINTENANCE_JSON env var (JSON array) or
 * a JSON file at MAINTENANCE_FILE path (default: /data/maintenance.json).
 * Supports hot-reload — call loadMaintenance() periodically.
 * CRUD operations persist changes to file.
 *
 * Format: [{ "id": "m1", "serviceId": "facilitator", "title": "Planned upgrade",
 *            "startAt": "2026-03-21T02:00:00Z", "endAt": "2026-03-21T04:00:00Z" }]
 */

import { readFile, writeFile, rename } from "node:fs/promises";

const MAINTENANCE_FILE = process.env.MAINTENANCE_FILE || "/data/maintenance.json";
let windows = [];

export async function loadMaintenance() {
  // Try env var first
  const envJson = process.env.MAINTENANCE_JSON;
  if (envJson) {
    try {
      windows = JSON.parse(envJson);
      pruneExpired();
      return;
    } catch {
      console.error("Invalid MAINTENANCE_JSON env var");
    }
  }
  // Try file
  try {
    const raw = await readFile(MAINTENANCE_FILE, "utf-8");
    windows = JSON.parse(raw);
    pruneExpired();
  } catch {
    windows = [];
  }
}

async function persistToFile() {
  try {
    const tmp = MAINTENANCE_FILE + ".tmp";
    await writeFile(tmp, JSON.stringify(windows, null, 2), "utf-8");
    await rename(tmp, MAINTENANCE_FILE);
  } catch (e) {
    console.error(`Maintenance file write failed: ${e.message}`);
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

export async function addWindow(window) {
  if (!window.title || !window.startAt || !window.endAt) {
    throw new Error("Maintenance window requires title, startAt, endAt");
  }
  const startTime = new Date(window.startAt).getTime();
  const endTime = new Date(window.endAt).getTime();
  if (isNaN(startTime) || isNaN(endTime)) {
    throw new Error("startAt and endAt must be valid ISO date strings");
  }
  if (startTime >= endTime) {
    throw new Error("startAt must be before endAt");
  }
  const entry = {
    id: window.id || `m-${Date.now()}`,
    serviceId: window.serviceId || "*",
    title: window.title,
    startAt: window.startAt,
    endAt: window.endAt,
  };
  windows.push(entry);
  await persistToFile();
  return entry;
}

export async function removeWindow(id) {
  const idx = windows.findIndex((w) => w.id === id);
  if (idx === -1) return false;
  windows.splice(idx, 1);
  await persistToFile();
  return true;
}

export function pruneExpired() {
  const now = Date.now();
  windows = windows.filter((w) => new Date(w.endAt).getTime() > now);
}
