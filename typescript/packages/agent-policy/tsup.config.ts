import { defineConfig } from "tsup";

const baseConfig = {
  entry: {
    index: "src/index.ts",
    "policy/index": "src/policy/index.ts",
    "limits/index": "src/limits/index.ts",
    "rules/index": "src/rules/index.ts",
    "mcp/index": "src/mcp/index.ts",
  },
  dts: {
    resolve: true,
  },
  sourcemap: true,
  target: "es2020",
  external: [
    "@modelcontextprotocol/sdk",
    "ioredis",
  ],
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
