import { serve } from "@hono/node-server";
import { makeServer } from "../src/facilitator";
import { facilitatorWallet } from "../src/shared/wallet";

const port = 4020;
const app = makeServer(facilitatorWallet);

console.log(`Facilitator running on port ${port}`);

serve({
  port: port,
  fetch: app.fetch,
});
