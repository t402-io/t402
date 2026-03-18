package io.t402.extensions.offerreceipt;

import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;

/**
 * Utility methods for creating, verifying, and matching offers and receipts.
 */
public final class OfferReceiptUtils {

    private OfferReceiptUtils() {}

    // ========== Signing ==========

    public static SignedOffer createSignedOffer(OfferReceiptSigner signer, OfferPayload payload, Integer acceptIndex) {
        String sig = signer.signOffer(payload);
        return new SignedOffer("eip712", sig, payload, acceptIndex);
    }

    public static SignedReceipt createSignedReceipt(OfferReceiptSigner signer, ReceiptPayload payload) {
        String sig = signer.signReceipt(payload);
        return new SignedReceipt("eip712", sig, payload);
    }

    // ========== Verification ==========

    public static VerifyResult verifyOffer(OfferReceiptVerifier verifier, SignedOffer offer) {
        if (!"eip712".equals(offer.getFormat()) || offer.getPayload() == null) {
            return new VerifyResult(false, null, null);
        }
        try {
            String signer = verifier.recoverOfferSigner(offer.getPayload(), offer.getSignature());
            return new VerifyResult(true, signer, offer.getPayload());
        } catch (Exception e) {
            return new VerifyResult(false, null, null);
        }
    }

    public static VerifyResult verifyReceipt(OfferReceiptVerifier verifier, SignedReceipt receipt) {
        if (!"eip712".equals(receipt.getFormat()) || receipt.getPayload() == null) {
            return new VerifyResult(false, null, null);
        }
        try {
            String signer = verifier.recoverReceiptSigner(receipt.getPayload(), receipt.getSignature());
            return new VerifyResult(true, signer, receipt.getPayload());
        } catch (Exception e) {
            return new VerifyResult(false, null, null);
        }
    }

    // ========== Matching ==========

    public static boolean matchOfferToRequirements(SignedOffer offer,
            String scheme, String network, String asset, String payTo, String amount) {
        if (!"eip712".equals(offer.getFormat()) || offer.getPayload() == null) {
            return false;
        }
        OfferPayload p = offer.getPayload();
        return p.getScheme().equals(scheme)
            && p.getNetwork().equals(network)
            && p.getAsset().equalsIgnoreCase(asset)
            && p.getPayTo().equalsIgnoreCase(payTo)
            && p.getAmount().equals(amount);
    }

    public static boolean isOfferExpired(SignedOffer offer, long nowSeconds) {
        if (!"eip712".equals(offer.getFormat()) || offer.getPayload() == null) {
            return true;
        }
        if (offer.getPayload().getValidUntil() == 0) {
            return false;
        }
        return nowSeconds > offer.getPayload().getValidUntil();
    }

    // ========== Server Helpers ==========

    public static List<SignedOffer> createOffersFromRequirements(
            OfferReceiptSigner signer, String resourceUrl,
            List<Map<String, String>> accepts, long offerValiditySeconds) {
        long now = Instant.now().getEpochSecond();
        long validUntil = offerValiditySeconds > 0 ? now + offerValiditySeconds : 0;

        List<SignedOffer> offers = new ArrayList<>();
        for (int i = 0; i < accepts.size(); i++) {
            Map<String, String> a = accepts.get(i);
            OfferPayload payload = new OfferPayload(
                1, resourceUrl, a.get("scheme"), a.get("network"),
                a.get("asset"), a.get("payTo"), a.get("amount"), validUntil
            );
            offers.add(createSignedOffer(signer, payload, i));
        }
        return offers;
    }

    public static SignedReceipt createReceiptForPayment(
            OfferReceiptSigner signer, String resourceUrl,
            String network, String payer, String transaction) {
        ReceiptPayload payload = new ReceiptPayload(
            1, network, resourceUrl, payer, Instant.now().getEpochSecond(), transaction
        );
        return createSignedReceipt(signer, payload);
    }

    // ========== Result Types ==========

    public static class VerifyResult {
        private final boolean valid;
        private final String signer;
        private final Object payload;

        public VerifyResult(boolean valid, String signer, Object payload) {
            this.valid = valid;
            this.signer = signer;
            this.payload = payload;
        }

        public boolean isValid() { return valid; }
        public String getSigner() { return signer; }
        public Object getPayload() { return payload; }
    }
}
