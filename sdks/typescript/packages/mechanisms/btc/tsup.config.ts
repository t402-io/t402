import { createTsupConfig } from "../../../config/tsup.base";

export default createTsupConfig({
  entry: {
    index: "src/index.ts",
    "exact/client/index": "src/exact/client/index.ts",
    "exact/server/index": "src/exact/server/index.ts",
    "exact/facilitator/index": "src/exact/facilitator/index.ts",
    "lightning/client/index": "src/lightning/client/index.ts",
    "lightning/server/index": "src/lightning/server/index.ts",
    "lightning/facilitator/index": "src/lightning/facilitator/index.ts",
  },
});
