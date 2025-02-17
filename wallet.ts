import {
  createPublicClient,
  createWalletClient,
  createTestClient,
  http,
  WalletClient,
  PublicClient,
  publicActions,
} from "viem";
import type {
  Chain,
  Transport,
  Client,
  Account,
  RpcSchema,
  PublicActions,
  WalletActions,
} from "viem";
import { baseSepolia } from "viem/chains";
import { privateKeyToAccount } from "viem/accounts";
import { Address, Hex } from "viem";
import { abi } from "./erc20PermitABI";
import { config } from "./config";

// Create a public client for reading data
export type SignerWallet<
  transport extends Transport = Transport,
  chain extends Chain | undefined = Chain,
  account extends Account | undefined = Account
> = Client<
  transport,
  chain,
  account,
  RpcSchema,
  PublicActions<transport, chain, account> & WalletActions<chain, account>
>;

export const botWallet: SignerWallet = createWalletClient({
  chain: baseSepolia,
  transport: http(),
  account: privateKeyToAccount(process.env.PRIVATE_KEY as Hex),
}).extend(publicActions);

export const facilitatorWallet: SignerWallet = createWalletClient({
  chain: baseSepolia,
  transport: http(),
  account: privateKeyToAccount(
    process.env.FACILITATOR_WALLET_PRIVATE_KEY as Hex
  ),
}).extend(publicActions);
