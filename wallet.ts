import {
  createPublicClient,
  createWalletClient,
  createTestClient,
  http,
  WalletClient,
  PublicClient,
  publicActions,
} from "viem";
import { baseSepolia } from "viem/chains";
import { privateKeyToAccount } from "viem/accounts";
import { Address, Hex } from "viem";
import { abi } from "./erc20PermitABI";
import { config } from "./config";

// Create a public client for reading data
// TODO: add a concrete type for a wallet with a network and wallet

export const botWallet = createWalletClient({
  chain: baseSepolia,
  transport: http(),
  account: privateKeyToAccount(process.env.PRIVATE_KEY as Hex),
}).extend(publicActions);

export const facilitatorWallet = createWalletClient({
  chain: baseSepolia,
  transport: http(),
  account: privateKeyToAccount(
    process.env.FACILITATOR_WALLET_PRIVATE_KEY as Hex
  ),
}).extend(publicActions);
