package io.t402.extensions.offerreceipt;

/**
 * Interface for creating EIP-712 signatures on offers and receipts.
 */
public interface OfferReceiptSigner {
    String signOffer(OfferPayload payload);
    String signReceipt(ReceiptPayload payload);
    String getAddress();
}
