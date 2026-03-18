package io.t402.extensions.offerreceipt;

/**
 * Interface for verifying EIP-712 signatures on offers and receipts.
 */
public interface OfferReceiptVerifier {
    String recoverOfferSigner(OfferPayload payload, String signature);
    String recoverReceiptSigner(ReceiptPayload payload, String signature);
}
