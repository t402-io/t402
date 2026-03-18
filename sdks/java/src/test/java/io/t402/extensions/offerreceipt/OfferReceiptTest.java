package io.t402.extensions.offerreceipt;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;

import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.*;

class OfferReceiptTest {

    static class MockSigner implements OfferReceiptSigner {
        public String signOffer(OfferPayload p) { return "0xoffer_sig"; }
        public String signReceipt(ReceiptPayload p) { return "0xreceipt_sig"; }
        public String getAddress() { return "0xserver1234"; }
    }

    static class MockVerifier implements OfferReceiptVerifier {
        public String recoverOfferSigner(OfferPayload p, String sig) { return "0xserver1234"; }
        public String recoverReceiptSigner(ReceiptPayload p, String sig) { return "0xserver1234"; }
    }

    static class FailingVerifier implements OfferReceiptVerifier {
        public String recoverOfferSigner(OfferPayload p, String sig) { throw new RuntimeException("bad"); }
        public String recoverReceiptSigner(ReceiptPayload p, String sig) { throw new RuntimeException("bad"); }
    }

    @Nested
    @DisplayName("Constants")
    class ConstantsTests {
        @Test void extensionKey() { assertEquals("offer-receipt", OfferReceiptConstants.EXTENSION_KEY); }
        @Test void offerDomain() { assertEquals("t402 offer", OfferReceiptConstants.offerDomain().get("name")); }
        @Test void receiptDomain() { assertEquals("t402 receipt", OfferReceiptConstants.receiptDomain().get("name")); }
        @Test void offerTypesCount() { assertEquals(8, OfferReceiptConstants.offerTypes().size()); }
        @Test void receiptTypesCount() { assertEquals(6, OfferReceiptConstants.receiptTypes().size()); }
    }

    @Nested
    @DisplayName("Signing")
    class SigningTests {
        @Test void createOffer() {
            var offer = OfferReceiptUtils.createSignedOffer(new MockSigner(),
                new OfferPayload(1, "https://example.com", "exact", "eip155:8453", "0xUSDC", "0xserver", "10000", 0), 0);
            assertEquals("eip712", offer.getFormat());
            assertEquals("0xoffer_sig", offer.getSignature());
            assertEquals(0, offer.getAcceptIndex());
        }

        @Test void createReceipt() {
            var receipt = OfferReceiptUtils.createSignedReceipt(new MockSigner(),
                new ReceiptPayload(1, "eip155:8453", "https://example.com", "0xpayer", 1700000000, "0xtx"));
            assertEquals("eip712", receipt.getFormat());
            assertEquals("0xreceipt_sig", receipt.getSignature());
        }
    }

    @Nested
    @DisplayName("Verification")
    class VerificationTests {
        @Test void verifyOfferValid() {
            var offer = new SignedOffer("eip712", "0xvalid",
                new OfferPayload(1, "https://example.com", "exact", "eip155:8453", "0xUSDC", "0xserver", "10000", 0), null);
            var result = OfferReceiptUtils.verifyOffer(new MockVerifier(), offer);
            assertTrue(result.isValid());
            assertEquals("0xserver1234", result.getSigner());
        }

        @Test void verifyOfferInvalid() {
            var offer = new SignedOffer("eip712", "0xinvalid",
                new OfferPayload(1, "https://example.com", "exact", "eip155:8453", "0xUSDC", "0xserver", "10000", 0), null);
            var result = OfferReceiptUtils.verifyOffer(new FailingVerifier(), offer);
            assertFalse(result.isValid());
        }

        @Test void verifyOfferJwsNotSupported() {
            var offer = new SignedOffer("jws", "eyJ...", null, null);
            var result = OfferReceiptUtils.verifyOffer(new MockVerifier(), offer);
            assertFalse(result.isValid());
        }
    }

    @Nested
    @DisplayName("Matching")
    class MatchingTests {
        @Test void matchExact() {
            var offer = new SignedOffer("eip712", "0x",
                new OfferPayload(1, "https://example.com", "exact", "eip155:8453", "0xUSDC", "0xServer", "10000", 0), null);
            assertTrue(OfferReceiptUtils.matchOfferToRequirements(offer, "exact", "eip155:8453", "0xusdc", "0xserver", "10000"));
        }

        @Test void noMatchWrongAmount() {
            var offer = new SignedOffer("eip712", "0x",
                new OfferPayload(1, "https://example.com", "exact", "eip155:8453", "0xUSDC", "0xserver", "10000", 0), null);
            assertFalse(OfferReceiptUtils.matchOfferToRequirements(offer, "exact", "eip155:8453", "0xUSDC", "0xserver", "99999"));
        }
    }

    @Nested
    @DisplayName("Expiry")
    class ExpiryTests {
        @Test void noExpiry() {
            var offer = new SignedOffer("eip712", "0x",
                new OfferPayload(1, "https://example.com", "exact", "eip155:8453", "0x", "0x", "1", 0), null);
            assertFalse(OfferReceiptUtils.isOfferExpired(offer, 1700000000));
        }

        @Test void expired() {
            var offer = new SignedOffer("eip712", "0x",
                new OfferPayload(1, "https://example.com", "exact", "eip155:8453", "0x", "0x", "1", 1700000000), null);
            assertTrue(OfferReceiptUtils.isOfferExpired(offer, 1700000001));
        }

        @Test void notExpired() {
            var offer = new SignedOffer("eip712", "0x",
                new OfferPayload(1, "https://example.com", "exact", "eip155:8453", "0x", "0x", "1", 9999999999L), null);
            assertFalse(OfferReceiptUtils.isOfferExpired(offer, 1700000000));
        }
    }

    @Nested
    @DisplayName("Server")
    class ServerTests {
        @Test void createOffers() {
            var accepts = List.of(
                Map.of("scheme", "exact", "network", "eip155:8453", "asset", "0xUSDC", "payTo", "0xserver", "amount", "10000"),
                Map.of("scheme", "exact", "network", "eip155:1", "asset", "0xUSDT0", "payTo", "0xserver", "amount", "10000")
            );
            var offers = OfferReceiptUtils.createOffersFromRequirements(new MockSigner(), "https://example.com", accepts, 0);
            assertEquals(2, offers.size());
            assertEquals(0, offers.get(0).getAcceptIndex());
            assertEquals(1, offers.get(1).getAcceptIndex());
        }

        @Test void createReceipt() {
            var receipt = OfferReceiptUtils.createReceiptForPayment(
                new MockSigner(), "https://example.com", "eip155:8453", "0xpayer", "0xtx");
            assertEquals("eip155:8453", receipt.getPayload().getNetwork());
            assertEquals("0xpayer", receipt.getPayload().getPayer());
            assertTrue(receipt.getPayload().getIssuedAt() > 0);
        }
    }

    @Nested
    @DisplayName("Payload serialization")
    class PayloadTests {
        @Test void offerRoundtrip() {
            var p = new OfferPayload(1, "https://example.com", "exact", "eip155:8453", "0xUSDC", "0xserver", "10000", 300);
            var map = p.toMap();
            var p2 = OfferPayload.fromMap(map);
            assertEquals(p.getScheme(), p2.getScheme());
            assertEquals(p.getValidUntil(), p2.getValidUntil());
        }

        @Test void receiptRoundtrip() {
            var p = new ReceiptPayload(1, "eip155:8453", "https://example.com", "0xpayer", 1700000000, "0xtx");
            var map = p.toMap();
            var p2 = ReceiptPayload.fromMap(map);
            assertEquals(p.getPayer(), p2.getPayer());
            assertEquals(p.getTransaction(), p2.getTransaction());
        }
    }
}
