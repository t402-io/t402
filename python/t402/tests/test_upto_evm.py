"""Tests for EVM Up-To Scheme Types."""

import pytest
from t402.schemes.evm.upto import (
    SCHEME_UPTO,
    PERMIT_TYPES,
    PERMIT_DOMAIN_TYPES,
    PermitSignature,
    PermitAuthorization,
    UptoEIP2612Payload,
    UptoCompactPayload,
    UptoEvmExtra,
    UptoEvmSettlement,
    UptoEvmUsageDetails,
    is_eip2612_payload,
    create_permit_domain,
    create_permit_message,
    payload_from_dict,
)


class TestPermitSignature:
    """Tests for PermitSignature model."""

    def test_should_have_correct_structure(self):
        """Test signature structure."""
        sig = PermitSignature(
            v=27,
            r="0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef",
            s="0xfedcba0987654321fedcba0987654321fedcba0987654321fedcba0987654321",
        )

        assert sig.v == 27
        assert len(sig.r) == 66  # 0x + 64 hex chars
        assert len(sig.s) == 66


class TestPermitAuthorization:
    """Tests for PermitAuthorization model."""

    def test_should_have_correct_structure(self):
        """Test authorization structure."""
        auth = PermitAuthorization(
            owner="0x1234567890123456789012345678901234567890",
            spender="0xabcdefabcdefabcdefabcdefabcdefabcdefabcd",
            value="1000000",
            deadline="1740675689",
            nonce=5,
        )

        assert len(auth.owner) == 42  # 0x + 40 hex chars
        assert len(auth.spender) == 42
        assert auth.value == "1000000"
        assert auth.deadline == "1740675689"
        assert auth.nonce == 5


class TestUptoEIP2612Payload:
    """Tests for UptoEIP2612Payload model."""

    def test_should_have_correct_structure(self):
        """Test payload structure."""
        payload = UptoEIP2612Payload(
            signature=PermitSignature(
                v=28,
                r="0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef",
                s="0xfedcba0987654321fedcba0987654321fedcba0987654321fedcba0987654321",
            ),
            authorization=PermitAuthorization(
                owner="0x1234567890123456789012345678901234567890",
                spender="0xabcdefabcdefabcdefabcdefabcdefabcdefabcd",
                value="1000000",
                deadline="1740675689",
                nonce=0,
            ),
            payment_nonce="0xf3746613c2d920b5fdabc0856f2aeb2d4f88ee6037b8cc5d04a71a4462f13480",
        )

        assert payload.signature.v == 28
        assert payload.authorization.owner == "0x1234567890123456789012345678901234567890"
        assert len(payload.payment_nonce) == 66

    def test_to_dict(self):
        """Test serialization to dict."""
        payload = UptoEIP2612Payload(
            signature=PermitSignature(v=28, r="0x1234", s="0x5678"),
            authorization=PermitAuthorization(
                owner="0xowner",
                spender="0xspender",
                value="1000000",
                deadline="1740675689",
                nonce=5,
            ),
            payment_nonce="0xnonce",
        )

        result = payload.to_dict()

        assert result["paymentNonce"] == "0xnonce"
        assert result["signature"]["v"] == 28
        assert result["authorization"]["owner"] == "0xowner"


class TestUptoEvmExtra:
    """Tests for UptoEvmExtra model."""

    def test_should_have_eip712_domain_parameters(self):
        """Test EIP-712 domain fields."""
        extra = UptoEvmExtra(
            name="USD Coin",
            version="2",
            router_address="0x1234567890123456789012345678901234567890",
            unit="token",
            unit_price="100",
        )

        assert extra.name == "USD Coin"
        assert extra.version == "2"
        assert len(extra.router_address) == 42
        assert extra.unit == "token"
        assert extra.unit_price == "100"

    def test_should_work_with_minimal_required_fields(self):
        """Test with only required fields."""
        extra = UptoEvmExtra(
            name="USDC",
            version="1",
        )

        assert extra.name == "USDC"
        assert extra.version == "1"
        assert extra.router_address is None


class TestUptoEvmSettlement:
    """Tests for UptoEvmSettlement model."""

    def test_should_contain_settle_amount(self):
        """Test settlement amount field."""
        settlement = UptoEvmSettlement(settle_amount="150000")

        assert settlement.settle_amount == "150000"

    def test_should_support_usage_details(self):
        """Test usage details field."""
        settlement = UptoEvmSettlement(
            settle_amount="150000",
            usage_details=UptoEvmUsageDetails(
                units_consumed=1500,
                unit_price="100",
                unit_type="token",
                start_time=1740672000,
                end_time=1740675600,
            ),
        )

        assert settlement.settle_amount == "150000"
        assert settlement.usage_details.units_consumed == 1500
        assert settlement.usage_details.unit_price == "100"
        assert settlement.usage_details.unit_type == "token"


class TestPermitTypes:
    """Tests for PERMIT_TYPES constant."""

    def test_should_have_correct_eip712_structure(self):
        """Test EIP-712 type structure."""
        assert "Permit" in PERMIT_TYPES
        assert len(PERMIT_TYPES["Permit"]) == 5

        field_names = [f["name"] for f in PERMIT_TYPES["Permit"]]
        assert "owner" in field_names
        assert "spender" in field_names
        assert "value" in field_names
        assert "nonce" in field_names
        assert "deadline" in field_names


class TestIsEIP2612Payload:
    """Tests for is_eip2612_payload function."""

    def test_should_return_true_for_valid_payload(self):
        """Test detection of valid EIP-2612 payload."""
        payload = {
            "signature": {"v": 28, "r": "0x123", "s": "0x456"},
            "authorization": {
                "owner": "0x123",
                "spender": "0x456",
                "value": "1000",
                "deadline": "123456",
                "nonce": 0,
            },
            "paymentNonce": "0xabc",
        }

        assert is_eip2612_payload(payload) is True

    def test_should_return_false_for_invalid_payload(self):
        """Test rejection of invalid payloads."""
        test_cases = [
            None,
            {},
            {"signature": "0x123"},  # string signature
            {
                "signature": {"v": 28},  # incomplete signature
                "authorization": {},
            },
        ]

        for tc in test_cases:
            assert is_eip2612_payload(tc) is False

    def test_should_return_false_for_exact_scheme_payload(self):
        """Test rejection of exact scheme payload."""
        exact_payload = {
            "signature": "0x123",  # string, not object
            "authorization": {
                "from": "0x123",
                "to": "0x456",
                "value": "1000",
                "validAfter": "0",
                "validBefore": "999999",
                "nonce": "0xabc",
            },
        }

        assert is_eip2612_payload(exact_payload) is False


class TestCreatePermitDomain:
    """Tests for create_permit_domain function."""

    def test_creates_correct_domain(self):
        """Test domain creation."""
        domain = create_permit_domain(
            name="USD Coin",
            version="2",
            chain_id=8453,
            token_address="0xtoken",
        )

        assert domain["name"] == "USD Coin"
        assert domain["version"] == "2"
        assert domain["chainId"] == 8453
        assert domain["verifyingContract"] == "0xtoken"


class TestCreatePermitMessage:
    """Tests for create_permit_message function."""

    def test_creates_correct_message(self):
        """Test message creation."""
        auth = PermitAuthorization(
            owner="0xowner",
            spender="0xspender",
            value="1000000",
            deadline="1740675689",
            nonce=5,
        )

        message = create_permit_message(auth)

        assert message["owner"] == "0xowner"
        assert message["spender"] == "0xspender"
        assert message["value"] == 1000000
        assert message["nonce"] == 5
        assert message["deadline"] == 1740675689


class TestPayloadFromDict:
    """Tests for payload_from_dict function."""

    def test_creates_payload_from_dict(self):
        """Test payload creation from dict."""
        data = {
            "signature": {
                "v": 28,
                "r": "0x1234",
                "s": "0x5678",
            },
            "authorization": {
                "owner": "0xowner",
                "spender": "0xspender",
                "value": "1000000",
                "deadline": "1740675689",
                "nonce": 5,
            },
            "paymentNonce": "0xnonce",
        }

        payload = payload_from_dict(data)

        assert payload.signature.v == 28
        assert payload.signature.r == "0x1234"
        assert payload.authorization.owner == "0xowner"
        assert payload.authorization.nonce == 5
        assert payload.payment_nonce == "0xnonce"
