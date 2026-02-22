import { defineConfig } from "vitest/config";
import tsconfigPaths from "vite-tsconfig-paths";
import { resolve } from "path";

export default defineConfig({
  plugins: [tsconfigPaths()],
  resolve: {
    alias: {
      "@t402/core/types": resolve(__dirname, "../core/src/types"),
      "@t402/core/client": resolve(__dirname, "../core/src/client"),
      "@t402/core/server": resolve(__dirname, "../core/src/server"),
      "@t402/core": resolve(__dirname, "../core/src"),
    },
  },
  test: {
    globals: true,
    environment: "node",
    pool: "forks",
    include: ["test/**/*.test.ts"],
    coverage: {
      provider: "v8",
      reporter: ["text", "json", "html"],
    },
  },
});
