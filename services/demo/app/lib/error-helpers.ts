import type { ChainFamily } from "@/lib/testnet-config";

export type ErrorType = "network" | "wallet-rejected" | "insufficient-funds" | "facilitator" | "timeout" | "unknown";

export function classifyError(error: unknown): ErrorType {
  const msg = error instanceof Error ? error.message : String(error);
  const lower = msg.toLowerCase();

  if (lower.includes("rejected") || lower.includes("denied") || lower.includes("cancelled") || lower.includes("user refused")) {
    return "wallet-rejected";
  }
  if (lower.includes("insufficient") || lower.includes("balance") || lower.includes("verify_signature") || lower.includes("payment failed")) {
    return "insufficient-funds";
  }
  if (lower.includes("timed out") || lower.includes("timeout") || lower.includes("aborted")) {
    return "timeout";
  }
  if (lower.includes("facilitator") || lower.includes("503") || lower.includes("service unavailable")) {
    return "facilitator";
  }
  if (lower.includes("network") || lower.includes("fetch") || lower.includes("econnrefused")) {
    return "network";
  }
  return "unknown";
}

export function getUserFriendlyMessage(type: ErrorType, originalMessage: string): string {
  switch (type) {
    case "wallet-rejected":
      return "You declined the signature request. Try again when ready.";
    case "insufficient-funds":
      return "Insufficient token balance. You need tokens to complete this payment.";
    case "timeout":
      return "Request timed out. The facilitator may be busy — try again.";
    case "facilitator":
      return "The facilitator service is temporarily unavailable. Please try again later.";
    case "network":
      return "Network error. Please check your internet connection.";
    default:
      return originalMessage;
  }
}

export function getErrorAction(type: ErrorType, family: ChainFamily): string | null {
  switch (type) {
    case "insufficient-funds":
      return "Get test tokens from the faucet link above.";
    case "wallet-rejected":
      return "Click the payment button to try again.";
    case "timeout":
    case "facilitator":
    case "network":
      return "Wait a moment and try again.";
    default:
      return null;
  }
}
