import { expect, test, describe } from "vitest";
import { Resource } from "./types";
import { baseSepolia } from "viem/chains";
import { botWallet, facilitatorWallet } from "./wallet";
import { Address } from "viem";
import { createPayment } from "./client";
import { getUsdcAddressForChain } from "./usdc";
import { settlePayment, verifyPayment } from "./facilitator";

describe("settlePayment", () => {
  const wallet = botWallet;

  test("happy path", async () => {
    const paymentDetails = {
      version: 1,
      maxAmountRequired: BigInt(1 * 10 ** 5),
      resource: "https://example.com" as Resource,
      description: "example",
      mimeType: "text/plain",
      routerAddress: facilitatorWallet.account!.address,
      resourceMaxTimeSeconds: 10,
      recommendedDeadlineSeconds: 6000,
      chainId: baseSepolia.id,
      usdcAddress: getUsdcAddressForChain(baseSepolia.id),
    };

    const payment = await createPayment(wallet, paymentDetails);

    const valid = await verifyPayment(wallet, payment, paymentDetails);
    expect(valid.isValid).toBe(true);

    const result = await settlePayment(
      facilitatorWallet,
      payment,
      paymentDetails
    );
    expect(result.success).toBe(true);
  });
});
