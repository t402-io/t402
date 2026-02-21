import { defineConfig } from "tsup";

export default defineConfig([
  {
    entry: { index: "src/index.ts", bin: "src/bin.ts" },
    format: ["esm"],
    outDir: "dist/esm",
    external: ["@t402/wdk", "@t402/wdk-gasless"],
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
    external: ["@t402/wdk", "@t402/wdk-gasless"],
    dts: true,
    sourcemap: true,
    target: "es2020",
  },
]);
