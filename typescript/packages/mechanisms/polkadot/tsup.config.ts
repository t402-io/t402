import { defineConfig } from "tsup";

export default defineConfig({
  entry: [
    "src/index.ts",
    "src/exact-direct/client/index.ts",
    "src/exact-direct/server/index.ts",
    "src/exact-direct/facilitator/index.ts",
  ],
  format: ["cjs", "esm"],
  dts: true,
  splitting: false,
  sourcemap: true,
  clean: true,
  outDir: "dist",
  outExtension({ format }) {
    return {
      js: format === "cjs" ? ".cjs" : ".mjs",
      dts: format === "cjs" ? ".d.cts" : ".d.mts",
    };
  },
});
