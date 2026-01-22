import { defineConfig } from "tsup";

/**
 * External dependencies that should not be bundled.
 * These are either peer dependencies or large libraries that
 * the consumer's bundler should handle.
 */
const externalDeps = [
  // Peer dependencies
  "react",
  "react-dom",
  // Large chain-specific dependencies - let consumer bundle these
  "viem",
  "viem/chains",
  "wagmi",
  "wagmi/connectors",
  "@wagmi/core",
  "@wagmi/connectors",
  "@tanstack/react-query",
  // TON dependencies
  "@ton/core",
  "@ton/ton",
  "@tonconnect/ui-react",
  // Solana dependencies
  "@solana/kit",
  "@solana/wallet-standard-features",
  "@solana-program/compute-budget",
  "@solana-program/token",
  "@solana-program/token-2022",
  "@solana/transaction-confirmation",
  "@wallet-standard/app",
  "@wallet-standard/base",
  "@wallet-standard/features",
  // Internal workspace dependencies
  "@t402/core",
  "@t402/evm",
  "@t402/svm",
  "@t402/ton",
  "@t402/tron",
];

const baseConfig = {
  entry: {
    index: "src/index.ts",
    "evm/index": "src/evm/index.ts",
    "svm/index": "src/svm/index.ts",
    "ton/index": "src/ton/index.ts",
    "tron/index": "src/tron/index.ts",
    "stacks/index": "src/stacks/index.ts",
    "cosmos/index": "src/cosmos/index.ts",
    "near/index": "src/near/index.ts",
  },
  dts: {
    resolve: true,
  },
  sourcemap: true,
  external: externalDeps,
  treeshake: {
    preset: "recommended",
  },
};

export default defineConfig([
  {
    ...baseConfig,
    format: "esm",
    outDir: "dist/esm",
    clean: true,
    splitting: true, // Enable code splitting for ESM
  },
  {
    ...baseConfig,
    format: "cjs",
    outDir: "dist/cjs",
    clean: false,
    splitting: false, // CJS doesn't support code splitting well
  },
]);
