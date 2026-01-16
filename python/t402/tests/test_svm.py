"""Tests for Solana SVM blockchain support."""

import base64
import pytest

from t402.svm import (
    # Constants
    SOLANA_MAINNET,
    SOLANA_DEVNET,
    SOLANA_TESTNET,
    USDC_MAINNET_ADDRESS,
    USDC_DEVNET_ADDRESS,
    USDC_TESTNET_ADDRESS,
    DEFAULT_DECIMALS,
    SCHEME_EXACT,
    TOKEN_PROGRAM_ADDRESS,
    TOKEN_2022_PROGRAM_ADDRESS,
    MAINNET_RPC_URL,
    DEVNET_RPC_URL,
    DEFAULT_COMPUTE_UNIT_LIMIT,
    DEFAULT_VALIDITY_DURATION,
    # V1 to V2 mapping
    V1_TO_V2_NETWORK_MAP,
    SOLANA_MAINNET_V1,
    SOLANA_DEVNET_V1,
    SOLANA_TESTNET_V1,
    # Functions
    validate_svm_address,
    addresses_equal,
    is_valid_network,
    is_svm_network,
    normalize_network,
    get_network_config,
    get_default_asset,
    get_asset_info,
    parse_amount,
    format_amount,
    validate_transaction,
    is_testnet,
    prepare_svm_payment_header,
    get_usdc_address,
    get_rpc_url,
    get_known_tokens,
)
from t402.svm import SvmAuthorization, SvmPaymentPayload
from t402.networks import is_svm_network as networks_is_svm_network, get_network_type


class TestConstants:
    """Test SVM constants."""

    def test_network_identifiers(self):
        assert SOLANA_MAINNET == "solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp"
        assert SOLANA_DEVNET == "solana:EtWTRABZaYq6iMfeYKouRu166VU2xqa1"
        assert SOLANA_TESTNET == "solana:4uhcVJyU9pJkvQyS88uRDiswHXSCkY3z"

    def test_legacy_network_identifiers(self):
        assert SOLANA_MAINNET_V1 == "solana"
        assert SOLANA_DEVNET_V1 == "solana-devnet"
        assert SOLANA_TESTNET_V1 == "solana-testnet"

    def test_v1_to_v2_mapping(self):
        assert V1_TO_V2_NETWORK_MAP[SOLANA_MAINNET_V1] == SOLANA_MAINNET
        assert V1_TO_V2_NETWORK_MAP[SOLANA_DEVNET_V1] == SOLANA_DEVNET
        assert V1_TO_V2_NETWORK_MAP[SOLANA_TESTNET_V1] == SOLANA_TESTNET

    def test_usdc_addresses(self):
        # All USDC addresses should be valid Solana addresses
        assert validate_svm_address(USDC_MAINNET_ADDRESS)
        assert validate_svm_address(USDC_DEVNET_ADDRESS)
        assert validate_svm_address(USDC_TESTNET_ADDRESS)

    def test_default_decimals(self):
        assert DEFAULT_DECIMALS == 6

    def test_token_program_addresses(self):
        assert validate_svm_address(TOKEN_PROGRAM_ADDRESS)
        assert validate_svm_address(TOKEN_2022_PROGRAM_ADDRESS)

    def test_scheme_exact(self):
        assert SCHEME_EXACT == "exact"

    def test_rpc_urls(self):
        assert "mainnet" in MAINNET_RPC_URL
        assert "devnet" in DEVNET_RPC_URL


class TestAddressValidation:
    """Test Solana address validation."""

    def test_valid_addresses(self):
        # USDC addresses
        assert validate_svm_address(USDC_MAINNET_ADDRESS)
        assert validate_svm_address(USDC_DEVNET_ADDRESS)
        # Token program addresses
        assert validate_svm_address(TOKEN_PROGRAM_ADDRESS)
        assert validate_svm_address(TOKEN_2022_PROGRAM_ADDRESS)
        # Random valid base58 address
        assert validate_svm_address("11111111111111111111111111111111")

    def test_invalid_addresses(self):
        assert not validate_svm_address("")
        assert not validate_svm_address("invalid")
        assert not validate_svm_address("0x1234567890abcdef")  # EVM-style address
        assert not validate_svm_address("abc")  # Too short
        # Contains invalid base58 characters (0, O, I, l)
        assert not validate_svm_address("0OIl111111111111111111111111111")


class TestAddressComparison:
    """Test Solana address comparison."""

    def test_equal_addresses(self):
        assert addresses_equal(USDC_MAINNET_ADDRESS, USDC_MAINNET_ADDRESS)

    def test_unequal_addresses(self):
        assert not addresses_equal(USDC_MAINNET_ADDRESS, USDC_DEVNET_ADDRESS)

    def test_case_sensitive(self):
        # Solana addresses are case-sensitive (base58)
        lower = USDC_MAINNET_ADDRESS.lower()
        if lower != USDC_MAINNET_ADDRESS:
            assert not addresses_equal(lower, USDC_MAINNET_ADDRESS)


class TestNetworkConfig:
    """Test network configuration."""

    def test_is_valid_network_v2(self):
        assert is_valid_network(SOLANA_MAINNET)
        assert is_valid_network(SOLANA_DEVNET)
        assert is_valid_network(SOLANA_TESTNET)

    def test_is_valid_network_v1(self):
        assert is_valid_network(SOLANA_MAINNET_V1)
        assert is_valid_network(SOLANA_DEVNET_V1)
        assert is_valid_network(SOLANA_TESTNET_V1)

    def test_is_valid_network_invalid(self):
        assert not is_valid_network("invalid")
        assert not is_valid_network("ton:mainnet")

    def test_is_svm_network(self):
        # V2 format
        assert is_svm_network(SOLANA_MAINNET)
        assert is_svm_network(SOLANA_DEVNET)
        # V1 format
        assert is_svm_network(SOLANA_MAINNET_V1)
        assert is_svm_network(SOLANA_DEVNET_V1)
        # Other networks
        assert not is_svm_network("ton:mainnet")
        assert not is_svm_network("eip155:1")

    def test_normalize_network(self):
        # V1 should normalize to V2
        assert normalize_network(SOLANA_MAINNET_V1) == SOLANA_MAINNET
        assert normalize_network(SOLANA_DEVNET_V1) == SOLANA_DEVNET
        assert normalize_network(SOLANA_TESTNET_V1) == SOLANA_TESTNET
        # V2 should stay V2
        assert normalize_network(SOLANA_MAINNET) == SOLANA_MAINNET

    def test_get_network_config_mainnet(self):
        config = get_network_config(SOLANA_MAINNET)
        assert config is not None
        assert config["name"] == "Solana Mainnet"
        assert config["is_testnet"] is False
        assert "rpc_url" in config

    def test_get_network_config_devnet(self):
        config = get_network_config(SOLANA_DEVNET)
        assert config is not None
        assert config["name"] == "Solana Devnet"
        assert config["is_testnet"] is True

    def test_get_network_config_v1(self):
        # V1 format should also work
        config = get_network_config(SOLANA_MAINNET_V1)
        assert config is not None
        assert config["name"] == "Solana Mainnet"

    def test_get_network_config_invalid(self):
        assert get_network_config("invalid") is None


class TestDefaultAsset:
    """Test default asset retrieval."""

    def test_mainnet_default_asset(self):
        asset = get_default_asset(SOLANA_MAINNET)
        assert asset is not None
        assert asset["symbol"] == "USDC"
        assert asset["decimals"] == 6
        assert asset["mint_address"] == USDC_MAINNET_ADDRESS

    def test_devnet_default_asset(self):
        asset = get_default_asset(SOLANA_DEVNET)
        assert asset is not None
        assert asset["symbol"] == "USDC"
        assert asset["decimals"] == 6

    def test_invalid_network_default_asset(self):
        assert get_default_asset("invalid") is None


class TestAssetInfo:
    """Test asset information retrieval."""

    def test_get_asset_by_symbol(self):
        asset = get_asset_info(SOLANA_MAINNET, "USDC")
        assert asset is not None
        assert asset["symbol"] == "USDC"
        assert asset["mint_address"] == USDC_MAINNET_ADDRESS

    def test_get_asset_by_address(self):
        asset = get_asset_info(SOLANA_MAINNET, USDC_MAINNET_ADDRESS)
        assert asset is not None
        assert asset["symbol"] == "USDC"

    def test_unknown_token_by_address(self):
        # Unknown token address returns default config
        asset = get_asset_info(
            SOLANA_MAINNET,
            "So11111111111111111111111111111111111111112",  # Wrapped SOL
        )
        assert asset is not None
        assert asset["symbol"] == "UNKNOWN"
        assert asset["decimals"] == 9  # Default for unknown tokens


class TestAmountParsing:
    """Test amount parsing and formatting."""

    def test_parse_integer_amount(self):
        assert parse_amount("1", 6) == 1000000
        assert parse_amount("100", 6) == 100000000

    def test_parse_decimal_amount(self):
        assert parse_amount("1.5", 6) == 1500000
        assert parse_amount("0.01", 6) == 10000
        assert parse_amount("0.000001", 6) == 1

    def test_parse_amount_with_different_decimals(self):
        assert parse_amount("1", 9) == 1000000000
        assert parse_amount("1.5", 9) == 1500000000

    def test_parse_amount_truncates_excess_decimals(self):
        # More decimals than supported should truncate
        assert parse_amount("1.1234567890", 6) == 1123456

    def test_format_amount(self):
        assert format_amount(1000000, 6) == "1"
        assert format_amount(1500000, 6) == "1.5"
        assert format_amount(10000, 6) == "0.01"
        assert format_amount(1, 6) == "0.000001"

    def test_format_amount_zero(self):
        assert format_amount(0, 6) == "0"


class TestTransactionValidation:
    """Test transaction validation."""

    def test_valid_transaction(self):
        # Valid base64 string with sufficient length
        valid_tx = base64.b64encode(b"x" * 200).decode()
        assert validate_transaction(valid_tx)

    def test_invalid_transaction(self):
        assert not validate_transaction("")
        assert not validate_transaction("not-valid-base64!!!")
        # Too short to be a valid transaction
        short_tx = base64.b64encode(b"short").decode()
        assert not validate_transaction(short_tx)


class TestTestnetCheck:
    """Test testnet/devnet detection."""

    def test_is_testnet(self):
        assert is_testnet(SOLANA_DEVNET)
        assert is_testnet(SOLANA_TESTNET)
        assert not is_testnet(SOLANA_MAINNET)


class TestPreparePaymentHeader:
    """Test payment header preparation."""

    def test_prepare_payment_header(self):
        header = prepare_svm_payment_header(
            sender_address=USDC_MAINNET_ADDRESS,
            t402_version=2,
            network=SOLANA_MAINNET,
            pay_to="So11111111111111111111111111111111111111112",
            asset=USDC_MAINNET_ADDRESS,
            amount="1000000",
        )

        assert header["t402Version"] == 2
        assert header["scheme"] == SCHEME_EXACT
        assert header["network"] == SOLANA_MAINNET
        assert header["payload"]["transaction"] is None
        assert header["payload"]["authorization"]["from"] == USDC_MAINNET_ADDRESS
        assert (
            header["payload"]["authorization"]["to"]
            == "So11111111111111111111111111111111111111112"
        )
        assert header["payload"]["authorization"]["mint"] == USDC_MAINNET_ADDRESS
        assert header["payload"]["authorization"]["amount"] == "1000000"
        assert "validUntil" in header["payload"]["authorization"]

    def test_prepare_payment_header_with_fee_payer(self):
        header = prepare_svm_payment_header(
            sender_address=USDC_MAINNET_ADDRESS,
            t402_version=2,
            network=SOLANA_MAINNET,
            pay_to="So11111111111111111111111111111111111111112",
            asset=USDC_MAINNET_ADDRESS,
            amount="1000000",
            fee_payer="FeePayer111111111111111111111111111111111",
        )

        assert (
            header["payload"]["authorization"]["feePayer"]
            == "FeePayer111111111111111111111111111111111"
        )

    def test_prepare_payment_header_normalizes_v1_network(self):
        header = prepare_svm_payment_header(
            sender_address=USDC_MAINNET_ADDRESS,
            t402_version=2,
            network=SOLANA_MAINNET_V1,  # V1 format
            pay_to="So11111111111111111111111111111111111111112",
            asset=USDC_MAINNET_ADDRESS,
            amount="1000000",
        )

        # Should be normalized to V2
        assert header["network"] == SOLANA_MAINNET


class TestGetUsdcAddress:
    """Test USDC address retrieval."""

    def test_mainnet_usdc(self):
        assert get_usdc_address(SOLANA_MAINNET) == USDC_MAINNET_ADDRESS

    def test_devnet_usdc(self):
        assert get_usdc_address(SOLANA_DEVNET) == USDC_DEVNET_ADDRESS

    def test_testnet_usdc(self):
        assert get_usdc_address(SOLANA_TESTNET) == USDC_DEVNET_ADDRESS  # Same as devnet

    def test_v1_network(self):
        assert get_usdc_address(SOLANA_MAINNET_V1) == USDC_MAINNET_ADDRESS

    def test_invalid_network(self):
        with pytest.raises(ValueError):
            get_usdc_address("invalid")


class TestGetRpcUrl:
    """Test RPC URL retrieval."""

    def test_mainnet_rpc(self):
        url = get_rpc_url(SOLANA_MAINNET)
        assert "mainnet" in url

    def test_devnet_rpc(self):
        url = get_rpc_url(SOLANA_DEVNET)
        assert "devnet" in url

    def test_v1_network(self):
        url = get_rpc_url(SOLANA_MAINNET_V1)
        assert "mainnet" in url

    def test_invalid_network(self):
        with pytest.raises(ValueError):
            get_rpc_url("invalid")


class TestGetKnownTokens:
    """Test known tokens retrieval."""

    def test_mainnet_tokens(self):
        tokens = get_known_tokens(SOLANA_MAINNET)
        assert len(tokens) > 0
        assert any(t["symbol"] == "USDC" for t in tokens)

    def test_devnet_tokens(self):
        tokens = get_known_tokens(SOLANA_DEVNET)
        assert len(tokens) > 0

    def test_invalid_network_tokens(self):
        tokens = get_known_tokens("invalid")
        assert tokens == []


class TestSvmAuthorizationModel:
    """Test SvmAuthorization Pydantic model."""

    def test_serde(self):
        original = SvmAuthorization(
            from_="EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
            to="So11111111111111111111111111111111111111112",
            mint=USDC_MAINNET_ADDRESS,
            amount="1000000",
            valid_until=1234567890,
        )

        expected = {
            "from": "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
            "to": "So11111111111111111111111111111111111111112",
            "mint": USDC_MAINNET_ADDRESS,
            "amount": "1000000",
            "validUntil": 1234567890,
            "feePayer": None,
        }

        assert original.model_dump(by_alias=True) == expected

    def test_with_fee_payer(self):
        original = SvmAuthorization(
            from_="EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
            to="So11111111111111111111111111111111111111112",
            mint=USDC_MAINNET_ADDRESS,
            amount="1000000",
            valid_until=1234567890,
            fee_payer="FeePayer111111111111111111111111111111111",
        )

        assert original.fee_payer == "FeePayer111111111111111111111111111111111"

    def test_amount_validation(self):
        with pytest.raises(ValueError):
            SvmAuthorization(
                from_="addr",
                to="addr",
                mint="addr",
                amount="not_a_number",  # Should fail validation
                valid_until=1234567890,
            )


class TestSvmPaymentPayloadModel:
    """Test SvmPaymentPayload Pydantic model."""

    def test_serde_without_authorization(self):
        original = SvmPaymentPayload(
            transaction="base64encodedtransaction",
        )

        expected = {
            "transaction": "base64encodedtransaction",
            "authorization": None,
        }

        assert original.model_dump(by_alias=True) == expected

    def test_serde_with_authorization(self):
        auth = SvmAuthorization(
            from_="EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
            to="So11111111111111111111111111111111111111112",
            mint=USDC_MAINNET_ADDRESS,
            amount="1000000",
            valid_until=1234567890,
        )

        original = SvmPaymentPayload(
            transaction="base64encodedtransaction",
            authorization=auth,
        )

        assert original.transaction == "base64encodedtransaction"
        assert original.authorization is not None
        assert original.authorization.amount == "1000000"


class TestNetworkUtilities:
    """Test network utility functions from networks module."""

    def test_is_svm_network(self):
        assert networks_is_svm_network(SOLANA_MAINNET)
        assert networks_is_svm_network(SOLANA_DEVNET)
        assert networks_is_svm_network(SOLANA_MAINNET_V1)
        assert not networks_is_svm_network("ton:mainnet")
        assert not networks_is_svm_network("eip155:1")

    def test_get_network_type(self):
        assert get_network_type(SOLANA_MAINNET) == "svm"
        assert get_network_type(SOLANA_DEVNET) == "svm"
        assert get_network_type("ton:mainnet") == "ton"
        assert get_network_type("base-sepolia") == "evm"
        assert get_network_type("unknown-network") == "unknown"


# =============================================================================
# New Tests for Signer Interfaces and Scheme Implementations
# =============================================================================

from t402.svm import (
    # Transaction utilities
    decode_transaction,
    check_solana_available,
    # Signer interfaces
    ClientSvmSigner,
    FacilitatorSvmSigner,
    # Scheme implementations
    ExactSvmClientScheme,
    ExactSvmServerScheme,
    ExactSvmFacilitatorScheme,
    # Factory functions
    create_client_scheme,
    create_server_scheme,
    create_facilitator_scheme,
    # Types
    SvmVerifyMessageResult,
    SvmTransactionConfirmation,
    ExactSvmPayloadV2,
    TransferDetails,
    SOLANA_AVAILABLE,
)


class TestTransactionUtilities:
    """Test transaction utility functions."""

    def test_decode_transaction_valid(self):
        # Valid base64 encoding
        original = b"test transaction data for decoding"
        encoded = base64.b64encode(original).decode()
        decoded = decode_transaction(encoded)
        assert decoded == original

    def test_decode_transaction_invalid(self):
        with pytest.raises(ValueError, match="Failed to decode"):
            decode_transaction("not-valid-base64!!!")

    def test_check_solana_available(self):
        # This should return a boolean regardless of installation
        result = check_solana_available()
        assert isinstance(result, bool)
        assert result == SOLANA_AVAILABLE


class TestExactSvmServerScheme:
    """Test ExactSvmServerScheme implementation."""

    def test_create_server_scheme(self):
        scheme = create_server_scheme()
        assert isinstance(scheme, ExactSvmServerScheme)
        assert scheme.scheme == "exact"
        assert scheme.caip_family == "solana:*"

    def test_parse_price_decimal(self):
        scheme = ExactSvmServerScheme()
        result = scheme.parse_price("1.50", SOLANA_MAINNET)

        assert result["amount"] == "1500000"
        assert result["asset"] == USDC_MAINNET_ADDRESS
        assert result["decimals"] == 6
        assert result["symbol"] == "USDC"

    def test_parse_price_atomic(self):
        scheme = ExactSvmServerScheme()
        result = scheme.parse_price("1500000", SOLANA_MAINNET)

        assert result["amount"] == "1500000"

    def test_parse_price_invalid_network(self):
        scheme = ExactSvmServerScheme()
        with pytest.raises(ValueError, match="Unsupported network"):
            scheme.parse_price("1.00", "invalid-network")

    def test_enhance_payment_requirements_basic(self):
        scheme = ExactSvmServerScheme()
        requirements = {
            "network": SOLANA_MAINNET_V1,
            "payTo": "recipient_address",
        }

        enhanced = scheme.enhance_payment_requirements(requirements)

        # Network should be normalized to CAIP-2 format
        assert enhanced["network"] == SOLANA_MAINNET
        assert enhanced["payTo"] == "recipient_address"

    def test_enhance_payment_requirements_with_fee_payer(self):
        scheme = ExactSvmServerScheme()
        requirements = {
            "network": SOLANA_MAINNET,
            "payTo": "recipient_address",
        }

        enhanced = scheme.enhance_payment_requirements(
            requirements,
            fee_payer="fee_payer_address"
        )

        assert enhanced["extra"]["feePayer"] == "fee_payer_address"


class TestSvmTypes:
    """Test new SVM types."""

    def test_svm_verify_message_result(self):
        result = SvmVerifyMessageResult(
            valid=True,
            reason=None,
            transfer={"amount": 1000000, "mint": USDC_MAINNET_ADDRESS},
        )

        assert result.valid is True
        assert result.reason is None
        assert result.transfer["amount"] == 1000000

    def test_svm_verify_message_result_invalid(self):
        result = SvmVerifyMessageResult(
            valid=False,
            reason="amount_insufficient",
        )

        assert result.valid is False
        assert result.reason == "amount_insufficient"

    def test_svm_transaction_confirmation(self):
        result = SvmTransactionConfirmation(
            success=True,
            signature="5nT1Lf...",
            slot=12345,
        )

        assert result.success is True
        assert result.signature == "5nT1Lf..."
        assert result.slot == 12345
        assert result.error is None

    def test_svm_transaction_confirmation_failed(self):
        result = SvmTransactionConfirmation(
            success=False,
            error="Transaction failed",
        )

        assert result.success is False
        assert result.error == "Transaction failed"


class TestSignerInterfaces:
    """Test signer interface protocols."""

    def test_client_signer_protocol(self):
        """Verify ClientSvmSigner is a Protocol."""
        # ClientSvmSigner should be a Protocol with required methods
        assert hasattr(ClientSvmSigner, "get_address")
        assert hasattr(ClientSvmSigner, "sign_transaction")

    def test_facilitator_signer_protocol(self):
        """Verify FacilitatorSvmSigner is a Protocol."""
        # FacilitatorSvmSigner should have all required methods
        assert hasattr(FacilitatorSvmSigner, "get_addresses")
        assert hasattr(FacilitatorSvmSigner, "sign_transaction")
        assert hasattr(FacilitatorSvmSigner, "simulate_transaction")
        assert hasattr(FacilitatorSvmSigner, "send_transaction")
        assert hasattr(FacilitatorSvmSigner, "confirm_transaction")


class TestMockClientSigner:
    """Test with a mock client signer implementation."""

    class MockClientSigner:
        """Mock implementation of ClientSvmSigner for testing."""

        def __init__(self, address: str):
            self._address = address

        def get_address(self) -> str:
            return self._address

        async def sign_transaction(self, tx_base64: str, network: str) -> str:
            # Mock signing by just returning the same transaction
            return tx_base64

    def test_mock_signer_get_address(self):
        signer = self.MockClientSigner("TestAddress111111111111111111111111111")
        assert signer.get_address() == "TestAddress111111111111111111111111111"

    @pytest.mark.asyncio
    async def test_mock_signer_sign_transaction(self):
        signer = self.MockClientSigner("TestAddress111111111111111111111111111")
        tx = base64.b64encode(b"test transaction").decode()
        signed = await signer.sign_transaction(tx, SOLANA_MAINNET)
        assert signed == tx  # Mock just returns same transaction


class TestMockFacilitatorSigner:
    """Test with a mock facilitator signer implementation."""

    class MockFacilitatorSigner:
        """Mock implementation of FacilitatorSvmSigner for testing."""

        def __init__(self, addresses: list):
            self._addresses = addresses

        def get_addresses(self) -> list:
            return self._addresses

        async def sign_transaction(self, tx_base64: str, fee_payer: str, network: str) -> str:
            if fee_payer not in self._addresses:
                raise ValueError(f"Fee payer {fee_payer} not managed")
            return tx_base64

        async def simulate_transaction(self, tx_base64: str, network: str) -> bool:
            return True

        async def send_transaction(self, tx_base64: str, network: str) -> str:
            return "mock_signature_12345"

        async def confirm_transaction(self, signature: str, network: str) -> bool:
            return True

    def test_mock_facilitator_get_addresses(self):
        addresses = ["Addr1", "Addr2"]
        signer = self.MockFacilitatorSigner(addresses)
        assert signer.get_addresses() == addresses

    @pytest.mark.asyncio
    async def test_mock_facilitator_sign_valid(self):
        signer = self.MockFacilitatorSigner(["FeePayerAddr"])
        tx = base64.b64encode(b"test").decode()
        result = await signer.sign_transaction(tx, "FeePayerAddr", SOLANA_MAINNET)
        assert result == tx

    @pytest.mark.asyncio
    async def test_mock_facilitator_sign_invalid_payer(self):
        signer = self.MockFacilitatorSigner(["FeePayerAddr"])
        tx = base64.b64encode(b"test").decode()
        with pytest.raises(ValueError, match="not managed"):
            await signer.sign_transaction(tx, "InvalidAddr", SOLANA_MAINNET)


class TestExactSvmClientScheme:
    """Test ExactSvmClientScheme with mock signer."""

    class MockClientSigner:
        def __init__(self, address: str):
            self._address = address

        def get_address(self) -> str:
            return self._address

        async def sign_transaction(self, tx_base64: str, network: str) -> str:
            return tx_base64

    def test_create_client_scheme(self):
        signer = self.MockClientSigner("TestAddr")
        scheme = create_client_scheme(signer)
        assert isinstance(scheme, ExactSvmClientScheme)
        assert scheme.scheme == "exact"

    @pytest.mark.asyncio
    async def test_create_payment_payload(self):
        signer = self.MockClientSigner("SenderAddr11111111111111111111111111111")
        scheme = ExactSvmClientScheme(signer)

        requirements = {
            "network": SOLANA_MAINNET,
            "payTo": "RecipientAddr11111111111111111111111111",
            "maxTimeoutSeconds": 3600,
            "t402Version": 2,
            "extra": {"feePayer": "FeePayer1111111111111111111111111111"},
        }

        async def mock_build_tx():
            # Return a minimal valid-looking transaction
            return base64.b64encode(b"mock_transaction_bytes").decode()

        payload = await scheme.create_payment_payload(requirements, mock_build_tx)

        assert payload["t402Version"] == 2
        assert payload["scheme"] == "exact"
        assert payload["network"] == SOLANA_MAINNET
        assert "transaction" in payload["payload"]


class TestExactSvmFacilitatorScheme:
    """Test ExactSvmFacilitatorScheme with mock signer."""

    class MockFacilitatorSigner:
        def __init__(self, addresses: list):
            self._addresses = addresses

        def get_addresses(self) -> list:
            return self._addresses

        async def sign_transaction(self, tx_base64: str, fee_payer: str, network: str) -> str:
            return tx_base64

        async def simulate_transaction(self, tx_base64: str, network: str) -> bool:
            return True

        async def send_transaction(self, tx_base64: str, network: str) -> str:
            return "mock_signature"

        async def confirm_transaction(self, signature: str, network: str) -> bool:
            return True

    def test_create_facilitator_scheme(self):
        signer = self.MockFacilitatorSigner(["FeePayer1"])
        scheme = create_facilitator_scheme(signer)
        assert isinstance(scheme, ExactSvmFacilitatorScheme)
        assert scheme.scheme == "exact"

    def test_get_extra(self):
        addresses = ["FeePayerA", "FeePayerB", "FeePayerC"]
        signer = self.MockFacilitatorSigner(addresses)
        scheme = ExactSvmFacilitatorScheme(signer)

        extra = scheme.get_extra(SOLANA_MAINNET)

        assert extra is not None
        assert "feePayer" in extra
        assert extra["feePayer"] in addresses

    def test_get_signers(self):
        addresses = ["Addr1", "Addr2"]
        signer = self.MockFacilitatorSigner(addresses)
        scheme = ExactSvmFacilitatorScheme(signer)

        signers = scheme.get_signers(SOLANA_MAINNET)

        assert signers == addresses

    @pytest.mark.asyncio
    async def test_verify_invalid_payload_structure(self):
        signer = self.MockFacilitatorSigner(["FeePayer"])
        scheme = ExactSvmFacilitatorScheme(signer)

        payload = {"scheme": "exact", "network": SOLANA_MAINNET, "payload": {}}
        requirements = {"scheme": "exact", "network": SOLANA_MAINNET}

        result = await scheme.verify(payload, requirements)

        assert result["isValid"] is False
        assert result["invalidReason"] == "invalid_payload_structure"

    @pytest.mark.asyncio
    async def test_verify_unsupported_scheme(self):
        signer = self.MockFacilitatorSigner(["FeePayer"])
        scheme = ExactSvmFacilitatorScheme(signer)

        tx = base64.b64encode(b"x" * 200).decode()
        payload = {"scheme": "other", "network": SOLANA_MAINNET, "payload": {"transaction": tx}}
        requirements = {"scheme": "exact", "network": SOLANA_MAINNET}

        result = await scheme.verify(payload, requirements)

        assert result["isValid"] is False
        assert result["invalidReason"] == "unsupported_scheme"

    @pytest.mark.asyncio
    async def test_verify_network_mismatch(self):
        signer = self.MockFacilitatorSigner(["FeePayer"])
        scheme = ExactSvmFacilitatorScheme(signer)

        tx = base64.b64encode(b"x" * 200).decode()
        payload = {"scheme": "exact", "network": SOLANA_MAINNET, "payload": {"transaction": tx}}
        requirements = {"scheme": "exact", "network": SOLANA_DEVNET}

        result = await scheme.verify(payload, requirements)

        assert result["isValid"] is False
        assert result["invalidReason"] == "network_mismatch"

    @pytest.mark.asyncio
    async def test_verify_missing_fee_payer(self):
        signer = self.MockFacilitatorSigner(["FeePayer"])
        scheme = ExactSvmFacilitatorScheme(signer)

        tx = base64.b64encode(b"x" * 200).decode()
        payload = {"scheme": "exact", "network": SOLANA_MAINNET, "payload": {"transaction": tx}}
        requirements = {"scheme": "exact", "network": SOLANA_MAINNET, "extra": {}}

        result = await scheme.verify(payload, requirements)

        assert result["isValid"] is False
        assert result["invalidReason"] == "invalid_exact_svm_payload_missing_fee_payer"

    @pytest.mark.asyncio
    async def test_verify_fee_payer_not_managed(self):
        signer = self.MockFacilitatorSigner(["ManagedFeePayer"])
        scheme = ExactSvmFacilitatorScheme(signer)

        tx = base64.b64encode(b"x" * 200).decode()
        payload = {"scheme": "exact", "network": SOLANA_MAINNET, "payload": {"transaction": tx}}
        requirements = {
            "scheme": "exact",
            "network": SOLANA_MAINNET,
            "extra": {"feePayer": "UnmanagedFeePayer"}
        }

        result = await scheme.verify(payload, requirements)

        assert result["isValid"] is False
        assert result["invalidReason"] == "fee_payer_not_managed_by_facilitator"


class TestExactSvmPayloadV2:
    """Test ExactSvmPayloadV2 TypedDict."""

    def test_payload_structure(self):
        payload: ExactSvmPayloadV2 = {
            "transaction": "base64_encoded_tx",
            "authorization": {
                "from": "sender",
                "to": "recipient",
                "mint": USDC_MAINNET_ADDRESS,
                "amount": "1000000",
                "validUntil": 1234567890,
            },
        }

        assert payload["transaction"] == "base64_encoded_tx"
        assert payload["authorization"]["amount"] == "1000000"

    def test_payload_without_authorization(self):
        payload: ExactSvmPayloadV2 = {
            "transaction": "base64_encoded_tx",
            "authorization": None,
        }

        assert payload["transaction"] == "base64_encoded_tx"
        assert payload["authorization"] is None
