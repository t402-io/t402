package io.t402.extensions.offerreceipt;

/**
 * A signed receipt in EIP-712 format.
 */
public class SignedReceipt {
    private final String format;
    private final String signature;
    private final ReceiptPayload payload;

    public SignedReceipt(String format, String signature, ReceiptPayload payload) {
        this.format = format;
        this.signature = signature;
        this.payload = payload;
    }

    public String getFormat() { return format; }
    public String getSignature() { return signature; }
    public ReceiptPayload getPayload() { return payload; }
}
