"""
T402 Multi-sig (Safe) Support

Provides Safe multi-sig smart account support for T402 payments.

Example:
    ```python
    from t402.multisig import SafeClient, SafeConfig, TransactionBuilder

    # Create client
    config = SafeConfig(
        address="0x...",
        rpc_url="https://arb1.arbitrum.io/rpc",
    )
    client = SafeClient(config)

    # Get Safe info
    info = await client.get_info()
    print(f"Owners: {info.owners}, Threshold: {info.threshold}")

    # Create and propose a transaction
    tx = TransactionBuilder().to("0x...").value(1000000).build()
    request = await client.propose_transaction(tx)

    # Sign with owner keys
    sig1 = await client.sign_transaction_async(request.transaction, "0x...")
    client.add_signature(request, sig1)

    # Execute when threshold met
    if request.is_ready():
        result = await client.execute_transaction(request, executor_key)
    ```
"""

from .types import (
    SignatureType,
    OperationType,
    SafeConfig,
    SafeOwner,
    SafeTransaction,
    SafeSignature,
    TransactionRequest,
    SafeInfo,
    ExecutionResult,
)
from .constants import (
    SAFE_4337_MODULE,
    SAFE_MODULE_SETUP,
    SAFE_SINGLETON,
    SAFE_PROXY_FACTORY,
    SAFE_FALLBACK_HANDLER,
    SAFE_ADD_MODULES_LIB,
    SAFE_MULTISEND,
    ENTRYPOINT_V07,
    DEFAULT_REQUEST_EXPIRATION_SECONDS,
    MIN_THRESHOLD,
    MAX_OWNERS,
)
from .safe import SafeClient
from .signature import SignatureCollector
from .transaction import (
    TransactionBuilder,
    BatchTransactionBuilder,
    erc20_transfer,
    eth_transfer,
    contract_call,
)
from .utils import (
    generate_request_id,
    current_timestamp,
    sort_addresses,
    is_valid_threshold,
    are_addresses_unique,
    get_owner_index,
    combine_signatures,
)


__all__ = [
    # Types
    "SignatureType",
    "OperationType",
    "SafeConfig",
    "SafeOwner",
    "SafeTransaction",
    "SafeSignature",
    "TransactionRequest",
    "SafeInfo",
    "ExecutionResult",
    # Constants
    "SAFE_4337_MODULE",
    "SAFE_MODULE_SETUP",
    "SAFE_SINGLETON",
    "SAFE_PROXY_FACTORY",
    "SAFE_FALLBACK_HANDLER",
    "SAFE_ADD_MODULES_LIB",
    "SAFE_MULTISEND",
    "ENTRYPOINT_V07",
    "DEFAULT_REQUEST_EXPIRATION_SECONDS",
    "MIN_THRESHOLD",
    "MAX_OWNERS",
    # Client
    "SafeClient",
    # Signature collector
    "SignatureCollector",
    # Transaction builders
    "TransactionBuilder",
    "BatchTransactionBuilder",
    "erc20_transfer",
    "eth_transfer",
    "contract_call",
    # Utilities
    "generate_request_id",
    "current_timestamp",
    "sort_addresses",
    "is_valid_threshold",
    "are_addresses_unique",
    "get_owner_index",
    "combine_signatures",
]
