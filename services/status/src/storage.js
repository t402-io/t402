/**
 * Flat-file JSON persistence for status history.
 * Writes atomically (tmp + rename) to prevent corruption.
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
    return fallback;
  }
}

async function writeJSON(filepath, data) {
  try {
    await ensureDir();
    const tmp = filepath + ".tmp";
    await writeFile(tmp, JSON.stringify(data), "utf-8");
    await rename(tmp, filepath);
  } catch (e) {
    console.error(`Storage write failed for ${filepath}:`, e.message);
  }
}

export async function loadChecks() {
  return readJSON(CHECKS_FILE, []);
}

export async function loadIncidents() {
  const data = await readJSON(INCIDENTS_FILE, { incidents: [], nextId: 1 });
  return data;
}

export async function saveChecks(checks) {
  await writeJSON(CHECKS_FILE, checks);
}

export async function saveIncidents(incidents, nextId) {
  await writeJSON(INCIDENTS_FILE, { incidents, nextId });
}
