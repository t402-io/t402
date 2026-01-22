import { useMemo } from "react";
import type { CosmosAccount, CosmosNetwork } from "./types";
import { NOBLE_CHAIN_IDS, USDC_DENOM } from "./types";
import { fetchAccountInfo, broadcastTx } from "./rpc";
import type { CosmosWalletId } from "./useCosmosWallet";

/**
 * Cosmos client signer interface
 */
export interface ClientCosmosSigner {
  /** Bech32 address */
  readonly address: string;
  /** Sign and broadcast a USDC transfer */
  signAndBroadcastTransfer(params: {
    recipient: string;
    amount: bigint;
    memo?: string;
  }): Promise<string>;
}

/**
 * Encode a varint for protobuf
 */
function encodeVarint(value: number | bigint): Uint8Array {
  const bytes: number[] = [];
  let n = typeof value === "bigint" ? value : BigInt(value);
  while (n > 127n) {
    bytes.push(Number(n & 0x7fn) | 0x80);
    n >>= 7n;
  }
  bytes.push(Number(n));
  return new Uint8Array(bytes);
}

/**
 * Encode a string for protobuf
 */
function encodeString(value: string): Uint8Array {
  const encoder = new TextEncoder();
  const bytes = encoder.encode(value);
  return concatBytes(encodeVarint(bytes.length), bytes);
}

/**
 * Concatenate Uint8Arrays
 */
function concatBytes(...arrays: Uint8Array[]): Uint8Array {
  const totalLength = arrays.reduce((sum, arr) => sum + arr.length, 0);
  const result = new Uint8Array(totalLength);
  let offset = 0;
  for (const arr of arrays) {
    result.set(arr, offset);
    offset += arr.length;
  }
  return result;
}

/**
 * Build a MsgSend for bank transfer
 */
function buildMsgSend(
  fromAddress: string,
  toAddress: string,
  amount: bigint,
  denom: string,
): Uint8Array {
  // cosmos.bank.v1beta1.MsgSend
  // field 1: from_address (string)
  // field 2: to_address (string)
  // field 3: amount (repeated Coin)

  // Coin: denom (string), amount (string)
  const amountStr = amount.toString();
  const coinBytes = concatBytes(
    new Uint8Array([0x0a]), // field 1 (denom), type string
    encodeString(denom),
    new Uint8Array([0x12]), // field 2 (amount), type string
    encodeString(amountStr),
  );

  return concatBytes(
    new Uint8Array([0x0a]), // field 1 (from_address), type string
    encodeString(fromAddress),
    new Uint8Array([0x12]), // field 2 (to_address), type string
    encodeString(toAddress),
    new Uint8Array([0x1a]), // field 3 (amount), type message
    encodeVarint(coinBytes.length),
    coinBytes,
  );
}

/**
 * Build a TxBody protobuf
 */
function buildTxBody(typeUrl: string, msgBytes: Uint8Array, memo: string): Uint8Array {
  // cosmos.tx.v1beta1.TxBody
  // field 1: messages (repeated Any)
  // field 2: memo (string)

  // Any: type_url (string), value (bytes)
  const anyBytes = concatBytes(
    new Uint8Array([0x0a]), // field 1 (type_url), type string
    encodeString(typeUrl),
    new Uint8Array([0x12]), // field 2 (value), type bytes
    encodeVarint(msgBytes.length),
    msgBytes,
  );

  const parts: Uint8Array[] = [
    new Uint8Array([0x0a]), // field 1 (messages), type message
    encodeVarint(anyBytes.length),
    anyBytes,
  ];

  if (memo) {
    parts.push(
      new Uint8Array([0x12]), // field 2 (memo), type string
      encodeString(memo),
    );
  }

  return concatBytes(...parts);
}

/**
 * Build AuthInfo protobuf
 */
function buildAuthInfo(
  pubKey: Uint8Array,
  sequence: bigint,
  gasLimit: bigint,
  feeAmount: bigint,
  feeDenom: string,
): Uint8Array {
  // SignerInfo
  // field 1: public_key (Any)
  // field 2: mode_info (ModeInfo)
  // field 3: sequence (uint64)

  // PubKey Any
  const pubKeyTypeUrl = "/cosmos.crypto.secp256k1.PubKey";
  const pubKeyValueBytes = concatBytes(
    new Uint8Array([0x0a]), // field 1 (key), type bytes
    encodeVarint(pubKey.length),
    pubKey,
  );
  const pubKeyAnyBytes = concatBytes(
    new Uint8Array([0x0a]),
    encodeString(pubKeyTypeUrl),
    new Uint8Array([0x12]),
    encodeVarint(pubKeyValueBytes.length),
    pubKeyValueBytes,
  );

  // ModeInfo (SIGN_MODE_DIRECT = 1)
  const modeInfoBytes = new Uint8Array([0x0a, 0x02, 0x08, 0x01]); // single.mode = 1

  // SignerInfo
  const signerInfoBytes = concatBytes(
    new Uint8Array([0x0a]), // field 1 (public_key)
    encodeVarint(pubKeyAnyBytes.length),
    pubKeyAnyBytes,
    new Uint8Array([0x12]), // field 2 (mode_info)
    encodeVarint(modeInfoBytes.length),
    modeInfoBytes,
    new Uint8Array([0x18]), // field 3 (sequence)
    encodeVarint(sequence),
  );

  // Fee
  // field 1: amount (repeated Coin)
  // field 2: gas_limit (uint64)
  const feeCoinBytes = concatBytes(
    new Uint8Array([0x0a]),
    encodeString(feeDenom),
    new Uint8Array([0x12]),
    encodeString(feeAmount.toString()),
  );
  const feeBytes = concatBytes(
    new Uint8Array([0x0a]),
    encodeVarint(feeCoinBytes.length),
    feeCoinBytes,
    new Uint8Array([0x10]),
    encodeVarint(gasLimit),
  );

  // AuthInfo
  return concatBytes(
    new Uint8Array([0x0a]), // field 1 (signer_infos)
    encodeVarint(signerInfoBytes.length),
    signerInfoBytes,
    new Uint8Array([0x12]), // field 2 (fee)
    encodeVarint(feeBytes.length),
    feeBytes,
  );
}

/**
 * Build the final TxRaw protobuf
 */
function buildTxRaw(
  bodyBytes: Uint8Array,
  authInfoBytes: Uint8Array,
  signature: Uint8Array,
): Uint8Array {
  return concatBytes(
    new Uint8Array([0x0a]), // field 1 (body_bytes)
    encodeVarint(bodyBytes.length),
    bodyBytes,
    new Uint8Array([0x12]), // field 2 (auth_info_bytes)
    encodeVarint(authInfoBytes.length),
    authInfoBytes,
    new Uint8Array([0x1a]), // field 3 (signatures)
    encodeVarint(signature.length),
    signature,
  );
}

/**
 * Hook to create a Cosmos signer from connected wallet
 */
export function useCosmosSigner(
  account: CosmosAccount | null,
  walletId: CosmosWalletId | null,
  network: CosmosNetwork,
): ClientCosmosSigner | null {
  return useMemo(() => {
    if (!account || !walletId) {
      return null;
    }

    const chainId = NOBLE_CHAIN_IDS[network];

    const signer: ClientCosmosSigner = {
      get address() {
        return account.address;
      },

      async signAndBroadcastTransfer(params) {
        const wallet = walletId === "keplr" ? window.keplr : window.leap;
        if (!wallet) {
          throw new Error(`${walletId} wallet not available`);
        }

        // Get account info
        const accountInfo = await fetchAccountInfo(account.address, network);
        if (!accountInfo) {
          throw new Error("Failed to fetch account info");
        }

        // Build the message
        const msgBytes = buildMsgSend(account.address, params.recipient, params.amount, USDC_DENOM);

        // Build tx body
        const bodyBytes = buildTxBody("/cosmos.bank.v1beta1.MsgSend", msgBytes, params.memo || "");

        // Get public key bytes
        const pubKeyHex = account.pubKey || "";
        const pubKeyBytes = new Uint8Array(
          pubKeyHex.match(/.{1,2}/g)?.map(byte => parseInt(byte, 16)) || [],
        );

        // Build auth info
        const gasLimit = 100000n;
        const feeAmount = 25000n; // 0.025 USDC
        const authInfoBytes = buildAuthInfo(
          pubKeyBytes,
          BigInt(accountInfo.sequence),
          gasLimit,
          feeAmount,
          USDC_DENOM,
        );

        // Sign the transaction
        const signDoc = {
          bodyBytes,
          authInfoBytes,
          chainId,
          accountNumber: accountInfo.accountNumber,
        };

        const signResult = await wallet.signDirect(chainId, account.address, signDoc);

        // Decode signature from base64
        const signatureBase64 = signResult.signature.signature;
        const signatureBytes = Uint8Array.from(atob(signatureBase64), c => c.charCodeAt(0));

        // Build final tx
        const txRaw = buildTxRaw(
          signResult.signed.bodyBytes,
          signResult.signed.authInfoBytes,
          signatureBytes,
        );

        // Broadcast
        const result = await broadcastTx(txRaw, network);

        if (result.code !== 0) {
          throw new Error(`Transaction failed: ${result.rawLog || "Unknown error"}`);
        }

        return result.txHash;
      },
    };

    return signer;
  }, [account, walletId, network]);
}
