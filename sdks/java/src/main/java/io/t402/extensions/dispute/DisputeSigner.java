package io.t402.extensions.dispute;

/**
 * EIP-712 signer for disputes and resolutions.
 */
public interface DisputeSigner {
    /** Sign a dispute payload, returning the EIP-712 signature. */
    String signDispute(DisputePayload payload) throws Exception;

    /** Sign a resolution payload, returning the EIP-712 signature. */
    String signResolution(ResolutionPayload payload) throws Exception;

    /** The signer's address (used to set the resolution payload's arbiter). */
    String getAddress();
}
