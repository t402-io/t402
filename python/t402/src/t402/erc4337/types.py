"""
ERC-4337 Account Abstraction Types for T402

This module provides type definitions for ERC-4337 v0.7 UserOperations,
bundler interactions, and paymaster integration.
"""

from dataclasses import dataclass, field
from enum import Enum
from typing import Optional, List, Union
from eth_typing import HexStr, Address

# EntryPoint addresses (canonical deployments)
ENTRYPOINT_V07_ADDRESS = "0x0000000071727De22E5E9d8BAf0edAc6f37da032"
ENTRYPOINT_V06_ADDRESS = "0x5FF137D4b0FDCD49DcA30c7CF57E578a026d2789"

# Safe 4337 Module addresses (v0.3.0)
SAFE_4337_ADDRESSES = {
    "module": "0xa581c4A4DB7175302464fF3C06380BC3270b4037",
    "module_setup": "0x2dd68b007B46fBe91B9A7c3EDa5A7a1063cB5b47",
    "singleton": "0x29fcB43b46531BcA003ddC8FCB67FFE91900C762",
    "proxy_factory": "0x4e1DCf7AD4e460CfD30791CCC4F9c8a4f820ec67",
    "fallback_handler": "0xfd0732Dc9E303f09fCEf3a7388Ad10A83459Ec99",
    "add_modules_lib": "0x8EcD4ec46D4D2a6B64fE960B3D64e8B94B2234eb",
}


class PaymasterType(str, Enum):
    """Type of paymaster for gas sponsorship."""
    NONE = "none"
    VERIFYING = "verifying"
    TOKEN = "token"
    SPONSORING = "sponsoring"


@dataclass
class UserOperation:
    """
    ERC-4337 UserOperation for off-chain representation.

    This is the format used before packing for on-chain submission.
    """
    sender: str
    nonce: int = 0
    init_code: bytes = field(default_factory=bytes)
    call_data: bytes = field(default_factory=bytes)
    verification_gas_limit: int = 150000
    call_gas_limit: int = 100000
    pre_verification_gas: int = 50000
    max_priority_fee_per_gas: int = 1000000000  # 1 gwei
    max_fee_per_gas: int = 10000000000  # 10 gwei
    paymaster_and_data: bytes = field(default_factory=bytes)
    signature: bytes = field(default_factory=bytes)

    def to_dict(self) -> dict:
        """Convert to dictionary for RPC calls."""
        return {
            "sender": self.sender,
            "nonce": hex(self.nonce),
            "initCode": "0x" + self.init_code.hex() if self.init_code else "0x",
            "callData": "0x" + self.call_data.hex() if self.call_data else "0x",
            "verificationGasLimit": hex(self.verification_gas_limit),
            "callGasLimit": hex(self.call_gas_limit),
            "preVerificationGas": hex(self.pre_verification_gas),
            "maxPriorityFeePerGas": hex(self.max_priority_fee_per_gas),
            "maxFeePerGas": hex(self.max_fee_per_gas),
            "paymasterAndData": "0x" + self.paymaster_and_data.hex() if self.paymaster_and_data else "0x",
            "signature": "0x" + self.signature.hex() if self.signature else "0x",
        }

    def to_packed_dict(self) -> dict:
        """Convert to packed format for v0.7 submission."""
        account_gas_limits = pack_account_gas_limits(
            self.verification_gas_limit,
            self.call_gas_limit
        )
        gas_fees = pack_gas_fees(
            self.max_priority_fee_per_gas,
            self.max_fee_per_gas
        )

        return {
            "sender": self.sender,
            "nonce": hex(self.nonce),
            "initCode": "0x" + self.init_code.hex() if self.init_code else "0x",
            "callData": "0x" + self.call_data.hex() if self.call_data else "0x",
            "accountGasLimits": "0x" + account_gas_limits.hex(),
            "preVerificationGas": hex(self.pre_verification_gas),
            "gasFees": "0x" + gas_fees.hex(),
            "paymasterAndData": "0x" + self.paymaster_and_data.hex() if self.paymaster_and_data else "0x",
            "signature": "0x" + self.signature.hex() if self.signature else "0x",
        }


@dataclass
class PackedUserOperation:
    """
    ERC-4337 UserOperation packed for on-chain submission (v0.7).

    Gas fields are packed into bytes32 for efficiency.
    """
    sender: str
    nonce: int
    init_code: bytes
    call_data: bytes
    account_gas_limits: bytes  # 32 bytes: verification (16) + call (16)
    pre_verification_gas: int
    gas_fees: bytes  # 32 bytes: priority (16) + max (16)
    paymaster_and_data: bytes
    signature: bytes


@dataclass
class PaymasterData:
    """Paymaster information for gas sponsorship."""
    paymaster: str
    paymaster_verification_gas_limit: int = 50000
    paymaster_post_op_gas_limit: int = 50000
    paymaster_data: bytes = field(default_factory=bytes)

    def to_bytes(self) -> bytes:
        """Pack into paymasterAndData format."""
        paymaster_bytes = bytes.fromhex(self.paymaster[2:])
        verification_bytes = self.paymaster_verification_gas_limit.to_bytes(16, 'big')
        post_op_bytes = self.paymaster_post_op_gas_limit.to_bytes(16, 'big')
        return paymaster_bytes + verification_bytes + post_op_bytes + self.paymaster_data


@dataclass
class GasEstimate:
    """Gas estimation results from the bundler."""
    verification_gas_limit: int
    call_gas_limit: int
    pre_verification_gas: int
    paymaster_verification_gas_limit: Optional[int] = None
    paymaster_post_op_gas_limit: Optional[int] = None


@dataclass
class UserOperationReceipt:
    """Receipt after UserOperation execution."""
    user_op_hash: str
    sender: str
    nonce: int
    paymaster: Optional[str] = None
    actual_gas_cost: int = 0
    actual_gas_used: int = 0
    success: bool = False
    reason: Optional[str] = None
    transaction_hash: Optional[str] = None
    block_number: Optional[int] = None
    block_hash: Optional[str] = None


@dataclass
class BundlerConfig:
    """Configuration for bundler client."""
    bundler_url: str
    chain_id: int
    entry_point: str = ENTRYPOINT_V07_ADDRESS


@dataclass
class PaymasterConfig:
    """Configuration for paymaster integration."""
    address: str
    url: Optional[str] = None
    paymaster_type: PaymasterType = PaymasterType.SPONSORING


@dataclass
class TokenQuote:
    """Quote for token paymaster."""
    token: str
    symbol: str
    decimals: int
    fee: int
    exchange_rate: int


@dataclass
class AssetChange:
    """Asset change from simulation."""
    asset_type: str  # native, erc20, erc721, erc1155
    change_type: str  # transfer_in, transfer_out
    from_address: str
    to_address: str
    amount: Optional[int] = None
    token_id: Optional[int] = None
    contract_address: Optional[str] = None
    symbol: Optional[str] = None
    name: Optional[str] = None
    decimals: Optional[int] = None


@dataclass
class SimulationResult:
    """Simulation result for UserOperation."""
    success: bool
    error: Optional[str] = None
    changes: List[AssetChange] = field(default_factory=list)


# Default gas limits
DEFAULT_GAS_LIMITS = GasEstimate(
    verification_gas_limit=150000,
    call_gas_limit=100000,
    pre_verification_gas=50000,
    paymaster_verification_gas_limit=50000,
    paymaster_post_op_gas_limit=50000,
)


# Bundler RPC methods
BUNDLER_METHODS = {
    "send_user_operation": "eth_sendUserOperation",
    "estimate_user_operation_gas": "eth_estimateUserOperationGas",
    "get_user_operation_by_hash": "eth_getUserOperationByHash",
    "get_user_operation_receipt": "eth_getUserOperationReceipt",
    "supported_entry_points": "eth_supportedEntryPoints",
    "chain_id": "eth_chainId",
}


# Supported chains for ERC-4337
SUPPORTED_CHAINS = [
    1,        # Ethereum Mainnet
    11155111, # Ethereum Sepolia
    8453,     # Base
    84532,    # Base Sepolia
    10,       # Optimism
    42161,    # Arbitrum One
    137,      # Polygon
]


# Alchemy network mapping
ALCHEMY_NETWORKS = {
    1: "eth-mainnet",
    11155111: "eth-sepolia",
    137: "polygon-mainnet",
    80001: "polygon-mumbai",
    10: "opt-mainnet",
    420: "opt-goerli",
    42161: "arb-mainnet",
    421613: "arb-goerli",
    8453: "base-mainnet",
    84532: "base-sepolia",
}


# Pimlico network mapping
PIMLICO_NETWORKS = {
    1: "ethereum",
    11155111: "sepolia",
    137: "polygon",
    80001: "mumbai",
    10: "optimism",
    420: "optimism-goerli",
    42161: "arbitrum",
    421613: "arbitrum-goerli",
    8453: "base",
    84532: "base-sepolia",
}


def pack_account_gas_limits(verification_gas_limit: int, call_gas_limit: int) -> bytes:
    """Pack verification and call gas limits into bytes32."""
    verification_bytes = verification_gas_limit.to_bytes(16, 'big')
    call_bytes = call_gas_limit.to_bytes(16, 'big')
    return verification_bytes + call_bytes


def unpack_account_gas_limits(packed: bytes) -> tuple[int, int]:
    """Unpack account gas limits from bytes32."""
    verification_gas_limit = int.from_bytes(packed[:16], 'big')
    call_gas_limit = int.from_bytes(packed[16:], 'big')
    return verification_gas_limit, call_gas_limit


def pack_gas_fees(max_priority_fee_per_gas: int, max_fee_per_gas: int) -> bytes:
    """Pack max priority fee and max fee per gas into bytes32."""
    priority_bytes = max_priority_fee_per_gas.to_bytes(16, 'big')
    max_bytes = max_fee_per_gas.to_bytes(16, 'big')
    return priority_bytes + max_bytes


def unpack_gas_fees(packed: bytes) -> tuple[int, int]:
    """Unpack gas fees from bytes32."""
    max_priority_fee_per_gas = int.from_bytes(packed[:16], 'big')
    max_fee_per_gas = int.from_bytes(packed[16:], 'big')
    return max_priority_fee_per_gas, max_fee_per_gas


def is_supported_chain(chain_id: int) -> bool:
    """Check if a chain ID is supported for ERC-4337."""
    return chain_id in SUPPORTED_CHAINS


def get_alchemy_network(chain_id: int) -> Optional[str]:
    """Get Alchemy network name for a chain ID."""
    return ALCHEMY_NETWORKS.get(chain_id)


def get_pimlico_network(chain_id: int) -> str:
    """Get Pimlico network name for a chain ID."""
    return PIMLICO_NETWORKS.get(chain_id, str(chain_id))


def get_dummy_signature() -> bytes:
    """Get a dummy signature for gas estimation."""
    return bytes.fromhex(
        "fffffffffffffffffffffffffffffff0000000000000000000000000000000007"
        "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa1c"
    )
