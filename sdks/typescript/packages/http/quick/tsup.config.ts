import { defineConfig } from "tsup";

const baseConfig = {
  entry: {
    index: "src/index.ts",
    express: "src/express.ts",
    fastify: "src/fastify.ts",
    hono: "src/hono.ts",
  },
  dts: {
    resolve: true,
  },
  sourcemap: true,
  target: "node16" as const,
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
