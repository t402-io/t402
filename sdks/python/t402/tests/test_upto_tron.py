"""Tests for TRON Up-To Scheme Types."""

from t402.schemes.tron.upto import (
    UptoTronAuthorization,
    UptoTronPayload,
    UptoTronExtra,
    is_upto_tron_payload,
    upto_payload_from_dict,
)


class TestUptoTronAuthorization:
    """Tests for UptoTronAuthorization model."""

    def test_should_have_correct_structure(self):
        """Test authorization structure with all fields."""
        auth = UptoTronAuthorization(
            owner="TXyz1234567890123456789012345678ab",
            spender="TAbcdefghijklmnopqrstuvwxyz123456",
            contract_address="TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t",
            max_amount="10000000",
            expiration=1740675689000,
            ref_block_bytes="abcd",
            ref_block_hash="1234567890abcdef",
            timestamp=1740672089000,
        )

        assert auth.owner.startswith("T")
        assert auth.spender.startswith("T")
        assert auth.contract_address == "TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t"
        assert auth.max_amount == "10000000"
        assert auth.expiration == 1740675689000
        assert auth.ref_block_bytes == "abcd"
        assert auth.ref_block_hash == "1234567890abcdef"
        assert auth.timestamp == 1740672089000

    def test_should_support_camel_case_aliases(self):
        """Test that camelCase aliases work for deserialization."""
        auth = UptoTronAuthorization(
            owner="TOwner123",
            spender="TSpender456",
            contractAddress="TContract789",
            maxAmount="5000000",
            expiration=1740675689000,
            refBlockBytes="ef01",
            refBlockHash="abcdef0123456789",
            timestamp=1740672089000,
        )

        assert auth.contract_address == "TContract789"
        assert auth.max_amount == "5000000"
        assert auth.ref_block_bytes == "ef01"
        assert auth.ref_block_hash == "abcdef0123456789"


class TestUptoTronPayload:
    """Tests for UptoTronPayload model."""

    def _make_payload(self) -> UptoTronPayload:
        """Create a valid test payload."""
        return UptoTronPayload(
            signed_transaction="a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6",
            authorization=UptoTronAuthorization(
                owner="TXyz1234567890123456789012345678ab",
                spender="TAbcdefghijklmnopqrstuvwxyz123456",
                contract_address="TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t",
                max_amount="10000000",
                expiration=1740675689000,
                ref_block_bytes="abcd",
                ref_block_hash="1234567890abcdef",
                timestamp=1740672089000,
            ),
            payment_nonce="0xf3746613c2d920b5fdabc0856f2aeb2d4f88ee6037b8cc5d04a71a4462f13480",
        )

    def test_should_have_correct_structure(self):
        """Test payload structure."""
        payload = self._make_payload()

        assert payload.signed_transaction == "a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6"
        assert payload.authorization.owner.startswith("T")
        assert payload.authorization.max_amount == "10000000"
        assert payload.payment_nonce.startswith("0x")
        assert len(payload.payment_nonce) == 66

    def test_to_dict(self):
        """Test serialization to dict with camelCase keys."""
        payload = self._make_payload()
        result = payload.to_dict()

        assert result["signedTransaction"] == "a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6"
        assert result["paymentNonce"].startswith("0x")

        auth = result["authorization"]
        assert auth["owner"] == "TXyz1234567890123456789012345678ab"
        assert auth["spender"] == "TAbcdefghijklmnopqrstuvwxyz123456"
        assert auth["contractAddress"] == "TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t"
        assert auth["maxAmount"] == "10000000"
        assert auth["expiration"] == 1740675689000
        assert auth["refBlockBytes"] == "abcd"
        assert auth["refBlockHash"] == "1234567890abcdef"
        assert auth["timestamp"] == 1740672089000

    def test_to_dict_round_trip(self):
        """Test that to_dict output can be read back."""
        payload = self._make_payload()
        result = payload.to_dict()

        restored = upto_payload_from_dict(result)

        assert restored.signed_transaction == payload.signed_transaction
        assert restored.authorization.owner == payload.authorization.owner
        assert restored.authorization.spender == payload.authorization.spender
        assert restored.authorization.contract_address == payload.authorization.contract_address
        assert restored.authorization.max_amount == payload.authorization.max_amount
        assert restored.authorization.expiration == payload.authorization.expiration
        assert restored.payment_nonce == payload.payment_nonce


class TestUptoTronExtra:
    """Tests for UptoTronExtra model."""

    def test_should_work_with_all_fields(self):
        """Test extra with all fields set."""
        extra = UptoTronExtra(
            max_amount="10000000",
            min_amount="100000",
            unit="request",
            unit_price="50000",
            spender_address="TAbcdefghijklmnopqrstuvwxyz123456",
        )

        assert extra.max_amount == "10000000"
        assert extra.min_amount == "100000"
        assert extra.unit == "request"
        assert extra.unit_price == "50000"
        assert extra.spender_address.startswith("T")

    def test_should_work_with_minimal_fields(self):
        """Test extra with no fields (all optional)."""
        extra = UptoTronExtra()

        assert extra.max_amount is None
        assert extra.min_amount is None
        assert extra.unit is None
        assert extra.unit_price is None
        assert extra.spender_address is None

    def test_should_support_camel_case_aliases(self):
        """Test camelCase alias deserialization."""
        extra = UptoTronExtra(
            maxAmount="5000000",
            minAmount="500000",
            unitPrice="100",
            spenderAddress="TSpender123",
        )

        assert extra.max_amount == "5000000"
        assert extra.min_amount == "500000"
        assert extra.unit_price == "100"
        assert extra.spender_address == "TSpender123"


class TestIsUptoTronPayload:
    """Tests for is_upto_tron_payload function."""

    def _valid_payload_dict(self):
        """Return a valid payload dictionary."""
        return {
            "signedTransaction": "a1b2c3d4e5f6",
            "authorization": {
                "owner": "TOwnerAddress123",
                "spender": "TSpenderAddress456",
                "contractAddress": "TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t",
                "maxAmount": "10000000",
                "expiration": 1740675689000,
                "refBlockBytes": "abcd",
                "refBlockHash": "1234567890abcdef",
                "timestamp": 1740672089000,
            },
            "paymentNonce": "0xabc123",
        }

    def test_should_return_true_for_valid_payload(self):
        """Test detection of valid upto TRON payload."""
        assert is_upto_tron_payload(self._valid_payload_dict()) is True

    def test_should_return_false_for_none(self):
        """Test rejection of None."""
        assert is_upto_tron_payload(None) is False

    def test_should_return_false_for_non_dict(self):
        """Test rejection of non-dict types."""
        assert is_upto_tron_payload("string") is False
        assert is_upto_tron_payload(42) is False
        assert is_upto_tron_payload([]) is False

    def test_should_return_false_for_empty_dict(self):
        """Test rejection of empty dict."""
        assert is_upto_tron_payload({}) is False

    def test_should_return_false_when_missing_signed_transaction(self):
        """Test rejection when signedTransaction is missing."""
        data = self._valid_payload_dict()
        del data["signedTransaction"]
        assert is_upto_tron_payload(data) is False

    def test_should_return_false_when_signed_transaction_empty(self):
        """Test rejection when signedTransaction is empty string."""
        data = self._valid_payload_dict()
        data["signedTransaction"] = ""
        assert is_upto_tron_payload(data) is False

    def test_should_return_false_when_missing_payment_nonce(self):
        """Test rejection when paymentNonce is missing."""
        data = self._valid_payload_dict()
        del data["paymentNonce"]
        assert is_upto_tron_payload(data) is False

    def test_should_return_false_when_payment_nonce_empty(self):
        """Test rejection when paymentNonce is empty string."""
        data = self._valid_payload_dict()
        data["paymentNonce"] = ""
        assert is_upto_tron_payload(data) is False

    def test_should_return_false_when_missing_authorization(self):
        """Test rejection when authorization is missing."""
        data = self._valid_payload_dict()
        del data["authorization"]
        assert is_upto_tron_payload(data) is False

    def test_should_return_false_when_authorization_not_dict(self):
        """Test rejection when authorization is not a dict."""
        data = self._valid_payload_dict()
        data["authorization"] = "not a dict"
        assert is_upto_tron_payload(data) is False

    def test_should_return_false_when_missing_owner(self):
        """Test rejection when authorization.owner is missing."""
        data = self._valid_payload_dict()
        data["authorization"]["owner"] = ""
        assert is_upto_tron_payload(data) is False

    def test_should_return_false_when_missing_spender(self):
        """Test rejection when authorization.spender is missing."""
        data = self._valid_payload_dict()
        data["authorization"]["spender"] = ""
        assert is_upto_tron_payload(data) is False

    def test_should_return_false_when_missing_contract_address(self):
        """Test rejection when authorization.contractAddress is missing."""
        data = self._valid_payload_dict()
        data["authorization"]["contractAddress"] = ""
        assert is_upto_tron_payload(data) is False

    def test_should_return_false_when_missing_max_amount(self):
        """Test rejection when authorization.maxAmount is missing."""
        data = self._valid_payload_dict()
        data["authorization"]["maxAmount"] = ""
        assert is_upto_tron_payload(data) is False

    def test_should_return_false_when_expiration_not_number(self):
        """Test rejection when authorization.expiration is not a number."""
        data = self._valid_payload_dict()
        data["authorization"]["expiration"] = "1740675689000"
        assert is_upto_tron_payload(data) is False

    def test_should_return_false_when_timestamp_not_number(self):
        """Test rejection when authorization.timestamp is not a number."""
        data = self._valid_payload_dict()
        data["authorization"]["timestamp"] = "1740672089000"
        assert is_upto_tron_payload(data) is False

    def test_should_reject_exact_scheme_payload(self):
        """Test rejection of exact scheme payload structure."""
        exact_payload = {
            "signedTransaction": "a1b2c3d4",
            "authorization": {
                "from": "TOwner123",
                "to": "TRecipient456",
                "contractAddress": "TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t",
                "amount": "1000000",
                "expiration": 1740675689000,
                "refBlockBytes": "abcd",
                "refBlockHash": "12345678",
                "timestamp": 1740672089000,
            },
        }
        # Exact uses "from/to/amount" not "owner/spender/maxAmount"
        assert is_upto_tron_payload(exact_payload) is False


class TestUptoPayloadFromDict:
    """Tests for upto_payload_from_dict function."""

    def test_creates_payload_from_dict(self):
        """Test payload creation from dict."""
        data = {
            "signedTransaction": "a1b2c3d4e5f6",
            "authorization": {
                "owner": "TOwner123",
                "spender": "TSpender456",
                "contractAddress": "TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t",
                "maxAmount": "10000000",
                "expiration": 1740675689000,
                "refBlockBytes": "abcd",
                "refBlockHash": "1234567890abcdef",
                "timestamp": 1740672089000,
            },
            "paymentNonce": "0xabc123",
        }

        payload = upto_payload_from_dict(data)

        assert payload.signed_transaction == "a1b2c3d4e5f6"
        assert payload.authorization.owner == "TOwner123"
        assert payload.authorization.spender == "TSpender456"
        assert payload.authorization.contract_address == "TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t"
        assert payload.authorization.max_amount == "10000000"
        assert payload.authorization.expiration == 1740675689000
        assert payload.authorization.ref_block_bytes == "abcd"
        assert payload.authorization.ref_block_hash == "1234567890abcdef"
        assert payload.authorization.timestamp == 1740672089000
        assert payload.payment_nonce == "0xabc123"

    def test_creates_payload_from_empty_dict(self):
        """Test payload creation from empty dict with defaults."""
        payload = upto_payload_from_dict({})

        assert payload.signed_transaction == ""
        assert payload.authorization.owner == ""
        assert payload.authorization.spender == ""
        assert payload.authorization.contract_address == ""
        assert payload.authorization.max_amount == ""
        assert payload.authorization.expiration == 0
        assert payload.authorization.ref_block_bytes == ""
        assert payload.authorization.ref_block_hash == ""
        assert payload.authorization.timestamp == 0
        assert payload.payment_nonce == ""
