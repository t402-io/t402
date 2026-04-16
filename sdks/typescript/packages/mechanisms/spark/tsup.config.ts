import { createTsupConfig } from "../../../config/tsup.base";

export default createTsupConfig({
  entry: ["src/index.ts"],
  simpleDts: true,
});
