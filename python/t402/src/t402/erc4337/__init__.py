"""
ERC-4337 Account Abstraction Module for T402

This module provides complete ERC-4337 v0.7 support including:
- UserOperation building and signing
- Bundler clients (generic, Pimlico, Alchemy)
- Paymaster integration (Pimlico, Biconomy, Stackup)
- Smart account implementations (Safe)

Example usage:

    from t402.erc4337 import (
        UserOperation,
        create_bundler_client,
        create_paymaster,
        SafeSmartAccount,
        SafeAccountConfig,
    )

    # Create a Safe smart account
    account = SafeSmartAccount(SafeAccountConfig(
        owner_private_key="0x...",
        chain_id=84532,  # Base Sepolia
    ))

    # Create a bundler client
    bundler = create_bundler_client(
        provider="pimlico",
        api_key="your-api-key",
        chain_id=84532,
    )

    # Create a paymaster
    paymaster = create_paymaster(
        provider="pimlico",
        api_key="your-api-key",
        chain_id=84532,
    )

    # Build and submit a UserOperation
    user_op = UserOperation(
        sender=account.get_address(),
        call_data=account.encode_execute(
            target="0x...",
            value=0,
            data=b"...",
        ),
    )

    # Get gas estimates and paymaster data
    gas = bundler.estimate_user_operation_gas(user_op)
    pm_data = paymaster.get_paymaster_data(user_op, 84532, ENTRYPOINT_V07_ADDRESS)

    # Update user_op with estimates and sign
    user_op.verification_gas_limit = gas.verification_gas_limit
    user_op.call_gas_limit = gas.call_gas_limit
    user_op.pre_verification_gas = gas.pre_verification_gas
    user_op.paymaster_and_data = pm_data.to_bytes()
    user_op.signature = account.sign_user_op_hash(user_op_hash)

    # Submit
    user_op_hash = bundler.send_user_operation(user_op)
    receipt = bundler.wait_for_receipt(user_op_hash)
"""

# Types
from .types import (
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
    # Dataclasses
    UserOperation,
    PackedUserOperation,
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
)

# Bundlers
from .bundlers import (
    BundlerError,
    GenericBundlerClient,
    PimlicoBundlerClient,
    PimlicoGasPrice,
    AlchemyBundlerClient,
    AlchemyPolicyConfig,
    GasAndPaymasterResult,
    create_bundler_client,
)

# Paymasters
from .paymasters import (
    PaymasterError,
    PaymasterClient,
    PimlicoPaymaster,
    BiconomyPaymaster,
    StackupPaymaster,
    UnifiedPaymaster,
    create_paymaster,
)

# Accounts
from .accounts import (
    SmartAccountError,
    SmartAccountSigner,
    SafeSmartAccount,
    SafeAccountConfig,
    create_smart_account,
)

__all__ = [
    # Constants
    "ENTRYPOINT_V07_ADDRESS",
    "ENTRYPOINT_V06_ADDRESS",
    "SAFE_4337_ADDRESSES",
    "SUPPORTED_CHAINS",
    "ALCHEMY_NETWORKS",
    "PIMLICO_NETWORKS",
    "DEFAULT_GAS_LIMITS",
    "BUNDLER_METHODS",
    # Enums
    "PaymasterType",
    # Types
    "UserOperation",
    "PackedUserOperation",
    "PaymasterData",
    "GasEstimate",
    "UserOperationReceipt",
    "BundlerConfig",
    "PaymasterConfig",
    "TokenQuote",
    "AssetChange",
    "SimulationResult",
    # Functions
    "pack_account_gas_limits",
    "unpack_account_gas_limits",
    "pack_gas_fees",
    "unpack_gas_fees",
    "is_supported_chain",
    "get_alchemy_network",
    "get_pimlico_network",
    "get_dummy_signature",
    # Bundlers
    "BundlerError",
    "GenericBundlerClient",
    "PimlicoBundlerClient",
    "PimlicoGasPrice",
    "AlchemyBundlerClient",
    "AlchemyPolicyConfig",
    "GasAndPaymasterResult",
    "create_bundler_client",
    # Paymasters
    "PaymasterError",
    "PaymasterClient",
    "PimlicoPaymaster",
    "BiconomyPaymaster",
    "StackupPaymaster",
    "UnifiedPaymaster",
    "create_paymaster",
    # Accounts
    "SmartAccountError",
    "SmartAccountSigner",
    "SafeSmartAccount",
    "SafeAccountConfig",
    "create_smart_account",
]
