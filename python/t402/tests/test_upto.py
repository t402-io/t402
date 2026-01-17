"""Tests for Up-To Scheme Types."""

import pytest
from t402.schemes.upto import (
    SCHEME_UPTO,
    DEFAULT_MIN_AMOUNT,
    DEFAULT_MAX_TIMEOUT_SECONDS,
    SUPPORTED_UNITS,
    UptoExtra,
    UptoPaymentRequirements,
    UptoUsageDetails,
    UptoSettlement,
    UptoSettlementResponse,
    UptoValidationResult,
    is_upto_payment_requirements,
    is_valid_unit,
    create_payment_requirements,
    create_settlement,
)


class TestUptoPaymentRequirements:
    """Tests for UptoPaymentRequirements model."""

    def test_should_have_upto_scheme(self):
        """Test that requirements have upto scheme."""
        requirements = UptoPaymentRequirements(
            scheme="upto",
            network="eip155:8453",
            max_amount="1000000",
            min_amount="10000",
            asset="0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
            pay_to="0x1234567890123456789012345678901234567890",
            max_timeout_seconds=300,
            extra=UptoExtra(unit="token", unit_price="100"),
        )

        assert requirements.scheme == "upto"
        assert requirements.max_amount == "1000000"
        assert requirements.min_amount == "10000"

    def test_should_work_without_optional_min_amount(self):
        """Test that minAmount is optional."""
        requirements = UptoPaymentRequirements(
            scheme="upto",
            network="eip155:8453",
            max_amount="1000000",
            asset="0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
            pay_to="0x1234567890123456789012345678901234567890",
            max_timeout_seconds=300,
        )

        assert requirements.scheme == "upto"
        assert requirements.min_amount is None

    def test_should_serialize_to_camel_case(self):
        """Test camelCase serialization."""
        requirements = UptoPaymentRequirements(
            scheme="upto",
            network="eip155:8453",
            max_amount="1000000",
            asset="0x123",
            pay_to="0x456",
            max_timeout_seconds=300,
        )

        data = requirements.model_dump(by_alias=True)
        assert "maxAmount" in data
        assert "payTo" in data
        assert "maxTimeoutSeconds" in data


class TestUptoExtra:
    """Tests for UptoExtra model."""

    def test_should_support_billing_unit_configuration(self):
        """Test billing unit fields."""
        extra = UptoExtra(
            unit="token",
            unit_price="100",
            name="USD Coin",
            version="2",
            router_address="0x1234567890123456789012345678901234567890",
        )

        assert extra.unit == "token"
        assert extra.unit_price == "100"
        assert extra.name == "USD Coin"
        assert extra.version == "2"

    def test_should_allow_extra_fields(self):
        """Test that extra fields are allowed."""
        extra = UptoExtra(
            unit="token",
            customField="customValue",  # type: ignore
        )

        assert extra.unit == "token"


class TestUptoSettlement:
    """Tests for UptoSettlement model."""

    def test_should_contain_settle_amount(self):
        """Test settlement amount field."""
        settlement = UptoSettlement(settle_amount="150000")

        assert settlement.settle_amount == "150000"

    def test_should_support_usage_details(self):
        """Test usage details field."""
        settlement = UptoSettlement(
            settle_amount="150000",
            usage_details=UptoUsageDetails(
                units_consumed=1500,
                unit_price="100",
                unit_type="token",
            ),
        )

        assert settlement.usage_details is not None
        assert settlement.usage_details.units_consumed == 1500


class TestUptoUsageDetails:
    """Tests for UptoUsageDetails model."""

    def test_should_track_usage_metrics(self):
        """Test usage metrics fields."""
        usage = UptoUsageDetails(
            units_consumed=1500,
            unit_price="100",
            unit_type="token",
            start_time=1740672000,
            end_time=1740675600,
            metadata={
                "model": "gpt-4",
                "promptTokens": 100,
                "completionTokens": 1400,
            },
        )

        assert usage.units_consumed == 1500
        assert usage.start_time == 1740672000
        assert usage.end_time == 1740675600
        assert usage.metadata["model"] == "gpt-4"


class TestUptoSettlementResponse:
    """Tests for UptoSettlementResponse model."""

    def test_should_report_successful_settlement(self):
        """Test successful settlement response."""
        response = UptoSettlementResponse(
            success=True,
            transaction_hash="0xabc123",
            settled_amount="150000",
            max_amount="1000000",
            block_number=12345678,
            gas_used="85000",
        )

        assert response.success is True
        assert response.settled_amount == "150000"
        assert response.max_amount == "1000000"

    def test_should_report_failed_settlement(self):
        """Test failed settlement response."""
        response = UptoSettlementResponse(
            success=False,
            settled_amount="0",
            max_amount="1000000",
            error="Insufficient balance",
        )

        assert response.success is False
        assert response.error == "Insufficient balance"


class TestUptoValidationResult:
    """Tests for UptoValidationResult model."""

    def test_should_indicate_valid_payment(self):
        """Test valid payment result."""
        result = UptoValidationResult(
            is_valid=True,
            validated_max_amount="1000000",
            payer="0x1234567890123456789012345678901234567890",
            expires_at=1740675600,
        )

        assert result.is_valid is True
        assert result.validated_max_amount == "1000000"

    def test_should_indicate_invalid_payment_with_reason(self):
        """Test invalid payment result."""
        result = UptoValidationResult(
            is_valid=False,
            invalid_reason="Permit signature is invalid",
        )

        assert result.is_valid is False
        assert result.invalid_reason == "Permit signature is invalid"


class TestIsUptoPaymentRequirements:
    """Tests for is_upto_payment_requirements function."""

    def test_should_return_true_for_upto_requirements(self):
        """Test detection of upto requirements."""
        data = {
            "scheme": "upto",
            "network": "eip155:8453",
            "maxAmount": "1000000",
            "asset": "0x123",
            "payTo": "0x456",
            "maxTimeoutSeconds": 300,
            "extra": {},
        }

        assert is_upto_payment_requirements(data) is True

    def test_should_return_false_for_exact_requirements(self):
        """Test rejection of exact scheme."""
        data = {
            "scheme": "exact",
            "network": "eip155:8453",
            "amount": "1000000",
            "asset": "0x123",
            "payTo": "0x456",
            "maxTimeoutSeconds": 300,
            "extra": {},
        }

        assert is_upto_payment_requirements(data) is False

    def test_should_return_false_for_missing_max_amount(self):
        """Test rejection of missing maxAmount."""
        data = {
            "scheme": "upto",
            "network": "eip155:8453",
            "amount": "1000000",  # wrong field name
        }

        assert is_upto_payment_requirements(data) is False


class TestIsValidUnit:
    """Tests for is_valid_unit function."""

    def test_valid_units(self):
        """Test valid units are recognized."""
        for unit in SUPPORTED_UNITS:
            assert is_valid_unit(unit) is True

    def test_invalid_units(self):
        """Test invalid units are rejected."""
        invalid_units = ["invalid", "unknown", ""]
        for unit in invalid_units:
            assert is_valid_unit(unit) is False


class TestConstants:
    """Tests for constants."""

    def test_scheme_constant(self):
        """Test SCHEME_UPTO constant."""
        assert SCHEME_UPTO == "upto"

    def test_defaults(self):
        """Test default values."""
        assert DEFAULT_MIN_AMOUNT == "1000"
        assert DEFAULT_MAX_TIMEOUT_SECONDS == 300

    def test_supported_units(self):
        """Test SUPPORTED_UNITS list."""
        expected = ["token", "request", "second", "minute", "byte", "kb", "mb"]
        assert SUPPORTED_UNITS == expected


class TestCreatePaymentRequirements:
    """Tests for create_payment_requirements factory function."""

    def test_creates_requirements_with_defaults(self):
        """Test factory function with defaults."""
        req = create_payment_requirements(
            network="eip155:8453",
            max_amount="1000000",
            asset="0x123",
            pay_to="0x456",
        )

        assert req.scheme == SCHEME_UPTO
        assert req.network == "eip155:8453"
        assert req.max_amount == "1000000"
        assert req.min_amount == DEFAULT_MIN_AMOUNT
        assert req.max_timeout_seconds == DEFAULT_MAX_TIMEOUT_SECONDS


class TestCreateSettlement:
    """Tests for create_settlement factory function."""

    def test_creates_settlement_without_usage_details(self):
        """Test factory function without usage details."""
        settlement = create_settlement(settle_amount="150000")

        assert settlement.settle_amount == "150000"
        assert settlement.usage_details is None

    def test_creates_settlement_with_usage_details(self):
        """Test factory function with usage details."""
        settlement = create_settlement(
            settle_amount="150000",
            units_consumed=1500,
            unit_price="100",
            unit_type="token",
            start_time=1740672000,
            end_time=1740675600,
            metadata={"model": "gpt-4"},
        )

        assert settlement.settle_amount == "150000"
        assert settlement.usage_details is not None
        assert settlement.usage_details.units_consumed == 1500
        assert settlement.usage_details.metadata["model"] == "gpt-4"
