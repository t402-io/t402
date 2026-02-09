import { defineConfig } from "tsup";

const baseConfig = {
  entry: {
    index: "src/index.ts",
    "exact-direct/client/index": "src/exact-direct/client/index.ts",
    "exact-direct/server/index": "src/exact-direct/server/index.ts",
    "exact-direct/facilitator/index": "src/exact-direct/facilitator/index.ts",
  },
  dts: {
    resolve: true,
  },
  sourcemap: true,
  target: "es2020" as const,
};

export default defineConfig([
  {
    ...baseConfig,
    format: "esm",
    outDir: "dist/esm",
    clean: true,
  },
  {
    ...baseConfig,
    format: "cjs",
    outDir: "dist/cjs",
    clean: false,
  },
]);
