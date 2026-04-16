import { createTsupConfig } from "../../config/tsup.base";

export default createTsupConfig({
  entry: {
    index: "src/index.ts",
    "client/index": "src/client/index.ts",
    "facilitator/index": "src/facilitator/index.ts",
    "http/index": "src/http/index.ts",
    "server/index": "src/server/index.ts",
    "types/index": "src/types/index.ts",
    "types/v1/index": "src/types/v1/index.ts",
    "utils/index": "src/utils/index.ts",
  },
});
