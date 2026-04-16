import { createTsupConfig } from "../../config/tsup.base";

export default createTsupConfig({
  entry: { index: "src/index.ts" },
});
