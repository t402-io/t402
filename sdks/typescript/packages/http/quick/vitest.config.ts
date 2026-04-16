import { createVitestConfig } from "../../../config/vitest.base";

export default createVitestConfig({ noLoadEnv: true, pool: "forks" });
