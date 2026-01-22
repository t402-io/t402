"""
Tests for ERC-4337 Account Abstraction module.

This module provides comprehensive tests for:
- Types and constants
- Bundler clients (Generic, Pimlico, Alchemy)
- Paymaster clients (Pimlico, Biconomy, Stackup)
- Smart accounts (Safe)
"""

import pytest
from unittest.mock import MagicMock, patch

from t402.erc4337 import (
    # Constants
    ENTRYPOINT_V07_ADDRESS,
    ENTRYPOINT_V06_ADDRESS,
    SAFE_4337_ADDRESSES,
    SUPPORTED_CHAINS,
    ALCHEMY_NETWORKS,
    PIMLICO_NETWORKS,
    DEFAULT_GAS_LIMITS,
    BUNDLER_METHODS,
    # Enums
    PaymasterType,
    # Types
    UserOperation,
    PaymasterData,
    GasEstimate,
    UserOperationReceipt,
    BundlerConfig,
    PaymasterConfig,
    TokenQuote,
    AssetChange,
    SimulationResult,
    # Functions
    pack_account_gas_limits,
    unpack_account_gas_limits,
    pack_gas_fees,
    unpack_gas_fees,
    is_supported_chain,
    get_alchemy_network,
    get_pimlico_network,
    get_dummy_signature,
    # Bundlers
    BundlerError,
    GenericBundlerClient,
    PimlicoBundlerClient,
    AlchemyBundlerClient,
    AlchemyPolicyConfig,
    create_bundler_client,
    # Paymasters
    PaymasterError,
    PaymasterClient,
    PimlicoPaymaster,
    BiconomyPaymaster,
    StackupPaymaster,
    UnifiedPaymaster,
    create_paymaster,
    # Accounts
    SmartAccountError,
    SafeSmartAccount,
    SafeAccountConfig,
    create_smart_account,
)


# =============================================================================
# Test Constants
# =============================================================================


class TestConstants:
    """Tests for ERC-4337 constants."""

    def test_entrypoint_v07_address(self):
        """Test v0.7 EntryPoint address."""
        assert ENTRYPOINT_V07_ADDRESS == "0x0000000071727De22E5E9d8BAf0edAc6f37da032"
        assert ENTRYPOINT_V07_ADDRESS.startswith("0x")
        assert len(ENTRYPOINT_V07_ADDRESS) == 42

    def test_entrypoint_v06_address(self):
        """Test v0.6 EntryPoint address."""
        assert ENTRYPOINT_V06_ADDRESS == "0x5FF137D4b0FDCD49DcA30c7CF57E578a026d2789"
        assert ENTRYPOINT_V06_ADDRESS.startswith("0x")
        assert len(ENTRYPOINT_V06_ADDRESS) == 42

    def test_safe_4337_addresses(self):
        """Test Safe 4337 module addresses."""
        required_keys = [
            "module",
            "module_setup",
            "singleton",
            "proxy_factory",
            "fallback_handler",
            "add_modules_lib",
        ]
        for key in required_keys:
            assert key in SAFE_4337_ADDRESSES
            assert SAFE_4337_ADDRESSES[key].startswith("0x")
            assert len(SAFE_4337_ADDRESSES[key]) == 42

    def test_supported_chains(self):
        """Test supported chains list."""
        expected_chains = [1, 11155111, 8453, 84532, 10, 42161, 137]
        for chain in expected_chains:
            assert chain in SUPPORTED_CHAINS

    def test_alchemy_networks(self):
        """Test Alchemy network mapping."""
        assert ALCHEMY_NETWORKS[1] == "eth-mainnet"
        assert ALCHEMY_NETWORKS[8453] == "base-mainnet"
        assert ALCHEMY_NETWORKS[84532] == "base-sepolia"

    def test_pimlico_networks(self):
        """Test Pimlico network mapping."""
        assert PIMLICO_NETWORKS[1] == "ethereum"
        assert PIMLICO_NETWORKS[8453] == "base"
        assert PIMLICO_NETWORKS[84532] == "base-sepolia"

    def test_default_gas_limits(self):
        """Test default gas limits."""
        assert DEFAULT_GAS_LIMITS.verification_gas_limit == 150000
        assert DEFAULT_GAS_LIMITS.call_gas_limit == 100000
        assert DEFAULT_GAS_LIMITS.pre_verification_gas == 50000

    def test_bundler_methods(self):
        """Test bundler RPC methods."""
        assert BUNDLER_METHODS["send_user_operation"] == "eth_sendUserOperation"
        assert (
            BUNDLER_METHODS["estimate_user_operation_gas"]
            == "eth_estimateUserOperationGas"
        )


# =============================================================================
# Test Enums
# =============================================================================


class TestPaymasterType:
    """Tests for PaymasterType enum."""

    def test_paymaster_type_values(self):
        """Test PaymasterType enum values."""
        assert PaymasterType.NONE == "none"
        assert PaymasterType.VERIFYING == "verifying"
        assert PaymasterType.TOKEN == "token"
        assert PaymasterType.SPONSORING == "sponsoring"

    def test_paymaster_type_string_comparison(self):
        """Test PaymasterType string comparison."""
        assert PaymasterType.SPONSORING == "sponsoring"
        assert PaymasterType.SPONSORING.value == "sponsoring"


# =============================================================================
# Test Types
# =============================================================================


class TestUserOperation:
    """Tests for UserOperation dataclass."""

    def test_user_operation_creation(self):
        """Test creating a UserOperation."""
        user_op = UserOperation(
            sender="0x1234567890123456789012345678901234567890",
            nonce=1,
        )
        assert user_op.sender == "0x1234567890123456789012345678901234567890"
        assert user_op.nonce == 1

    def test_user_operation_defaults(self):
        """Test UserOperation default values."""
        user_op = UserOperation(
            sender="0x1234567890123456789012345678901234567890"
        )
        assert user_op.nonce == 0
        assert user_op.init_code == b""
        assert user_op.call_data == b""
        assert user_op.verification_gas_limit == 150000
        assert user_op.call_gas_limit == 100000
        assert user_op.pre_verification_gas == 50000

    def test_user_operation_to_dict(self):
        """Test UserOperation to_dict method."""
        user_op = UserOperation(
            sender="0x1234567890123456789012345678901234567890",
            nonce=1,
            call_data=b"\x01\x02\x03",
        )
        d = user_op.to_dict()
        assert d["sender"] == "0x1234567890123456789012345678901234567890"
        assert d["nonce"] == "0x1"
        assert d["callData"] == "0x010203"

    def test_user_operation_to_packed_dict(self):
        """Test UserOperation to_packed_dict method."""
        user_op = UserOperation(
            sender="0x1234567890123456789012345678901234567890",
            nonce=1,
            verification_gas_limit=150000,
            call_gas_limit=100000,
        )
        d = user_op.to_packed_dict()
        assert d["sender"] == "0x1234567890123456789012345678901234567890"
        assert d["nonce"] == "0x1"
        assert "accountGasLimits" in d
        assert "gasFees" in d


class TestPaymasterData:
    """Tests for PaymasterData dataclass."""

    def test_paymaster_data_creation(self):
        """Test creating PaymasterData."""
        pm_data = PaymasterData(
            paymaster="0x1234567890123456789012345678901234567890",
            paymaster_verification_gas_limit=50000,
            paymaster_post_op_gas_limit=50000,
        )
        assert pm_data.paymaster == "0x1234567890123456789012345678901234567890"

    def test_paymaster_data_to_bytes(self):
        """Test PaymasterData to_bytes method."""
        pm_data = PaymasterData(
            paymaster="0x1234567890123456789012345678901234567890",
            paymaster_verification_gas_limit=50000,
            paymaster_post_op_gas_limit=50000,
            paymaster_data=b"\x01\x02\x03",
        )
        data = pm_data.to_bytes()
        assert len(data) >= 20 + 16 + 16  # paymaster + gas limits
        assert data[-3:] == b"\x01\x02\x03"


class TestGasEstimate:
    """Tests for GasEstimate dataclass."""

    def test_gas_estimate_creation(self):
        """Test creating GasEstimate."""
        estimate = GasEstimate(
            verification_gas_limit=150000,
            call_gas_limit=100000,
            pre_verification_gas=50000,
        )
        assert estimate.verification_gas_limit == 150000
        assert estimate.call_gas_limit == 100000
        assert estimate.pre_verification_gas == 50000

    def test_gas_estimate_optional_fields(self):
        """Test GasEstimate optional fields."""
        estimate = GasEstimate(
            verification_gas_limit=150000,
            call_gas_limit=100000,
            pre_verification_gas=50000,
            paymaster_verification_gas_limit=50000,
            paymaster_post_op_gas_limit=50000,
        )
        assert estimate.paymaster_verification_gas_limit == 50000
        assert estimate.paymaster_post_op_gas_limit == 50000


class TestUserOperationReceipt:
    """Tests for UserOperationReceipt dataclass."""

    def test_receipt_creation(self):
        """Test creating UserOperationReceipt."""
        receipt = UserOperationReceipt(
            user_op_hash="0x" + "a" * 64,
            sender="0x1234567890123456789012345678901234567890",
            nonce=1,
            success=True,
            transaction_hash="0x" + "b" * 64,
        )
        assert receipt.user_op_hash == "0x" + "a" * 64
        assert receipt.success is True


class TestTokenQuote:
    """Tests for TokenQuote dataclass."""

    def test_token_quote_creation(self):
        """Test creating TokenQuote."""
        quote = TokenQuote(
            token="0x1234567890123456789012345678901234567890",
            symbol="USDC",
            decimals=6,
            fee=1000000,
            exchange_rate=1000000000000000000,
        )
        assert quote.symbol == "USDC"
        assert quote.decimals == 6


class TestAssetChange:
    """Tests for AssetChange dataclass."""

    def test_asset_change_creation(self):
        """Test creating AssetChange."""
        change = AssetChange(
            asset_type="erc20",
            change_type="transfer_out",
            from_address="0x1234567890123456789012345678901234567890",
            to_address="0x0987654321098765432109876543210987654321",
            amount=1000000,
            symbol="USDC",
        )
        assert change.asset_type == "erc20"
        assert change.amount == 1000000


class TestSimulationResult:
    """Tests for SimulationResult dataclass."""

    def test_simulation_result_success(self):
        """Test successful SimulationResult."""
        result = SimulationResult(success=True, changes=[])
        assert result.success is True
        assert result.changes == []

    def test_simulation_result_failure(self):
        """Test failed SimulationResult."""
        result = SimulationResult(success=False, error="Simulation failed")
        assert result.success is False
        assert result.error == "Simulation failed"


# =============================================================================
# Test Utility Functions
# =============================================================================


class TestPackingFunctions:
    """Tests for packing/unpacking utility functions."""

    def test_pack_account_gas_limits(self):
        """Test pack_account_gas_limits function."""
        packed = pack_account_gas_limits(150000, 100000)
        assert len(packed) == 32
        assert isinstance(packed, bytes)

    def test_unpack_account_gas_limits(self):
        """Test unpack_account_gas_limits function."""
        packed = pack_account_gas_limits(150000, 100000)
        verification, call = unpack_account_gas_limits(packed)
        assert verification == 150000
        assert call == 100000

    def test_pack_gas_fees(self):
        """Test pack_gas_fees function."""
        packed = pack_gas_fees(1000000000, 10000000000)
        assert len(packed) == 32
        assert isinstance(packed, bytes)

    def test_unpack_gas_fees(self):
        """Test unpack_gas_fees function."""
        packed = pack_gas_fees(1000000000, 10000000000)
        priority, max_fee = unpack_gas_fees(packed)
        assert priority == 1000000000
        assert max_fee == 10000000000

    def test_pack_unpack_roundtrip(self):
        """Test packing and unpacking roundtrip."""
        original_verification = 200000
        original_call = 150000
        packed = pack_account_gas_limits(original_verification, original_call)
        verification, call = unpack_account_gas_limits(packed)
        assert verification == original_verification
        assert call == original_call


class TestHelperFunctions:
    """Tests for helper functions."""

    def test_is_supported_chain_true(self):
        """Test is_supported_chain returns True for supported chains."""
        assert is_supported_chain(1) is True
        assert is_supported_chain(8453) is True
        assert is_supported_chain(84532) is True

    def test_is_supported_chain_false(self):
        """Test is_supported_chain returns False for unsupported chains."""
        assert is_supported_chain(999999) is False
        assert is_supported_chain(0) is False

    def test_get_alchemy_network(self):
        """Test get_alchemy_network function."""
        assert get_alchemy_network(1) == "eth-mainnet"
        assert get_alchemy_network(8453) == "base-mainnet"
        assert get_alchemy_network(999999) is None

    def test_get_pimlico_network(self):
        """Test get_pimlico_network function."""
        assert get_pimlico_network(1) == "ethereum"
        assert get_pimlico_network(8453) == "base"
        assert get_pimlico_network(999999) == "999999"

    def test_get_dummy_signature(self):
        """Test get_dummy_signature function."""
        sig = get_dummy_signature()
        assert len(sig) == 65  # 64 bytes + 1 byte for v
        assert isinstance(sig, bytes)


# =============================================================================
# Test Bundler Clients
# =============================================================================


class TestBundlerError:
    """Tests for BundlerError exception."""

    def test_bundler_error_creation(self):
        """Test creating BundlerError."""
        error = BundlerError("Test error", code=123, data={"key": "value"})
        assert str(error) == "Test error"
        assert error.code == 123
        assert error.data == {"key": "value"}

    def test_bundler_error_minimal(self):
        """Test BundlerError with minimal args."""
        error = BundlerError("Test error")
        assert str(error) == "Test error"
        assert error.code is None
        assert error.data is None


class TestGenericBundlerClient:
    """Tests for GenericBundlerClient."""

    def test_client_creation(self):
        """Test creating GenericBundlerClient."""
        config = BundlerConfig(
            bundler_url="https://bundler.example.com",
            chain_id=8453,
            entry_point=ENTRYPOINT_V07_ADDRESS,
        )
        client = GenericBundlerClient(config)
        assert client.bundler_url == "https://bundler.example.com"
        assert client.chain_id == 8453
        assert client.entry_point == ENTRYPOINT_V07_ADDRESS

    @patch("t402.erc4337.bundlers.httpx.Client")
    def test_send_user_operation(self, mock_client_class):
        """Test sending a UserOperation."""
        mock_client = MagicMock()
        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_response.json.return_value = {
            "jsonrpc": "2.0",
            "id": 1,
            "result": "0x" + "a" * 64,
        }
        mock_client.post.return_value = mock_response
        mock_client_class.return_value = mock_client

        config = BundlerConfig(
            bundler_url="https://bundler.example.com",
            chain_id=8453,
        )
        client = GenericBundlerClient(config)
        client._client = mock_client

        user_op = UserOperation(
            sender="0x1234567890123456789012345678901234567890"
        )
        result = client.send_user_operation(user_op)
        assert result == "0x" + "a" * 64

    @patch("t402.erc4337.bundlers.httpx.Client")
    def test_estimate_user_operation_gas(self, mock_client_class):
        """Test estimating gas for a UserOperation."""
        mock_client = MagicMock()
        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_response.json.return_value = {
            "jsonrpc": "2.0",
            "id": 1,
            "result": {
                "verificationGasLimit": "0x30000",
                "callGasLimit": "0x20000",
                "preVerificationGas": "0x10000",
            },
        }
        mock_client.post.return_value = mock_response
        mock_client_class.return_value = mock_client

        config = BundlerConfig(
            bundler_url="https://bundler.example.com",
            chain_id=8453,
        )
        client = GenericBundlerClient(config)
        client._client = mock_client

        user_op = UserOperation(
            sender="0x1234567890123456789012345678901234567890"
        )
        estimate = client.estimate_user_operation_gas(user_op)
        assert estimate.verification_gas_limit == 0x30000
        assert estimate.call_gas_limit == 0x20000
        assert estimate.pre_verification_gas == 0x10000

    @patch("t402.erc4337.bundlers.httpx.Client")
    def test_rpc_error_handling(self, mock_client_class):
        """Test RPC error handling."""
        mock_client = MagicMock()
        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_response.json.return_value = {
            "jsonrpc": "2.0",
            "id": 1,
            "error": {"code": -32000, "message": "Execution reverted"},
        }
        mock_client.post.return_value = mock_response
        mock_client_class.return_value = mock_client

        config = BundlerConfig(
            bundler_url="https://bundler.example.com",
            chain_id=8453,
        )
        client = GenericBundlerClient(config)
        client._client = mock_client

        user_op = UserOperation(
            sender="0x1234567890123456789012345678901234567890"
        )
        with pytest.raises(BundlerError) as exc_info:
            client.send_user_operation(user_op)
        assert "Execution reverted" in str(exc_info.value)


class TestPimlicoBundlerClient:
    """Tests for PimlicoBundlerClient."""

    def test_client_creation(self):
        """Test creating PimlicoBundlerClient."""
        client = PimlicoBundlerClient(
            api_key="test-api-key",
            chain_id=8453,
        )
        assert client.api_key == "test-api-key"
        assert client.chain_id == 8453
        assert "pimlico.io" in client.bundler_url

    def test_client_with_custom_url(self):
        """Test creating PimlicoBundlerClient with custom URL."""
        client = PimlicoBundlerClient(
            api_key="test-api-key",
            chain_id=8453,
            bundler_url="https://custom-bundler.example.com",
        )
        assert client.bundler_url == "https://custom-bundler.example.com"

    @patch("t402.erc4337.bundlers.httpx.Client")
    def test_get_user_operation_gas_price(self, mock_client_class):
        """Test getting gas prices from Pimlico."""
        mock_client = MagicMock()
        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_response.json.return_value = {
            "jsonrpc": "2.0",
            "id": 1,
            "result": {
                "slow": {"maxFeePerGas": "0x100", "maxPriorityFeePerGas": "0x10"},
                "standard": {"maxFeePerGas": "0x200", "maxPriorityFeePerGas": "0x20"},
                "fast": {"maxFeePerGas": "0x300", "maxPriorityFeePerGas": "0x30"},
            },
        }
        mock_client.post.return_value = mock_response
        mock_client_class.return_value = mock_client

        client = PimlicoBundlerClient(api_key="test", chain_id=8453)
        client._client = mock_client

        gas_price = client.get_user_operation_gas_price()
        assert gas_price.slow_max_fee == 0x100
        assert gas_price.standard_max_fee == 0x200
        assert gas_price.fast_max_fee == 0x300


class TestAlchemyBundlerClient:
    """Tests for AlchemyBundlerClient."""

    def test_client_creation(self):
        """Test creating AlchemyBundlerClient."""
        client = AlchemyBundlerClient(
            api_key="test-api-key",
            chain_id=8453,
        )
        assert client.api_key == "test-api-key"
        assert client.chain_id == 8453
        assert "alchemy.com" in client.bundler_url

    def test_client_unsupported_chain(self):
        """Test AlchemyBundlerClient with unsupported chain."""
        with pytest.raises(BundlerError) as exc_info:
            AlchemyBundlerClient(api_key="test", chain_id=999999)
        assert "Unsupported chain ID" in str(exc_info.value)

    def test_client_with_policy(self):
        """Test AlchemyBundlerClient with policy config."""
        policy = AlchemyPolicyConfig(policy_id="test-policy-id")
        client = AlchemyBundlerClient(
            api_key="test-api-key",
            chain_id=8453,
            policy=policy,
        )
        assert client.policy.policy_id == "test-policy-id"


class TestCreateBundlerClient:
    """Tests for create_bundler_client factory function."""

    def test_create_pimlico_client(self):
        """Test creating Pimlico bundler client."""
        client = create_bundler_client(
            provider="pimlico",
            api_key="test-key",
            chain_id=8453,
        )
        assert isinstance(client, PimlicoBundlerClient)

    def test_create_alchemy_client(self):
        """Test creating Alchemy bundler client."""
        client = create_bundler_client(
            provider="alchemy",
            api_key="test-key",
            chain_id=8453,
        )
        assert isinstance(client, AlchemyBundlerClient)

    def test_create_generic_client(self):
        """Test creating generic bundler client."""
        client = create_bundler_client(
            provider="generic",
            api_key="test-key",
            chain_id=8453,
            bundler_url="https://bundler.example.com",
        )
        assert isinstance(client, GenericBundlerClient)


# =============================================================================
# Test Paymaster Clients
# =============================================================================


class TestPaymasterError:
    """Tests for PaymasterError exception."""

    def test_paymaster_error_creation(self):
        """Test creating PaymasterError."""
        error = PaymasterError("Test error", code=123, data={"key": "value"})
        assert str(error) == "Test error"
        assert error.code == 123
        assert error.data == {"key": "value"}


class TestPimlicoPaymaster:
    """Tests for PimlicoPaymaster."""

    def test_paymaster_creation(self):
        """Test creating PimlicoPaymaster."""
        paymaster = PimlicoPaymaster(
            api_key="test-api-key",
            chain_id=8453,
        )
        assert paymaster.api_key == "test-api-key"
        assert paymaster.chain_id == 8453
        assert "pimlico.io" in paymaster.paymaster_url

    def test_paymaster_with_policy(self):
        """Test PimlicoPaymaster with sponsorship policy."""
        paymaster = PimlicoPaymaster(
            api_key="test-api-key",
            chain_id=8453,
            sponsorship_policy_id="test-policy",
        )
        assert paymaster.sponsorship_policy_id == "test-policy"

    @patch("t402.erc4337.paymasters.httpx.Client")
    def test_get_paymaster_data(self, mock_client_class):
        """Test getting paymaster data."""
        mock_client = MagicMock()
        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_response.json.return_value = {
            "jsonrpc": "2.0",
            "id": 1,
            "result": {
                "paymaster": "0x1234567890123456789012345678901234567890",
                "paymasterVerificationGasLimit": "0xc350",
                "paymasterPostOpGasLimit": "0xc350",
                "paymasterData": "0x",
            },
        }
        mock_client.post.return_value = mock_response
        mock_client_class.return_value = mock_client

        paymaster = PimlicoPaymaster(api_key="test", chain_id=8453)
        paymaster._client = mock_client

        user_op = UserOperation(
            sender="0x1234567890123456789012345678901234567890"
        )
        pm_data = paymaster.get_paymaster_data(
            user_op, 8453, ENTRYPOINT_V07_ADDRESS
        )
        assert pm_data.paymaster == "0x1234567890123456789012345678901234567890"

    @patch("t402.erc4337.paymasters.httpx.Client")
    def test_will_sponsor_true(self, mock_client_class):
        """Test will_sponsor returns True on success."""
        mock_client = MagicMock()
        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_response.json.return_value = {
            "jsonrpc": "2.0",
            "id": 1,
            "result": {
                "paymaster": "0x1234567890123456789012345678901234567890",
                "paymasterVerificationGasLimit": "0xc350",
                "paymasterPostOpGasLimit": "0xc350",
            },
        }
        mock_client.post.return_value = mock_response
        mock_client_class.return_value = mock_client

        paymaster = PimlicoPaymaster(api_key="test", chain_id=8453)
        paymaster._client = mock_client

        user_op = UserOperation(
            sender="0x1234567890123456789012345678901234567890"
        )
        assert paymaster.will_sponsor(user_op, 8453, ENTRYPOINT_V07_ADDRESS) is True


class TestBiconomyPaymaster:
    """Tests for BiconomyPaymaster."""

    def test_paymaster_creation(self):
        """Test creating BiconomyPaymaster."""
        paymaster = BiconomyPaymaster(
            api_key="test-api-key",
            chain_id=8453,
            paymaster_url="https://paymaster.biconomy.io",
        )
        assert paymaster.api_key == "test-api-key"
        assert paymaster.chain_id == 8453
        assert paymaster.mode == "sponsored"

    def test_paymaster_with_mode(self):
        """Test BiconomyPaymaster with custom mode."""
        paymaster = BiconomyPaymaster(
            api_key="test-api-key",
            chain_id=8453,
            paymaster_url="https://paymaster.biconomy.io",
            mode="erc20",
        )
        assert paymaster.mode == "erc20"


class TestStackupPaymaster:
    """Tests for StackupPaymaster."""

    def test_paymaster_creation(self):
        """Test creating StackupPaymaster."""
        paymaster = StackupPaymaster(
            api_key="test-api-key",
            chain_id=8453,
            paymaster_url="https://api.stackup.sh/v1/paymaster",
        )
        assert paymaster.api_key == "test-api-key"
        assert paymaster.chain_id == 8453


class TestUnifiedPaymaster:
    """Tests for UnifiedPaymaster."""

    def test_unified_paymaster_creation(self):
        """Test creating UnifiedPaymaster."""
        paymaster1 = MagicMock(spec=PaymasterClient)
        paymaster2 = MagicMock(spec=PaymasterClient)
        unified = UnifiedPaymaster([paymaster1, paymaster2])
        assert len(unified.paymasters) == 2

    def test_unified_paymaster_tries_all(self):
        """Test UnifiedPaymaster tries all paymasters."""
        paymaster1 = MagicMock(spec=PaymasterClient)
        paymaster1.get_paymaster_data.side_effect = PaymasterError("Failed")

        paymaster2 = MagicMock(spec=PaymasterClient)
        expected_data = PaymasterData(
            paymaster="0x1234567890123456789012345678901234567890"
        )
        paymaster2.get_paymaster_data.return_value = expected_data

        unified = UnifiedPaymaster([paymaster1, paymaster2])
        user_op = UserOperation(
            sender="0x1234567890123456789012345678901234567890"
        )

        result = unified.get_paymaster_data(user_op, 8453, ENTRYPOINT_V07_ADDRESS)
        assert result == expected_data

    def test_unified_paymaster_all_fail(self):
        """Test UnifiedPaymaster raises when all fail."""
        paymaster1 = MagicMock(spec=PaymasterClient)
        paymaster1.get_paymaster_data.side_effect = PaymasterError("Failed 1")

        paymaster2 = MagicMock(spec=PaymasterClient)
        paymaster2.get_paymaster_data.side_effect = PaymasterError("Failed 2")

        unified = UnifiedPaymaster([paymaster1, paymaster2])
        user_op = UserOperation(
            sender="0x1234567890123456789012345678901234567890"
        )

        with pytest.raises(PaymasterError) as exc_info:
            unified.get_paymaster_data(user_op, 8453, ENTRYPOINT_V07_ADDRESS)
        assert "All paymasters failed" in str(exc_info.value)


class TestCreatePaymaster:
    """Tests for create_paymaster factory function."""

    def test_create_pimlico_paymaster(self):
        """Test creating Pimlico paymaster."""
        paymaster = create_paymaster(
            provider="pimlico",
            api_key="test-key",
            chain_id=8453,
        )
        assert isinstance(paymaster, PimlicoPaymaster)

    def test_create_biconomy_paymaster(self):
        """Test creating Biconomy paymaster."""
        paymaster = create_paymaster(
            provider="biconomy",
            api_key="test-key",
            chain_id=8453,
            paymaster_url="https://paymaster.biconomy.io",
        )
        assert isinstance(paymaster, BiconomyPaymaster)

    def test_create_stackup_paymaster(self):
        """Test creating Stackup paymaster."""
        paymaster = create_paymaster(
            provider="stackup",
            api_key="test-key",
            chain_id=8453,
            paymaster_url="https://api.stackup.sh/v1/paymaster",
        )
        assert isinstance(paymaster, StackupPaymaster)

    def test_create_unknown_paymaster(self):
        """Test creating unknown paymaster raises error."""
        with pytest.raises(PaymasterError) as exc_info:
            create_paymaster(
                provider="unknown",
                api_key="test-key",
                chain_id=8453,
            )
        assert "Unknown paymaster provider" in str(exc_info.value)


# =============================================================================
# Test Smart Accounts
# =============================================================================


class TestSmartAccountError:
    """Tests for SmartAccountError exception."""

    def test_error_creation(self):
        """Test creating SmartAccountError."""
        error = SmartAccountError("Test error")
        assert str(error) == "Test error"


class TestSafeAccountConfig:
    """Tests for SafeAccountConfig dataclass."""

    def test_config_creation(self):
        """Test creating SafeAccountConfig."""
        config = SafeAccountConfig(
            owner_private_key="0x" + "a" * 64,
            chain_id=8453,
        )
        assert config.chain_id == 8453
        assert config.salt == 0
        assert config.threshold == 1

    def test_config_with_custom_values(self):
        """Test SafeAccountConfig with custom values."""
        config = SafeAccountConfig(
            owner_private_key="0x" + "a" * 64,
            chain_id=8453,
            salt=12345,
            threshold=2,
        )
        assert config.salt == 12345
        assert config.threshold == 2


class TestSafeSmartAccount:
    """Tests for SafeSmartAccount."""

    def test_account_creation(self):
        """Test creating SafeSmartAccount."""
        config = SafeAccountConfig(
            owner_private_key="0x" + "a" * 64,
            chain_id=8453,
        )
        account = SafeSmartAccount(config)
        assert account.chain_id == 8453
        assert account.threshold == 1

    def test_get_address(self):
        """Test getting counterfactual address."""
        config = SafeAccountConfig(
            owner_private_key="0x" + "a" * 64,
            chain_id=8453,
        )
        account = SafeSmartAccount(config)
        address = account.get_address()
        assert address.startswith("0x")
        assert len(address) == 42

    def test_get_address_cached(self):
        """Test address is cached."""
        config = SafeAccountConfig(
            owner_private_key="0x" + "a" * 64,
            chain_id=8453,
        )
        account = SafeSmartAccount(config)
        address1 = account.get_address()
        address2 = account.get_address()
        assert address1 == address2

    def test_get_init_code(self):
        """Test getting init code."""
        config = SafeAccountConfig(
            owner_private_key="0x" + "a" * 64,
            chain_id=8453,
        )
        account = SafeSmartAccount(config)
        init_code = account.get_init_code()
        assert isinstance(init_code, bytes)
        assert len(init_code) > 0

    def test_sign_user_op_hash(self):
        """Test signing a UserOperation hash."""
        config = SafeAccountConfig(
            owner_private_key="0x" + "a" * 64,
            chain_id=8453,
        )
        account = SafeSmartAccount(config)
        user_op_hash = bytes.fromhex("a" * 64)
        signature = account.sign_user_op_hash(user_op_hash)
        assert isinstance(signature, bytes)
        assert len(signature) > 0

    def test_encode_execute(self):
        """Test encoding execute call."""
        config = SafeAccountConfig(
            owner_private_key="0x" + "a" * 64,
            chain_id=8453,
        )
        account = SafeSmartAccount(config)
        calldata = account.encode_execute(
            target="0x1234567890123456789012345678901234567890",
            value=0,
            data=b"\x01\x02\x03",
        )
        assert isinstance(calldata, bytes)
        # Should start with executeUserOp selector
        assert calldata[:4] == bytes.fromhex("541d63c8")

    def test_encode_execute_batch(self):
        """Test encoding batch execute call."""
        config = SafeAccountConfig(
            owner_private_key="0x" + "a" * 64,
            chain_id=8453,
        )
        account = SafeSmartAccount(config)
        calldata = account.encode_execute_batch(
            targets=[
                "0x1234567890123456789012345678901234567890",
                "0x0987654321098765432109876543210987654321",
            ],
            values=[0, 100],
            datas=[b"\x01", b"\x02"],
        )
        assert isinstance(calldata, bytes)
        # Should start with executeUserOp selector
        assert calldata[:4] == bytes.fromhex("541d63c8")

    def test_encode_execute_batch_mismatched_lengths(self):
        """Test batch encode with mismatched array lengths."""
        config = SafeAccountConfig(
            owner_private_key="0x" + "a" * 64,
            chain_id=8453,
        )
        account = SafeSmartAccount(config)
        with pytest.raises(SmartAccountError) as exc_info:
            account.encode_execute_batch(
                targets=["0x1234567890123456789012345678901234567890"],
                values=[0, 100],  # Mismatched
                datas=[b"\x01"],
            )
        assert "same length" in str(exc_info.value)

    def test_is_deployed_returns_false(self):
        """Test is_deployed returns False by default."""
        config = SafeAccountConfig(
            owner_private_key="0x" + "a" * 64,
            chain_id=8453,
        )
        account = SafeSmartAccount(config)
        assert account.is_deployed() is False


class TestCreateSmartAccount:
    """Tests for create_smart_account factory function."""

    def test_create_safe_account(self):
        """Test creating Safe smart account."""
        config = SafeAccountConfig(
            owner_private_key="0x" + "a" * 64,
            chain_id=8453,
        )
        account = create_smart_account("safe", config)
        assert isinstance(account, SafeSmartAccount)

    def test_create_unknown_account(self):
        """Test creating unknown account type raises error."""
        config = SafeAccountConfig(
            owner_private_key="0x" + "a" * 64,
            chain_id=8453,
        )
        with pytest.raises(SmartAccountError) as exc_info:
            create_smart_account("unknown", config)
        assert "Unknown smart account type" in str(exc_info.value)


# =============================================================================
# Test Config Dataclasses
# =============================================================================


class TestBundlerConfig:
    """Tests for BundlerConfig dataclass."""

    def test_config_creation(self):
        """Test creating BundlerConfig."""
        config = BundlerConfig(
            bundler_url="https://bundler.example.com",
            chain_id=8453,
        )
        assert config.bundler_url == "https://bundler.example.com"
        assert config.chain_id == 8453
        assert config.entry_point == ENTRYPOINT_V07_ADDRESS


class TestPaymasterConfig:
    """Tests for PaymasterConfig dataclass."""

    def test_config_creation(self):
        """Test creating PaymasterConfig."""
        config = PaymasterConfig(
            address="0x1234567890123456789012345678901234567890",
        )
        assert config.address == "0x1234567890123456789012345678901234567890"
        assert config.paymaster_type == PaymasterType.SPONSORING

    def test_config_with_url(self):
        """Test PaymasterConfig with URL."""
        config = PaymasterConfig(
            address="0x1234567890123456789012345678901234567890",
            url="https://paymaster.example.com",
            paymaster_type=PaymasterType.TOKEN,
        )
        assert config.url == "https://paymaster.example.com"
        assert config.paymaster_type == PaymasterType.TOKEN
