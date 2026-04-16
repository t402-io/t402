import { createVitestConfig } from "../../config/vitest.base";

export default createVitestConfig({ coverage: true, pool: "forks" });
