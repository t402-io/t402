"""Tests for TON Up-To Scheme Types."""

from t402.schemes.ton.upto import (
    UptoTonAuthorization,
    UptoTonPayload,
    UptoTonExtra,
    is_upto_ton_payload,
    upto_payload_from_dict,
)


# Sample TON addresses
SAMPLE_SENDER = "EQDtFpEwcFAEcRe5mLVh2N6C0x-_hJEM7W61_JLnSF74p4q2"
SAMPLE_FACILITATOR = "EQDjv9CUEJ__D_3-3J4trQtqVklMBiNoGVSf3Fu6AaDGkEUe"
SAMPLE_JETTON_MASTER = "EQCxE6mUtQJKFnGfaROTKOt1lZbDiiX1kCixRv7Nw2Id_sDs"
SAMPLE_BOC = "te6cckEBAQEAJAAAQ4AXxx6CuYAlGP8P//+2bLUQ6w94Zv8nEiZ+lBvGKVo+8BA="


class TestUptoTonAuthorization:
    """Tests for UptoTonAuthorization model."""

    def test_should_have_correct_structure(self):
        """Test authorization structure."""
        auth = UptoTonAuthorization(
            from_address=SAMPLE_SENDER,
            facilitator=SAMPLE_FACILITATOR,
            jetton_master=SAMPLE_JETTON_MASTER,
            max_amount="5000000",
            ton_amount="100000000",
            valid_until=1740675689,
            seqno=42,
            query_id="12345678901234567890",
        )

        assert auth.from_address == SAMPLE_SENDER
        assert auth.facilitator == SAMPLE_FACILITATOR
        assert auth.jetton_master == SAMPLE_JETTON_MASTER
        assert auth.max_amount == "5000000"
        assert auth.ton_amount == "100000000"
        assert auth.valid_until == 1740675689
        assert auth.seqno == 42
        assert auth.query_id == "12345678901234567890"

    def test_should_support_alias_construction(self):
        """Test construction with camelCase aliases."""
        auth = UptoTonAuthorization(
            **{
                "from": SAMPLE_SENDER,
                "facilitator": SAMPLE_FACILITATOR,
                "jettonMaster": SAMPLE_JETTON_MASTER,
                "maxAmount": "5000000",
                "tonAmount": "100000000",
                "validUntil": 1740675689,
                "seqno": 42,
                "queryId": "12345678901234567890",
            }
        )

        assert auth.from_address == SAMPLE_SENDER
        assert auth.jetton_master == SAMPLE_JETTON_MASTER
        assert auth.max_amount == "5000000"


class TestUptoTonPayload:
    """Tests for UptoTonPayload model."""

    def test_should_have_correct_structure(self):
        """Test payload structure."""
        payload = UptoTonPayload(
            signed_boc=SAMPLE_BOC,
            authorization=UptoTonAuthorization(
                from_address=SAMPLE_SENDER,
                facilitator=SAMPLE_FACILITATOR,
                jetton_master=SAMPLE_JETTON_MASTER,
                max_amount="5000000",
                ton_amount="100000000",
                valid_until=1740675689,
                seqno=42,
                query_id="12345678901234567890",
            ),
            payment_nonce="0xf3746613c2d920b5fdabc0856f2aeb2d4f88ee6037b8cc5d04a71a4462f13480",
        )

        assert payload.signed_boc == SAMPLE_BOC
        assert payload.authorization.from_address == SAMPLE_SENDER
        assert payload.authorization.facilitator == SAMPLE_FACILITATOR
        assert len(payload.payment_nonce) == 66

    def test_to_dict(self):
        """Test serialization to dict."""
        payload = UptoTonPayload(
            signed_boc=SAMPLE_BOC,
            authorization=UptoTonAuthorization(
                from_address=SAMPLE_SENDER,
                facilitator=SAMPLE_FACILITATOR,
                jetton_master=SAMPLE_JETTON_MASTER,
                max_amount="5000000",
                ton_amount="100000000",
                valid_until=1740675689,
                seqno=42,
                query_id="12345678901234567890",
            ),
            payment_nonce="0xnonce",
        )

        result = payload.to_dict()

        assert result["signedBoc"] == SAMPLE_BOC
        assert result["paymentNonce"] == "0xnonce"
        assert result["authorization"]["from"] == SAMPLE_SENDER
        assert result["authorization"]["facilitator"] == SAMPLE_FACILITATOR
        assert result["authorization"]["jettonMaster"] == SAMPLE_JETTON_MASTER
        assert result["authorization"]["maxAmount"] == "5000000"
        assert result["authorization"]["tonAmount"] == "100000000"
        assert result["authorization"]["validUntil"] == 1740675689
        assert result["authorization"]["seqno"] == 42
        assert result["authorization"]["queryId"] == "12345678901234567890"

    def test_to_dict_roundtrip(self):
        """Test dict roundtrip."""
        payload = UptoTonPayload(
            signed_boc=SAMPLE_BOC,
            authorization=UptoTonAuthorization(
                from_address=SAMPLE_SENDER,
                facilitator=SAMPLE_FACILITATOR,
                jetton_master=SAMPLE_JETTON_MASTER,
                max_amount="5000000",
                ton_amount="100000000",
                valid_until=1740675689,
                seqno=42,
                query_id="999",
            ),
            payment_nonce="0xabc123",
        )

        data = payload.to_dict()
        restored = upto_payload_from_dict(data)

        assert restored.signed_boc == payload.signed_boc
        assert restored.authorization.from_address == payload.authorization.from_address
        assert restored.authorization.facilitator == payload.authorization.facilitator
        assert restored.authorization.jetton_master == payload.authorization.jetton_master
        assert restored.authorization.max_amount == payload.authorization.max_amount
        assert restored.authorization.ton_amount == payload.authorization.ton_amount
        assert restored.authorization.valid_until == payload.authorization.valid_until
        assert restored.authorization.seqno == payload.authorization.seqno
        assert restored.authorization.query_id == payload.authorization.query_id
        assert restored.payment_nonce == payload.payment_nonce


class TestUptoTonExtra:
    """Tests for UptoTonExtra model."""

    def test_should_have_full_upto_parameters(self):
        """Test full extra fields."""
        extra = UptoTonExtra(
            facilitator=SAMPLE_FACILITATOR,
            max_amount="10000000",
            min_amount="100000",
            unit="token",
            unit_price="100",
        )

        assert extra.facilitator == SAMPLE_FACILITATOR
        assert extra.max_amount == "10000000"
        assert extra.min_amount == "100000"
        assert extra.unit == "token"
        assert extra.unit_price == "100"

    def test_should_work_with_minimal_fields(self):
        """Test with no fields set."""
        extra = UptoTonExtra()

        assert extra.facilitator is None
        assert extra.max_amount is None
        assert extra.min_amount is None
        assert extra.unit is None
        assert extra.unit_price is None

    def test_should_work_with_only_facilitator(self):
        """Test with only facilitator set."""
        extra = UptoTonExtra(facilitator=SAMPLE_FACILITATOR)

        assert extra.facilitator == SAMPLE_FACILITATOR
        assert extra.unit is None

    def test_should_support_alias_construction(self):
        """Test construction with camelCase aliases."""
        extra = UptoTonExtra(
            **{
                "facilitator": SAMPLE_FACILITATOR,
                "maxAmount": "10000000",
                "minAmount": "100000",
                "unit": "request",
                "unitPrice": "500",
            }
        )

        assert extra.max_amount == "10000000"
        assert extra.min_amount == "100000"
        assert extra.unit_price == "500"


class TestIsUptoTonPayload:
    """Tests for is_upto_ton_payload function."""

    def _valid_payload(self):
        return {
            "signedBoc": SAMPLE_BOC,
            "authorization": {
                "from": SAMPLE_SENDER,
                "facilitator": SAMPLE_FACILITATOR,
                "jettonMaster": SAMPLE_JETTON_MASTER,
                "maxAmount": "5000000",
                "tonAmount": "100000000",
                "validUntil": 1740675689,
                "seqno": 42,
                "queryId": "12345678901234567890",
            },
            "paymentNonce": "0xf374661300000000",
        }

    def test_should_return_true_for_valid_payload(self):
        """Test detection of valid TON upto payload."""
        assert is_upto_ton_payload(self._valid_payload()) is True

    def test_should_return_false_for_none(self):
        """Test rejection of None."""
        assert is_upto_ton_payload(None) is False

    def test_should_return_false_for_empty_dict(self):
        """Test rejection of empty dict."""
        assert is_upto_ton_payload({}) is False

    def test_should_return_false_for_non_dict(self):
        """Test rejection of non-dict types."""
        assert is_upto_ton_payload("string") is False
        assert is_upto_ton_payload(42) is False
        assert is_upto_ton_payload([]) is False

    def test_should_return_false_for_missing_signed_boc(self):
        """Test rejection when signedBoc is missing."""
        data = self._valid_payload()
        del data["signedBoc"]
        assert is_upto_ton_payload(data) is False

    def test_should_return_false_for_empty_signed_boc(self):
        """Test rejection when signedBoc is empty."""
        data = self._valid_payload()
        data["signedBoc"] = ""
        assert is_upto_ton_payload(data) is False

    def test_should_return_false_for_missing_payment_nonce(self):
        """Test rejection when paymentNonce is missing."""
        data = self._valid_payload()
        del data["paymentNonce"]
        assert is_upto_ton_payload(data) is False

    def test_should_return_false_for_missing_authorization(self):
        """Test rejection when authorization is missing."""
        data = self._valid_payload()
        del data["authorization"]
        assert is_upto_ton_payload(data) is False

    def test_should_return_false_for_missing_from(self):
        """Test rejection when authorization.from is empty."""
        data = self._valid_payload()
        data["authorization"]["from"] = ""
        assert is_upto_ton_payload(data) is False

    def test_should_return_false_for_missing_facilitator(self):
        """Test rejection when authorization.facilitator is empty."""
        data = self._valid_payload()
        data["authorization"]["facilitator"] = ""
        assert is_upto_ton_payload(data) is False

    def test_should_return_false_for_wrong_field_types(self):
        """Test rejection when field types are wrong."""
        data = self._valid_payload()
        data["authorization"]["maxAmount"] = 5000000  # should be string
        assert is_upto_ton_payload(data) is False

    def test_should_return_false_for_exact_scheme_payload(self):
        """Test rejection of exact TON payload (different structure)."""
        exact_payload = {
            "signedBoc": SAMPLE_BOC,
            "authorization": {
                "from": SAMPLE_SENDER,
                "to": "EQSomeRecipient",
                "jettonMaster": SAMPLE_JETTON_MASTER,
                "jettonAmount": "1000000",
                "tonAmount": "100000000",
                "validUntil": 1740675689,
                "seqno": 42,
                "queryId": "12345",
            },
        }
        assert is_upto_ton_payload(exact_payload) is False


class TestUptoPayloadFromDict:
    """Tests for upto_payload_from_dict function."""

    def test_creates_payload_from_dict(self):
        """Test payload creation from dict."""
        data = {
            "signedBoc": SAMPLE_BOC,
            "authorization": {
                "from": SAMPLE_SENDER,
                "facilitator": SAMPLE_FACILITATOR,
                "jettonMaster": SAMPLE_JETTON_MASTER,
                "maxAmount": "5000000",
                "tonAmount": "100000000",
                "validUntil": 1740675689,
                "seqno": 42,
                "queryId": "12345678901234567890",
            },
            "paymentNonce": "0xnonce",
        }

        payload = upto_payload_from_dict(data)

        assert payload.signed_boc == SAMPLE_BOC
        assert payload.authorization.from_address == SAMPLE_SENDER
        assert payload.authorization.facilitator == SAMPLE_FACILITATOR
        assert payload.authorization.jetton_master == SAMPLE_JETTON_MASTER
        assert payload.authorization.max_amount == "5000000"
        assert payload.authorization.ton_amount == "100000000"
        assert payload.authorization.valid_until == 1740675689
        assert payload.authorization.seqno == 42
        assert payload.authorization.query_id == "12345678901234567890"
        assert payload.payment_nonce == "0xnonce"

    def test_handles_missing_fields_with_defaults(self):
        """Test payload creation with missing fields defaults."""
        data = {}

        payload = upto_payload_from_dict(data)

        assert payload.signed_boc == ""
        assert payload.authorization.from_address == ""
        assert payload.authorization.facilitator == ""
        assert payload.authorization.seqno == 0
        assert payload.payment_nonce == ""
