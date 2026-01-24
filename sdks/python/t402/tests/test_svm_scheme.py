"""Tests for Solana SVM Scheme Package - Verify imports and re-exports work.

This test file validates that:
1. The new schemes/svm/ package correctly re-exports from svm.py
2. TON and TRON facilitator classes are properly exported from their __init__.py
3. EVM upto Server and Facilitator are properly exported
"""

import pytest


class TestSvmSchemeImports:
    """Test that SVM scheme classes can be imported from the scheme package."""

    def test_import_client_from_scheme_package(self):
        """Test importing ExactSvmClientScheme from t402.schemes.svm."""
        from t402.schemes.svm import ExactSvmClientScheme

        assert ExactSvmClientScheme is not None

    def test_import_server_from_scheme_package(self):
        """Test importing ExactSvmServerScheme from t402.schemes.svm."""
        from t402.schemes.svm import ExactSvmServerScheme

        assert ExactSvmServerScheme is not None

    def test_import_facilitator_from_scheme_package(self):
        """Test importing ExactSvmFacilitatorScheme from t402.schemes.svm."""
        from t402.schemes.svm import ExactSvmFacilitatorScheme

        assert ExactSvmFacilitatorScheme is not None

    def test_import_client_signer(self):
        """Test importing ClientSvmSigner from t402.schemes.svm."""
        from t402.schemes.svm import ClientSvmSigner

        assert ClientSvmSigner is not None

    def test_import_facilitator_signer(self):
        """Test importing FacilitatorSvmSigner from t402.schemes.svm."""
        from t402.schemes.svm import FacilitatorSvmSigner

        assert FacilitatorSvmSigner is not None

    def test_import_scheme_constant(self):
        """Test importing SCHEME_EXACT from t402.schemes.svm."""
        from t402.schemes.svm import SCHEME_EXACT

        assert SCHEME_EXACT == "exact"

    def test_import_from_exact_subpackage(self):
        """Test importing from t402.schemes.svm.exact directly."""
        from t402.schemes.svm.exact import (
            ExactSvmClientScheme,
            ExactSvmServerScheme,
            ExactSvmFacilitatorScheme,
            ClientSvmSigner,
            FacilitatorSvmSigner,
            SCHEME_EXACT,
        )

        assert SCHEME_EXACT == "exact"

    def test_import_from_individual_modules(self):
        """Test importing from individual module files."""
        from t402.schemes.svm.exact.client import (
            ExactSvmClientScheme,
            ClientSvmSigner,
            SCHEME_EXACT,
        )
        from t402.schemes.svm.exact.server import ExactSvmServerScheme
        from t402.schemes.svm.exact.facilitator import (
            ExactSvmFacilitatorScheme,
            FacilitatorSvmSigner,
        )

        assert SCHEME_EXACT == "exact"

    def test_import_from_top_level_schemes(self):
        """Test importing SVM classes from t402.schemes (top-level)."""
        from t402.schemes import (
            ExactSvmClientScheme,
            ExactSvmServerScheme,
            ExactSvmFacilitatorScheme,
            SvmClientSigner,
            SvmFacilitatorSigner,
            SVM_SCHEME_EXACT,
        )

        assert SVM_SCHEME_EXACT == "exact"

    def test_scheme_package_matches_svm_module(self):
        """Test that scheme package re-exports are the same classes as svm.py."""
        from t402.schemes.svm import (
            ExactSvmClientScheme as SchemeClient,
            ExactSvmServerScheme as SchemeServer,
            ExactSvmFacilitatorScheme as SchemeFacilitator,
        )
        from t402.svm import (
            ExactSvmClientScheme as SvmClient,
            ExactSvmServerScheme as SvmServer,
            ExactSvmFacilitatorScheme as SvmFacilitator,
        )

        # They should be the exact same class objects
        assert SchemeClient is SvmClient
        assert SchemeServer is SvmServer
        assert SchemeFacilitator is SvmFacilitator


class TestSvmSchemeClientProperties:
    """Test basic properties of the SVM client scheme from the new package."""

    def test_client_scheme_attribute(self):
        """Test that ExactSvmClientScheme has scheme='exact'."""
        from t402.schemes.svm import ExactSvmClientScheme

        assert ExactSvmClientScheme.scheme == "exact"

    def test_client_caip_family(self):
        """Test that ExactSvmClientScheme has caip_family='solana:*'."""
        from t402.schemes.svm import ExactSvmClientScheme

        assert ExactSvmClientScheme.caip_family == "solana:*"


class TestSvmSchemeServerProperties:
    """Test basic properties of the SVM server scheme from the new package."""

    def test_server_scheme_attribute(self):
        """Test that ExactSvmServerScheme has scheme='exact'."""
        from t402.schemes.svm import ExactSvmServerScheme

        assert ExactSvmServerScheme.scheme == "exact"

    def test_server_caip_family(self):
        """Test that ExactSvmServerScheme has caip_family='solana:*'."""
        from t402.schemes.svm import ExactSvmServerScheme

        assert ExactSvmServerScheme.caip_family == "solana:*"


class TestSvmSchemeFacilitatorProperties:
    """Test basic properties of the SVM facilitator scheme from the new package."""

    def test_facilitator_scheme_attribute(self):
        """Test that ExactSvmFacilitatorScheme has scheme='exact'."""
        from t402.schemes.svm import ExactSvmFacilitatorScheme

        assert ExactSvmFacilitatorScheme.scheme == "exact"

    def test_facilitator_caip_family(self):
        """Test that ExactSvmFacilitatorScheme has caip_family='solana:*'."""
        from t402.schemes.svm import ExactSvmFacilitatorScheme

        assert ExactSvmFacilitatorScheme.caip_family == "solana:*"


class TestTonFacilitatorExports:
    """Test that TON facilitator classes are properly exported."""

    def test_ton_facilitator_from_ton_package(self):
        """Test importing from t402.schemes.ton."""
        from t402.schemes.ton import (
            ExactTonFacilitatorScheme,
            FacilitatorTonSigner,
        )

        assert ExactTonFacilitatorScheme is not None
        assert ExactTonFacilitatorScheme.scheme == "exact"
        assert ExactTonFacilitatorScheme.caip_family == "ton:*"

    def test_ton_facilitator_from_exact_subpackage(self):
        """Test importing from t402.schemes.ton.exact."""
        from t402.schemes.ton.exact import (
            ExactTonFacilitatorScheme,
            FacilitatorTonSigner,
        )

        assert ExactTonFacilitatorScheme is not None

    def test_ton_facilitator_from_top_level(self):
        """Test importing from t402.schemes."""
        from t402.schemes import (
            ExactTonFacilitatorScheme,
            FacilitatorTonSigner,
        )

        assert ExactTonFacilitatorScheme.scheme == "exact"
        assert ExactTonFacilitatorScheme.caip_family == "ton:*"


class TestTronFacilitatorExports:
    """Test that TRON facilitator classes are properly exported."""

    def test_tron_facilitator_from_tron_package(self):
        """Test importing from t402.schemes.tron."""
        from t402.schemes.tron import (
            ExactTronFacilitatorScheme,
            ExactTronFacilitatorConfig,
            FacilitatorTronSigner,
        )

        assert ExactTronFacilitatorScheme is not None
        assert ExactTronFacilitatorScheme.scheme == "exact"
        assert ExactTronFacilitatorScheme.caip_family == "tron:*"

    def test_tron_facilitator_from_exact_subpackage(self):
        """Test importing from t402.schemes.tron.exact."""
        from t402.schemes.tron.exact import (
            ExactTronFacilitatorScheme,
            ExactTronFacilitatorConfig,
            FacilitatorTronSigner,
        )

        assert ExactTronFacilitatorScheme is not None

    def test_tron_facilitator_from_top_level(self):
        """Test importing from t402.schemes."""
        from t402.schemes import (
            ExactTronFacilitatorScheme,
            ExactTronFacilitatorConfig,
            FacilitatorTronSigner,
        )

        assert ExactTronFacilitatorScheme.scheme == "exact"
        assert ExactTronFacilitatorScheme.caip_family == "tron:*"

    def test_tron_facilitator_config(self):
        """Test ExactTronFacilitatorConfig initialization."""
        from t402.schemes.tron import ExactTronFacilitatorConfig

        config = ExactTronFacilitatorConfig(can_sponsor_gas=True)
        assert config.can_sponsor_gas is True

        config_default = ExactTronFacilitatorConfig()
        assert config_default.can_sponsor_gas is False


class TestEvmUptoExports:
    """Test that EVM upto Server and Facilitator are properly exported."""

    def test_upto_server_from_evm_package(self):
        """Test importing UptoEvmServerScheme from t402.schemes.evm."""
        from t402.schemes.evm import UptoEvmServerScheme

        assert UptoEvmServerScheme is not None
        assert UptoEvmServerScheme.scheme == "upto"
        assert UptoEvmServerScheme.caip_family == "eip155:*"

    def test_upto_facilitator_from_evm_package(self):
        """Test importing UptoEvmFacilitatorScheme from t402.schemes.evm."""
        from t402.schemes.evm import UptoEvmFacilitatorScheme

        assert UptoEvmFacilitatorScheme is not None
        assert UptoEvmFacilitatorScheme.scheme == "upto"
        assert UptoEvmFacilitatorScheme.caip_family == "eip155:*"

    def test_upto_from_upto_subpackage(self):
        """Test importing from t402.schemes.evm.upto."""
        from t402.schemes.evm.upto import (
            UptoEvmClientScheme,
            UptoEvmServerScheme,
            UptoEvmFacilitatorScheme,
        )

        assert UptoEvmClientScheme.scheme == "upto"
        assert UptoEvmServerScheme.scheme == "upto"
        assert UptoEvmFacilitatorScheme.scheme == "upto"

    def test_upto_from_top_level(self):
        """Test importing from t402.schemes."""
        from t402.schemes import (
            UptoEvmClientScheme,
            UptoEvmServerScheme,
            UptoEvmFacilitatorScheme,
        )

        assert UptoEvmClientScheme.scheme == "upto"
        assert UptoEvmServerScheme.scheme == "upto"
        assert UptoEvmFacilitatorScheme.scheme == "upto"


class TestNearAptosTezosPolkadotExports:
    """Test that NEAR, Aptos, Tezos, Polkadot are all fully exported."""

    def test_near_full_csfexport(self):
        """Test NEAR has Client, Server, Facilitator exports."""
        from t402.schemes import (
            ExactDirectNearClientScheme,
            ExactDirectNearServerScheme,
            ExactDirectNearFacilitatorScheme,
            ClientNearSigner,
            FacilitatorNearSigner,
        )

        assert ExactDirectNearClientScheme is not None
        assert ExactDirectNearServerScheme is not None
        assert ExactDirectNearFacilitatorScheme is not None

    def test_aptos_full_csfexport(self):
        """Test Aptos has Client, Server, Facilitator exports."""
        from t402.schemes import (
            ExactDirectAptosClientScheme,
            ExactDirectAptosServerScheme,
            ExactDirectAptosFacilitatorScheme,
            ClientAptosSigner,
            FacilitatorAptosSigner,
        )

        assert ExactDirectAptosClientScheme is not None
        assert ExactDirectAptosServerScheme is not None
        assert ExactDirectAptosFacilitatorScheme is not None

    def test_tezos_full_csfexport(self):
        """Test Tezos has Client, Server, Facilitator exports."""
        from t402.schemes import (
            ExactDirectTezosClient,
            ExactDirectTezosServer,
            ExactDirectTezosFacilitator,
            ClientTezosSigner,
            FacilitatorTezosSigner,
        )

        assert ExactDirectTezosClient is not None
        assert ExactDirectTezosServer is not None
        assert ExactDirectTezosFacilitator is not None

    def test_polkadot_full_csfexport(self):
        """Test Polkadot has Client, Server, Facilitator exports."""
        from t402.schemes import (
            ExactDirectPolkadotClientScheme,
            ExactDirectPolkadotServerScheme,
            ExactDirectPolkadotFacilitatorScheme,
            ClientPolkadotSigner,
            FacilitatorPolkadotSigner,
        )

        assert ExactDirectPolkadotClientScheme is not None
        assert ExactDirectPolkadotServerScheme is not None
        assert ExactDirectPolkadotFacilitatorScheme is not None


class TestEvmExactExports:
    """Test EVM exact has all C/S/F exports."""

    def test_evm_exact_full_export(self):
        """Test EVM exact has Client, Server, Facilitator exports."""
        from t402.schemes import (
            ExactEvmClientScheme,
            ExactEvmServerScheme,
            ExactEvmFacilitatorScheme,
            FacilitatorEvmSigner,
            EvmSigner,
        )

        assert ExactEvmClientScheme is not None
        assert ExactEvmServerScheme is not None
        assert ExactEvmFacilitatorScheme is not None


class TestAllSchemeCoverage:
    """Test that all required chains have full C/S/F coverage via the package."""

    def test_all_chains_have_client(self):
        """All chains have a client scheme."""
        from t402.schemes import (
            ExactEvmClientScheme,
            UptoEvmClientScheme,
            ExactSvmClientScheme,
            ExactTonClientScheme,
            ExactTronClientScheme,
            ExactDirectNearClientScheme,
            ExactDirectAptosClientScheme,
            ExactDirectTezosClient,
            ExactDirectPolkadotClientScheme,
        )

    def test_all_chains_have_server(self):
        """All chains have a server scheme."""
        from t402.schemes import (
            ExactEvmServerScheme,
            UptoEvmServerScheme,
            ExactSvmServerScheme,
            ExactTonServerScheme,
            ExactTronServerScheme,
            ExactDirectNearServerScheme,
            ExactDirectAptosServerScheme,
            ExactDirectTezosServer,
            ExactDirectPolkadotServerScheme,
        )

    def test_all_chains_have_facilitator(self):
        """All chains have a facilitator scheme."""
        from t402.schemes import (
            ExactEvmFacilitatorScheme,
            UptoEvmFacilitatorScheme,
            ExactSvmFacilitatorScheme,
            ExactTonFacilitatorScheme,
            ExactTronFacilitatorScheme,
            ExactDirectNearFacilitatorScheme,
            ExactDirectAptosFacilitatorScheme,
            ExactDirectTezosFacilitator,
            ExactDirectPolkadotFacilitatorScheme,
        )
