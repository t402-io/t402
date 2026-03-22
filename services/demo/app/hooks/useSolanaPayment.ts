"use client";

import { useCallback, useContext, createContext } from "react";

interface PaymentRequirements {
  scheme: string;
  network: string;
  amount: string;
  asset: string;
  payTo: string;
  maxTimeoutSeconds: number;
  extra?: Record<string, unknown>;
}

interface PaymentPayload {
  t402Version: number;
  scheme: string;
  network: string;
  payload: Record<string, unknown>;
}

// Solana Wallet Context — populated by SolanaProvider, safe to use without provider
export interface SolanaWalletContextType {
  publicKey: string | null;
  connected: boolean;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  signTransaction: ((tx: any) => Promise<any>) | null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  connection: any;
  hasWallet: boolean;
  connect: () => Promise<void>;
  disconnect: () => Promise<void>;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  wallets: any[];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  select: (name: any) => void;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  wallet: any;
}

export const SolanaWalletCtx = createContext<SolanaWalletContextType>({
  publicKey: null,
  connected: false,
  signTransaction: null,
  connection: null,
  hasWallet: false,
  connect: async () => {},
  disconnect: async () => {},
  wallets: [],
  select: () => {},
  wallet: null,
});

export function useSolanaPayment() {
  const ctx = useContext(SolanaWalletCtx);

  const signPayment = useCallback(
    async (requirements: PaymentRequirements): Promise<PaymentPayload> => {
      if (!ctx.publicKey || !ctx.signTransaction || !ctx.connection) {
        throw new Error("Solana wallet not connected");
      }

      // Dynamic import to avoid loading @solana/web3.js in initial bundle
      const { Transaction, PublicKey } = await import("@solana/web3.js");

      const TOKEN_PROGRAM_ID = new PublicKey("TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA");
      const ASSOCIATED_TOKEN_PROGRAM_ID = new PublicKey("ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL");

      const ownerPubkey = new PublicKey(ctx.publicKey);
      const mint = new PublicKey(requirements.asset);
      const recipient = new PublicKey(requirements.payTo);
      const amount = BigInt(requirements.amount);

      // Derive Associated Token Account addresses
      const [senderAta] = PublicKey.findProgramAddressSync(
        [ownerPubkey.toBuffer(), TOKEN_PROGRAM_ID.toBuffer(), mint.toBuffer()],
        ASSOCIATED_TOKEN_PROGRAM_ID
      );
      const [recipientAta] = PublicKey.findProgramAddressSync(
        [recipient.toBuffer(), TOKEN_PROGRAM_ID.toBuffer(), mint.toBuffer()],
        ASSOCIATED_TOKEN_PROGRAM_ID
      );

      // SPL Token Transfer instruction: [3 (u8), amount (u64 LE)]
      const data = Buffer.alloc(9);
      data.writeUInt8(3, 0);
      data.writeBigUInt64LE(amount, 1);

      const transferIx = {
        programId: TOKEN_PROGRAM_ID,
        keys: [
          { pubkey: senderAta, isSigner: false, isWritable: true },
          { pubkey: recipientAta, isSigner: false, isWritable: true },
          { pubkey: ownerPubkey, isSigner: true, isWritable: false },
        ],
        data,
      };

      const { blockhash, lastValidBlockHeight } = await ctx.connection.getLatestBlockhash();
      const tx = new Transaction({
        blockhash,
        lastValidBlockHeight,
        feePayer: ownerPubkey,
      });
      tx.add(transferIx);

      const signedTx = await ctx.signTransaction(tx);
      const serialized = signedTx.serialize({ requireAllSignatures: true });
      const base64Tx = Buffer.from(serialized).toString("base64");

      return {
        t402Version: 2,
        scheme: requirements.scheme,
        network: requirements.network,
        payload: {
          transaction: base64Tx,
          from: ctx.publicKey,
          to: requirements.payTo,
          value: requirements.amount,
          blockhash,
        },
      };
    },
    [ctx.publicKey, ctx.signTransaction, ctx.connection]
  );

  const doConnect = useCallback(async () => {
    const installed = ctx.wallets.find((w: { readyState: string }) => w.readyState === "Installed");
    if (installed) {
      if (ctx.wallet?.adapter.name === installed.adapter.name) {
        await ctx.connect();
      } else {
        ctx.select(installed.adapter.name);
      }
    } else {
      window.open("https://phantom.app/", "_blank");
    }
  }, [ctx]);

  return {
    address: ctx.publicKey,
    isConnected: ctx.connected,
    hasWallet: ctx.hasWallet,
    signPayment,
    connect: doConnect,
    disconnect: useCallback(async () => { await ctx.disconnect(); }, [ctx]),
  };
}
