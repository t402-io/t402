import { createTsupConfig } from "../../config/tsup.base";

export default createTsupConfig({
  entry: {
    index: "src/index.ts",
    "bazaar/index": "src/bazaar/index.ts",
    "sign-in-with-x/index": "src/sign-in-with-x/index.ts",
    "payment-id/index": "src/payment-id/index.ts",
    "eip2612-gas-sponsoring/index": "src/eip2612-gas-sponsoring/index.ts",
    "erc20-approval-gas-sponsoring/index": "src/erc20-approval-gas-sponsoring/index.ts",
  },
});
