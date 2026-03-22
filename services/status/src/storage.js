/**
 * Flat-file JSON persistence for status history.
 * Writes atomically (tmp + rename) to prevent corruption.
 * Stores checks as Map<serviceId, Check[]> for efficient per-service queries.
 */

import { readFile, writeFile, rename, mkdir } from "node:fs/promises";
import { join } from "node:path";

const DATA_DIR = process.env.DATA_DIR || "/data";
const CHECKS_FILE = join(DATA_DIR, "checks.json");
const INCIDENTS_FILE = join(DATA_DIR, "incidents.json");

let initialized = false;

async function ensureDir() {
  if (initialized) return;
  try {
    await mkdir(DATA_DIR, { recursive: true });
  } catch {
    // read-only or already exists
  }
  initialized = true;
}

async function readJSON(filepath, fallback) {
  try {
    const raw = await readFile(filepath, "utf-8");
    return JSON.parse(raw);
  } catch {
    console.warn(`Storage: ${filepath} not found or corrupted, using defaults`);
    return fallback;
  }
}

async function writeJSON(filepath, data) {
  await ensureDir();
  const tmp = filepath + ".tmp";
  await writeFile(tmp, JSON.stringify(data), "utf-8");
  await rename(tmp, filepath);
}

export async function loadChecks() {
  const data = await readJSON(CHECKS_FILE, {});
  // Backward compat: if old flat-array format, convert to Map
  if (Array.isArray(data)) {
    const map = new Map();
    for (const check of data) {
      const arr = map.get(check.serviceId) || [];
      arr.push(check);
      map.set(check.serviceId, arr);
    }
    return map;
  }
  // New format: { [serviceId]: Check[] }
  return new Map(Object.entries(data));
}

export async function loadIncidents() {
  const data = await readJSON(INCIDENTS_FILE, { incidents: [], nextId: 1 });
  return data;
}

export async function saveChecks(checksByService) {
  await writeJSON(CHECKS_FILE, Object.fromEntries(checksByService));
}

export async function saveIncidents(incidents, nextId) {
  await writeJSON(INCIDENTS_FILE, { incidents, nextId });
}
