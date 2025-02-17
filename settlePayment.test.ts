import { expect, test, describe } from "vitest";
import { Resource } from "./types";
import { baseSepolia } from "viem/chains";
import { botWallet, facilitatorWallet } from "./wallet";
import { Address } from "viem";
import { createPayment } from "./client";
import { getUsdcAddressForChain, getUSDCBalance } from "./usdc";
import { settlePayment, verifyPayment } from "./facilitator";

describe("settlePayment", () => {
  const wallet = botWallet;
  const resourceAddress = process.env.RESOURCE_WALLET_ADDRESS as Address;

  test("happy path", async () => {
    const initialBalance = await getUSDCBalance(wallet, resourceAddress);

    const paymentDetails = {
      version: 1,
      maxAmountRequired: BigInt(0.01 * 10 ** 6), // 0.01 USDC
      resource: "https://example.com" as Resource,
      description: "example",
      mimeType: "text/plain",
      resourceAddress: resourceAddress,
      resourceMaxTimeSeconds: 60,
      recommendedDeadlineSeconds: 10,
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

    const finalBalance = await getUSDCBalance(wallet, resourceAddress);

    expect(finalBalance).toBe(
      initialBalance + paymentDetails.maxAmountRequired
    );
  });
});
