package io.t402.extensions.dispute;

import java.time.Instant;

/**
 * Facilitator-as-arbiter handler for the `facilitator` arbiterScheme.
 * The signer's address becomes the arbiter address.
 */
public class DisputeFacilitatorHandler {
    private final DisputeSigner signer;

    public DisputeFacilitatorHandler(DisputeSigner signer) {
        this.signer = signer;
    }

    public String getArbiterAddress() {
        return signer.getAddress();
    }

    /** Sign a resolution for a verified dispute. */
    public SignedResolution resolveDispute(
        String disputeHash, String verdict, String settledAmount,
        String refundTransaction, int version, long issuedAt
    ) throws Exception {
        int v = version == 0 ? 1 : version;
        long iat = issuedAt == 0 ? Instant.now().getEpochSecond() : issuedAt;
        ResolutionPayload payload = new ResolutionPayload(
            v, disputeHash, verdict, settledAmount,
            getArbiterAddress(), iat, refundTransaction
        );
        return DisputeUtils.createSignedResolution(signer, payload);
    }

    public SignedResolution resolveDispute(
        String disputeHash, String verdict, String settledAmount,
        String refundTransaction
    ) throws Exception {
        return resolveDispute(disputeHash, verdict, settledAmount, refundTransaction, 0, 0);
    }

    public SignedResolution resolveDispute(
        String disputeHash, String verdict, String settledAmount
    ) throws Exception {
        return resolveDispute(disputeHash, verdict, settledAmount, "", 0, 0);
    }

    /** One-call helper for facilitators acting on a pre-decided verdict. */
    public static SignedResolution buildFacilitatorResolution(
        DisputeFacilitatorHandler handler,
        String disputeHash,
        String verdict,
        String settledAmount,
        String refundTransaction
    ) throws Exception {
        return handler.resolveDispute(disputeHash, verdict, settledAmount, refundTransaction);
    }
}
