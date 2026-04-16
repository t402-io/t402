import { createVitestConfig } from "../../../config/vitest.base";

export default createVitestConfig({
  noLoadEnv: true,
  noTsconfigPaths: true,
  globals: true,
  environment: "node",
  include: ["test/**/*.test.ts"],
  exclude: ["test/integrations/**/*.test.ts"],
  coverage: true,
  coverageInclude: ["src/**/*.ts"],
  coverageExclude: ["src/**/*.d.ts"],
});
