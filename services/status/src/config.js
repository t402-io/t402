/**
 * Externalized service configuration.
 * Load services from SERVICES_JSON env var, SERVICES_FILE, or built-in defaults.
 */

import { readFile } from "node:fs/promises";

export const CHECK_INTERVAL = parseInt(process.env.CHECK_INTERVAL_MS || "300000", 10);
export const FAIL_THRESHOLD = parseInt(process.env.FAIL_THRESHOLD || "2", 10);
export const RATE_LIMIT = parseInt(process.env.RATE_LIMIT_PER_MINUTE || "60", 10);

const DEFAULT_SERVICES = [
  // Website services
  { id: "site", name: "t402.io", url: "https://t402.io", type: "website", group: "Websites" },
  { id: "docs", name: "docs.t402.io", url: "https://docs.t402.io", type: "website", group: "Websites" },
  { id: "demo", name: "demo.t402.io", url: "https://demo.t402.io", type: "website", group: "Websites" },
  // Core services
  { id: "facilitator", name: "Facilitator API", url: "https://facilitator.t402.io/health", type: "api", group: "Core", expect: "healthy" },
  { id: "scan2pay-fe", name: "Scan2Pay Frontend", url: "https://scan2pay.t402.io", type: "website", group: "Core", dependsOn: ["scan2pay-api"] },
  { id: "scan2pay-api", name: "Scan2Pay API", url: "https://scan2pay-api.t402.io/health", type: "api", group: "Core", expect: "OK", dependsOn: ["facilitator"] },
  { id: "grafana", name: "Grafana", url: "https://grafana-facilitator.t402.io", type: "monitoring", group: "Core" },
  // Platform services
  { id: "bazaar", name: "Bazaar", url: "https://bazaar.t402.io/health", type: "api", group: "Platform", expect: "ok" },
  { id: "explorer", name: "Explorer", url: "https://explorer.t402.io/health", type: "api", group: "Platform", expect: "ok" },
  { id: "dashboard", name: "Agent Dashboard", url: "https://agents.t402.io/health", type: "api", group: "Platform", expect: "ok" },
  { id: "sandbox", name: "Sandbox", url: "https://sandbox.t402.io/health", type: "api", group: "Platform", expect: "ok" },
  { id: "sandbox-ready", name: "Sandbox Upstream", url: "https://sandbox.t402.io/ready", type: "api", group: "Platform", expect: "true" },
];

const REQUIRED_FIELDS = ["id", "name", "url", "type", "group"];

export let SERVICES = [...DEFAULT_SERVICES];
export let SERVICE_MAP = new Map(SERVICES.map((s) => [s.id, s]));

function validate(services) {
  for (const s of services) {
    for (const field of REQUIRED_FIELDS) {
      if (!s[field]) throw new Error(`Service missing required field "${field}": ${JSON.stringify(s)}`);
    }
  }
}

export async function loadServices() {
  // Try env var first
  const envJson = process.env.SERVICES_JSON;
  if (envJson) {
    try {
      const parsed = JSON.parse(envJson);
      validate(parsed);
      SERVICES = parsed;
      SERVICE_MAP = new Map(SERVICES.map((s) => [s.id, s]));
      console.log(`Loaded ${SERVICES.length} services from SERVICES_JSON`);
      return;
    } catch (e) {
      console.error("Invalid SERVICES_JSON env var:", e.message);
    }
  }

  // Try file
  const filePath = process.env.SERVICES_FILE;
  if (filePath) {
    try {
      const raw = await readFile(filePath, "utf-8");
      const parsed = JSON.parse(raw);
      validate(parsed);
      SERVICES = parsed;
      SERVICE_MAP = new Map(SERVICES.map((s) => [s.id, s]));
      console.log(`Loaded ${SERVICES.length} services from ${filePath}`);
      return;
    } catch (e) {
      console.error(`Failed to load services from ${filePath}:`, e.message);
    }
  }

  // Use defaults
  console.log(`Loaded ${SERVICES.length} services (built-in defaults)`);
}
