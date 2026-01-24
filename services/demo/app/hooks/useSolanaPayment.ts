"use client";

import { useCallback } from "react";
import { useWallet, useConnection } from "@solana/wallet-adapter-react";
import {
  Transaction,
  PublicKey,
  SystemProgram,
} from "@solana/web3.js";

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

// SPL Token Program ID
const TOKEN_PROGRAM_ID = new PublicKey("TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA");

// Build SPL token transfer instruction manually (avoids @solana/spl-token heavy dep)
function createTransferInstruction(
  source: PublicKey,
  destination: PublicKey,
  owner: PublicKey,
  amount: bigint
): { programId: PublicKey; keys: { pubkey: PublicKey; isSigner: boolean; isWritable: boolean }[]; data: Buffer } {
  // SPL Token Transfer instruction layout: [3 (u8 instruction), amount (u64 LE)]
  const data = Buffer.alloc(9);
  data.writeUInt8(3, 0); // Transfer instruction index
  data.writeBigUInt64LE(amount, 1);

  return {
    programId: TOKEN_PROGRAM_ID,
    keys: [
      { pubkey: source, isSigner: false, isWritable: true },
      { pubkey: destination, isSigner: false, isWritable: true },
      { pubkey: owner, isSigner: true, isWritable: false },
    ],
    data,
  };
}

// Derive Associated Token Account address
function getAssociatedTokenAddress(mint: PublicKey, owner: PublicKey): PublicKey {
  const ASSOCIATED_TOKEN_PROGRAM_ID = new PublicKey("ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL");
  const [address] = PublicKey.findProgramAddressSync(
    [owner.toBuffer(), TOKEN_PROGRAM_ID.toBuffer(), mint.toBuffer()],
    ASSOCIATED_TOKEN_PROGRAM_ID
  );
  return address;
}

export function useSolanaPayment() {
  const { publicKey, signTransaction, connected, connect, disconnect, wallets, select, wallet } = useWallet();
  const { connection } = useConnection();

  const signPayment = useCallback(
    async (requirements: PaymentRequirements): Promise<PaymentPayload> => {
      if (!publicKey || !signTransaction) {
        throw new Error("Solana wallet not connected");
      }

      const mint = new PublicKey(requirements.asset);
      const recipient = new PublicKey(requirements.payTo);
      const amount = BigInt(requirements.amount);

      // Derive token accounts
      const senderAta = getAssociatedTokenAddress(mint, publicKey);
      const recipientAta = getAssociatedTokenAddress(mint, recipient);

      // Create transfer instruction
      const transferIx = createTransferInstruction(senderAta, recipientAta, publicKey, amount);

      // Build transaction
      const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash();
      const tx = new Transaction({
        blockhash,
        lastValidBlockHeight,
        feePayer: publicKey,
      });
      tx.add(transferIx);

      // Sign (but don't send — facilitator settles)
      const signedTx = await signTransaction(tx);
      const serialized = signedTx.serialize({ requireAllSignatures: true });
      const base64Tx = Buffer.from(serialized).toString("base64");

      return {
        t402Version: 2,
        scheme: requirements.scheme,
        network: requirements.network,
        payload: {
          transaction: base64Tx,
          from: publicKey.toBase58(),
          to: requirements.payTo,
          value: requirements.amount,
          blockhash,
        },
      };
    },
    [publicKey, signTransaction, connection]
  );

  const hasWallet = wallets.some((w) => w.readyState === "Installed");

  const doConnect = useCallback(async () => {
    const installed = wallets.find((w) => w.readyState === "Installed");
    if (installed) {
      // If already selected, just connect
      if (wallet?.adapter.name === installed.adapter.name) {
        if (connect) await connect();
      } else {
        // Select the wallet — autoConnect in SolanaProvider will handle connection
        select(installed.adapter.name);
      }
    } else {
      window.open("https://phantom.app/", "_blank");
    }
  }, [wallets, wallet, select, connect]);

  return {
    address: publicKey?.toBase58() || null,
    isConnected: connected,
    hasWallet,
    signPayment,
    connect: doConnect,
    disconnect: useCallback(async () => { if (disconnect) await disconnect(); }, [disconnect]),
  };
}
