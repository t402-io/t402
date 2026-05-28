package io.t402.extensions.dispute;

/**
 * EIP-712 verifier for disputes and resolutions.
 */
public interface DisputeVerifier {
    /** Recover the signer address from a dispute signature. */
    String recoverDisputeSigner(DisputePayload payload, String signature) throws Exception;

    /** Recover the signer address from a resolution signature. */
    String recoverResolutionSigner(ResolutionPayload payload, String signature) throws Exception;
}
