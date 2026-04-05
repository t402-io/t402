import { randomBytes, createCipheriv, createDecipheriv, scryptSync } from "node:crypto";
import chalk from "chalk";
import ora, { type Ora } from "ora";
import type { BalanceResult, NetworkInfo, PaymentResult } from "../types.js";
import { NETWORKS } from "../types.js";

/**
 * Create a spinner with consistent styling
 */
export function createSpinner(text: string): Ora {
  return ora({
    text,
    color: "cyan",
  });
}

/**
 * Format an address for display (truncated)
 */
export function formatAddress(address: string, startChars = 6, endChars = 4): string {
  if (address.length <= startChars + endChars + 3) {
    return address;
  }
  return `${address.slice(0, startChars)}...${address.slice(-endChars)}`;
}

/**
 * Format a token amount with decimals
 */
export function formatAmount(amount: string, decimals = 6): string {
  const value = BigInt(amount);
  const divisor = BigInt(10 ** decimals);
  const whole = value / divisor;
  const fraction = value % divisor;

  if (fraction === 0n) {
    return whole.toString();
  }

  const fractionStr = fraction.toString().padStart(decimals, "0").replace(/0+$/, "");
  return `${whole}.${fractionStr}`;
}

/**
 * Format balance result for display
 */
export function formatBalanceResult(result: BalanceResult): string {
  const network = getNetworkInfo(result.network);
  const networkName = network?.name || result.network;
  const assetName = result.asset.toUpperCase();

  return `${chalk.bold(networkName)}: ${chalk.green(result.formatted)} ${assetName}`;
}

/**
 * Format payment result for display
 */
export function formatPaymentResult(result: PaymentResult): string {
  if (result.success) {
    const lines = [chalk.green("✓ Payment successful!")];
    if (result.txHash) {
      lines.push(`  Transaction: ${chalk.cyan(result.txHash)}`);
    }
    if (result.network) {
      const network = getNetworkInfo(result.network);
      lines.push(`  Network: ${network?.name || result.network}`);
    }
    if (result.amount) {
      lines.push(`  Amount: ${result.amount}`);
    }
    return lines.join("\n");
  } else {
    return chalk.red(`✗ Payment failed: ${result.error || "Unknown error"}`);
  }
}

/**
 * Get network info by ID
 */
export function getNetworkInfo(networkId: string): NetworkInfo | undefined {
  return NETWORKS.find((n) => n.id === networkId);
}

/**
 * Get network display name
 */
export function getNetworkName(networkId: string): string {
  const network = getNetworkInfo(networkId);
  return network?.name || networkId;
}

/**
 * Filter networks by testnet mode
 */
export function getAvailableNetworks(testnet: boolean): NetworkInfo[] {
  return NETWORKS.filter((n) => n.testnet === testnet);
}

/**
 * Print a table of key-value pairs
 */
export function printTable(data: Record<string, string>): void {
  const maxKeyLength = Math.max(...Object.keys(data).map((k) => k.length));

  for (const [key, value] of Object.entries(data)) {
    const paddedKey = key.padEnd(maxKeyLength);
    console.log(`  ${chalk.gray(paddedKey)}  ${value}`);
  }
}

/**
 * Print a success message
 */
export function printSuccess(message: string): void {
  console.log(chalk.green(`✓ ${message}`));
}

/**
 * Print an error message
 */
export function printError(message: string): void {
  console.error(chalk.red(`✗ ${message}`));
}

/**
 * Print a warning message
 */
export function printWarning(message: string): void {
  console.log(chalk.yellow(`⚠ ${message}`));
}

/**
 * Print an info message
 */
export function printInfo(message: string): void {
  console.log(chalk.cyan(`ℹ ${message}`));
}

/**
 * Print a header
 */
export function printHeader(title: string): void {
  console.log();
  console.log(chalk.bold.underline(title));
  console.log();
}

/**
 * Validate a seed phrase (basic check)
 */
export function isValidSeedPhrase(phrase: string): boolean {
  const words = phrase.trim().split(/\s+/);
  return words.length === 12 || words.length === 24;
}

/**
 * Derive a 256-bit key from the passphrase using scrypt.
 */
function deriveKey(passphrase: string, salt: Buffer): Buffer {
  return scryptSync(passphrase, salt, 32) as Buffer;
}

/**
 * Encrypt seed phrase using AES-256-GCM.
 * Output format: base64(salt[16] + iv[12] + authTag[16] + ciphertext)
 */
export function encryptSeed(seed: string, key: string): string {
  const salt = randomBytes(16);
  const iv = randomBytes(12);
  const derivedKey = deriveKey(key, salt);

  const cipher = createCipheriv("aes-256-gcm", derivedKey, iv);
  const encrypted = Buffer.concat([cipher.update(seed, "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();

  return Buffer.concat([salt, iv, authTag, encrypted]).toString("base64");
}

/**
 * Decrypt seed phrase encrypted with AES-256-GCM.
 */
export function decryptSeed(encrypted: string, key: string): string {
  const data = Buffer.from(encrypted, "base64");
  const salt = data.subarray(0, 16);
  const iv = data.subarray(16, 28);
  const authTag = data.subarray(28, 44);
  const ciphertext = data.subarray(44);

  const derivedKey = deriveKey(key, salt);

  const decipher = createDecipheriv("aes-256-gcm", derivedKey, iv);
  decipher.setAuthTag(authTag);
  return decipher.update(ciphertext) + decipher.final("utf8");
}

/**
 * Parse amount string to smallest units
 */
export function parseAmount(amount: string, decimals = 6): string {
  const parts = amount.split(".");
  const whole = parts[0] || "0";
  const fraction = (parts[1] || "").padEnd(decimals, "0").slice(0, decimals);

  return (BigInt(whole) * BigInt(10 ** decimals) + BigInt(fraction)).toString();
}

/**
 * Validate URL format
 */
export function isValidUrl(url: string): boolean {
  try {
    new URL(url);
    return true;
  } catch {
    return false;
  }
}
