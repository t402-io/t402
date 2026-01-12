import { defineConfig } from "vitest/config";
import vue from "@vitejs/plugin-vue";
import tsconfigPaths from "vite-tsconfig-paths";

export default defineConfig({
  plugins: [vue(), tsconfigPaths({ projects: ["."] })],
  test: {
    globals: true,
    environment: "happy-dom",
  },
});
