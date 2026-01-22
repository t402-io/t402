import { defineConfig } from "tsup";

export default defineConfig([
  {
    entry: { index: "src/index.ts", bin: "src/bin.ts" },
    format: ["esm"],
    outDir: "dist/esm",
    dts: true,
    sourcemap: true,
    clean: true,
    target: "es2020",
    banner: {
      js: "#!/usr/bin/env node",
    },
  },
  {
    entry: { index: "src/index.ts" },
    format: ["cjs"],
    outDir: "dist/cjs",
    dts: true,
    sourcemap: true,
    target: "es2020",
  },
]);
