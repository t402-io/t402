import { createTsupConfig } from "../../../config/tsup.base";

export default createTsupConfig({
  entry: {
    index: "src/index.ts",
    express: "src/express.ts",
    fastify: "src/fastify.ts",
    hono: "src/hono.ts",
  },
  target: "node16",
});
