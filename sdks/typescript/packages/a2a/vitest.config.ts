import { resolve } from "path";
import { createVitestConfig } from "../../config/vitest.base";

export default createVitestConfig({
  noLoadEnv: true,
  globals: true,
  environment: "node",
  pool: "forks",
  include: ["test/**/*.test.ts"],
  coverage: true,
  aliases: {
    "@t402/core/types": resolve(__dirname, "../core/src/types"),
    "@t402/core/server": resolve(__dirname, "../core/src/server"),
    "@t402/core": resolve(__dirname, "../core/src"),
  },
});
