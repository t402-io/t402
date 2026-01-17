/**
 * Up-To Scheme Client for EVM
 *
 * @example
 * ```typescript
 * import { UptoEvmScheme, createUptoEvmScheme } from "@t402/evm/upto/client";
 * import { privateKeyToAccount } from "viem/accounts";
 *
 * const signer = privateKeyToAccount(privateKey);
 * const scheme = createUptoEvmScheme(signer);
 *
 * // Register with t402 client
 * client.registerScheme("eip155:8453", scheme);
 * ```
 */
export { UptoEvmScheme, createUptoEvmScheme } from "./scheme";
