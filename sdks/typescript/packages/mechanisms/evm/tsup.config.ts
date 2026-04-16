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
    // Permit2 scheme
    "permit2/index": "src/permit2/index.ts",
    "permit2/client/index": "src/permit2/client/index.ts",
    "permit2/server/index": "src/permit2/server/index.ts",
    "permit2/facilitator/index": "src/permit2/facilitator/index.ts",
    // Permit2 Proxy scheme
    "permit2-proxy/index": "src/permit2-proxy/index.ts",
    "permit2-proxy/client/index": "src/permit2-proxy/client/index.ts",
    "permit2-proxy/server/index": "src/permit2-proxy/server/index.ts",
    "permit2-proxy/facilitator/index": "src/permit2-proxy/facilitator/index.ts",
    // Up-To scheme (DRAFT)
    "upto/client/index": "src/upto/client/index.ts",
    "upto/index": "src/upto/index.ts",
  },
});
