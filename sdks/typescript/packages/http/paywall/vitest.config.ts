import { createVitestConfig } from "../../../config/vitest.base";

export default createVitestConfig({
  setupFiles: ["./src/test-setup.ts"],
});
