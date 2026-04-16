import { createTsupConfig } from "../../../config/tsup.base";

export default createTsupConfig({
  entry: {
    index: "src/index.ts",
    "v1/index": "src/v1/index.ts",
    "exact/client/index": "src/exact/client/index.ts",
    "exact/server/index": "src/exact/server/index.ts",
    "exact/facilitator/index": "src/exact/facilitator/index.ts",
    "exact/v1/client/index": "src/exact/v1/client/index.ts",
    "exact/v1/facilitator/index": "src/exact/v1/facilitator/index.ts",
    "upto/index": "src/upto/index.ts",
  },
});
