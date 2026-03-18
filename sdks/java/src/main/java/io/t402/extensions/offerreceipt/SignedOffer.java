package io.t402.extensions.offerreceipt;

/**
 * A signed offer in EIP-712 format.
 */
public class SignedOffer {
    private final String format;
    private final String signature;
    private final OfferPayload payload;
    private final Integer acceptIndex;

    public SignedOffer(String format, String signature, OfferPayload payload, Integer acceptIndex) {
        this.format = format;
        this.signature = signature;
        this.payload = payload;
        this.acceptIndex = acceptIndex;
    }

    public String getFormat() { return format; }
    public String getSignature() { return signature; }
    public OfferPayload getPayload() { return payload; }
    public Integer getAcceptIndex() { return acceptIndex; }
}
