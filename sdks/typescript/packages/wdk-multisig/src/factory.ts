/**
 * WDK Multi-sig Factory Functions
 *
 * Factory functions to create multi-sig gasless clients from
 * single or multiple seed phrases.
 */

import type { PublicClient, Chain, Transport } from "viem";
import { createPublicClient, http } from "viem";
import { arbitrum, mainnet, base, optimism, polygon, sepolia } from "viem/chains";
import type { BundlerConfig, PaymasterConfig } from "@t402/evm";
import { T402WDK } from "@t402/wdk";
import type { WDKSigner, T402WDKConfig } from "@t402/wdk";
import type { SingleSeedConfig, MultiSeedConfig } from "./types.js";
import { createMultiSigWdkSmartAccount } from "./account.js";
import { MultiSigWdkGaslessClient } from "./client.js";
import { MultiSigError } from "./errors.js";
import { isValidThreshold } from "./utils.js";

/**
 * Chain ID mapping
 */
const CHAIN_IDS: Record<string, number> = {
  ethereum: 1,
  arbitrum: 42161,
  "arbitrum-sepolia": 421614,
  base: 8453,
  "base-sepolia": 84532,
  optimism: 10,
  "optimism-sepolia": 11155420,
  polygon: 137,
  ink: 57073,
  berachain: 80084,
  unichain: 130,
  sepolia: 11155111,
};

/**
 * Chain configurations mapping
 */
const CHAIN_CONFIGS: Record<string, Chain> = {
  ethereum: mainnet,
  arbitrum,
  base,
  optimism,
  polygon,
  sepolia,
};

function getChainId(chain: string): number {
  const chainId = CHAIN_IDS[chain.toLowerCase()];
  if (!chainId) {
    throw new Error(`Unknown chain: ${chain}`);
  }
  return chainId;
}

/**
 * Create a multi-sig gasless client from a single seed phrase
 *
 * Uses different HD derivation paths to create multiple owner addresses
 * from a single seed phrase. Useful for individual users who want
 * multi-sig security using one seed.
 *
 * @example
 * ```typescript
 * const client = await createMultiSigFromSingleSeed({
 *   seedPhrase: 'word1 word2 ... word24',
 *   accountIndices: [0, 1, 2], // 3 owners from indices 0, 1, 2
 *   threshold: 2, // 2-of-3 multi-sig
 *   chainConfig: { arbitrum: 'https://arb1.arbitrum.io/rpc' },
 *   chain: 'arbitrum',
 *   bundler: { bundlerUrl: '...', chainId: 42161 },
 * });
 *
 * // All signers available - direct payment
 * const result = await client.payWithAllSigners(
 *   { to: '0x...', amount: 1000000n },
 *   client.getSigners()
 * );
 * ```
 */
export async function createMultiSigFromSingleSeed(
  config: SingleSeedConfig,
): Promise<MultiSigWdkGaslessClient> {
  const {
    seedPhrase,
    accountIndices,
    threshold,
    chainConfig,
    chain,
    saltNonce,
    bundler,
    paymaster,
  } = config;

  // Validate
  if (accountIndices.length === 0) {
    throw MultiSigError.insufficientSigners(1, 0);
  }

  if (!isValidThreshold(threshold, accountIndices.length)) {
    throw MultiSigError.invalidThreshold(threshold, accountIndices.length);
  }

  // Create WDK instance
  const wdk = new T402WDK(seedPhrase, chainConfig);

  // Create public client for the chain
  const publicClient = getPublicClient(chainConfig, chain);
  const chainId = getChainId(chain);

  // Create WDK signers for each account index using T402WDK's getSigner method
  const signers: WDKSigner[] = await Promise.all(
    accountIndices.map((index) => wdk.getSigner(chain, index)),
  );

  // Create multi-sig smart account
  const smartAccount = await createMultiSigWdkSmartAccount({
    owners: signers,
    threshold,
    chainId,
    publicClient,
    saltNonce,
  });

  // Create and return the gasless client
  return new MultiSigWdkGaslessClient({
    signer: smartAccount,
    bundler,
    paymaster,
    chainId,
    publicClient,
  });
}

/**
 * Create a multi-sig gasless client from multiple seed phrases
 *
 * Each seed phrase generates one owner address. Useful for
 * multi-party setups where each participant controls their own key.
 *
 * @example
 * ```typescript
 * const client = await createMultiSigFromMultipleSeeds({
 *   seedPhrases: [partyASeed, partyBSeed, partyCSeed],
 *   threshold: 2, // 2-of-3 multi-sig
 *   chainConfig: { arbitrum: 'https://arb1.arbitrum.io/rpc' },
 *   chain: 'arbitrum',
 *   bundler: { bundlerUrl: '...', chainId: 42161 },
 * });
 *
 * // Initiate payment (creates pending request)
 * const request = await client.initiatePayment({
 *   to: '0x...',
 *   amount: 1000000n,
 * });
 *
 * // Party A signs
 * await request.addSignature(0, partyASigner);
 *
 * // Party B signs
 * await request.addSignature(1, partyBSigner);
 *
 * // Submit with threshold met
 * const result = await request.submit();
 * ```
 */
export async function createMultiSigFromMultipleSeeds(
  config: MultiSeedConfig,
): Promise<MultiSigWdkGaslessClient> {
  const {
    seedPhrases,
    threshold,
    chainConfig,
    chain,
    saltNonce,
    bundler,
    paymaster,
  } = config;

  // Validate
  if (seedPhrases.length === 0) {
    throw MultiSigError.insufficientSigners(1, 0);
  }

  if (!isValidThreshold(threshold, seedPhrases.length)) {
    throw MultiSigError.invalidThreshold(threshold, seedPhrases.length);
  }

  // Create public client for the chain
  const publicClient = getPublicClient(chainConfig, chain);
  const chainId = getChainId(chain);

  // Create WDK signers for each seed phrase
  const signers: WDKSigner[] = await Promise.all(
    seedPhrases.map(async (seedPhrase) => {
      const wdk = new T402WDK(seedPhrase, chainConfig);
      return wdk.getSigner(chain, 0);
    }),
  );

  // Create multi-sig smart account
  const smartAccount = await createMultiSigWdkSmartAccount({
    owners: signers,
    threshold,
    chainId,
    publicClient,
    saltNonce,
  });

  // Create and return the gasless client
  return new MultiSigWdkGaslessClient({
    signer: smartAccount,
    bundler,
    paymaster,
    chainId,
    publicClient,
  });
}

/**
 * Create a multi-sig gasless client from existing WDK signers
 *
 * Use this when you already have initialized WDK signers.
 *
 * @example
 * ```typescript
 * const signers = [signer1, signer2, signer3];
 *
 * const client = await createMultiSigFromSigners({
 *   signers,
 *   threshold: 2,
 *   chainId: 42161,
 *   publicClient,
 *   bundler: { bundlerUrl: '...', chainId: 42161 },
 * });
 * ```
 */
export async function createMultiSigFromSigners(config: {
  signers: WDKSigner[];
  threshold: number;
  chainId: number;
  publicClient: PublicClient;
  saltNonce?: bigint;
  bundler: BundlerConfig;
  paymaster?: PaymasterConfig;
}): Promise<MultiSigWdkGaslessClient> {
  const {
    signers,
    threshold,
    chainId,
    publicClient,
    saltNonce,
    bundler,
    paymaster,
  } = config;

  // Validate
  if (signers.length === 0) {
    throw MultiSigError.insufficientSigners(1, 0);
  }

  if (!isValidThreshold(threshold, signers.length)) {
    throw MultiSigError.invalidThreshold(threshold, signers.length);
  }

  // Ensure all signers are initialized
  await Promise.all(
    signers.map(async (signer) => {
      if (!signer.isInitialized) {
        await signer.initialize();
      }
    }),
  );

  // Create multi-sig smart account
  const smartAccount = await createMultiSigWdkSmartAccount({
    owners: signers,
    threshold,
    chainId,
    publicClient,
    saltNonce,
  });

  // Create and return the gasless client
  return new MultiSigWdkGaslessClient({
    signer: smartAccount,
    bundler,
    paymaster,
    chainId,
    publicClient,
  });
}

/**
 * Get public client from chain config
 */
function getPublicClient(
  chainConfig: T402WDKConfig,
  chain: string,
): PublicClient<Transport, Chain> {
  // The chain config contains RPC URLs or EvmChainConfig objects
  const config = chainConfig[chain];
  if (!config) {
    throw new Error(`No RPC URL configured for chain: ${chain}`);
  }

  // Extract RPC URL from config (can be string or EvmChainConfig object)
  const rpcUrl = typeof config === "string" ? config : config.provider;
  if (!rpcUrl) {
    throw new Error(`No RPC URL found in chain config for: ${chain}`);
  }

  // Get viem chain config
  const viemChain = CHAIN_CONFIGS[chain.toLowerCase()] ?? arbitrum;

  return createPublicClient({
    chain: viemChain,
    transport: http(rpcUrl),
  });
}
