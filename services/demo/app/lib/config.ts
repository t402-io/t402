export const FACILITATOR_URL =
  process.env.NEXT_PUBLIC_FACILITATOR_URL || "https://facilitator.t402.io";

export const PAY_TO =
  process.env.DEMO_PAY_TO_ADDRESS || "0xC88f67e776f16DcFBf42e6bDda1B82604448899B";

export const TESTNET_NETWORK = "eip155:84532"; // Base Sepolia
export const MAINNET_NETWORK = "eip155:8453"; // Base

// USDT on Base Sepolia (test token)
export const TESTNET_ASSET = "0x036CbD53842c5426634e7929541eC2318f3dCF7e";
// USDT on Base mainnet
export const MAINNET_ASSET = "0x833589fCD6eDb6E08f4c7C32D4f71b54bda02913";

export const DEMO_AMOUNT = "1000"; // 0.001 USDT (6 decimals)

export function getNetwork() {
  return process.env.NEXT_PUBLIC_TESTNET === "true" ? TESTNET_NETWORK : MAINNET_NETWORK;
}

export function getAsset() {
  return process.env.NEXT_PUBLIC_TESTNET === "true" ? TESTNET_ASSET : MAINNET_ASSET;
}
