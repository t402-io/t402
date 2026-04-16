import { createVitestConfig } from "../../../config/vitest.base";

export default createVitestConfig({
  noLoadEnv: true,
  globals: true,
  environment: "node",
  include: ["test/unit/**/*.test.ts", "test/**/*.test.ts"],
  exclude: ["test/integrations/**"],
});
