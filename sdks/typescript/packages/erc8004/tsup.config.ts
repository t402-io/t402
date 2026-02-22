import { defineConfig } from "tsup";

export default defineConfig([
  {
    entry: ["src/index.ts"],
    format: ["esm"],
    dts: true,
    clean: true,
    outDir: "dist/esm",
    outExtension() {
      return { js: ".mjs", dts: ".d.mts" };
    },
  },
  {
    entry: ["src/index.ts"],
    format: ["cjs"],
    dts: true,
    clean: false,
    outDir: "dist/cjs",
    outExtension() {
      return { js: ".cjs", dts: ".d.cts" };
    },
  },
]);
