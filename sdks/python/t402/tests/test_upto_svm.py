"""Tests for SVM Up-To Scheme Types."""

import pytest

from t402.schemes.svm.upto import (
    UptoSvmAuthorization,
    UptoSvmPayload,
    UptoSvmExtra,
    upto_payload_from_dict,
    is_upto_svm_payload,
)


# Sample valid Solana addresses (base58)
SAMPLE_OWNER = "9WzDXwBbmkg8ZTbNMqUxvQRAyrZzDsGYdLVL9zYtAWWM"
SAMPLE_DELEGATE = "8GGtWHRQ1wz5gDKE2KXZLktqzcfV1CBqSbeUZjA7hoWL"
SAMPLE_MINT = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v"
SAMPLE_ATA = "FEeSRuEDk8ENZbpzXjn4DLBMbCjPo2EfQQsMCAfmxZGu"
SAMPLE_TX_BASE64 = "AQAAAA" + "A" * 200 + "=="


class TestUptoSvmAuthorization:
    """Tests for UptoSvmAuthorization model."""

    def test_should_have_correct_structure(self):
        """Test authorization structure."""
        auth = UptoSvmAuthorization(
            owner=SAMPLE_OWNER,
            delegate=SAMPLE_DELEGATE,
            mint=SAMPLE_MINT,
            max_amount="1000000",
            source_ata=SAMPLE_ATA,
        )

        assert auth.owner == SAMPLE_OWNER
        assert auth.delegate == SAMPLE_DELEGATE
        assert auth.mint == SAMPLE_MINT
        assert auth.max_amount == "1000000"
        assert auth.source_ata == SAMPLE_ATA

    def test_to_dict(self):
        """Test serialization to dict."""
        auth = UptoSvmAuthorization(
            owner=SAMPLE_OWNER,
            delegate=SAMPLE_DELEGATE,
            mint=SAMPLE_MINT,
            max_amount="5000000",
            source_ata=SAMPLE_ATA,
        )

        result = auth.to_dict()

        assert result["owner"] == SAMPLE_OWNER
        assert result["delegate"] == SAMPLE_DELEGATE
        assert result["mint"] == SAMPLE_MINT
        assert result["maxAmount"] == "5000000"
        assert result["sourceATA"] == SAMPLE_ATA

    def test_from_camel_case_aliases(self):
        """Test creation using camelCase aliases."""
        auth = UptoSvmAuthorization(
            owner=SAMPLE_OWNER,
            delegate=SAMPLE_DELEGATE,
            mint=SAMPLE_MINT,
            maxAmount="1000000",
            sourceATA=SAMPLE_ATA,
        )

        assert auth.max_amount == "1000000"
        assert auth.source_ata == SAMPLE_ATA


class TestUptoSvmPayload:
    """Tests for UptoSvmPayload model."""

    def test_should_have_correct_structure(self):
        """Test payload structure."""
        payload = UptoSvmPayload(
            transaction=SAMPLE_TX_BASE64,
            authorization=UptoSvmAuthorization(
                owner=SAMPLE_OWNER,
                delegate=SAMPLE_DELEGATE,
                mint=SAMPLE_MINT,
                max_amount="1000000",
                source_ata=SAMPLE_ATA,
            ),
            payment_nonce="a1b2c3d4e5f6",
        )

        assert payload.transaction == SAMPLE_TX_BASE64
        assert payload.authorization.owner == SAMPLE_OWNER
        assert payload.authorization.delegate == SAMPLE_DELEGATE
        assert payload.payment_nonce == "a1b2c3d4e5f6"

    def test_to_dict(self):
        """Test serialization to dict."""
        payload = UptoSvmPayload(
            transaction=SAMPLE_TX_BASE64,
            authorization=UptoSvmAuthorization(
                owner=SAMPLE_OWNER,
                delegate=SAMPLE_DELEGATE,
                mint=SAMPLE_MINT,
                max_amount="1000000",
                source_ata=SAMPLE_ATA,
            ),
            payment_nonce="deadbeef",
        )

        result = payload.to_dict()

        assert result["transaction"] == SAMPLE_TX_BASE64
        assert result["paymentNonce"] == "deadbeef"
        assert result["authorization"]["owner"] == SAMPLE_OWNER
        assert result["authorization"]["delegate"] == SAMPLE_DELEGATE
        assert result["authorization"]["maxAmount"] == "1000000"
        assert result["authorization"]["sourceATA"] == SAMPLE_ATA

    def test_from_camel_case_alias(self):
        """Test creation using paymentNonce alias."""
        payload = UptoSvmPayload(
            transaction=SAMPLE_TX_BASE64,
            authorization=UptoSvmAuthorization(
                owner=SAMPLE_OWNER,
                delegate=SAMPLE_DELEGATE,
                mint=SAMPLE_MINT,
                maxAmount="1000000",
                sourceATA=SAMPLE_ATA,
            ),
            paymentNonce="a1b2c3d4e5f6",
        )

        assert payload.payment_nonce == "a1b2c3d4e5f6"


class TestUptoSvmExtra:
    """Tests for UptoSvmExtra model."""

    def test_should_accept_all_fields(self):
        """Test with all fields populated."""
        extra = UptoSvmExtra(
            fee_payer=SAMPLE_DELEGATE,
            max_amount="10000000",
            min_amount="100000",
            unit="token",
            unit_price="100",
        )

        assert extra.fee_payer == SAMPLE_DELEGATE
        assert extra.max_amount == "10000000"
        assert extra.min_amount == "100000"
        assert extra.unit == "token"
        assert extra.unit_price == "100"

    def test_should_work_with_no_fields(self):
        """Test with no fields (all optional)."""
        extra = UptoSvmExtra()

        assert extra.fee_payer is None
        assert extra.max_amount is None
        assert extra.min_amount is None
        assert extra.unit is None
        assert extra.unit_price is None

    def test_should_work_with_partial_fields(self):
        """Test with partial fields."""
        extra = UptoSvmExtra(
            fee_payer=SAMPLE_DELEGATE,
            unit="request",
        )

        assert extra.fee_payer == SAMPLE_DELEGATE
        assert extra.unit == "request"
        assert extra.max_amount is None

    def test_from_camel_case_aliases(self):
        """Test creation using camelCase aliases."""
        extra = UptoSvmExtra(
            feePayer=SAMPLE_DELEGATE,
            maxAmount="10000000",
            minAmount="100000",
            unitPrice="100",
        )

        assert extra.fee_payer == SAMPLE_DELEGATE
        assert extra.max_amount == "10000000"
        assert extra.min_amount == "100000"
        assert extra.unit_price == "100"


class TestUptoPayloadFromDict:
    """Tests for upto_payload_from_dict function."""

    def test_creates_payload_from_valid_dict(self):
        """Test payload creation from valid dict."""
        data = {
            "transaction": SAMPLE_TX_BASE64,
            "authorization": {
                "owner": SAMPLE_OWNER,
                "delegate": SAMPLE_DELEGATE,
                "mint": SAMPLE_MINT,
                "maxAmount": "1000000",
                "sourceATA": SAMPLE_ATA,
            },
            "paymentNonce": "a1b2c3d4e5f6",
        }

        payload = upto_payload_from_dict(data)

        assert payload.transaction == SAMPLE_TX_BASE64
        assert payload.authorization.owner == SAMPLE_OWNER
        assert payload.authorization.delegate == SAMPLE_DELEGATE
        assert payload.authorization.mint == SAMPLE_MINT
        assert payload.authorization.max_amount == "1000000"
        assert payload.authorization.source_ata == SAMPLE_ATA
        assert payload.payment_nonce == "a1b2c3d4e5f6"

    def test_raises_on_missing_transaction(self):
        """Test error on missing transaction."""
        data = {
            "authorization": {
                "owner": SAMPLE_OWNER,
                "delegate": SAMPLE_DELEGATE,
                "mint": SAMPLE_MINT,
                "maxAmount": "1000000",
                "sourceATA": SAMPLE_ATA,
            },
            "paymentNonce": "a1b2c3d4e5f6",
        }

        with pytest.raises(ValueError, match="transaction"):
            upto_payload_from_dict(data)

    def test_raises_on_missing_payment_nonce(self):
        """Test error on missing paymentNonce."""
        data = {
            "transaction": SAMPLE_TX_BASE64,
            "authorization": {
                "owner": SAMPLE_OWNER,
                "delegate": SAMPLE_DELEGATE,
                "mint": SAMPLE_MINT,
                "maxAmount": "1000000",
                "sourceATA": SAMPLE_ATA,
            },
        }

        with pytest.raises(ValueError, match="paymentNonce"):
            upto_payload_from_dict(data)

    def test_raises_on_missing_owner(self):
        """Test error on missing authorization.owner."""
        data = {
            "transaction": SAMPLE_TX_BASE64,
            "authorization": {
                "delegate": SAMPLE_DELEGATE,
                "mint": SAMPLE_MINT,
                "maxAmount": "1000000",
                "sourceATA": SAMPLE_ATA,
            },
            "paymentNonce": "a1b2c3d4e5f6",
        }

        with pytest.raises(ValueError, match="owner"):
            upto_payload_from_dict(data)

    def test_raises_on_missing_delegate(self):
        """Test error on missing authorization.delegate."""
        data = {
            "transaction": SAMPLE_TX_BASE64,
            "authorization": {
                "owner": SAMPLE_OWNER,
                "mint": SAMPLE_MINT,
                "maxAmount": "1000000",
                "sourceATA": SAMPLE_ATA,
            },
            "paymentNonce": "a1b2c3d4e5f6",
        }

        with pytest.raises(ValueError, match="delegate"):
            upto_payload_from_dict(data)

    def test_raises_on_invalid_authorization_type(self):
        """Test error when authorization is not a dict."""
        data = {
            "transaction": SAMPLE_TX_BASE64,
            "authorization": "not-a-dict",
            "paymentNonce": "a1b2c3d4e5f6",
        }

        with pytest.raises(ValueError, match="authorization"):
            upto_payload_from_dict(data)

    def test_roundtrip(self):
        """Test that to_dict -> from_dict round-trips correctly."""
        original = UptoSvmPayload(
            transaction=SAMPLE_TX_BASE64,
            authorization=UptoSvmAuthorization(
                owner=SAMPLE_OWNER,
                delegate=SAMPLE_DELEGATE,
                mint=SAMPLE_MINT,
                max_amount="1000000",
                source_ata=SAMPLE_ATA,
            ),
            payment_nonce="deadbeef",
        )

        data = original.to_dict()
        restored = upto_payload_from_dict(data)

        assert restored.transaction == original.transaction
        assert restored.authorization.owner == original.authorization.owner
        assert restored.authorization.delegate == original.authorization.delegate
        assert restored.authorization.mint == original.authorization.mint
        assert restored.authorization.max_amount == original.authorization.max_amount
        assert restored.authorization.source_ata == original.authorization.source_ata
        assert restored.payment_nonce == original.payment_nonce


class TestIsUptoSvmPayload:
    """Tests for is_upto_svm_payload function."""

    def test_should_return_true_for_valid_payload(self):
        """Test detection of valid SVM upto payload."""
        payload = {
            "transaction": SAMPLE_TX_BASE64,
            "authorization": {
                "owner": SAMPLE_OWNER,
                "delegate": SAMPLE_DELEGATE,
                "mint": SAMPLE_MINT,
                "maxAmount": "1000000",
                "sourceATA": SAMPLE_ATA,
            },
            "paymentNonce": "a1b2c3d4e5f6",
        }

        assert is_upto_svm_payload(payload) is True

    def test_should_return_false_for_invalid_payloads(self):
        """Test rejection of invalid payloads."""
        test_cases = [
            None,
            {},
            "string",
            42,
            {"transaction": SAMPLE_TX_BASE64},  # missing authorization and nonce
            {
                "transaction": SAMPLE_TX_BASE64,
                "authorization": "not-a-dict",
                "paymentNonce": "abc",
            },
            {
                "transaction": SAMPLE_TX_BASE64,
                "authorization": {"owner": SAMPLE_OWNER},  # incomplete
                "paymentNonce": "abc",
            },
        ]

        for tc in test_cases:
            assert is_upto_svm_payload(tc) is False, f"Expected False for: {tc}"

    def test_should_return_false_for_exact_svm_payload(self):
        """Test rejection of exact SVM payload (no delegate/maxAmount/sourceATA)."""
        exact_payload = {
            "transaction": SAMPLE_TX_BASE64,
        }

        assert is_upto_svm_payload(exact_payload) is False

    def test_should_return_false_when_authorization_field_is_numeric(self):
        """Test rejection when authorization field has wrong type."""
        payload = {
            "transaction": SAMPLE_TX_BASE64,
            "authorization": {
                "owner": SAMPLE_OWNER,
                "delegate": SAMPLE_DELEGATE,
                "mint": SAMPLE_MINT,
                "maxAmount": 1000000,  # number instead of string
                "sourceATA": SAMPLE_ATA,
            },
            "paymentNonce": "a1b2c3d4e5f6",
        }

        assert is_upto_svm_payload(payload) is False
