"""Tests for EVM Up-To Scheme - Server Implementation."""

import pytest

from t402.schemes.evm.upto.server import UptoEvmServerScheme
from t402.schemes.interfaces import SchemeNetworkServer


class TestUptoEvmServerSchemeBasic:
    """Test basic properties of UptoEvmServerScheme."""

    def test_scheme_name(self):
        """Test scheme is 'upto'."""
        scheme = UptoEvmServerScheme()
        assert scheme.scheme == "upto"

    def test_caip_family(self):
        """Test CAIP family is eip155:*."""
        scheme = UptoEvmServerScheme()
        assert scheme.caip_family == "eip155:*"

    def test_protocol_compliance(self):
        """Test that UptoEvmServerScheme implements SchemeNetworkServer protocol."""
        scheme = UptoEvmServerScheme()
        assert isinstance(scheme, SchemeNetworkServer)
        assert hasattr(scheme, "scheme")
        assert hasattr(scheme, "parse_price")
        assert hasattr(scheme, "enhance_requirements")

    def test_init_without_router_address(self):
        """Test initialization without router address."""
        scheme = UptoEvmServerScheme()
        assert scheme._router_address is None

    def test_init_with_router_address(self):
        """Test initialization with router address."""
        router = "0x1234567890123456789012345678901234567890"
        scheme = UptoEvmServerScheme(router_address=router)
        assert scheme._router_address == router


class TestUptoEvmServerParsePrice:
    """Test parse_price method of UptoEvmServerScheme."""

    @pytest.mark.asyncio
    async def test_parse_price_dollar_string(self):
        """Test parsing dollar-prefixed string price."""
        scheme = UptoEvmServerScheme()
        result = await scheme.parse_price("$1.00", "eip155:8453")

        assert "amount" in result
        assert "asset" in result
        assert "extra" in result
        assert result["amount"] == "1000000"  # $1.00 * 10^6

    @pytest.mark.asyncio
    async def test_parse_price_plain_string(self):
        """Test parsing plain string price without $ prefix."""
        scheme = UptoEvmServerScheme()
        result = await scheme.parse_price("0.50", "eip155:8453")

        assert result["amount"] == "500000"  # $0.50 * 10^6

    @pytest.mark.asyncio
    async def test_parse_price_number_float(self):
        """Test parsing float price."""
        scheme = UptoEvmServerScheme()
        result = await scheme.parse_price(0.25, "eip155:8453")

        assert result["amount"] == "250000"  # $0.25 * 10^6

    @pytest.mark.asyncio
    async def test_parse_price_number_int(self):
        """Test parsing integer price."""
        scheme = UptoEvmServerScheme()
        result = await scheme.parse_price(2, "eip155:8453")

        assert result["amount"] == "2000000"  # $2 * 10^6

    @pytest.mark.asyncio
    async def test_parse_price_dict_passthrough(self):
        """Test parsing dict (TokenAmount) passes through."""
        scheme = UptoEvmServerScheme()
        result = await scheme.parse_price(
            {"amount": "5000000", "asset": "0xCustomToken"},
            "eip155:8453",
        )

        assert result["amount"] == "5000000"
        assert result["asset"] == "0xCustomToken"

    @pytest.mark.asyncio
    async def test_parse_price_dict_with_extra(self):
        """Test parsing dict preserves extra field."""
        scheme = UptoEvmServerScheme()
        result = await scheme.parse_price(
            {
                "amount": "5000000",
                "asset": "0xCustomToken",
                "extra": {"name": "Custom", "version": "1"},
            },
            "eip155:8453",
        )

        assert result["extra"]["name"] == "Custom"
        assert result["extra"]["version"] == "1"

    @pytest.mark.asyncio
    async def test_parse_price_returns_eip712_domain(self):
        """Test that parsed price includes EIP-712 domain info."""
        scheme = UptoEvmServerScheme()
        result = await scheme.parse_price("$1.00", "eip155:8453")

        assert "name" in result["extra"]
        assert "version" in result["extra"]
        assert "decimals" in result["extra"]
        assert result["extra"]["decimals"] == 6

    @pytest.mark.asyncio
    async def test_parse_price_returns_correct_asset_base(self):
        """Test that Base network returns USDC asset address."""
        scheme = UptoEvmServerScheme()
        result = await scheme.parse_price("$0.10", "eip155:8453")

        # Base mainnet USDC
        assert result["asset"] == "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913"

    @pytest.mark.asyncio
    async def test_parse_price_returns_usdt0_for_ethereum(self):
        """Test that Ethereum returns USDT0 asset address."""
        scheme = UptoEvmServerScheme()
        result = await scheme.parse_price("$1.00", "eip155:1")

        # Ethereum mainnet USDT0
        assert result["asset"] == "0x6C96dE32CEa08842dcc4058c14d3aaAD7Fa41dee"

    @pytest.mark.asyncio
    async def test_parse_price_with_router_address(self):
        """Test that router address is included in extra."""
        router = "0x1234567890123456789012345678901234567890"
        scheme = UptoEvmServerScheme(router_address=router)
        result = await scheme.parse_price("$1.00", "eip155:8453")

        assert result["extra"]["routerAddress"] == router

    @pytest.mark.asyncio
    async def test_parse_price_without_router_address(self):
        """Test that routerAddress is absent when not configured."""
        scheme = UptoEvmServerScheme()
        result = await scheme.parse_price("$1.00", "eip155:8453")

        assert "routerAddress" not in result["extra"]

    @pytest.mark.asyncio
    async def test_parse_price_small_amount(self):
        """Test parsing small amounts preserves precision."""
        scheme = UptoEvmServerScheme()
        result = await scheme.parse_price("$0.001", "eip155:8453")

        assert result["amount"] == "1000"  # $0.001 * 10^6

    @pytest.mark.asyncio
    async def test_parse_price_large_amount(self):
        """Test parsing large amounts."""
        scheme = UptoEvmServerScheme()
        result = await scheme.parse_price("$100.00", "eip155:8453")

        assert result["amount"] == "100000000"  # $100 * 10^6

    @pytest.mark.asyncio
    async def test_parse_price_unknown_network_raises(self):
        """Test that unknown network raises ValueError."""
        scheme = UptoEvmServerScheme()
        with pytest.raises(ValueError, match="Unknown network"):
            await scheme.parse_price("$1.00", "eip155:999999")

    @pytest.mark.asyncio
    async def test_parse_price_legacy_network(self):
        """Test parsing price with legacy network name."""
        scheme = UptoEvmServerScheme()
        result = await scheme.parse_price("$1.00", "eip155:84532")

        assert result["amount"] == "1000000"
        # Base Sepolia USDC
        assert result["asset"] == "0x036CbD53842c5426634e7929541eC2318f3dCF7e"


class TestUptoEvmServerEnhanceRequirements:
    """Test enhance_requirements method of UptoEvmServerScheme."""

    @pytest.mark.asyncio
    async def test_enhance_adds_eip712_domain(self):
        """Test that enhancement adds EIP-712 domain info."""
        scheme = UptoEvmServerScheme()

        requirements = {
            "scheme": "upto",
            "network": "eip155:8453",
            "asset": "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
            "amount": "1000000",
            "payTo": "0xPayTo",
            "maxTimeoutSeconds": 300,
        }

        supported_kind = {
            "t402Version": 2,
            "scheme": "upto",
            "network": "eip155:8453",
        }

        enhanced = await scheme.enhance_requirements(
            requirements,
            supported_kind,
            [],
        )

        assert "extra" in enhanced
        assert "name" in enhanced["extra"]
        assert "version" in enhanced["extra"]
        assert enhanced["extra"]["name"] == "USD Coin"
        assert enhanced["extra"]["version"] == "2"

    @pytest.mark.asyncio
    async def test_enhance_preserves_existing_extra(self):
        """Test that existing extra fields are preserved."""
        scheme = UptoEvmServerScheme()

        requirements = {
            "scheme": "upto",
            "network": "eip155:8453",
            "asset": "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
            "amount": "1000000",
            "payTo": "0xPayTo",
            "maxTimeoutSeconds": 300,
            "extra": {"unit": "token", "unitPrice": "100"},
        }

        supported_kind = {
            "t402Version": 2,
            "scheme": "upto",
            "network": "eip155:8453",
        }

        enhanced = await scheme.enhance_requirements(
            requirements,
            supported_kind,
            [],
        )

        # Original fields preserved
        assert enhanced["extra"]["unit"] == "token"
        assert enhanced["extra"]["unitPrice"] == "100"
        # New fields added
        assert "name" in enhanced["extra"]
        assert "version" in enhanced["extra"]

    @pytest.mark.asyncio
    async def test_enhance_does_not_overwrite_existing_name(self):
        """Test that existing name/version in extra are not overwritten."""
        scheme = UptoEvmServerScheme()

        requirements = {
            "scheme": "upto",
            "network": "eip155:8453",
            "asset": "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
            "amount": "1000000",
            "payTo": "0xPayTo",
            "maxTimeoutSeconds": 300,
            "extra": {"name": "CustomName", "version": "99"},
        }

        supported_kind = {
            "t402Version": 2,
            "scheme": "upto",
            "network": "eip155:8453",
        }

        enhanced = await scheme.enhance_requirements(
            requirements,
            supported_kind,
            [],
        )

        # Should NOT be overwritten
        assert enhanced["extra"]["name"] == "CustomName"
        assert enhanced["extra"]["version"] == "99"

    @pytest.mark.asyncio
    async def test_enhance_creates_extra_if_missing(self):
        """Test that extra dict is created if not present."""
        scheme = UptoEvmServerScheme()

        requirements = {
            "scheme": "upto",
            "network": "eip155:8453",
            "asset": "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
            "amount": "1000000",
            "payTo": "0xPayTo",
            "maxTimeoutSeconds": 300,
        }

        supported_kind = {
            "t402Version": 2,
            "scheme": "upto",
            "network": "eip155:8453",
        }

        enhanced = await scheme.enhance_requirements(
            requirements,
            supported_kind,
            [],
        )

        assert "extra" in enhanced
        assert isinstance(enhanced["extra"], dict)

    @pytest.mark.asyncio
    async def test_enhance_creates_extra_if_none(self):
        """Test that extra is created when explicitly None."""
        scheme = UptoEvmServerScheme()

        requirements = {
            "scheme": "upto",
            "network": "eip155:8453",
            "asset": "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
            "amount": "1000000",
            "payTo": "0xPayTo",
            "maxTimeoutSeconds": 300,
            "extra": None,
        }

        supported_kind = {
            "t402Version": 2,
            "scheme": "upto",
            "network": "eip155:8453",
        }

        enhanced = await scheme.enhance_requirements(
            requirements,
            supported_kind,
            [],
        )

        assert enhanced["extra"] is not None
        assert "name" in enhanced["extra"]

    @pytest.mark.asyncio
    async def test_enhance_adds_router_address(self):
        """Test that router address is added when configured."""
        router = "0x1234567890123456789012345678901234567890"
        scheme = UptoEvmServerScheme(router_address=router)

        requirements = {
            "scheme": "upto",
            "network": "eip155:8453",
            "asset": "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
            "amount": "1000000",
            "payTo": "0xPayTo",
            "maxTimeoutSeconds": 300,
        }

        supported_kind = {
            "t402Version": 2,
            "scheme": "upto",
            "network": "eip155:8453",
        }

        enhanced = await scheme.enhance_requirements(
            requirements,
            supported_kind,
            [],
        )

        assert enhanced["extra"]["routerAddress"] == router

    @pytest.mark.asyncio
    async def test_enhance_does_not_overwrite_existing_router(self):
        """Test that existing routerAddress is not overwritten."""
        router = "0x1234567890123456789012345678901234567890"
        existing_router = "0xabcdefabcdefabcdefabcdefabcdefabcdefabcd"
        scheme = UptoEvmServerScheme(router_address=router)

        requirements = {
            "scheme": "upto",
            "network": "eip155:8453",
            "asset": "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
            "amount": "1000000",
            "payTo": "0xPayTo",
            "maxTimeoutSeconds": 300,
            "extra": {"routerAddress": existing_router},
        }

        supported_kind = {
            "t402Version": 2,
            "scheme": "upto",
            "network": "eip155:8453",
        }

        enhanced = await scheme.enhance_requirements(
            requirements,
            supported_kind,
            [],
        )

        assert enhanced["extra"]["routerAddress"] == existing_router

    @pytest.mark.asyncio
    async def test_enhance_adds_facilitator_extra(self):
        """Test that facilitator extra data is merged."""
        scheme = UptoEvmServerScheme()

        requirements = {
            "scheme": "upto",
            "network": "eip155:8453",
            "asset": "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
            "amount": "1000000",
            "payTo": "0xPayTo",
            "maxTimeoutSeconds": 300,
        }

        supported_kind = {
            "t402Version": 2,
            "scheme": "upto",
            "network": "eip155:8453",
            "extra": {"feePayer": "0xFeePayer", "maxGas": "100000"},
        }

        enhanced = await scheme.enhance_requirements(
            requirements,
            supported_kind,
            [],
        )

        assert enhanced["extra"]["feePayer"] == "0xFeePayer"
        assert enhanced["extra"]["maxGas"] == "100000"

    @pytest.mark.asyncio
    async def test_enhance_facilitator_extra_does_not_overwrite(self):
        """Test that facilitator extra does not overwrite existing values."""
        scheme = UptoEvmServerScheme()

        requirements = {
            "scheme": "upto",
            "network": "eip155:8453",
            "asset": "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
            "amount": "1000000",
            "payTo": "0xPayTo",
            "maxTimeoutSeconds": 300,
            "extra": {"feePayer": "0xOriginal"},
        }

        supported_kind = {
            "t402Version": 2,
            "scheme": "upto",
            "network": "eip155:8453",
            "extra": {"feePayer": "0xFacilitator"},
        }

        enhanced = await scheme.enhance_requirements(
            requirements,
            supported_kind,
            [],
        )

        # Should keep original value
        assert enhanced["extra"]["feePayer"] == "0xOriginal"

    @pytest.mark.asyncio
    async def test_enhance_with_usdt0_network(self):
        """Test enhancement with USDT0 network (Ethereum)."""
        scheme = UptoEvmServerScheme()

        requirements = {
            "scheme": "upto",
            "network": "eip155:1",
            "asset": "0x6C96dE32CEa08842dcc4058c14d3aaAD7Fa41dee",
            "amount": "1000000",
            "payTo": "0xPayTo",
            "maxTimeoutSeconds": 300,
        }

        supported_kind = {
            "t402Version": 2,
            "scheme": "upto",
            "network": "eip155:1",
        }

        enhanced = await scheme.enhance_requirements(
            requirements,
            supported_kind,
            [],
        )

        assert enhanced["extra"]["name"] == "TetherToken"
        assert enhanced["extra"]["version"] == "1"

    @pytest.mark.asyncio
    async def test_enhance_with_unknown_token_uses_defaults(self):
        """Test that unknown token falls back to default name/version."""
        scheme = UptoEvmServerScheme()

        requirements = {
            "scheme": "upto",
            "network": "eip155:8453",
            "asset": "0x0000000000000000000000000000000000000000",
            "amount": "1000000",
            "payTo": "0xPayTo",
            "maxTimeoutSeconds": 300,
        }

        supported_kind = {
            "t402Version": 2,
            "scheme": "upto",
            "network": "eip155:8453",
        }

        enhanced = await scheme.enhance_requirements(
            requirements,
            supported_kind,
            [],
        )

        # Should fall back to defaults
        assert "name" in enhanced["extra"]
        assert "version" in enhanced["extra"]

    @pytest.mark.asyncio
    async def test_enhance_preserves_non_extra_fields(self):
        """Test that non-extra fields are preserved."""
        scheme = UptoEvmServerScheme()

        requirements = {
            "scheme": "upto",
            "network": "eip155:8453",
            "asset": "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
            "amount": "1000000",
            "payTo": "0xPayTo",
            "maxTimeoutSeconds": 300,
        }

        supported_kind = {
            "t402Version": 2,
            "scheme": "upto",
            "network": "eip155:8453",
        }

        enhanced = await scheme.enhance_requirements(
            requirements,
            supported_kind,
            [],
        )

        assert enhanced["scheme"] == "upto"
        assert enhanced["network"] == "eip155:8453"
        assert enhanced["asset"] == "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913"
        assert enhanced["amount"] == "1000000"
        assert enhanced["payTo"] == "0xPayTo"
        assert enhanced["maxTimeoutSeconds"] == 300


class TestUptoEvmServerGetChainId:
    """Test _get_chain_id helper method."""

    def test_caip2_format(self):
        """Test CAIP-2 format parsing."""
        scheme = UptoEvmServerScheme()
        assert scheme._get_chain_id("eip155:8453") == 8453
        assert scheme._get_chain_id("eip155:1") == 1
        assert scheme._get_chain_id("eip155:42161") == 42161

    def test_legacy_format(self):
        """Test legacy network name format."""
        scheme = UptoEvmServerScheme()
        assert scheme._get_chain_id("base") == 8453
        assert scheme._get_chain_id("ethereum") == 1
        assert scheme._get_chain_id("arbitrum") == 42161

    def test_unknown_network_raises(self):
        """Test that unknown network raises ValueError."""
        scheme = UptoEvmServerScheme()
        with pytest.raises(ValueError, match="Unknown network"):
            scheme._get_chain_id("unknown-network")
