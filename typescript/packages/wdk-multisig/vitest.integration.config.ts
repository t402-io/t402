import { defineConfig } from "vitest/config";
import tsconfigPaths from "vite-tsconfig-paths";

export default defineConfig({
  plugins: [tsconfigPaths({ projects: ["."] })],
  test: {
    globals: true,
    environment: "node",
    include: ["test/integration/**/*.test.ts"],
    testTimeout: 30000,
    hookTimeout: 30000,
  },
});
