import { createTsupConfig } from "../../config/tsup.base";

export default createTsupConfig({
  entry: {
    index: "src/index.ts",
    "server/index": "src/server/index.ts",
    "tools/index": "src/tools/index.ts",
  },
  external: ["@t402/wdk", "@t402/wdk-protocol"],
});
