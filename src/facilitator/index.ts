export * from "./facilitator";

import { Hono } from "hono";
import { logger } from "hono/logger";

import { SignerWallet } from "../shared/wallet";
import {
  PaymentPayloadV1,
  PaymentNeededDetails,
  paymentNeededDetailsSchema,
  paymentPayloadV1Schema,
} from "../shared/types";
import { settlePayment, verifyPayment } from "./facilitator";
import {
  paymentNeededDetailsFromObj,
  paymentPayloadV1FromObj,
} from "../shared/types/convert";

type VerifyRequest = {
  payload: PaymentPayloadV1;
  details: PaymentNeededDetails;
};

type SettleRequest = {
  payload: PaymentPayloadV1;
  details: PaymentNeededDetails;
};

export function makeServer(wallet: SignerWallet): Hono {
  const app = new Hono();
  app.use("*", logger());

  app.post("/verify", async (c) => {
    // TODO: add zod validation
    const req = await c.req.json();
    console.log(req);

    const paymentDetails = paymentNeededDetailsFromObj(req.details);
    const payload = paymentPayloadV1FromObj(req.payload);

    const valid = await verifyPayment(wallet, payload, paymentDetails);

    return c.json(valid);
  });

  app.post("/settle", async (c) => {
    // TODO: add zod validation
    const req: SettleRequest = await c.req.json();

    const paymentDetails = paymentNeededDetailsFromObj(req.details);
    const payload = paymentPayloadV1FromObj(req.payload);

    const res = await settlePayment(wallet, payload, paymentDetails);

    return c.json(res);
  });

  return app;
}
