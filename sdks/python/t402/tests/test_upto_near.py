"""Tests for NEAR Up-To Scheme Types."""

from t402.schemes.near.upto import (
    UptoNearAuthorization,
    UptoNearPayload,
    UptoNearExtra,
    UptoNearSettlement,
    UptoNearUsageDetails,
    is_upto_near_payload,
    upto_payload_from_dict,
)


class TestUptoNearAuthorization:
    """Tests for UptoNearAuthorization model."""

    def test_should_have_correct_structure(self):
        """Test that authorization has all required fields."""
        auth = UptoNearAuthorization(
            from_account="alice.near",
            facilitator="facilitator.near",
            token_contract="usdt.tether-token.near",
            max_amount="1000000",
        )

        assert auth.from_account == "alice.near"
        assert auth.facilitator == "facilitator.near"
        assert auth.token_contract == "usdt.tether-token.near"
        assert auth.max_amount == "1000000"

    def test_should_serialize_to_camel_case(self):
        """Test camelCase serialization."""
        auth = UptoNearAuthorization(
            from_account="alice.near",
            facilitator="facilitator.near",
            token_contract="usdt.tether-token.near",
            max_amount="1000000",
        )

        data = auth.model_dump(by_alias=True)
        assert "from" in data
        assert "facilitator" in data
        assert "tokenContract" in data
        assert "maxAmount" in data

    def test_should_deserialize_from_camel_case(self):
        """Test deserialization from camelCase dict."""
        auth = UptoNearAuthorization.model_validate({
            "from": "alice.near",
            "facilitator": "facilitator.near",
            "tokenContract": "usdt.tether-token.near",
            "maxAmount": "1000000",
        })

        assert auth.from_account == "alice.near"
        assert auth.facilitator == "facilitator.near"
        assert auth.token_contract == "usdt.tether-token.near"
        assert auth.max_amount == "1000000"


class TestUptoNearPayload:
    """Tests for UptoNearPayload model."""

    def test_should_have_correct_structure(self):
        """Test that payload has all required fields."""
        payload = UptoNearPayload(
            tx_hash="9FbNk5XzYTa1BRuesGjCZ5uWY8TV9KFesh3PFjDEB4jQ",
            authorization=UptoNearAuthorization(
                from_account="alice.near",
                facilitator="facilitator.near",
                token_contract="usdt.tether-token.near",
                max_amount="1000000",
            ),
            payment_nonce="0xf3746613c2d920b5",
        )

        assert payload.tx_hash == "9FbNk5XzYTa1BRuesGjCZ5uWY8TV9KFesh3PFjDEB4jQ"
        assert payload.authorization.from_account == "alice.near"
        assert payload.authorization.facilitator == "facilitator.near"
        assert payload.payment_nonce == "0xf3746613c2d920b5"

    def test_should_serialize_to_dict(self):
        """Test to_dict produces correct camelCase keys."""
        payload = UptoNearPayload(
            tx_hash="9FbNk5XzYTa1BRuesGjCZ5uWY8TV9KFesh3PFjDEB4jQ",
            authorization=UptoNearAuthorization(
                from_account="alice.near",
                facilitator="facilitator.near",
                token_contract="usdt.tether-token.near",
                max_amount="1000000",
            ),
            payment_nonce="0xnonce",
        )

        data = payload.to_dict()

        assert data["txHash"] == "9FbNk5XzYTa1BRuesGjCZ5uWY8TV9KFesh3PFjDEB4jQ"
        assert data["paymentNonce"] == "0xnonce"
        assert data["authorization"]["from"] == "alice.near"
        assert data["authorization"]["facilitator"] == "facilitator.near"
        assert data["authorization"]["tokenContract"] == "usdt.tether-token.near"
        assert data["authorization"]["maxAmount"] == "1000000"

    def test_should_round_trip_through_dict(self):
        """Test serialization round-trip."""
        original = UptoNearPayload(
            tx_hash="9FbNk5XzYTa1BRuesGjCZ5uWY8TV9KFesh3PFjDEB4jQ",
            authorization=UptoNearAuthorization(
                from_account="alice.near",
                facilitator="facilitator.near",
                token_contract="usdt.tether-token.near",
                max_amount="1000000",
            ),
            payment_nonce="0xnonce",
        )

        data = original.to_dict()
        restored = upto_payload_from_dict(data)

        assert restored.tx_hash == original.tx_hash
        assert restored.authorization.from_account == original.authorization.from_account
        assert restored.authorization.facilitator == original.authorization.facilitator
        assert restored.authorization.token_contract == original.authorization.token_contract
        assert restored.authorization.max_amount == original.authorization.max_amount
        assert restored.payment_nonce == original.payment_nonce


class TestUptoNearExtra:
    """Tests for UptoNearExtra model."""

    def test_should_have_all_fields(self):
        """Test extra with all optional fields populated."""
        extra = UptoNearExtra(
            facilitator="facilitator.near",
            max_amount="1000000",
            min_amount="10000",
            unit="token",
            unit_price="100",
        )

        assert extra.facilitator == "facilitator.near"
        assert extra.max_amount == "1000000"
        assert extra.min_amount == "10000"
        assert extra.unit == "token"
        assert extra.unit_price == "100"

    def test_should_work_without_optional_fields(self):
        """Test that all fields are optional."""
        extra = UptoNearExtra()

        assert extra.facilitator is None
        assert extra.max_amount is None
        assert extra.min_amount is None
        assert extra.unit is None
        assert extra.unit_price is None

    def test_should_serialize_to_camel_case(self):
        """Test camelCase serialization."""
        extra = UptoNearExtra(
            facilitator="facilitator.near",
            max_amount="1000000",
            min_amount="10000",
            unit_price="100",
        )

        data = extra.model_dump(by_alias=True, exclude_none=True)
        assert "facilitator" in data
        assert "maxAmount" in data
        assert "minAmount" in data
        assert "unitPrice" in data

    def test_should_work_with_only_facilitator(self):
        """Test extra with just facilitator field."""
        extra = UptoNearExtra(facilitator="facilitator.near")

        assert extra.facilitator == "facilitator.near"
        assert extra.unit is None


class TestUptoNearSettlement:
    """Tests for UptoNearSettlement model."""

    def test_should_contain_settle_amount(self):
        """Test settlement amount field."""
        settlement = UptoNearSettlement(settle_amount="150000")

        assert settlement.settle_amount == "150000"

    def test_should_support_usage_details(self):
        """Test settlement with usage details."""
        settlement = UptoNearSettlement(
            settle_amount="150000",
            usage_details=UptoNearUsageDetails(
                units_consumed=1500,
                unit_price="100",
                unit_type="token",
                start_time=1740672000,
                end_time=1740675600,
            ),
        )

        assert settlement.settle_amount == "150000"
        assert settlement.usage_details is not None
        assert settlement.usage_details.units_consumed == 1500
        assert settlement.usage_details.unit_price == "100"
        assert settlement.usage_details.unit_type == "token"
        assert settlement.usage_details.start_time == 1740672000
        assert settlement.usage_details.end_time == 1740675600

    def test_should_work_without_usage_details(self):
        """Test settlement without usage details."""
        settlement = UptoNearSettlement(settle_amount="150000")

        assert settlement.usage_details is None

    def test_should_serialize_to_camel_case(self):
        """Test camelCase serialization."""
        settlement = UptoNearSettlement(settle_amount="150000")

        data = settlement.model_dump(by_alias=True)
        assert "settleAmount" in data


class TestIsUptoNearPayload:
    """Tests for is_upto_near_payload function."""

    def test_should_return_true_for_valid_payload(self):
        """Test detection of valid upto NEAR payload."""
        data = {
            "txHash": "9FbNk5XzYTa1BRuesGjCZ5uWY8TV9KFesh3PFjDEB4jQ",
            "authorization": {
                "from": "alice.near",
                "facilitator": "facilitator.near",
                "tokenContract": "usdt.tether-token.near",
                "maxAmount": "1000000",
            },
            "paymentNonce": "0xabc123",
        }

        assert is_upto_near_payload(data) is True

    def test_should_return_false_for_none(self):
        """Test rejection of None."""
        assert is_upto_near_payload(None) is False  # type: ignore

    def test_should_return_false_for_empty_dict(self):
        """Test rejection of empty dict."""
        assert is_upto_near_payload({}) is False

    def test_should_return_false_for_missing_tx_hash(self):
        """Test rejection when txHash is missing."""
        data = {
            "authorization": {
                "from": "alice.near",
                "facilitator": "facilitator.near",
                "tokenContract": "usdt.tether-token.near",
                "maxAmount": "1000000",
            },
            "paymentNonce": "0xabc",
        }

        assert is_upto_near_payload(data) is False

    def test_should_return_false_for_missing_payment_nonce(self):
        """Test rejection when paymentNonce is missing."""
        data = {
            "txHash": "9FbNk5XzYTa1BRuesGjCZ5uWY8TV9KFesh3PFjDEB4jQ",
            "authorization": {
                "from": "alice.near",
                "facilitator": "facilitator.near",
                "tokenContract": "usdt.tether-token.near",
                "maxAmount": "1000000",
            },
        }

        assert is_upto_near_payload(data) is False

    def test_should_return_false_for_missing_authorization(self):
        """Test rejection when authorization is missing."""
        data = {
            "txHash": "9FbNk5XzYTa1BRuesGjCZ5uWY8TV9KFesh3PFjDEB4jQ",
            "paymentNonce": "0xabc",
        }

        assert is_upto_near_payload(data) is False

    def test_should_return_false_for_incomplete_authorization(self):
        """Test rejection when authorization is missing required fields."""
        data = {
            "txHash": "9FbNk5XzYTa1BRuesGjCZ5uWY8TV9KFesh3PFjDEB4jQ",
            "authorization": {
                "from": "alice.near",
                # missing facilitator, tokenContract, maxAmount
            },
            "paymentNonce": "0xabc",
        }

        assert is_upto_near_payload(data) is False

    def test_should_return_false_for_exact_direct_payload(self):
        """Test rejection of exact-direct payload format."""
        data = {
            "txHash": "9FbNk5XzYTa1BRuesGjCZ5uWY8TV9KFesh3PFjDEB4jQ",
            "from": "alice.near",
            "to": "merchant.near",
            "amount": "1000000",
        }

        assert is_upto_near_payload(data) is False

    def test_should_return_false_for_empty_from(self):
        """Test rejection when from is empty string."""
        data = {
            "txHash": "9FbNk5XzYTa1BRuesGjCZ5uWY8TV9KFesh3PFjDEB4jQ",
            "authorization": {
                "from": "",
                "facilitator": "facilitator.near",
                "tokenContract": "usdt.tether-token.near",
                "maxAmount": "1000000",
            },
            "paymentNonce": "0xabc",
        }

        assert is_upto_near_payload(data) is False

    def test_should_return_false_for_empty_facilitator(self):
        """Test rejection when facilitator is empty string."""
        data = {
            "txHash": "9FbNk5XzYTa1BRuesGjCZ5uWY8TV9KFesh3PFjDEB4jQ",
            "authorization": {
                "from": "alice.near",
                "facilitator": "",
                "tokenContract": "usdt.tether-token.near",
                "maxAmount": "1000000",
            },
            "paymentNonce": "0xabc",
        }

        assert is_upto_near_payload(data) is False

    def test_should_return_false_for_non_string_tx_hash(self):
        """Test rejection when txHash is not a string."""
        data = {
            "txHash": 12345,
            "authorization": {
                "from": "alice.near",
                "facilitator": "facilitator.near",
                "tokenContract": "usdt.tether-token.near",
                "maxAmount": "1000000",
            },
            "paymentNonce": "0xabc",
        }

        assert is_upto_near_payload(data) is False


class TestUptoPayloadFromDict:
    """Tests for upto_payload_from_dict function."""

    def test_should_create_payload_from_valid_dict(self):
        """Test creating a payload from a valid dictionary."""
        data = {
            "txHash": "9FbNk5XzYTa1BRuesGjCZ5uWY8TV9KFesh3PFjDEB4jQ",
            "authorization": {
                "from": "alice.near",
                "facilitator": "facilitator.near",
                "tokenContract": "usdt.tether-token.near",
                "maxAmount": "1000000",
            },
            "paymentNonce": "0xnonce",
        }

        payload = upto_payload_from_dict(data)

        assert payload.tx_hash == "9FbNk5XzYTa1BRuesGjCZ5uWY8TV9KFesh3PFjDEB4jQ"
        assert payload.authorization.from_account == "alice.near"
        assert payload.authorization.facilitator == "facilitator.near"
        assert payload.authorization.token_contract == "usdt.tether-token.near"
        assert payload.authorization.max_amount == "1000000"
        assert payload.payment_nonce == "0xnonce"

    def test_should_handle_missing_fields_with_defaults(self):
        """Test that missing fields get default empty strings."""
        data = {}

        payload = upto_payload_from_dict(data)

        assert payload.tx_hash == ""
        assert payload.authorization.from_account == ""
        assert payload.authorization.facilitator == ""
        assert payload.authorization.token_contract == ""
        assert payload.authorization.max_amount == ""
        assert payload.payment_nonce == ""
