import { createTsupConfig } from "../../../config/tsup.base";

export default createTsupConfig({
  entry: {
    index: "src/index.ts",
    "exact-direct/client/index": "src/exact-direct/client/index.ts",
    "exact-direct/server/index": "src/exact-direct/server/index.ts",
    "exact-direct/facilitator/index": "src/exact-direct/facilitator/index.ts",
    "upto/index": "src/upto/index.ts",
  },
});
