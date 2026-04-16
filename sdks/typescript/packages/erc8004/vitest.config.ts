import { resolve } from "path";
import { createVitestConfig } from "../../config/vitest.base";

export default createVitestConfig({
  globals: true,
  pool: "forks",
  coverage: true,
  include: ["test/**/*.test.ts"],
  aliases: {
    "@t402/core/types": resolve(__dirname, "../core/src/types"),
    "@t402/core/client": resolve(__dirname, "../core/src/client"),
    "@t402/core/server": resolve(__dirname, "../core/src/server"),
    "@t402/core": resolve(__dirname, "../core/src"),
  },
});
