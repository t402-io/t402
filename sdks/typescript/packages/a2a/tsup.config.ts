import { createTsupConfig } from "../../config/tsup.base";

export default createTsupConfig({
  entry: ["src/index.ts", "src/client.ts", "src/server.ts"],
  simpleDts: true,
  noSourcemap: true,
  explicitExtensions: true,
});
