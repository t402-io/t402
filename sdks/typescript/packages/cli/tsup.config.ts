import { createTsupConfig } from "../../config/tsup.base";

export default createTsupConfig({
  entry: { index: "src/index.ts" },
  esmEntry: { index: "src/index.ts", bin: "src/bin.ts" },
  external: ["@t402/wdk", "@t402/wdk-gasless"],
  banner: { js: "#!/usr/bin/env node" },
});
