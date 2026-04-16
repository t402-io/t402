import { createVitestConfig } from "../../../config/vitest.base";

export default createVitestConfig({
  noLoadEnv: true,
  noTsconfigPaths: true,
  pool: "forks",
  include: ["test/**/*.test.ts"],
});
