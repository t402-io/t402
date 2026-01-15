import { base58 } from "@scure/base";
import { createKeyPairSignerFromBytes } from "@solana/kit";
import { t402Facilitator } from "@t402/core/facilitator";
import {
  PaymentPayload,
  PaymentRequirements,
  SettleResponse,
  VerifyResponse,
} from "@t402/core/types";
import { toFacilitatorEvmSigner } from "@t402/evm";
import { registerExactEvmScheme } from "@t402/evm/exact/facilitator";
import { toFacilitatorSvmSigner } from "@t402/svm";
import { registerExactSvmScheme } from "@t402/svm/exact/facilitator";
import dotenv from "dotenv";
import express from "express";
import { createWalletClient, http, publicActions } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { baseSepolia } from "viem/chains";

// Import Prometheus metrics
import {
  register,
  metricsMiddleware,
  recordVerification,
  recordSettlement,
  recordError,
} from "./metrics.js";

dotenv.config();

// Configuration
const PORT = process.env.PORT || "4022";
const METRICS_ENABLED = process.env.METRICS_ENABLED !== "false";

// Validate required environment variables
if (!process.env.EVM_PRIVATE_KEY) {
  console.error("❌ EVM_PRIVATE_KEY environment variable is required");
  process.exit(1);
}

if (!process.env.SVM_PRIVATE_KEY) {
  console.error("❌ SVM_PRIVATE_KEY environment variable is required");
  process.exit(1);
}

// Initialize the EVM account from private key
const evmAccount = privateKeyToAccount(
  process.env.EVM_PRIVATE_KEY as `0x${string}`,
);
console.info(`EVM Facilitator account: ${evmAccount.address}`);

// Initialize the SVM account from private key
const svmAccount = await createKeyPairSignerFromBytes(
  base58.decode(process.env.SVM_PRIVATE_KEY as string),
);
console.info(`SVM Facilitator account: ${svmAccount.address}`);

// Create a Viem client with both wallet and public capabilities
const viemClient = createWalletClient({
  account: evmAccount,
  chain: baseSepolia,
  transport: http(),
}).extend(publicActions);

// Initialize the t402 Facilitator with EVM and SVM support

const evmSigner = toFacilitatorEvmSigner({
  getCode: (args: { address: `0x${string}` }) => viemClient.getCode(args),
  address: evmAccount.address,
  readContract: (args: {
    address: `0x${string}`;
    abi: readonly unknown[];
    functionName: string;
    args?: readonly unknown[];
  }) =>
    viemClient.readContract({
      ...args,
      args: args.args || [],
    }),
  verifyTypedData: (args: {
    address: `0x${string}`;
    domain: Record<string, unknown>;
    types: Record<string, unknown>;
    primaryType: string;
    message: Record<string, unknown>;
    signature: `0x${string}`;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  }) => viemClient.verifyTypedData(args as any),
  writeContract: (args: {
    address: `0x${string}`;
    abi: readonly unknown[];
    functionName: string;
    args: readonly unknown[];
  }) =>
    viemClient.writeContract({
      ...args,
      args: args.args || [],
    }),
  sendTransaction: (args: { to: `0x${string}`; data: `0x${string}` }) =>
    viemClient.sendTransaction(args),
  waitForTransactionReceipt: (args: { hash: `0x${string}` }) =>
    viemClient.waitForTransactionReceipt(args),
});

// Facilitator can now handle all Solana networks with automatic RPC creation
const svmSigner = toFacilitatorSvmSigner(svmAccount);

// Track operation start times for duration metrics
const operationTimers = new Map<string, number>();

function getOperationKey(
  operation: "verify" | "settle",
  payload: PaymentPayload,
): string {
  // Use accepted network and resource URL for uniqueness
  return `${operation}:${payload.accepted.network}:${payload.resource.url}:${Date.now()}`;
}

const facilitator = new t402Facilitator()
  .onBeforeVerify(async (context) => {
    const key = getOperationKey("verify", context.paymentPayload);
    operationTimers.set(key, Date.now());
    // Store the key in the context for later retrieval
    (context as { _metricsKey?: string })._metricsKey = key;
    console.log("Before verify", context.requirements.network);
  })
  .onAfterVerify(async (context) => {
    const key = (context as { _metricsKey?: string })._metricsKey;
    const startTime = key ? operationTimers.get(key) : undefined;
    const duration = startTime ? Date.now() - startTime : 0;
    if (key) operationTimers.delete(key);

    const { network, scheme } = context.requirements;
    const isValid = context.result.isValid;

    if (METRICS_ENABLED) {
      recordVerification(isValid, network, scheme, duration);
    }

    console.log(
      `Verify ${isValid ? "success" : "failed"}: ${network} (${duration}ms)`,
    );
  })
  .onVerifyFailure(async (context) => {
    const key = (context as { _metricsKey?: string })._metricsKey;
    const startTime = key ? operationTimers.get(key) : undefined;
    const duration = startTime ? Date.now() - startTime : 0;
    if (key) operationTimers.delete(key);

    const { network, scheme } = context.requirements;

    if (METRICS_ENABLED) {
      recordVerification(false, network, scheme, duration);
      recordError("verification", network);
    }

    console.error(`Verify error: ${network}`, context.error.message);
  })
  .onBeforeSettle(async (context) => {
    const key = getOperationKey("settle", context.paymentPayload);
    operationTimers.set(key, Date.now());
    (context as { _metricsKey?: string })._metricsKey = key;
    console.log("Before settle", context.requirements.network);
  })
  .onAfterSettle(async (context) => {
    const key = (context as { _metricsKey?: string })._metricsKey;
    const startTime = key ? operationTimers.get(key) : undefined;
    const duration = startTime ? Date.now() - startTime : 0;
    if (key) operationTimers.delete(key);

    const { network, scheme } = context.requirements;
    const success = context.result.success;

    if (METRICS_ENABLED) {
      // Extract payment amount from requirements if available
      const amount = context.requirements.amount
        ? BigInt(context.requirements.amount)
        : undefined;
      const token = context.requirements.asset;

      recordSettlement(success, network, scheme, duration, amount, token);
    }

    console.log(
      `Settle ${success ? "success" : "failed"}: ${network} (${duration}ms)`,
    );
  })
  .onSettleFailure(async (context) => {
    const key = (context as { _metricsKey?: string })._metricsKey;
    const startTime = key ? operationTimers.get(key) : undefined;
    const duration = startTime ? Date.now() - startTime : 0;
    if (key) operationTimers.delete(key);

    const { network, scheme } = context.requirements;

    if (METRICS_ENABLED) {
      recordSettlement(false, network, scheme, duration);
      recordError("settlement", network);
    }

    console.error(`Settle error: ${network}`, context.error.message);
  });

// Register EVM and SVM schemes using the new register helpers
registerExactEvmScheme(facilitator, {
  signer: evmSigner,
  networks: "eip155:84532", // Base Sepolia
  deployERC4337WithEIP6492: true,
});
registerExactSvmScheme(facilitator, {
  signer: svmSigner,
  networks: "solana:EtWTRABZaYq6iMfeYKouRu166VU2xqa1", // Devnet
});

// Initialize Express app
const app = express();

// Add metrics middleware before other middleware
if (METRICS_ENABLED) {
  app.use(metricsMiddleware);
}

app.use(express.json());

/**
 * GET /health
 * Health check endpoint
 */
app.get("/health", (_req, res) => {
  res.json({
    status: "healthy",
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
  });
});

/**
 * GET /metrics
 * Prometheus metrics endpoint
 */
if (METRICS_ENABLED) {
  app.get("/metrics", async (_req, res) => {
    try {
      res.set("Content-Type", register.contentType);
      res.end(await register.metrics());
    } catch (error) {
      console.error("Metrics error:", error);
      res.status(500).json({
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
  });
}

/**
 * POST /verify
 * Verify a payment against requirements
 *
 * Note: Payment tracking and bazaar discovery are handled by lifecycle hooks
 */
app.post("/verify", async (req, res) => {
  try {
    const { paymentPayload, paymentRequirements } = req.body as {
      paymentPayload: PaymentPayload;
      paymentRequirements: PaymentRequirements;
    };

    if (!paymentPayload || !paymentRequirements) {
      return res.status(400).json({
        error: "Missing paymentPayload or paymentRequirements",
      });
    }

    // Hooks will automatically:
    // - Track verified payment (onAfterVerify)
    // - Extract and catalog discovery info (onAfterVerify)
    // - Record Prometheus metrics
    const response: VerifyResponse = await facilitator.verify(
      paymentPayload,
      paymentRequirements,
    );

    res.json(response);
  } catch (error) {
    console.error("Verify error:", error);
    if (METRICS_ENABLED) {
      recordError("internal", req.body?.paymentRequirements?.network);
    }
    res.status(500).json({
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
});

/**
 * POST /settle
 * Settle a payment on-chain
 *
 * Note: Verification validation and cleanup are handled by lifecycle hooks
 */
app.post("/settle", async (req, res) => {
  try {
    const { paymentPayload, paymentRequirements } = req.body;

    if (!paymentPayload || !paymentRequirements) {
      return res.status(400).json({
        error: "Missing paymentPayload or paymentRequirements",
      });
    }

    // Hooks will automatically:
    // - Validate payment was verified (onBeforeSettle - will abort if not)
    // - Check verification timeout (onBeforeSettle)
    // - Clean up tracking (onAfterSettle / onSettleFailure)
    // - Record Prometheus metrics
    const response: SettleResponse = await facilitator.settle(
      paymentPayload as PaymentPayload,
      paymentRequirements as PaymentRequirements,
    );

    res.json(response);
  } catch (error) {
    console.error("Settle error:", error);

    // Check if this was an abort from hook
    if (
      error instanceof Error &&
      error.message.includes("Settlement aborted:")
    ) {
      // Return a proper SettleResponse instead of 500 error
      return res.json({
        success: false,
        errorReason: error.message.replace("Settlement aborted: ", ""),
        network: req.body?.paymentPayload?.network || "unknown",
      } as SettleResponse);
    }

    if (METRICS_ENABLED) {
      recordError("internal", req.body?.paymentRequirements?.network);
    }
    res.status(500).json({
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
});

/**
 * GET /supported
 * Get supported payment kinds and extensions
 */
app.get("/supported", async (_req, res) => {
  try {
    const response = facilitator.getSupported();
    res.json(response);
  } catch (error) {
    console.error("Supported error:", error);
    if (METRICS_ENABLED) {
      recordError("internal");
    }
    res.status(500).json({
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
});

// Start the server
app.listen(parseInt(PORT), () => {
  console.log(`Facilitator listening on port ${PORT}`);
  console.log(`Metrics endpoint: http://localhost:${PORT}/metrics`);
  console.log(`Health endpoint: http://localhost:${PORT}/health`);
});
