"""Tests for the offer-receipt extension."""

import time
from t402.extensions.offer_receipt import (
    EXTENSION_KEY,
    OFFER_DOMAIN,
    RECEIPT_DOMAIN,
    OFFER_TYPES,
    RECEIPT_TYPES,
    OfferPayload,
    ReceiptPayload,
    SignedOffer,
    SignedReceipt,
    create_signed_offer,
    create_signed_receipt,
    verify_offer,
    verify_receipt,
    match_offer_to_requirements,
    is_offer_expired,
    create_offers_from_requirements,
    create_receipt_for_payment,
    extract_offers,
    extract_receipt,
    normalize_offer_for_signing,
    normalize_receipt_for_signing,
)


class MockSigner:
    def sign_offer(self, payload):
        return "0xoffer_sig"

    def sign_receipt(self, payload):
        return "0xreceipt_sig"

    def get_address(self):
        return "0xserver1234"


class MockVerifier:
    def recover_offer_signer(self, payload, signature):
        return "0xserver1234"

    def recover_receipt_signer(self, payload, signature):
        return "0xserver1234"


class FailingVerifier:
    def recover_offer_signer(self, payload, signature):
        raise ValueError("invalid signature")

    def recover_receipt_signer(self, payload, signature):
        raise ValueError("invalid signature")


SAMPLE_OFFER = OfferPayload(
    version=1,
    resource_url="https://api.example.com/data",
    scheme="exact",
    network="eip155:8453",
    asset="0xUSDC",
    pay_to="0xserver1234",
    amount="10000",
)


class TestEIP712Constants:
    def test_offer_domain(self):
        assert OFFER_DOMAIN["name"] == "t402 offer"
        assert OFFER_DOMAIN["chainId"] == 1

    def test_receipt_domain(self):
        assert RECEIPT_DOMAIN["name"] == "t402 receipt"

    def test_offer_types(self):
        names = [t["name"] for t in OFFER_TYPES]
        assert "version" in names
        assert "resourceUrl" in names
        assert "validUntil" in names
        assert len(OFFER_TYPES) == 8

    def test_receipt_types(self):
        assert len(RECEIPT_TYPES) == 6


class TestPayloads:
    def test_offer_to_dict(self):
        d = SAMPLE_OFFER.to_dict()
        assert d["resourceUrl"] == "https://api.example.com/data"
        assert d["validUntil"] == 0

    def test_offer_from_dict(self):
        d = SAMPLE_OFFER.to_dict()
        p = OfferPayload.from_dict(d)
        assert p.scheme == "exact"
        assert p.network == "eip155:8453"

    def test_receipt_roundtrip(self):
        r = ReceiptPayload(1, "eip155:8453", "https://example.com", "0xpayer", 1700000000, "0xtx")
        d = r.to_dict()
        r2 = ReceiptPayload.from_dict(d)
        assert r2.payer == "0xpayer"
        assert r2.transaction == "0xtx"


class TestSigning:
    def test_create_signed_offer(self):
        offer = create_signed_offer(MockSigner(), SAMPLE_OFFER, accept_index=0)
        assert offer.format == "eip712"
        assert offer.signature == "0xoffer_sig"
        assert offer.accept_index == 0

    def test_create_signed_receipt(self):
        payload = ReceiptPayload(1, "eip155:8453", "https://example.com", "0xpayer", 1700000000)
        receipt = create_signed_receipt(MockSigner(), payload)
        assert receipt.format == "eip712"
        assert receipt.signature == "0xreceipt_sig"

    def test_verify_offer_valid(self):
        offer = SignedOffer("eip712", "0xvalid", payload=SAMPLE_OFFER)
        result = verify_offer(MockVerifier(), offer)
        assert result.valid
        assert result.signer == "0xserver1234"

    def test_verify_offer_invalid(self):
        offer = SignedOffer("eip712", "0xinvalid", payload=SAMPLE_OFFER)
        result = verify_offer(FailingVerifier(), offer)
        assert not result.valid

    def test_verify_offer_jws_not_supported(self):
        offer = SignedOffer("jws", "eyJ...")
        result = verify_offer(MockVerifier(), offer)
        assert not result.valid

    def test_verify_receipt_valid(self):
        payload = ReceiptPayload(1, "eip155:8453", "https://example.com", "0xpayer", 1700000000)
        receipt = SignedReceipt("eip712", "0xvalid", payload=payload)
        result = verify_receipt(MockVerifier(), receipt)
        assert result.valid

    def test_verify_receipt_invalid(self):
        payload = ReceiptPayload(1, "eip155:8453", "https://example.com", "0xpayer", 1700000000)
        receipt = SignedReceipt("eip712", "0xinvalid", payload=payload)
        result = verify_receipt(FailingVerifier(), receipt)
        assert not result.valid


class TestMatching:
    def test_match_exact(self):
        offer = SignedOffer("eip712", "0x", payload=SAMPLE_OFFER)
        assert match_offer_to_requirements(offer, "exact", "eip155:8453", "0xUSDC", "0xserver1234", "10000")

    def test_match_case_insensitive(self):
        offer = SignedOffer("eip712", "0x", payload=SAMPLE_OFFER)
        assert match_offer_to_requirements(offer, "exact", "eip155:8453", "0xusdc", "0xSERVER1234", "10000")

    def test_no_match_wrong_amount(self):
        offer = SignedOffer("eip712", "0x", payload=SAMPLE_OFFER)
        assert not match_offer_to_requirements(offer, "exact", "eip155:8453", "0xUSDC", "0xserver1234", "99999")

    def test_no_match_wrong_network(self):
        offer = SignedOffer("eip712", "0x", payload=SAMPLE_OFFER)
        assert not match_offer_to_requirements(offer, "exact", "eip155:1", "0xUSDC", "0xserver1234", "10000")


class TestExpiry:
    def test_no_expiry(self):
        offer = SignedOffer("eip712", "0x", payload=SAMPLE_OFFER)
        assert not is_offer_expired(offer)

    def test_not_expired(self):
        p = OfferPayload(1, "https://example.com", "exact", "eip155:8453", "0x", "0x", "1", valid_until=9999999999)
        offer = SignedOffer("eip712", "0x", payload=p)
        assert not is_offer_expired(offer, now_seconds=1700000000)

    def test_expired(self):
        p = OfferPayload(1, "https://example.com", "exact", "eip155:8453", "0x", "0x", "1", valid_until=1700000000)
        offer = SignedOffer("eip712", "0x", payload=p)
        assert is_offer_expired(offer, now_seconds=1700000001)


class TestServer:
    def test_create_offers(self):
        accepts = [
            {"scheme": "exact", "network": "eip155:8453", "asset": "0xUSDC", "payTo": "0xserver", "amount": "10000"},
            {"scheme": "exact", "network": "eip155:1", "asset": "0xUSDT0", "payTo": "0xserver", "amount": "10000"},
        ]
        offers = create_offers_from_requirements(MockSigner(), "https://api.example.com", accepts)
        assert len(offers) == 2
        assert offers[0].accept_index == 0
        assert offers[1].accept_index == 1
        assert offers[0].payload.network == "eip155:8453"

    def test_create_receipt(self):
        receipt = create_receipt_for_payment(MockSigner(), "https://api.example.com", "eip155:8453", "0xpayer", "0xtx")
        assert receipt.payload.network == "eip155:8453"
        assert receipt.payload.payer == "0xpayer"
        assert receipt.payload.issued_at > 0


class TestClientHelpers:
    def test_extract_offers(self):
        extensions = {
            EXTENSION_KEY: {
                "info": {
                    "offers": [
                        {"format": "eip712", "signature": "0x", "payload": SAMPLE_OFFER.to_dict()},
                    ]
                }
            }
        }
        offers = extract_offers(extensions)
        assert len(offers) == 1
        assert offers[0].payload.scheme == "exact"

    def test_extract_offers_empty(self):
        assert extract_offers(None) == []
        assert extract_offers({}) == []

    def test_extract_receipt(self):
        payload = ReceiptPayload(1, "eip155:8453", "https://example.com", "0xpayer", 1700000000)
        extensions = {
            EXTENSION_KEY: {
                "info": {"receipt": {"format": "eip712", "signature": "0x", "payload": payload.to_dict()}}
            }
        }
        receipt = extract_receipt(extensions)
        assert receipt is not None
        assert receipt.payload.payer == "0xpayer"

    def test_extract_receipt_empty(self):
        assert extract_receipt(None) is None
        assert extract_receipt({}) is None


class TestNormalization:
    def test_normalize_offer(self):
        d = normalize_offer_for_signing(SAMPLE_OFFER)
        assert d["amount"] == "10000"
        assert d["validUntil"] == 0

    def test_normalize_receipt(self):
        p = ReceiptPayload(1, "eip155:8453", "https://example.com", "0xpayer", 1700000000)
        d = normalize_receipt_for_signing(p)
        assert d["transaction"] == ""
