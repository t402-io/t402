import Conf from "conf";
import type { CliConfig } from "../types.js";
import { DEFAULT_CONFIG } from "../types.js";

/**
 * Configuration store for t402 CLI
 */
const config = new Conf<CliConfig>({
  projectName: "t402",
  defaults: DEFAULT_CONFIG,
});

/**
 * Get a configuration value
 */
export function getConfig<K extends keyof CliConfig>(key: K): CliConfig[K] {
  return config.get(key);
}

/**
 * Set a configuration value
 */
export function setConfig<K extends keyof CliConfig>(key: K, value: CliConfig[K]): void {
  config.set(key, value);
}

/**
 * Get all configuration values
 */
export function getAllConfig(): CliConfig {
  return config.store;
}

/**
 * Reset configuration to defaults
 */
export function resetConfig(): void {
  config.clear();
}

/**
 * Get the path to the configuration file
 */
export function getConfigPath(): string {
  return config.path;
}

/**
 * Check if a seed phrase is configured
 */
export function hasSeedConfigured(): boolean {
  return !!config.get("encryptedSeed");
}

/**
 * Store encrypted seed phrase
 */
export function storeSeed(encryptedSeed: string): void {
  config.set("encryptedSeed", encryptedSeed);
}

/**
 * Get encrypted seed phrase
 */
export function getEncryptedSeed(): string | undefined {
  return config.get("encryptedSeed");
}

/**
 * Clear stored seed phrase
 */
export function clearSeed(): void {
  config.delete("encryptedSeed");
}

/**
 * Set custom RPC endpoint for a network
 */
export function setRpcEndpoint(network: string, url: string): void {
  const endpoints = config.get("rpcEndpoints");
  config.set("rpcEndpoints", { ...endpoints, [network]: url });
}

/**
 * Get RPC endpoint for a network
 */
export function getRpcEndpoint(network: string): string | undefined {
  return config.get("rpcEndpoints")[network];
}

export { config };
