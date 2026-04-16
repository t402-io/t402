import { createVitestConfig } from "../../config/vitest.base";

export default createVitestConfig({
  noLoadEnv: true,
  globals: true,
  environment: "node",
  include: ["test/**/*.test.ts"],
  coverage: true,
});
