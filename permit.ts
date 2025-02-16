import { WalletClient, Hex, toHex } from "viem";
import { config } from "./config";
import { AuthorizationParameters } from "./types";

/**
 * Signs an EIP-3009 authorization for USDC transfer
 * @param walletClient - The wallet client that will sign the authorization
 * @param params - The authorization parameters
 * @param params.from - The address tokens will be transferred from
 * @param params.to - The address tokens will be transferred to
 * @param params.value - The amount of USDC tokens to transfer (in base units)
 * @param params.validAfter - Unix timestamp after which the authorization becomes valid
 * @param params.validBefore - Unix timestamp before which the authorization is valid
 * @param params.nonce - Random 32-byte nonce to prevent replay attacks
 * @param params.chainId - The chain ID where the USDC contract exists
 * @param params.version - The USDC contract version
 * @param params.usdcAddress - The address of the USDC contract
 * @returns The signature for the authorization
 */

export async function signAuthorization(
  walletClient: WalletClient,
  {
    from,
    to,
    value,
    validAfter,
    validBefore,
    nonce,
    chainId,
    version,
    usdcAddress,
  }: AuthorizationParameters
): Promise<{ signature: Hex }> {
  const usdcName = config[chainId].usdcName;

  const data = {
    account: walletClient.account!,
    types: {
      // EIP712Domain: [
      //   { name: "name", type: "string" },
      //   { name: "version", type: "string" },
      //   { name: "chainId", type: "uint256" },
      //   { name: "verifyingContract", type: "address" },
      // ],
      TransferWithAuthorization: [
        { name: "from", type: "address" },
        { name: "to", type: "address" },
        { name: "value", type: "uint256" },
        { name: "validAfter", type: "uint256" },
        { name: "validBefore", type: "uint256" },
        { name: "nonce", type: "bytes32" },
      ],
    } as const,
    domain: {
      name: usdcName,
      version: version,
      chainId: chainId,
      verifyingContract: usdcAddress,
    },
    primaryType: "TransferWithAuthorization" as const,
    message: {
      from,
      to,
      value,
      validAfter,
      validBefore,
      nonce: nonce,
    },
  };

  const signature = await walletClient.signTypedData(data);

  return {
    signature,
  };
}

export function createNonce(): Hex {
  return toHex(crypto.getRandomValues(new Uint8Array(32)));
}
