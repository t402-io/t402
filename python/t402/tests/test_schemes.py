"""Tests for Scheme Registry and Interfaces."""

import pytest
from unittest.mock import MagicMock, AsyncMock

from t402 import (
    # Interfaces
    SchemeNetworkClient,
    SchemeNetworkServer,
    SchemeNetworkFacilitator,
    # Registry
    SchemeRegistry,
    ClientSchemeRegistry,
    ServerSchemeRegistry,
    FacilitatorSchemeRegistry,
    get_client_registry,
    get_server_registry,
    get_facilitator_registry,
    reset_global_registries,
    # EVM Schemes
    ExactEvmClientScheme,
    ExactEvmServerScheme,
    # TON Schemes
    ExactTonClientScheme,
    ExactTonServerScheme,
    TonSigner,
    # TRON Schemes
    ExactTronClientScheme,
    ExactTronServerScheme,
    TronSigner,
    # Types
    T402_VERSION_V1,
    T402_VERSION_V2,
    TON_MAINNET,
    TON_TESTNET,
    TRON_MAINNET,
    TRON_NILE,
)


class TestSchemeRegistry:
    """Test SchemeRegistry functionality."""

    def setup_method(self):
        """Reset global registries before each test."""
        reset_global_registries()

    def test_create_registry(self):
        registry = SchemeRegistry()
        assert registry is not None

    def test_register_scheme(self):
        registry = ClientSchemeRegistry()

        class MockScheme:
            scheme = "exact"

        scheme = MockScheme()
        registry.register("eip155:8453", scheme)

        result = registry.get("eip155:8453", "exact")
        assert result is scheme

    def test_register_returns_self_for_chaining(self):
        registry = ClientSchemeRegistry()

        class MockScheme:
            scheme = "exact"

        result = registry.register("eip155:8453", MockScheme())
        assert result is registry

    def test_get_nonexistent_scheme(self):
        registry = ClientSchemeRegistry()
        result = registry.get("eip155:8453", "nonexistent")
        assert result is None

    def test_wildcard_pattern_matching(self):
        registry = ClientSchemeRegistry()

        class MockScheme:
            scheme = "exact"

        scheme = MockScheme()
        registry.register("eip155:*", scheme)

        # Should match any eip155 network
        assert registry.get("eip155:8453", "exact") is scheme
        assert registry.get("eip155:1", "exact") is scheme
        assert registry.get("eip155:84532", "exact") is scheme

        # Should NOT match other networks
        assert registry.get("solana:mainnet", "exact") is None

    def test_exact_match_takes_precedence(self):
        registry = ClientSchemeRegistry()

        class WildcardScheme:
            scheme = "exact"

        class ExactScheme:
            scheme = "exact"

        wildcard = WildcardScheme()
        exact = ExactScheme()

        registry.register("eip155:*", wildcard)
        registry.register("eip155:8453", exact)

        # Exact match should take precedence
        assert registry.get("eip155:8453", "exact") is exact
        # Wildcard should still work for other networks
        assert registry.get("eip155:1", "exact") is wildcard

    def test_register_v1_and_v2(self):
        registry = ClientSchemeRegistry()

        class V1Scheme:
            scheme = "exact"

        class V2Scheme:
            scheme = "exact"

        v1 = V1Scheme()
        v2 = V2Scheme()

        registry.register_v1("base-sepolia", v1)
        registry.register_v2("eip155:8453", v2)

        assert registry.get("base-sepolia", "exact", version=T402_VERSION_V1) is v1
        assert registry.get("eip155:8453", "exact", version=T402_VERSION_V2) is v2

    def test_has_scheme(self):
        registry = ClientSchemeRegistry()

        class MockScheme:
            scheme = "exact"

        registry.register("eip155:8453", MockScheme())

        assert registry.has_scheme("eip155:8453", "exact") is True
        assert registry.has_scheme("eip155:8453", "streaming") is False
        assert registry.has_scheme("solana:mainnet", "exact") is False

    def test_get_for_network(self):
        registry = ClientSchemeRegistry()

        class ExactScheme:
            scheme = "exact"

        class StreamingScheme:
            scheme = "streaming"

        registry.register("eip155:8453", ExactScheme())
        registry.register("eip155:8453", StreamingScheme())

        schemes = registry.get_for_network("eip155:8453")
        assert "exact" in schemes
        assert "streaming" in schemes

    def test_get_registered_networks(self):
        registry = ClientSchemeRegistry()

        class MockScheme:
            scheme = "exact"

        registry.register("eip155:8453", MockScheme())
        registry.register("eip155:*", MockScheme())
        registry.register("solana:mainnet", MockScheme())

        networks = registry.get_registered_networks()
        assert "eip155:8453" in networks
        assert "eip155:*" in networks
        assert "solana:mainnet" in networks

    def test_clear_registry(self):
        registry = ClientSchemeRegistry()

        class MockScheme:
            scheme = "exact"

        registry.register("eip155:8453", MockScheme())
        assert registry.has_scheme("eip155:8453", "exact") is True

        registry.clear()
        assert registry.has_scheme("eip155:8453", "exact") is False

    def test_clear_specific_version(self):
        registry = ClientSchemeRegistry()

        class MockScheme:
            scheme = "exact"

        registry.register_v1("base-sepolia", MockScheme())
        registry.register_v2("eip155:8453", MockScheme())

        registry.clear(version=T402_VERSION_V1)

        assert registry.has_scheme("base-sepolia", "exact", T402_VERSION_V1) is False
        assert registry.has_scheme("eip155:8453", "exact", T402_VERSION_V2) is True


class TestGlobalRegistries:
    """Test global registry accessors."""

    def setup_method(self):
        reset_global_registries()

    def test_get_client_registry_returns_same_instance(self):
        reg1 = get_client_registry()
        reg2 = get_client_registry()
        assert reg1 is reg2

    def test_get_server_registry_returns_same_instance(self):
        reg1 = get_server_registry()
        reg2 = get_server_registry()
        assert reg1 is reg2

    def test_get_facilitator_registry_returns_same_instance(self):
        reg1 = get_facilitator_registry()
        reg2 = get_facilitator_registry()
        assert reg1 is reg2

    def test_reset_clears_global_registries(self):
        # Register something
        class MockScheme:
            scheme = "exact"

        get_client_registry().register("eip155:8453", MockScheme())
        assert get_client_registry().has_scheme("eip155:8453", "exact")

        # Reset
        reset_global_registries()

        # Should be gone (new registry instance)
        assert not get_client_registry().has_scheme("eip155:8453", "exact")


class TestFacilitatorSchemeRegistry:
    """Test FacilitatorSchemeRegistry specific functionality."""

    def test_get_supported_kinds(self):
        registry = FacilitatorSchemeRegistry()

        class MockFacilitator:
            scheme = "exact"
            caip_family = "eip155:*"

            def get_extra(self, network):
                return {"feePayer": "0x123"}

            def get_signers(self, network):
                return ["0x456"]

        registry.register("eip155:8453", MockFacilitator())

        kinds = registry.get_supported_kinds()
        assert len(kinds) == 1
        assert kinds[0]["scheme"] == "exact"
        assert kinds[0]["network"] == "eip155:8453"
        assert kinds[0]["extra"]["feePayer"] == "0x123"

    def test_get_supported_kinds_excludes_wildcards(self):
        registry = FacilitatorSchemeRegistry()

        class MockFacilitator:
            scheme = "exact"
            caip_family = "eip155:*"

            def get_extra(self, network):
                return None

            def get_signers(self, network):
                return []

        # Register with wildcard - should not appear in supported kinds
        registry.register("eip155:*", MockFacilitator())

        kinds = registry.get_supported_kinds()
        assert len(kinds) == 0

    def test_get_signers_by_family(self):
        registry = FacilitatorSchemeRegistry()

        class EvmFacilitator:
            scheme = "exact"
            caip_family = "eip155:*"

            def get_extra(self, network):
                return None

            def get_signers(self, network):
                return ["0xEVM1", "0xEVM2"]

        class SvmFacilitator:
            scheme = "exact"
            caip_family = "solana:*"

            def get_extra(self, network):
                return None

            def get_signers(self, network):
                return ["SolanaAddr1"]

        registry.register("eip155:8453", EvmFacilitator())
        registry.register("solana:mainnet", SvmFacilitator())

        signers = registry.get_signers_by_family()

        assert "eip155:*" in signers
        assert "0xEVM1" in signers["eip155:*"]
        assert "0xEVM2" in signers["eip155:*"]

        assert "solana:*" in signers
        assert "SolanaAddr1" in signers["solana:*"]


class TestExactEvmClientScheme:
    """Test ExactEvmClientScheme."""

    def create_mock_signer(self, address="0x1234567890123456789012345678901234567890"):
        signer = MagicMock()
        signer.address = address

        # Create mock signed result
        mock_signature = MagicMock()
        mock_signature.signature.hex.return_value = "0xabcdef123456"
        signer.sign_typed_data.return_value = mock_signature

        return signer

    def test_scheme_name(self):
        signer = self.create_mock_signer()
        scheme = ExactEvmClientScheme(signer)
        assert scheme.scheme == "exact"

    def test_caip_family(self):
        signer = self.create_mock_signer()
        scheme = ExactEvmClientScheme(signer)
        assert scheme.caip_family == "eip155:*"

    def test_address_property(self):
        signer = self.create_mock_signer("0xMyAddress")
        scheme = ExactEvmClientScheme(signer)
        assert scheme.address == "0xMyAddress"

    @pytest.mark.asyncio
    async def test_create_payment_payload_v2(self):
        signer = self.create_mock_signer()
        scheme = ExactEvmClientScheme(signer)

        requirements = {
            "scheme": "exact",
            "network": "eip155:8453",
            "asset": "0xUSDC",
            "amount": "1000000",
            "payTo": "0xPayTo",
            "maxTimeoutSeconds": 300,
            "extra": {"name": "USD Coin", "version": "2"},
        }

        payload = await scheme.create_payment_payload(
            t402_version=T402_VERSION_V2,
            requirements=requirements,
        )

        assert payload["t402Version"] == 2
        assert "payload" in payload
        assert "signature" in payload["payload"]
        assert "authorization" in payload["payload"]
        assert payload["payload"]["authorization"]["from"] == signer.address
        assert payload["payload"]["authorization"]["to"] == "0xPayTo"

    @pytest.mark.asyncio
    async def test_create_payment_payload_v1(self):
        signer = self.create_mock_signer()
        scheme = ExactEvmClientScheme(signer)

        requirements = {
            "scheme": "exact",
            "network": "eip155:8453",
            "asset": "0xUSDC",
            "amount": "1000000",
            "payTo": "0xPayTo",
            "maxTimeoutSeconds": 300,
            "extra": {"name": "USD Coin", "version": "2"},
        }

        payload = await scheme.create_payment_payload(
            t402_version=T402_VERSION_V1,
            requirements=requirements,
        )

        assert payload["t402Version"] == 1
        assert payload["scheme"] == "exact"
        assert payload["network"] == "eip155:8453"


class TestExactEvmServerScheme:
    """Test ExactEvmServerScheme."""

    def test_scheme_name(self):
        scheme = ExactEvmServerScheme()
        assert scheme.scheme == "exact"

    @pytest.mark.asyncio
    async def test_parse_price_dollar_string(self):
        scheme = ExactEvmServerScheme()
        result = await scheme.parse_price("$0.10", "eip155:8453")

        assert "amount" in result
        assert "asset" in result
        assert result["amount"] == "100000"  # 0.10 * 10^6

    @pytest.mark.asyncio
    async def test_parse_price_number(self):
        scheme = ExactEvmServerScheme()
        result = await scheme.parse_price(0.10, "eip155:8453")

        assert result["amount"] == "100000"

    @pytest.mark.asyncio
    async def test_parse_price_dict(self):
        scheme = ExactEvmServerScheme()
        result = await scheme.parse_price(
            {"amount": "500000", "asset": "0xCustomToken"},
            "eip155:8453",
        )

        assert result["amount"] == "500000"
        assert result["asset"] == "0xCustomToken"

    @pytest.mark.asyncio
    async def test_enhance_requirements(self):
        scheme = ExactEvmServerScheme()

        requirements = {
            "scheme": "exact",
            "network": "eip155:8453",
            "asset": "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
            "amount": "1000000",
            "payTo": "0xPayTo",
            "maxTimeoutSeconds": 300,
        }

        supported_kind = {
            "t402Version": 2,
            "scheme": "exact",
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


class TestProtocolCompliance:
    """Test that schemes implement the Protocol interfaces correctly."""

    def test_client_scheme_is_protocol_compliant(self):
        signer = MagicMock()
        signer.address = "0x123"
        scheme = ExactEvmClientScheme(signer)

        # Protocol check
        assert isinstance(scheme, SchemeNetworkClient)
        assert hasattr(scheme, "scheme")
        assert hasattr(scheme, "create_payment_payload")

    def test_server_scheme_is_protocol_compliant(self):
        scheme = ExactEvmServerScheme()

        assert isinstance(scheme, SchemeNetworkServer)
        assert hasattr(scheme, "scheme")
        assert hasattr(scheme, "parse_price")
        assert hasattr(scheme, "enhance_requirements")


class TestExactTonClientScheme:
    """Test ExactTonClientScheme."""

    def create_mock_signer(self, address="EQCxE6mUtQJKFnGfaROTKOt1lZbDiiX1kCixRv7Nw2Id_sDs"):
        """Create a mock TON signer."""
        signer = MagicMock()
        signer.address = address

        # Mock get_seqno
        signer.get_seqno = AsyncMock(return_value=42)

        # Mock sign_message
        mock_signed = MagicMock()
        mock_signed.to_boc_base64.return_value = "te6cckEBAQEAAgAAAEysuc0="
        signer.sign_message = AsyncMock(return_value=mock_signed)

        return signer

    def create_mock_resolver(self, wallet_address="EQWalletAddress"):
        """Create a mock Jetton wallet resolver."""
        async def resolver(owner: str, jetton_master: str) -> str:
            return wallet_address
        return resolver

    def test_scheme_name(self):
        signer = self.create_mock_signer()
        resolver = self.create_mock_resolver()
        scheme = ExactTonClientScheme(signer, resolver)
        assert scheme.scheme == "exact"

    def test_caip_family(self):
        signer = self.create_mock_signer()
        resolver = self.create_mock_resolver()
        scheme = ExactTonClientScheme(signer, resolver)
        assert scheme.caip_family == "ton:*"

    def test_address_property(self):
        signer = self.create_mock_signer("EQMyAddress")
        resolver = self.create_mock_resolver()
        scheme = ExactTonClientScheme(signer, resolver)
        assert scheme.address == "EQMyAddress"

    @pytest.mark.asyncio
    async def test_create_payment_payload_v2(self):
        signer = self.create_mock_signer()
        resolver = self.create_mock_resolver()
        scheme = ExactTonClientScheme(signer, resolver)

        requirements = {
            "scheme": "exact",
            "network": "ton:mainnet",
            "asset": "EQCxE6mUtQJKFnGfaROTKOt1lZbDiiX1kCixRv7Nw2Id_sDs",
            "amount": "1000000",
            "payTo": "EQPayToAddress123456789012345678901234567890123",
            "maxTimeoutSeconds": 300,
        }

        payload = await scheme.create_payment_payload(
            t402_version=T402_VERSION_V2,
            requirements=requirements,
        )

        assert payload["t402Version"] == 2
        assert "payload" in payload
        assert "signedBoc" in payload["payload"]
        assert "authorization" in payload["payload"]
        assert payload["payload"]["authorization"]["from"] == signer.address
        assert payload["payload"]["authorization"]["to"] == requirements["payTo"]

    @pytest.mark.asyncio
    async def test_create_payment_payload_v1(self):
        signer = self.create_mock_signer()
        resolver = self.create_mock_resolver()
        scheme = ExactTonClientScheme(signer, resolver)

        requirements = {
            "scheme": "exact",
            "network": "ton:mainnet",
            "asset": "EQCxE6mUtQJKFnGfaROTKOt1lZbDiiX1kCixRv7Nw2Id_sDs",
            "amount": "1000000",
            "payTo": "EQPayToAddress123456789012345678901234567890123",
            "maxTimeoutSeconds": 300,
        }

        payload = await scheme.create_payment_payload(
            t402_version=T402_VERSION_V1,
            requirements=requirements,
        )

        assert payload["t402Version"] == 1
        assert payload["scheme"] == "exact"
        assert payload["network"] == "ton:mainnet"

    @pytest.mark.asyncio
    async def test_create_payment_payload_validates_address(self):
        signer = self.create_mock_signer()
        resolver = self.create_mock_resolver()
        scheme = ExactTonClientScheme(signer, resolver)

        requirements = {
            "scheme": "exact",
            "network": "ton:mainnet",
            "asset": "EQCxE6mUtQJKFnGfaROTKOt1lZbDiiX1kCixRv7Nw2Id_sDs",
            "amount": "1000000",
            "payTo": "invalid-address",  # Invalid
            "maxTimeoutSeconds": 300,
        }

        with pytest.raises(ValueError, match="Invalid payTo address"):
            await scheme.create_payment_payload(
                t402_version=T402_VERSION_V2,
                requirements=requirements,
            )

    @pytest.mark.asyncio
    async def test_create_payment_payload_requires_asset(self):
        signer = self.create_mock_signer()
        resolver = self.create_mock_resolver()
        scheme = ExactTonClientScheme(signer, resolver)

        requirements = {
            "scheme": "exact",
            "network": "ton:mainnet",
            "asset": "",  # Missing
            "amount": "1000000",
            "payTo": "EQPayToAddress123456789012345678901234567890123",
            "maxTimeoutSeconds": 300,
        }

        with pytest.raises(ValueError, match="Asset.*is required"):
            await scheme.create_payment_payload(
                t402_version=T402_VERSION_V2,
                requirements=requirements,
            )


class TestExactTonServerScheme:
    """Test ExactTonServerScheme."""

    def test_scheme_name(self):
        scheme = ExactTonServerScheme()
        assert scheme.scheme == "exact"

    def test_caip_family(self):
        scheme = ExactTonServerScheme()
        assert scheme.caip_family == "ton:*"

    @pytest.mark.asyncio
    async def test_parse_price_dollar_string(self):
        scheme = ExactTonServerScheme()
        result = await scheme.parse_price("$0.10", "ton:mainnet")

        assert "amount" in result
        assert "asset" in result
        assert result["amount"] == "100000"  # 0.10 * 10^6

    @pytest.mark.asyncio
    async def test_parse_price_number(self):
        scheme = ExactTonServerScheme()
        result = await scheme.parse_price(0.10, "ton:mainnet")

        assert result["amount"] == "100000"

    @pytest.mark.asyncio
    async def test_parse_price_dict(self):
        scheme = ExactTonServerScheme()
        result = await scheme.parse_price(
            {"amount": "500000", "asset": "EQCustomToken"},
            "ton:mainnet",
        )

        assert result["amount"] == "500000"
        assert result["asset"] == "EQCustomToken"

    @pytest.mark.asyncio
    async def test_parse_price_returns_usdt_asset(self):
        scheme = ExactTonServerScheme()
        result = await scheme.parse_price("$1.00", "ton:mainnet")

        # Should return USDT address for mainnet
        assert result["asset"] == "EQCxE6mUtQJKFnGfaROTKOt1lZbDiiX1kCixRv7Nw2Id_sDs"

    @pytest.mark.asyncio
    async def test_parse_price_testnet(self):
        scheme = ExactTonServerScheme()
        result = await scheme.parse_price("$0.50", "ton:testnet")

        assert result["amount"] == "500000"
        # Should return testnet USDT address
        assert result["asset"] == "kQBqSpvo4S87mX9tTc4FX3Sfqf4uSp3Tx-Fz4RBUfTRWBx"

    @pytest.mark.asyncio
    async def test_parse_price_invalid_network(self):
        scheme = ExactTonServerScheme()

        with pytest.raises(ValueError, match="Unknown.*network"):
            await scheme.parse_price("$0.10", "ton:invalid")

    @pytest.mark.asyncio
    async def test_enhance_requirements(self):
        scheme = ExactTonServerScheme()

        requirements = {
            "scheme": "exact",
            "network": "ton:mainnet",
            "asset": "EQCxE6mUtQJKFnGfaROTKOt1lZbDiiX1kCixRv7Nw2Id_sDs",
            "amount": "1000000",
            "payTo": "EQPayTo",
            "maxTimeoutSeconds": 300,
        }

        supported_kind = {
            "t402Version": 2,
            "scheme": "exact",
            "network": "ton:mainnet",
        }

        enhanced = await scheme.enhance_requirements(
            requirements,
            supported_kind,
            [],
        )

        assert "extra" in enhanced
        assert "symbol" in enhanced["extra"]
        assert "name" in enhanced["extra"]
        assert "decimals" in enhanced["extra"]

    @pytest.mark.asyncio
    async def test_enhance_requirements_adds_endpoint(self):
        scheme = ExactTonServerScheme()

        requirements = {
            "scheme": "exact",
            "network": "ton:mainnet",
            "asset": "EQCxE6mUtQJKFnGfaROTKOt1lZbDiiX1kCixRv7Nw2Id_sDs",
            "amount": "1000000",
            "payTo": "EQPayTo",
            "maxTimeoutSeconds": 300,
        }

        enhanced = await scheme.enhance_requirements(
            requirements,
            {"t402Version": 2, "scheme": "exact", "network": "ton:mainnet"},
            [],
        )

        assert "endpoint" in enhanced["extra"]
        assert "toncenter.com" in enhanced["extra"]["endpoint"]


class TestTonSchemeProtocolCompliance:
    """Test that TON schemes implement the Protocol interfaces correctly."""

    def test_ton_client_scheme_is_protocol_compliant(self):
        signer = MagicMock()
        signer.address = "EQAddress"
        signer.get_seqno = AsyncMock(return_value=0)

        async def resolver(owner, master):
            return "EQWallet"

        scheme = ExactTonClientScheme(signer, resolver)

        # Protocol check
        assert isinstance(scheme, SchemeNetworkClient)
        assert hasattr(scheme, "scheme")
        assert hasattr(scheme, "create_payment_payload")

    def test_ton_server_scheme_is_protocol_compliant(self):
        scheme = ExactTonServerScheme()

        assert isinstance(scheme, SchemeNetworkServer)
        assert hasattr(scheme, "scheme")
        assert hasattr(scheme, "parse_price")
        assert hasattr(scheme, "enhance_requirements")


class TestTonSchemeRegistry:
    """Test TON scheme registration in registry."""

    def setup_method(self):
        reset_global_registries()

    def test_register_ton_client_scheme(self):
        registry = ClientSchemeRegistry()

        signer = MagicMock()
        signer.address = "EQAddress"
        signer.get_seqno = AsyncMock(return_value=0)

        async def resolver(owner, master):
            return "EQWallet"

        scheme = ExactTonClientScheme(signer, resolver)
        registry.register("ton:*", scheme)

        # Should match TON networks
        assert registry.get("ton:mainnet", "exact") is scheme
        assert registry.get("ton:testnet", "exact") is scheme

        # Should NOT match EVM networks
        assert registry.get("eip155:8453", "exact") is None

    def test_register_ton_server_scheme(self):
        registry = ServerSchemeRegistry()

        scheme = ExactTonServerScheme()
        registry.register("ton:*", scheme)

        assert registry.get("ton:mainnet", "exact") is scheme
        assert registry.get("ton:testnet", "exact") is scheme


class TestExactTronClientScheme:
    """Test ExactTronClientScheme."""

    def create_mock_signer(self, address="TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t"):
        """Create a mock TRON signer."""
        signer = MagicMock()
        signer.address = address

        # Mock get_block_info
        signer.get_block_info = AsyncMock(return_value={
            "ref_block_bytes": "abcd",
            "ref_block_hash": "12345678",
            "expiration": 1700000000000,
        })

        # Mock sign_transaction
        signer.sign_transaction = AsyncMock(return_value="0a020a2022080a...")

        return signer

    def test_scheme_name(self):
        signer = self.create_mock_signer()
        scheme = ExactTronClientScheme(signer)
        assert scheme.scheme == "exact"

    def test_caip_family(self):
        signer = self.create_mock_signer()
        scheme = ExactTronClientScheme(signer)
        assert scheme.caip_family == "tron:*"

    def test_address_property(self):
        signer = self.create_mock_signer("TMyAddress123456789012345678901234")
        scheme = ExactTronClientScheme(signer)
        assert scheme.address == "TMyAddress123456789012345678901234"

    @pytest.mark.asyncio
    async def test_create_payment_payload_v2(self):
        signer = self.create_mock_signer()
        scheme = ExactTronClientScheme(signer)

        requirements = {
            "scheme": "exact",
            "network": "tron:mainnet",
            "asset": "TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t",
            "amount": "1000000",
            "payTo": "TPSg7bz6huJBaHnuUt9S9FWLwZqEDNBYHc",
            "maxTimeoutSeconds": 300,
        }

        payload = await scheme.create_payment_payload(
            t402_version=T402_VERSION_V2,
            requirements=requirements,
        )

        assert payload["t402Version"] == 2
        assert "payload" in payload
        assert "signedTransaction" in payload["payload"]
        assert "authorization" in payload["payload"]
        assert payload["payload"]["authorization"]["from"] == signer.address
        assert payload["payload"]["authorization"]["to"] == requirements["payTo"]

    @pytest.mark.asyncio
    async def test_create_payment_payload_v1(self):
        signer = self.create_mock_signer()
        scheme = ExactTronClientScheme(signer)

        requirements = {
            "scheme": "exact",
            "network": "tron:mainnet",
            "asset": "TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t",
            "amount": "1000000",
            "payTo": "TPSg7bz6huJBaHnuUt9S9FWLwZqEDNBYHc",
            "maxTimeoutSeconds": 300,
        }

        payload = await scheme.create_payment_payload(
            t402_version=T402_VERSION_V1,
            requirements=requirements,
        )

        assert payload["t402Version"] == 1
        assert payload["scheme"] == "exact"
        assert payload["network"] == "tron:mainnet"

    @pytest.mark.asyncio
    async def test_create_payment_payload_validates_address(self):
        signer = self.create_mock_signer()
        scheme = ExactTronClientScheme(signer)

        requirements = {
            "scheme": "exact",
            "network": "tron:mainnet",
            "asset": "TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t",
            "amount": "1000000",
            "payTo": "invalid-address",  # Invalid
            "maxTimeoutSeconds": 300,
        }

        with pytest.raises(ValueError, match="Invalid payTo address"):
            await scheme.create_payment_payload(
                t402_version=T402_VERSION_V2,
                requirements=requirements,
            )

    @pytest.mark.asyncio
    async def test_create_payment_payload_requires_asset(self):
        signer = self.create_mock_signer()
        scheme = ExactTronClientScheme(signer)

        requirements = {
            "scheme": "exact",
            "network": "tron:mainnet",
            "asset": "",  # Missing
            "amount": "1000000",
            "payTo": "TPSg7bz6huJBaHnuUt9S9FWLwZqEDNBYHc",
            "maxTimeoutSeconds": 300,
        }

        with pytest.raises(ValueError, match="Asset.*is required"):
            await scheme.create_payment_payload(
                t402_version=T402_VERSION_V2,
                requirements=requirements,
            )

    @pytest.mark.asyncio
    async def test_create_payment_payload_validates_contract_address(self):
        signer = self.create_mock_signer()
        scheme = ExactTronClientScheme(signer)

        requirements = {
            "scheme": "exact",
            "network": "tron:mainnet",
            "asset": "invalid-contract",  # Invalid
            "amount": "1000000",
            "payTo": "TPSg7bz6huJBaHnuUt9S9FWLwZqEDNBYHc",
            "maxTimeoutSeconds": 300,
        }

        with pytest.raises(ValueError, match="Invalid TRC-20 contract address"):
            await scheme.create_payment_payload(
                t402_version=T402_VERSION_V2,
                requirements=requirements,
            )


class TestExactTronServerScheme:
    """Test ExactTronServerScheme."""

    def test_scheme_name(self):
        scheme = ExactTronServerScheme()
        assert scheme.scheme == "exact"

    def test_caip_family(self):
        scheme = ExactTronServerScheme()
        assert scheme.caip_family == "tron:*"

    @pytest.mark.asyncio
    async def test_parse_price_dollar_string(self):
        scheme = ExactTronServerScheme()
        result = await scheme.parse_price("$0.10", "tron:mainnet")

        assert "amount" in result
        assert "asset" in result
        assert result["amount"] == "100000"  # 0.10 * 10^6

    @pytest.mark.asyncio
    async def test_parse_price_number(self):
        scheme = ExactTronServerScheme()
        result = await scheme.parse_price(0.10, "tron:mainnet")

        assert result["amount"] == "100000"

    @pytest.mark.asyncio
    async def test_parse_price_dict(self):
        scheme = ExactTronServerScheme()
        result = await scheme.parse_price(
            {"amount": "500000", "asset": "TCustomToken12345678901234567890123"},
            "tron:mainnet",
        )

        assert result["amount"] == "500000"
        assert result["asset"] == "TCustomToken12345678901234567890123"

    @pytest.mark.asyncio
    async def test_parse_price_returns_usdt_asset(self):
        scheme = ExactTronServerScheme()
        result = await scheme.parse_price("$1.00", "tron:mainnet")

        # Should return USDT address for mainnet
        assert result["asset"] == "TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t"

    @pytest.mark.asyncio
    async def test_parse_price_nile_testnet(self):
        scheme = ExactTronServerScheme()
        result = await scheme.parse_price("$0.50", "tron:nile")

        assert result["amount"] == "500000"
        # Should return Nile testnet USDT address
        assert result["asset"] == "TXYZopYRdj2D9XRtbG411XZZ3kM5VkAeBf"

    @pytest.mark.asyncio
    async def test_parse_price_invalid_network(self):
        scheme = ExactTronServerScheme()

        with pytest.raises(ValueError, match="Unknown.*TRON.*network"):
            await scheme.parse_price("$0.10", "tron:invalid")

    @pytest.mark.asyncio
    async def test_enhance_requirements(self):
        scheme = ExactTronServerScheme()

        requirements = {
            "scheme": "exact",
            "network": "tron:mainnet",
            "asset": "TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t",
            "amount": "1000000",
            "payTo": "TPayTo",
            "maxTimeoutSeconds": 300,
        }

        supported_kind = {
            "t402Version": 2,
            "scheme": "exact",
            "network": "tron:mainnet",
        }

        enhanced = await scheme.enhance_requirements(
            requirements,
            supported_kind,
            [],
        )

        assert "extra" in enhanced
        assert "symbol" in enhanced["extra"]
        assert "name" in enhanced["extra"]
        assert "decimals" in enhanced["extra"]

    @pytest.mark.asyncio
    async def test_enhance_requirements_adds_endpoint(self):
        scheme = ExactTronServerScheme()

        requirements = {
            "scheme": "exact",
            "network": "tron:mainnet",
            "asset": "TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t",
            "amount": "1000000",
            "payTo": "TPayTo",
            "maxTimeoutSeconds": 300,
        }

        enhanced = await scheme.enhance_requirements(
            requirements,
            {"t402Version": 2, "scheme": "exact", "network": "tron:mainnet"},
            [],
        )

        assert "endpoint" in enhanced["extra"]
        assert "trongrid.io" in enhanced["extra"]["endpoint"]


class TestTronSchemeProtocolCompliance:
    """Test that TRON schemes implement the Protocol interfaces correctly."""

    def test_tron_client_scheme_is_protocol_compliant(self):
        signer = MagicMock()
        signer.address = "TAddress1234567890123456789012345"
        signer.get_block_info = AsyncMock(return_value={})

        scheme = ExactTronClientScheme(signer)

        # Protocol check
        assert isinstance(scheme, SchemeNetworkClient)
        assert hasattr(scheme, "scheme")
        assert hasattr(scheme, "create_payment_payload")

    def test_tron_server_scheme_is_protocol_compliant(self):
        scheme = ExactTronServerScheme()

        assert isinstance(scheme, SchemeNetworkServer)
        assert hasattr(scheme, "scheme")
        assert hasattr(scheme, "parse_price")
        assert hasattr(scheme, "enhance_requirements")


class TestTronSchemeRegistry:
    """Test TRON scheme registration in registry."""

    def setup_method(self):
        reset_global_registries()

    def test_register_tron_client_scheme(self):
        registry = ClientSchemeRegistry()

        signer = MagicMock()
        signer.address = "TAddress"
        signer.get_block_info = AsyncMock(return_value={})

        scheme = ExactTronClientScheme(signer)
        registry.register("tron:*", scheme)

        # Should match TRON networks
        assert registry.get("tron:mainnet", "exact") is scheme
        assert registry.get("tron:nile", "exact") is scheme
        assert registry.get("tron:shasta", "exact") is scheme

        # Should NOT match EVM networks
        assert registry.get("eip155:8453", "exact") is None

    def test_register_tron_server_scheme(self):
        registry = ServerSchemeRegistry()

        scheme = ExactTronServerScheme()
        registry.register("tron:*", scheme)

        assert registry.get("tron:mainnet", "exact") is scheme
        assert registry.get("tron:nile", "exact") is scheme
        assert registry.get("tron:shasta", "exact") is scheme
