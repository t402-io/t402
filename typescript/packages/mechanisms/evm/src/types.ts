export type ExactEIP3009Payload = {
  signature?: `0x${string}`;
  authorization: {
    from: `0x${string}`;
    to: `0x${string}`;
    value: string;
    validAfter: string;
    validBefore: string;
    nonce: `0x${string}`;
  };
};

export type ExactEvmPayloadV1 = ExactEIP3009Payload;

export type ExactEvmPayloadV2 = ExactEIP3009Payload;

/**
 * Payload for exact-legacy scheme (approve + transferFrom pattern)
 * Used for legacy USDT and other tokens without EIP-3009 support
 */
export type ExactLegacyPayload = {
  signature?: `0x${string}`;
  authorization: {
    /** Payer address */
    from: `0x${string}`;
    /** Recipient address */
    to: `0x${string}`;
    /** Payment amount in token units */
    value: string;
    /** Unix timestamp after which the authorization is valid */
    validAfter: string;
    /** Unix timestamp before which the authorization is valid */
    validBefore: string;
    /** Unique nonce to prevent replay attacks */
    nonce: `0x${string}`;
    /** Facilitator address that will call transferFrom */
    spender: `0x${string}`;
  };
};
