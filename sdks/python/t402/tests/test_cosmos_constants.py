"""Tests for Cosmos/Noble constants and configuration.

Tests cover:
- Scheme and network identifiers
- RPC and REST endpoint URLs
- Token definitions and lookups
- Network configuration lookups
- Address validation
"""

from __future__ import annotations

from t402.schemes.cosmos.constants import (
    SCHEME_EXACT_DIRECT,
    COSMOS_NOBLE_MAINNET,
    COSMOS_NOBLE_TESTNET,
    NOBLE_MAINNET_RPC,
    NOBLE_TESTNET_RPC,
    NOBLE_MAINNET_REST,
    NOBLE_TESTNET_REST,
    NOBLE_BECH32_PREFIX,
    USDC_DENOM,
    DEFAULT_GAS_LIMIT,
    MSG_TYPE_SEND,
    MSG_TYPE_MULTI_SEND,
    CAIP_FAMILY,
    USDC_TOKEN,
    get_network_config,
    get_token_info,
    get_token_by_denom,
    is_valid_network,
    is_valid_address,
    get_supported_networks,
)


class TestSchemeConstants:
    """Test scheme and network identifiers."""

    def test_scheme_identifier(self):
        assert SCHEME_EXACT_DIRECT == "exact-direct"

    def test_network_identifiers(self):
        assert COSMOS_NOBLE_MAINNET == "cosmos:noble-1"
        assert COSMOS_NOBLE_TESTNET == "cosmos:grand-1"

    def test_rpc_endpoints(self):
        assert NOBLE_MAINNET_RPC == "https://noble-rpc.polkachu.com"
        assert NOBLE_TESTNET_RPC == "https://rpc.testnet.noble.strange.love"

    def test_rest_endpoints(self):
        assert NOBLE_MAINNET_REST == "https://noble-api.polkachu.com"
        assert NOBLE_TESTNET_REST == "https://api.testnet.noble.strange.love"

    def test_bech32_prefix(self):
        assert NOBLE_BECH32_PREFIX == "noble"

    def test_usdc_denom(self):
        assert USDC_DENOM == "uusdc"

    def test_gas_limit(self):
        assert DEFAULT_GAS_LIMIT == 200000

    def test_message_types(self):
        assert MSG_TYPE_SEND == "/cosmos.bank.v1beta1.MsgSend"
        assert MSG_TYPE_MULTI_SEND == "/cosmos.bank.v1beta1.MsgMultiSend"

    def test_caip_family(self):
        assert CAIP_FAMILY == "cosmos:*"


class TestTokenInfo:
    """Test USDC token definition."""

    def test_usdc_token(self):
        assert USDC_TOKEN.denom == "uusdc"
        assert USDC_TOKEN.symbol == "USDC"
        assert USDC_TOKEN.decimals == 6

    def test_repr(self):
        repr_str = repr(USDC_TOKEN)
        assert "uusdc" in repr_str
        assert "USDC" in repr_str
        assert "6" in repr_str


class TestNetworkConfig:
    """Test network configuration lookups."""

    def test_mainnet_config(self):
        config = get_network_config(COSMOS_NOBLE_MAINNET)
        assert config is not None
        assert config.chain_id == "noble-1"
        assert config.rpc_url == NOBLE_MAINNET_RPC
        assert config.rest_url == NOBLE_MAINNET_REST
        assert config.bech32_prefix == "noble"
        assert config.default_token.symbol == "USDC"

    def test_testnet_config(self):
        config = get_network_config(COSMOS_NOBLE_TESTNET)
        assert config is not None
        assert config.chain_id == "grand-1"
        assert config.rpc_url == NOBLE_TESTNET_RPC
        assert config.rest_url == NOBLE_TESTNET_REST
        assert config.bech32_prefix == "noble"
        assert config.default_token.symbol == "USDC"

    def test_unsupported_network(self):
        config = get_network_config("cosmos:unknown-1")
        assert config is None

    def test_non_cosmos_network(self):
        config = get_network_config("eip155:1")
        assert config is None


class TestNetworkValidation:
    """Test network validation."""

    def test_mainnet_valid(self):
        assert is_valid_network(COSMOS_NOBLE_MAINNET) is True

    def test_testnet_valid(self):
        assert is_valid_network(COSMOS_NOBLE_TESTNET) is True

    def test_unknown_invalid(self):
        assert is_valid_network("cosmos:unknown-1") is False

    def test_empty_invalid(self):
        assert is_valid_network("") is False

    def test_evm_network_invalid(self):
        assert is_valid_network("eip155:1") is False


class TestTokenLookups:
    """Test token registry lookups."""

    def test_get_token_info_usdc_mainnet(self):
        token = get_token_info(COSMOS_NOBLE_MAINNET, "USDC")
        assert token is not None
        assert token.denom == "uusdc"
        assert token.decimals == 6

    def test_get_token_info_usdc_testnet(self):
        token = get_token_info(COSMOS_NOBLE_TESTNET, "USDC")
        assert token is not None
        assert token.denom == "uusdc"

    def test_get_token_info_unknown_symbol(self):
        token = get_token_info(COSMOS_NOBLE_MAINNET, "DAI")
        assert token is None

    def test_get_token_info_unknown_network(self):
        token = get_token_info("cosmos:unknown-1", "USDC")
        assert token is None

    def test_get_token_by_denom_mainnet(self):
        token = get_token_by_denom(COSMOS_NOBLE_MAINNET, "uusdc")
        assert token is not None
        assert token.symbol == "USDC"

    def test_get_token_by_denom_unknown(self):
        token = get_token_by_denom(COSMOS_NOBLE_MAINNET, "unknown")
        assert token is None

    def test_get_token_by_denom_unknown_network(self):
        token = get_token_by_denom("cosmos:unknown-1", "uusdc")
        assert token is None

    def test_get_supported_networks(self):
        networks = get_supported_networks()
        assert COSMOS_NOBLE_MAINNET in networks
        assert COSMOS_NOBLE_TESTNET in networks
        assert len(networks) == 2


class TestAddressValidation:
    """Test bech32 address validation."""

    def test_valid_noble_address(self):
        assert is_valid_address("noble1abc123def456", "noble") is True

    def test_valid_noble_long_address(self):
        assert is_valid_address("noble1qpzry9x8gf2tvdw0s3jn54khce6mua7lmqqqxw", "noble") is True

    def test_invalid_wrong_prefix(self):
        assert is_valid_address("cosmos1abc123", "noble") is False

    def test_invalid_empty(self):
        assert is_valid_address("", "noble") is False

    def test_invalid_too_short(self):
        assert is_valid_address("nobl", "noble") is False

    def test_valid_with_different_prefix(self):
        assert is_valid_address("cosmos1abc123def", "cosmos") is True
