/**
 * Permit2 Proxy Constants
 *
 * Contract addresses, EIP-712 type definitions, and ABI fragments
 * for T402 Permit2 proxy contracts with witness-based settlement.
 */

// Re-export shared Permit2 constants
export { PERMIT2_ADDRESS, erc20BalanceABI } from "../permit2/constants";

/** Scheme identifier for Permit2 proxy */
export const SCHEME_PERMIT2_PROXY = "permit2-proxy" as const;

/** T402 Exact Permit2 Proxy contract address (TBD - not yet deployed) */
export const T402_EXACT_PERMIT2_PROXY =
  "0x0000000000000000000000000000000000000000" as `0x${string}`;

/** T402 Upto Permit2 Proxy contract address (TBD - not yet deployed) */
export const T402_UPTO_PERMIT2_PROXY =
  "0x0000000000000000000000000000000000000000" as `0x${string}`;

/**
 * EIP-712 typehash for the Witness struct.
 * Must match WITNESS_TYPEHASH in T402BasePermit2Proxy.sol:
 * keccak256("Witness(address to,address facilitator,uint256 validAfter)")
 */
export const WITNESS_TYPEHASH =
  "0x5e3bbbe812684a9a24e1e1b7fe7c5b763bfb791ee8423aed3b4e1a5a9e25c255" as const;

/**
 * Witness type string for Permit2's permitWitnessTransferFrom.
 * Format: "Witness witness)TokenPermissions(...)Witness(...)" -- types listed alphabetically.
 * Must match WITNESS_TYPE_STRING in T402BasePermit2Proxy.sol.
 */
export const WITNESS_TYPE_STRING =
  "Witness witness)TokenPermissions(address token,uint256 amount)Witness(address to,address facilitator,uint256 validAfter)" as const;

/**
 * EIP-712 type definitions for PermitWitnessTransferFrom with Witness.
 * Used by clients when signing the permit with witness data.
 */
export const permit2WitnessTypes = {
  PermitWitnessTransferFrom: [
    { name: "permitted", type: "TokenPermissions" },
    { name: "spender", type: "address" },
    { name: "nonce", type: "uint256" },
    { name: "deadline", type: "uint256" },
    { name: "witness", type: "Witness" },
  ],
  TokenPermissions: [
    { name: "token", type: "address" },
    { name: "amount", type: "uint256" },
  ],
  Witness: [
    { name: "to", type: "address" },
    { name: "facilitator", type: "address" },
    { name: "validAfter", type: "uint256" },
  ],
} as const;

/**
 * ABI for T402ExactPermit2Proxy contract.
 * Includes settle() and settleWithPermit() functions.
 */
export const permit2ProxyExactABI = [
  {
    inputs: [
      {
        components: [
          {
            components: [
              { name: "token", type: "address" },
              { name: "amount", type: "uint256" },
            ],
            name: "permitted",
            type: "tuple",
          },
          { name: "nonce", type: "uint256" },
          { name: "deadline", type: "uint256" },
        ],
        name: "permit",
        type: "tuple",
      },
      { name: "owner", type: "address" },
      {
        components: [
          { name: "to", type: "address" },
          { name: "facilitator", type: "address" },
          { name: "validAfter", type: "uint256" },
        ],
        name: "witness",
        type: "tuple",
      },
      { name: "signature", type: "bytes" },
    ],
    name: "settle",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [
      {
        components: [
          { name: "value", type: "uint256" },
          { name: "deadline", type: "uint256" },
          { name: "v", type: "uint8" },
          { name: "r", type: "bytes32" },
          { name: "s", type: "bytes32" },
        ],
        name: "permit2612",
        type: "tuple",
      },
      {
        components: [
          {
            components: [
              { name: "token", type: "address" },
              { name: "amount", type: "uint256" },
            ],
            name: "permitted",
            type: "tuple",
          },
          { name: "nonce", type: "uint256" },
          { name: "deadline", type: "uint256" },
        ],
        name: "permit",
        type: "tuple",
      },
      { name: "owner", type: "address" },
      {
        components: [
          { name: "to", type: "address" },
          { name: "facilitator", type: "address" },
          { name: "validAfter", type: "uint256" },
        ],
        name: "witness",
        type: "tuple",
      },
      { name: "signature", type: "bytes" },
    ],
    name: "settleWithPermit",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
] as const;

/**
 * ABI for T402UptoPermit2Proxy contract.
 * Includes settle() and settleWithPermit() functions.
 */
export const permit2ProxyUptoABI = [
  {
    inputs: [
      {
        components: [
          {
            components: [
              { name: "token", type: "address" },
              { name: "amount", type: "uint256" },
            ],
            name: "permitted",
            type: "tuple",
          },
          { name: "nonce", type: "uint256" },
          { name: "deadline", type: "uint256" },
        ],
        name: "permit",
        type: "tuple",
      },
      { name: "amount", type: "uint256" },
      { name: "owner", type: "address" },
      {
        components: [
          { name: "to", type: "address" },
          { name: "facilitator", type: "address" },
          { name: "validAfter", type: "uint256" },
        ],
        name: "witness",
        type: "tuple",
      },
      { name: "signature", type: "bytes" },
    ],
    name: "settle",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [
      {
        components: [
          { name: "value", type: "uint256" },
          { name: "deadline", type: "uint256" },
          { name: "v", type: "uint8" },
          { name: "r", type: "bytes32" },
          { name: "s", type: "bytes32" },
        ],
        name: "permit2612",
        type: "tuple",
      },
      {
        components: [
          {
            components: [
              { name: "token", type: "address" },
              { name: "amount", type: "uint256" },
            ],
            name: "permitted",
            type: "tuple",
          },
          { name: "nonce", type: "uint256" },
          { name: "deadline", type: "uint256" },
        ],
        name: "permit",
        type: "tuple",
      },
      { name: "amount", type: "uint256" },
      { name: "owner", type: "address" },
      {
        components: [
          { name: "to", type: "address" },
          { name: "facilitator", type: "address" },
          { name: "validAfter", type: "uint256" },
        ],
        name: "witness",
        type: "tuple",
      },
      { name: "signature", type: "bytes" },
    ],
    name: "settleWithPermit",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
] as const;
