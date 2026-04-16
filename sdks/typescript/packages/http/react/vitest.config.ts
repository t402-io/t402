import { createVitestConfig } from "../../../config/vitest.base";

export default createVitestConfig({
  noLoadEnv: true,
  globals: true,
  environment: "jsdom",
  setupFiles: ["./src/test-setup.ts"],
});
