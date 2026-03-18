import { defineConfig } from "tsup";
export default defineConfig([
  { entry: ["src/index.ts"], format: ["esm"], dts: true, outDir: "dist/esm", sourcemap: true },
  { entry: ["src/index.ts"], format: ["cjs"], dts: true, outDir: "dist/cjs", sourcemap: true },
]);
