"""
Tests for T402 WDK Python adapter.
"""

import pytest
from unittest.mock import Mock, patch, AsyncMock
from t402.wdk import (
    WDKSigner,
    generate_seed_phrase,
    validate_seed_phrase,
    format_token_amount,
    WDKConfig,
    ChainConfig,
    NetworkType,
    TokenInfo,
    TokenBalance,
    ChainBalance,
    AggregatedBalance,
    PaymentParams,
    PaymentResult,
    SignedTypedData,
    DEFAULT_CHAINS,
    CHAIN_TOKENS,
    USDT0_ADDRESSES,
    USDC_ADDRESSES,
    get_chain_config,
    get_chain_id,
    get_network_from_chain,
    get_chain_from_network,
    get_usdt0_chains,
    get_chain_tokens,
    get_preferred_token,
    get_token_address,
    is_testnet,
    WDKError,
    WDKInitializationError,
    SignerError,
    SigningError,
    ChainError,
    BalanceError,
    WDKErrorCode,
    is_wdk_error,
)


# Test seed phrase for testing (DO NOT USE IN PRODUCTION)
TEST_SEED_PHRASE = "abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about"


class TestSeedPhraseFunctions:
    """Tests for seed phrase utility functions."""

    def test_generate_seed_phrase(self):
        """Test generating a new seed phrase."""
        seed = generate_seed_phrase()
        assert seed is not None
        assert isinstance(seed, str)
        words = seed.split()
        assert len(words) in [12, 24]

    def test_validate_seed_phrase_valid_12_words(self):
        """Test validating a valid 12-word seed phrase."""
        assert validate_seed_phrase(TEST_SEED_PHRASE) is True

    def test_validate_seed_phrase_valid_24_words(self):
        """Test validating a valid 24-word seed phrase."""
        seed_24 = " ".join(["abandon"] * 23 + ["about"])
        assert validate_seed_phrase(seed_24) is True

    def test_validate_seed_phrase_invalid(self):
        """Test validating an invalid seed phrase."""
        assert validate_seed_phrase("invalid seed") is False
        assert validate_seed_phrase("one two three") is False
        assert validate_seed_phrase("") is False


class TestChainConfiguration:
    """Tests for chain configuration functions."""

    def test_default_chains_exist(self):
        """Test that default chains are defined."""
        assert "ethereum" in DEFAULT_CHAINS
        assert "arbitrum" in DEFAULT_CHAINS
        assert "base" in DEFAULT_CHAINS

    def test_get_chain_config(self):
        """Test getting chain configuration."""
        config = get_chain_config("arbitrum")
        assert config is not None
        assert config.chain_id == 42161
        assert config.network == "eip155:42161"
        assert config.name == "arbitrum"

    def test_get_chain_config_unknown(self):
        """Test getting configuration for unknown chain."""
        config = get_chain_config("unknown_chain")
        assert config is None

    def test_get_chain_id(self):
        """Test getting chain ID."""
        assert get_chain_id("ethereum") == 1
        assert get_chain_id("arbitrum") == 42161
        assert get_chain_id("base") == 8453

    def test_get_network_from_chain(self):
        """Test getting network ID from chain name."""
        assert get_network_from_chain("ethereum") == "eip155:1"
        assert get_network_from_chain("arbitrum") == "eip155:42161"

    def test_get_chain_from_network(self):
        """Test getting chain name from network ID."""
        assert get_chain_from_network("eip155:42161") == "arbitrum"
        assert get_chain_from_network("eip155:8453") == "base"
        assert get_chain_from_network("unknown:123") is None

    def test_get_usdt0_chains(self):
        """Test getting chains that support USDT0."""
        chains = get_usdt0_chains()
        assert "ethereum" in chains
        assert "arbitrum" in chains

    def test_get_chain_tokens(self):
        """Test getting tokens for a chain."""
        tokens = get_chain_tokens("arbitrum")
        assert len(tokens) > 0
        assert any(t.symbol == "USDT0" for t in tokens)

    def test_get_preferred_token(self):
        """Test getting preferred token for a chain."""
        # Arbitrum has USDT0, so it should be preferred
        token = get_preferred_token("arbitrum")
        assert token is not None
        assert token.symbol == "USDT0"

    def test_get_token_address(self):
        """Test getting token address."""
        address = get_token_address("arbitrum", "USDT0")
        assert address is not None
        assert address.startswith("0x")

    def test_is_testnet(self):
        """Test testnet detection."""
        assert is_testnet("arbitrum-sepolia") is True
        assert is_testnet("base-sepolia") is True
        assert is_testnet("arbitrum") is False
        assert is_testnet("base") is False


class TestTokenAddresses:
    """Tests for token address constants."""

    def test_usdt0_addresses_exist(self):
        """Test that USDT0 addresses are defined."""
        assert "ethereum" in USDT0_ADDRESSES
        assert "arbitrum" in USDT0_ADDRESSES

    def test_usdt0_addresses_format(self):
        """Test that USDT0 addresses are valid format."""
        for chain, address in USDT0_ADDRESSES.items():
            assert address.startswith("0x"), f"Invalid address format for {chain}"
            assert len(address) == 42, f"Invalid address length for {chain}"

    def test_usdc_addresses_exist(self):
        """Test that USDC addresses are defined."""
        assert "ethereum" in USDC_ADDRESSES
        assert "arbitrum" in USDC_ADDRESSES
        assert "base" in USDC_ADDRESSES


class TestFormatTokenAmount:
    """Tests for token amount formatting."""

    def test_format_whole_number(self):
        """Test formatting whole numbers."""
        assert format_token_amount(1000000, 6) == "1"
        assert format_token_amount(5000000, 6) == "5"

    def test_format_decimal(self):
        """Test formatting decimal amounts."""
        assert format_token_amount(1500000, 6) == "1.5"
        assert format_token_amount(1234567, 6) == "1.234567"

    def test_format_trailing_zeros(self):
        """Test that trailing zeros are removed."""
        assert format_token_amount(1100000, 6) == "1.1"
        assert format_token_amount(1010000, 6) == "1.01"

    def test_format_zero(self):
        """Test formatting zero."""
        assert format_token_amount(0, 6) == "0"


class TestWDKErrors:
    """Tests for WDK error classes."""

    def test_wdk_error_creation(self):
        """Test creating a WDK error."""
        error = WDKError(
            code=WDKErrorCode.CHAIN_NOT_CONFIGURED,
            message="Chain not found",
            chain="unknown",
        )
        assert error.code == WDKErrorCode.CHAIN_NOT_CONFIGURED
        assert error.message == "Chain not found"
        assert error.chain == "unknown"

    def test_wdk_error_to_dict(self):
        """Test converting error to dictionary."""
        error = WDKError(
            code=WDKErrorCode.BALANCE_FETCH_FAILED,
            message="Failed to fetch",
            chain="arbitrum",
            context={"token": "USDT0"},
        )
        d = error.to_dict()
        assert d["code"] == "BALANCE_FETCH_FAILED"
        assert d["message"] == "Failed to fetch"
        assert d["chain"] == "arbitrum"
        assert d["context"]["token"] == "USDT0"

    def test_is_wdk_error(self):
        """Test is_wdk_error function."""
        wdk_error = WDKError(WDKErrorCode.UNKNOWN_ERROR, "test")
        regular_error = ValueError("test")

        assert is_wdk_error(wdk_error) is True
        assert is_wdk_error(regular_error) is False

    def test_initialization_error(self):
        """Test WDKInitializationError."""
        error = WDKInitializationError("Invalid seed phrase")
        assert error.code == WDKErrorCode.WDK_NOT_INITIALIZED

    def test_chain_error(self):
        """Test ChainError."""
        error = ChainError(
            code=WDKErrorCode.CHAIN_NOT_CONFIGURED,
            message="Chain not found",
            chain="unknown",
        )
        assert error.chain == "unknown"

    def test_balance_error_with_token(self):
        """Test BalanceError with token."""
        error = BalanceError(
            code=WDKErrorCode.TOKEN_BALANCE_FETCH_FAILED,
            message="Failed",
            chain="arbitrum",
            token="0x123",
        )
        assert error.token == "0x123"
        assert "token" in error.context


class TestWDKSignerInit:
    """Tests for WDKSigner initialization."""

    def test_create_signer_with_seed(self):
        """Test creating signer with seed phrase."""
        signer = WDKSigner(seed_phrase=TEST_SEED_PHRASE)
        assert signer is not None
        assert signer.is_initialized is False

    def test_create_signer_with_chains(self):
        """Test creating signer with chain configuration."""
        signer = WDKSigner(
            seed_phrase=TEST_SEED_PHRASE,
            chains={"arbitrum": "https://arb1.arbitrum.io/rpc"},
        )
        assert signer.is_chain_configured("arbitrum")

    def test_create_signer_invalid_seed(self):
        """Test creating signer with invalid seed phrase."""
        with pytest.raises(WDKInitializationError):
            WDKSigner(seed_phrase="invalid")

    def test_create_signer_empty_seed(self):
        """Test creating signer with empty seed phrase."""
        with pytest.raises(WDKInitializationError):
            WDKSigner(seed_phrase="")

    def test_get_configured_chains(self):
        """Test getting configured chains."""
        signer = WDKSigner(
            seed_phrase=TEST_SEED_PHRASE,
            chains={
                "arbitrum": "https://arb1.arbitrum.io/rpc",
                "base": "https://mainnet.base.org",
            },
        )
        chains = signer.get_configured_chains()
        assert "arbitrum" in chains
        assert "base" in chains


@pytest.mark.asyncio
class TestWDKSignerAsync:
    """Async tests for WDKSigner."""

    async def test_initialize_signer(self):
        """Test initializing the signer."""
        signer = WDKSigner(seed_phrase=TEST_SEED_PHRASE)
        await signer.initialize()
        assert signer.is_initialized is True

    async def test_get_address_after_init(self):
        """Test getting address after initialization."""
        signer = WDKSigner(seed_phrase=TEST_SEED_PHRASE)
        await signer.initialize()
        address = signer.get_address("evm")
        assert address is not None
        assert address.startswith("0x")
        assert len(address) == 42

    async def test_get_address_before_init(self):
        """Test getting address before initialization raises error."""
        signer = WDKSigner(seed_phrase=TEST_SEED_PHRASE)
        with pytest.raises(SignerError):
            signer.get_address("evm")

    async def test_sign_message(self):
        """Test signing a message."""
        signer = WDKSigner(seed_phrase=TEST_SEED_PHRASE)
        await signer.initialize()

        signature = await signer.sign_message("Hello, T402!")
        assert signature is not None
        assert isinstance(signature, str)
        # Signatures are 65 bytes (130 hex chars)
        assert len(signature) >= 130

    async def test_sign_typed_data(self):
        """Test signing typed data."""
        signer = WDKSigner(seed_phrase=TEST_SEED_PHRASE)
        await signer.initialize()

        typed_data = SignedTypedData(
            domain={
                "name": "Test",
                "version": "1",
                "chainId": 42161,
                "verifyingContract": "0x0000000000000000000000000000000000000001",
            },
            types={
                "Message": [
                    {"name": "content", "type": "string"},
                ],
            },
            primary_type="Message",
            message={"content": "Hello, T402!"},
        )

        signature = await signer.sign_typed_data(typed_data, "arbitrum")
        assert signature is not None
        assert isinstance(signature, str)

    async def test_deterministic_address(self):
        """Test that the same seed produces the same address."""
        signer1 = WDKSigner(seed_phrase=TEST_SEED_PHRASE)
        signer2 = WDKSigner(seed_phrase=TEST_SEED_PHRASE)

        await signer1.initialize()
        await signer2.initialize()

        assert signer1.get_address("evm") == signer2.get_address("evm")


class TestDataTypes:
    """Tests for data type classes."""

    def test_chain_config(self):
        """Test ChainConfig dataclass."""
        config = ChainConfig(
            chain_id=42161,
            network="eip155:42161",
            name="arbitrum",
            rpc_url="https://arb1.arbitrum.io/rpc",
        )
        assert config.chain_id == 42161
        assert config.network_type == NetworkType.EVM

    def test_token_balance(self):
        """Test TokenBalance dataclass."""
        balance = TokenBalance(
            token="0x123",
            symbol="USDT0",
            balance=1000000,
            formatted="1",
            decimals=6,
        )
        assert balance.symbol == "USDT0"
        assert balance.balance == 1000000

    def test_chain_balance(self):
        """Test ChainBalance dataclass."""
        balance = ChainBalance(
            chain="arbitrum",
            network="eip155:42161",
            native=1000000000000000000,
            tokens=[],
        )
        assert balance.chain == "arbitrum"
        assert balance.native == 1000000000000000000

    def test_aggregated_balance(self):
        """Test AggregatedBalance dataclass."""
        agg = AggregatedBalance(
            total_usdt0=1000000,
            total_usdc=500000,
            chains=[],
        )
        assert agg.total_usdt0 == 1000000
        assert agg.total_usdc == 500000

    def test_payment_params(self):
        """Test PaymentParams dataclass."""
        params = PaymentParams(
            network="eip155:42161",
            asset="usdt0",
            to="0x123",
            amount=1000000,
        )
        assert params.network == "eip155:42161"
        assert params.amount == 1000000

    def test_payment_result(self):
        """Test PaymentResult dataclass."""
        result = PaymentResult(
            success=True,
            tx_hash="0x123abc",
        )
        assert result.success is True
        assert result.tx_hash == "0x123abc"

    def test_signed_typed_data(self):
        """Test SignedTypedData dataclass."""
        data = SignedTypedData(
            domain={"name": "Test"},
            types={"Test": []},
            primary_type="Test",
            message={},
        )
        assert data.domain["name"] == "Test"
        assert data.primary_type == "Test"
