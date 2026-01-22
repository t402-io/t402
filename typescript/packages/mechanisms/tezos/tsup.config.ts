import { defineConfig } from "tsup";

export default defineConfig({
  entry: {
    index: "src/index.ts",
    "exact-direct/client/index": "src/exact-direct/client/index.ts",
    "exact-direct/server/index": "src/exact-direct/server/index.ts",
    "exact-direct/facilitator/index": "src/exact-direct/facilitator/index.ts",
  },
  format: ["cjs", "esm"],
  dts: true,
  splitting: false,
  sourcemap: true,
  clean: true,
  outExtension({ format }) {
    return {
      js: format === "esm" ? ".mjs" : ".js",
    };
  },
});
