import { defineConfig } from "vitest/config";

/**
 * Root Vitest Configuration
 *
 * This configuration enables unified test running across all packages
 * from the monorepo root. Each package maintains its own vitest.config.ts
 * for package-specific settings.
 *
 * Usage:
 *   pnpm vitest              # Run all tests interactively
 *   pnpm vitest run          # Run all tests once
 *   pnpm vitest --coverage   # Run with coverage
 *   pnpm vitest --project=@t402/evm  # Run specific project
 */
export default defineConfig({
  test: {
    projects: [
      // Core packages
      "packages/core",
      "packages/extensions",

      // Mechanism packages (blockchain-specific implementations)
      "packages/mechanisms/*",

      // HTTP integration packages
      "packages/http/*",

      // WDK packages (wallet integration)
      "packages/wdk",
      "packages/wdk-gasless",
      "packages/wdk-bridge",
      "packages/wdk-multisig",

      // Tools
      "packages/mcp",
      "packages/cli",
    ],
  },
});
