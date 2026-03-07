"""Tests for Stellar blockchain support."""

import math
import pytest

from t402.stellar import (
    # Constants
    STELLAR_PUBNET,
    STELLAR_TESTNET,
    USDC_PUBNET_ADDRESS,
    USDC_TESTNET_ADDRESS,
    DEFAULT_DECIMALS,
    SCHEME_EXACT,
    DEFAULT_TIMEOUT_SECONDS,
    LEDGER_TIME_SECONDS,
    PUBNET_PASSPHRASE,
    TESTNET_PASSPHRASE,
    # Functions
    validate_stellar_address,
    is_g_address,
    is_c_address,
    addresses_equal,
    is_valid_network,
    get_network_config,
    get_default_asset,
    get_asset_info,
    get_usdc_address,
    get_network_passphrase,
    calculate_max_ledger,
    is_testnet,
    is_stellar_network,
    # Types
    StellarAuthorization,
    StellarPaymentPayload,
    StellarVerifyResult,
    TransactionStatus,
    StellarTransactionConfirmation,
)
from t402.networks import is_stellar_network as networks_is_stellar, get_network_type, StellarNetworks


class TestConstants:
    """Test Stellar constants."""

    def test_network_identifiers(self):
        assert STELLAR_PUBNET == "stellar:pubnet"
        assert STELLAR_TESTNET == "stellar:testnet"

    def test_usdc_addresses(self):
        assert validate_stellar_address(USDC_PUBNET_ADDRESS)
        assert validate_stellar_address(USDC_TESTNET_ADDRESS)
        assert is_c_address(USDC_PUBNET_ADDRESS)
        assert is_c_address(USDC_TESTNET_ADDRESS)

    def test_default_decimals(self):
        assert DEFAULT_DECIMALS == 7

    def test_scheme_exact(self):
        assert SCHEME_EXACT == "exact"

    def test_network_passphrases(self):
        assert PUBNET_PASSPHRASE == "Public Global Stellar Network ; September 2015"
        assert TESTNET_PASSPHRASE == "Test SDF Network ; September 2015"

    def test_default_timeout(self):
        assert DEFAULT_TIMEOUT_SECONDS == 60

    def test_ledger_time(self):
        assert LEDGER_TIME_SECONDS == 5


class TestAddressValidation:
    """Test Stellar address validation."""

    def test_valid_g_address(self):
        # G-accounts: 56 chars, start with G, base32 chars
        assert validate_stellar_address(
            "GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA"
        )

    def test_valid_c_address(self):
        # C-accounts (contracts): 56 chars, start with C
        assert validate_stellar_address(USDC_PUBNET_ADDRESS)
        assert validate_stellar_address(USDC_TESTNET_ADDRESS)

    def test_invalid_addresses(self):
        assert not validate_stellar_address("")
        assert not validate_stellar_address("invalid")
        assert not validate_stellar_address("0x1234567890abcdef")  # EVM address
        assert not validate_stellar_address("EQDxE6mUtQJKFnGfaROTKOt1lZbDiiX1kCixRv7Nw2Id_xxx")  # TON address

    def test_is_g_address(self):
        assert is_g_address(
            "GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA"
        )
        assert not is_g_address(USDC_PUBNET_ADDRESS)  # C-account
        assert not is_g_address("")

    def test_is_c_address(self):
        assert is_c_address(USDC_PUBNET_ADDRESS)
        assert is_c_address(USDC_TESTNET_ADDRESS)
        assert not is_c_address(
            "GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA"
        )
        assert not is_c_address("")


class TestAddressComparison:
    """Test Stellar address comparison."""

    def test_equal_addresses(self):
        assert addresses_equal(USDC_PUBNET_ADDRESS, USDC_PUBNET_ADDRESS)

    def test_different_addresses(self):
        assert not addresses_equal(USDC_PUBNET_ADDRESS, USDC_TESTNET_ADDRESS)

    def test_case_sensitive(self):
        # Stellar addresses are case-sensitive (base32)
        assert not addresses_equal(
            USDC_PUBNET_ADDRESS, USDC_PUBNET_ADDRESS.lower()
        )


class TestNetworkValidation:
    """Test Stellar network validation."""

    def test_valid_networks(self):
        assert is_valid_network(STELLAR_PUBNET)
        assert is_valid_network(STELLAR_TESTNET)

    def test_invalid_networks(self):
        assert not is_valid_network("stellar:unknown")
        assert not is_valid_network("eip155:1")
        assert not is_valid_network("ton:mainnet")

    def test_is_testnet(self):
        assert is_testnet(STELLAR_TESTNET)
        assert not is_testnet(STELLAR_PUBNET)

    def test_is_stellar_network(self):
        assert is_stellar_network("stellar:pubnet")
        assert is_stellar_network("stellar:testnet")
        assert not is_stellar_network("ton:mainnet")
        assert not is_stellar_network("eip155:1")


class TestNetworkConfig:
    """Test Stellar network configuration."""

    def test_get_pubnet_config(self):
        config = get_network_config(STELLAR_PUBNET)
        assert config is not None
        assert config["name"] == "Stellar Pubnet"
        assert config["is_testnet"] is False
        assert config["passphrase"] == PUBNET_PASSPHRASE
        assert "horizon_url" in config

    def test_get_testnet_config(self):
        config = get_network_config(STELLAR_TESTNET)
        assert config is not None
        assert config["name"] == "Stellar Testnet"
        assert config["is_testnet"] is True
        assert config["passphrase"] == TESTNET_PASSPHRASE

    def test_get_unknown_config(self):
        assert get_network_config("stellar:unknown") is None


class TestAssetInfo:
    """Test Stellar asset information."""

    def test_get_default_asset_pubnet(self):
        asset = get_default_asset(STELLAR_PUBNET)
        assert asset is not None
        assert asset["symbol"] == "USDC"
        assert asset["contract_address"] == USDC_PUBNET_ADDRESS
        assert asset["decimals"] == DEFAULT_DECIMALS

    def test_get_default_asset_testnet(self):
        asset = get_default_asset(STELLAR_TESTNET)
        assert asset is not None
        assert asset["symbol"] == "USDC"
        assert asset["contract_address"] == USDC_TESTNET_ADDRESS

    def test_get_default_asset_unknown(self):
        assert get_default_asset("stellar:unknown") is None

    def test_get_asset_info_by_symbol(self):
        info = get_asset_info(STELLAR_PUBNET, "USDC")
        assert info is not None
        assert info["symbol"] == "USDC"
        assert info["contract_address"] == USDC_PUBNET_ADDRESS

    def test_get_asset_info_by_address(self):
        info = get_asset_info(STELLAR_PUBNET, USDC_PUBNET_ADDRESS)
        assert info is not None
        assert info["symbol"] == "USDC"

    def test_get_usdc_address(self):
        assert get_usdc_address(STELLAR_PUBNET) == USDC_PUBNET_ADDRESS
        assert get_usdc_address(STELLAR_TESTNET) == USDC_TESTNET_ADDRESS

    def test_get_usdc_address_invalid(self):
        with pytest.raises(ValueError):
            get_usdc_address("stellar:unknown")

    def test_get_network_passphrase(self):
        assert get_network_passphrase(STELLAR_PUBNET) == PUBNET_PASSPHRASE
        assert get_network_passphrase(STELLAR_TESTNET) == TESTNET_PASSPHRASE

    def test_get_network_passphrase_invalid(self):
        with pytest.raises(ValueError):
            get_network_passphrase("stellar:unknown")


class TestCalculateMaxLedger:
    """Test max ledger calculation."""

    def test_calculate_max_ledger(self):
        current = 1000
        timeout = 60  # 60 seconds
        expected = current + math.ceil(timeout / LEDGER_TIME_SECONDS)
        assert calculate_max_ledger(current, timeout) == expected

    def test_calculate_max_ledger_rounds_up(self):
        current = 1000
        timeout = 7  # Not evenly divisible by 5
        expected = current + math.ceil(7 / 5)  # 1002
        assert calculate_max_ledger(current, timeout) == expected


class TestTypes:
    """Test Stellar Pydantic types."""

    def test_stellar_authorization(self):
        auth = StellarAuthorization(
            from_="GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA",
            to="GBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB",
            token_contract=USDC_PUBNET_ADDRESS,
            amount="10000000",
            max_ledger=1100,
            network=STELLAR_PUBNET,
        )
        assert auth.from_ == "GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA"
        assert auth.to == "GBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB"
        assert auth.token_contract == USDC_PUBNET_ADDRESS
        assert auth.amount == "10000000"
        assert auth.max_ledger == 1100

    def test_stellar_authorization_camel_case_dump(self):
        auth = StellarAuthorization(
            from_="GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA",
            to="GBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB",
            token_contract=USDC_PUBNET_ADDRESS,
            amount="10000000",
            max_ledger=1100,
            network=STELLAR_PUBNET,
        )
        dumped = auth.model_dump(by_alias=True)
        assert "from" in dumped
        assert "tokenContract" in dumped
        assert "maxLedger" in dumped

    def test_stellar_authorization_invalid_amount(self):
        with pytest.raises(ValueError):
            StellarAuthorization(
                from_="GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA",
                to="GBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB",
                token_contract=USDC_PUBNET_ADDRESS,
                amount="not_a_number",
                max_ledger=1100,
                network=STELLAR_PUBNET,
            )

    def test_stellar_payment_payload(self):
        auth = StellarAuthorization(
            from_="GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA",
            to="GBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB",
            token_contract=USDC_PUBNET_ADDRESS,
            amount="10000000",
            max_ledger=1100,
            network=STELLAR_PUBNET,
        )
        payload = StellarPaymentPayload(
            signed_tx="AAAA...",
            authorization=auth,
        )
        assert payload.signed_tx == "AAAA..."
        assert payload.authorization.amount == "10000000"

    def test_stellar_verify_result(self):
        result = StellarVerifyResult(valid=True)
        assert result.valid
        assert result.reason is None

        result = StellarVerifyResult(valid=False, reason="expired")
        assert not result.valid
        assert result.reason == "expired"

    def test_transaction_status(self):
        assert TransactionStatus.PENDING == "pending"
        assert TransactionStatus.CONFIRMED == "confirmed"
        assert TransactionStatus.FAILED == "failed"

    def test_stellar_transaction_confirmation(self):
        conf = StellarTransactionConfirmation(
            success=True,
            hash="abc123",
            ledger=12345,
        )
        assert conf.success
        assert conf.hash == "abc123"
        assert conf.ledger == 12345


class TestNetworksIntegration:
    """Test Stellar integration in the networks module."""

    def test_is_stellar_network(self):
        assert networks_is_stellar("stellar:pubnet")
        assert networks_is_stellar("stellar:testnet")
        assert not networks_is_stellar("ton:mainnet")

    def test_get_network_type(self):
        assert get_network_type("stellar:pubnet") == "stellar"
        assert get_network_type("stellar:testnet") == "stellar"


class TestSchemeImports:
    """Test that Stellar scheme classes can be imported."""

    def test_import_client(self):
        from t402.schemes.stellar import ExactStellarClientScheme
        assert ExactStellarClientScheme is not None

    def test_import_server(self):
        from t402.schemes.stellar import ExactStellarServerScheme
        assert ExactStellarServerScheme is not None

    def test_import_facilitator(self):
        from t402.schemes.stellar import ExactStellarFacilitatorScheme
        assert ExactStellarFacilitatorScheme is not None

    def test_import_from_schemes(self):
        from t402.schemes import (
            ExactStellarClientScheme,
            ExactStellarServerScheme,
            ExactStellarFacilitatorScheme,
            StellarSigner,
            FacilitatorStellarSigner,
            STELLAR_SCHEME_EXACT,
        )
        assert ExactStellarClientScheme is not None
        assert ExactStellarServerScheme is not None
        assert ExactStellarFacilitatorScheme is not None
        assert STELLAR_SCHEME_EXACT == "exact"


class TestServerScheme:
    """Test ExactStellarServerScheme."""

    @pytest.fixture
    def server(self):
        from t402.schemes.stellar import ExactStellarServerScheme
        return ExactStellarServerScheme()

    @pytest.mark.asyncio
    async def test_parse_price_decimal(self, server):
        result = await server.parse_price("1.50", STELLAR_PUBNET)
        assert result["amount"] == "15000000"  # 1.50 * 10^7
        assert result["asset"] == USDC_PUBNET_ADDRESS
        assert result["extra"]["symbol"] == "USDC"
        assert result["extra"]["decimals"] == 7

    @pytest.mark.asyncio
    async def test_parse_price_dollar(self, server):
        result = await server.parse_price("$0.10", STELLAR_PUBNET)
        assert result["amount"] == "1000000"  # 0.10 * 10^7

    @pytest.mark.asyncio
    async def test_parse_price_dict(self, server):
        result = await server.parse_price(
            {"amount": "5000000", "asset": USDC_PUBNET_ADDRESS},
            STELLAR_PUBNET,
        )
        assert result["amount"] == "5000000"
        assert result["asset"] == USDC_PUBNET_ADDRESS

    @pytest.mark.asyncio
    async def test_parse_price_testnet(self, server):
        result = await server.parse_price("1.00", STELLAR_TESTNET)
        assert result["asset"] == USDC_TESTNET_ADDRESS

    @pytest.mark.asyncio
    async def test_parse_price_invalid_network(self, server):
        with pytest.raises(ValueError):
            await server.parse_price("1.00", "stellar:unknown")

    @pytest.mark.asyncio
    async def test_enhance_requirements(self, server):
        req = {
            "network": STELLAR_PUBNET,
            "asset": USDC_PUBNET_ADDRESS,
            "amount": "10000000",
            "payTo": "GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA",
        }
        supported_kind = {"extra": {"facilitator": "GFAC..."}}
        result = await server.enhance_requirements(req, supported_kind, [])
        assert "extra" in result
        assert result["extra"]["symbol"] == "USDC"
        assert result["extra"]["decimals"] == 7
        assert result["extra"]["facilitator"] == "GFAC..."


class TestFacilitatorScheme:
    """Test ExactStellarFacilitatorScheme."""

    def test_get_extra(self):
        from t402.schemes.stellar import (
            ExactStellarFacilitatorScheme,
        )

        class MockSigner:
            def get_addresses(self, network):
                return ["GCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCC"]

        facilitator = ExactStellarFacilitatorScheme(signer=MockSigner())
        extra = facilitator.get_extra(STELLAR_PUBNET)
        assert extra is not None
        assert extra["defaultAsset"] == USDC_PUBNET_ADDRESS
        assert extra["symbol"] == "USDC"
        assert extra["decimals"] == 7

    def test_get_extra_unknown_network(self):
        from t402.schemes.stellar import ExactStellarFacilitatorScheme

        class MockSigner:
            def get_addresses(self, network):
                return []

        facilitator = ExactStellarFacilitatorScheme(signer=MockSigner())
        assert facilitator.get_extra("stellar:unknown") is None

    def test_get_signers(self):
        from t402.schemes.stellar import ExactStellarFacilitatorScheme

        expected = ["GCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCC"]

        class MockSigner:
            def get_addresses(self, network):
                return expected

        facilitator = ExactStellarFacilitatorScheme(signer=MockSigner())
        signers = facilitator.get_signers(STELLAR_PUBNET)
        assert signers == expected

    def test_scheme_attributes(self):
        from t402.schemes.stellar import ExactStellarFacilitatorScheme

        class MockSigner:
            def get_addresses(self, network):
                return []

        facilitator = ExactStellarFacilitatorScheme(signer=MockSigner())
        assert facilitator.scheme == "exact"
        assert facilitator.caip_family == "stellar:*"

    @pytest.mark.asyncio
    async def test_verify_unsupported_scheme(self):
        from t402.schemes.stellar import ExactStellarFacilitatorScheme

        class MockSigner:
            def get_addresses(self, network):
                return []

        facilitator = ExactStellarFacilitatorScheme(signer=MockSigner())
        result = await facilitator.verify(
            {"payload": {"signedTx": "AAAA", "authorization": {"from": "G..."}}},
            {"scheme": "upto", "network": STELLAR_PUBNET},
        )
        assert not result.is_valid
        assert result.invalid_reason == "unsupported_scheme"

    @pytest.mark.asyncio
    async def test_verify_unsupported_network(self):
        from t402.schemes.stellar import ExactStellarFacilitatorScheme

        class MockSigner:
            def get_addresses(self, network):
                return []

        facilitator = ExactStellarFacilitatorScheme(signer=MockSigner())
        result = await facilitator.verify(
            {"payload": {"signedTx": "AAAA", "authorization": {"from": "G..."}}},
            {"scheme": "exact", "network": "stellar:unknown"},
        )
        assert not result.is_valid
        assert result.invalid_reason == "unsupported_network"

    @pytest.mark.asyncio
    async def test_verify_invalid_payload(self):
        from t402.schemes.stellar import ExactStellarFacilitatorScheme

        class MockSigner:
            def get_addresses(self, network):
                return []

        facilitator = ExactStellarFacilitatorScheme(signer=MockSigner())
        result = await facilitator.verify(
            {"payload": {}},
            {"scheme": "exact", "network": STELLAR_PUBNET},
        )
        assert not result.is_valid
        assert result.invalid_reason == "invalid_payload"


class TestClientScheme:
    """Test ExactStellarClientScheme."""

    def test_scheme_attributes(self):
        from t402.schemes.stellar import ExactStellarClientScheme

        class MockSigner:
            @property
            def address(self):
                return "GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA"

        scheme = ExactStellarClientScheme(signer=MockSigner())
        assert scheme.scheme == "exact"
        assert scheme.caip_family == "stellar:*"
        assert scheme.address == "GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA"
