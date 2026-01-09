"""
ERC-4337 Bundler Clients for T402

This module provides bundler client implementations for ERC-4337
UserOperation submission, including generic, Pimlico, and Alchemy clients.
"""

import httpx
import time
from dataclasses import dataclass
from typing import Optional, List, Dict, Any, Union

from .types import (
    UserOperation,
    GasEstimate,
    UserOperationReceipt,
    PaymasterData,
    AssetChange,
    SimulationResult,
    BundlerConfig,
    ENTRYPOINT_V07_ADDRESS,
    ALCHEMY_NETWORKS,
    PIMLICO_NETWORKS,
    get_dummy_signature,
)


class BundlerError(Exception):
    """Error from bundler operations."""

    def __init__(self, message: str, code: Optional[int] = None, data: Any = None):
        super().__init__(message)
        self.code = code
        self.data = data


class GenericBundlerClient:
    """Generic bundler client for ERC-4337 v0.7."""

    def __init__(self, config: BundlerConfig):
        self.bundler_url = config.bundler_url
        self.chain_id = config.chain_id
        self.entry_point = config.entry_point
        self._request_id = 0
        self._client = httpx.Client(timeout=30.0)

    def send_user_operation(self, user_op: UserOperation) -> str:
        """Submit a UserOperation to the bundler."""
        packed = user_op.to_packed_dict()
        result = self._rpc_call(
            "eth_sendUserOperation",
            [packed, self.entry_point]
        )
        return result

    def estimate_user_operation_gas(self, user_op: UserOperation) -> GasEstimate:
        """Estimate gas for a UserOperation."""
        packed = user_op.to_packed_dict()
        result = self._rpc_call(
            "eth_estimateUserOperationGas",
            [packed, self.entry_point]
        )

        return GasEstimate(
            verification_gas_limit=int(result.get("verificationGasLimit", "0x0"), 16),
            call_gas_limit=int(result.get("callGasLimit", "0x0"), 16),
            pre_verification_gas=int(result.get("preVerificationGas", "0x0"), 16),
            paymaster_verification_gas_limit=int(result.get("paymasterVerificationGasLimit", "0x0"), 16) if result.get("paymasterVerificationGasLimit") else None,
            paymaster_post_op_gas_limit=int(result.get("paymasterPostOpGasLimit", "0x0"), 16) if result.get("paymasterPostOpGasLimit") else None,
        )

    def get_user_operation_by_hash(self, user_op_hash: str) -> Optional[UserOperation]:
        """Retrieve a UserOperation by hash."""
        result = self._rpc_call(
            "eth_getUserOperationByHash",
            [user_op_hash]
        )

        if not result or not result.get("userOperation"):
            return None

        op = result["userOperation"]
        return UserOperation(
            sender=op.get("sender", ""),
            nonce=int(op.get("nonce", "0x0"), 16),
            init_code=bytes.fromhex(op.get("initCode", "0x")[2:]),
            call_data=bytes.fromhex(op.get("callData", "0x")[2:]),
            verification_gas_limit=int(op.get("verificationGasLimit", "0x0"), 16),
            call_gas_limit=int(op.get("callGasLimit", "0x0"), 16),
            pre_verification_gas=int(op.get("preVerificationGas", "0x0"), 16),
            max_priority_fee_per_gas=int(op.get("maxPriorityFeePerGas", "0x0"), 16),
            max_fee_per_gas=int(op.get("maxFeePerGas", "0x0"), 16),
            paymaster_and_data=bytes.fromhex(op.get("paymasterAndData", "0x")[2:]),
            signature=bytes.fromhex(op.get("signature", "0x")[2:]),
        )

    def get_user_operation_receipt(self, user_op_hash: str) -> Optional[UserOperationReceipt]:
        """Retrieve the receipt for a UserOperation."""
        result = self._rpc_call(
            "eth_getUserOperationReceipt",
            [user_op_hash]
        )

        if not result or not result.get("userOpHash"):
            return None

        receipt = result.get("receipt", {})
        return UserOperationReceipt(
            user_op_hash=result.get("userOpHash", ""),
            sender=result.get("sender", ""),
            nonce=int(result.get("nonce", "0x0"), 16),
            paymaster=result.get("paymaster"),
            actual_gas_cost=int(result.get("actualGasCost", "0x0"), 16),
            actual_gas_used=int(result.get("actualGasUsed", "0x0"), 16),
            success=result.get("success", False),
            reason=result.get("reason"),
            transaction_hash=receipt.get("transactionHash"),
            block_number=int(receipt.get("blockNumber", "0x0"), 16) if receipt.get("blockNumber") else None,
            block_hash=receipt.get("blockHash"),
        )

    def get_supported_entry_points(self) -> List[str]:
        """Return supported EntryPoint addresses."""
        result = self._rpc_call("eth_supportedEntryPoints", [])
        return result or []

    def wait_for_receipt(
        self,
        user_op_hash: str,
        timeout: float = 60.0,
        polling_interval: float = 2.0
    ) -> UserOperationReceipt:
        """Wait for a UserOperation receipt with polling."""
        deadline = time.time() + timeout

        while time.time() < deadline:
            receipt = self.get_user_operation_receipt(user_op_hash)
            if receipt:
                return receipt
            time.sleep(polling_interval)

        raise BundlerError(f"Timeout waiting for UserOperation receipt: {user_op_hash}")

    def _rpc_call(self, method: str, params: List[Any]) -> Any:
        """Make a JSON-RPC call to the bundler."""
        self._request_id += 1

        request = {
            "jsonrpc": "2.0",
            "id": self._request_id,
            "method": method,
            "params": params,
        }

        response = self._client.post(
            self.bundler_url,
            json=request,
            headers={"Content-Type": "application/json"}
        )

        if response.status_code != 200:
            raise BundlerError(f"HTTP error {response.status_code}: {response.text}")

        data = response.json()

        if "error" in data and data["error"]:
            error = data["error"]
            raise BundlerError(
                error.get("message", "Unknown error"),
                code=error.get("code"),
                data=error.get("data")
            )

        return data.get("result")


@dataclass
class PimlicoGasPrice:
    """Gas price estimates from Pimlico."""
    slow_max_fee: int
    slow_priority_fee: int
    standard_max_fee: int
    standard_priority_fee: int
    fast_max_fee: int
    fast_priority_fee: int


class PimlicoBundlerClient(GenericBundlerClient):
    """Pimlico bundler client with extended methods."""

    def __init__(
        self,
        api_key: str,
        chain_id: int,
        bundler_url: Optional[str] = None,
        entry_point: str = ENTRYPOINT_V07_ADDRESS
    ):
        network = PIMLICO_NETWORKS.get(chain_id, str(chain_id))
        url = bundler_url or f"https://api.pimlico.io/v2/{network}/rpc?apikey={api_key}"

        super().__init__(BundlerConfig(
            bundler_url=url,
            chain_id=chain_id,
            entry_point=entry_point
        ))

        self.api_key = api_key

    def get_user_operation_gas_price(self) -> PimlicoGasPrice:
        """Get gas prices from Pimlico."""
        result = self._rpc_call("pimlico_getUserOperationGasPrice", [])

        return PimlicoGasPrice(
            slow_max_fee=int(result["slow"]["maxFeePerGas"], 16),
            slow_priority_fee=int(result["slow"]["maxPriorityFeePerGas"], 16),
            standard_max_fee=int(result["standard"]["maxFeePerGas"], 16),
            standard_priority_fee=int(result["standard"]["maxPriorityFeePerGas"], 16),
            fast_max_fee=int(result["fast"]["maxFeePerGas"], 16),
            fast_priority_fee=int(result["fast"]["maxPriorityFeePerGas"], 16),
        )

    def send_compressed_user_operation(
        self,
        compressed_calldata: bytes,
        inflator_address: str
    ) -> str:
        """Send a compressed UserOperation for gas savings."""
        result = self._rpc_call(
            "pimlico_sendCompressedUserOperation",
            [
                "0x" + compressed_calldata.hex(),
                inflator_address,
                self.entry_point
            ]
        )
        return result

    def get_user_operation_status(self, user_op_hash: str) -> Dict[str, Any]:
        """Get the status of a UserOperation."""
        result = self._rpc_call(
            "pimlico_getUserOperationStatus",
            [user_op_hash]
        )
        return result


@dataclass
class AlchemyPolicyConfig:
    """Alchemy policy configuration for gas sponsorship."""
    policy_id: str


@dataclass
class GasAndPaymasterResult:
    """Combined gas and paymaster data from Alchemy."""
    gas_estimate: GasEstimate
    paymaster_data: Optional[PaymasterData]
    max_fee_per_gas: int
    max_priority_fee_per_gas: int


class AlchemyBundlerClient(GenericBundlerClient):
    """Alchemy bundler client with extended methods."""

    def __init__(
        self,
        api_key: str,
        chain_id: int,
        bundler_url: Optional[str] = None,
        entry_point: str = ENTRYPOINT_V07_ADDRESS,
        policy: Optional[AlchemyPolicyConfig] = None
    ):
        network = ALCHEMY_NETWORKS.get(chain_id)
        if not network:
            raise BundlerError(f"Unsupported chain ID for Alchemy: {chain_id}")

        url = bundler_url or f"https://{network}.g.alchemy.com/v2/{api_key}"

        super().__init__(BundlerConfig(
            bundler_url=url,
            chain_id=chain_id,
            entry_point=entry_point
        ))

        self.api_key = api_key
        self.policy = policy

    def request_gas_and_paymaster_and_data(
        self,
        user_op: UserOperation,
        overrides: Optional[Dict[str, int]] = None
    ) -> GasAndPaymasterResult:
        """Request gas estimates and paymaster data in a single call."""
        if not self.policy:
            raise BundlerError("Alchemy policy required for gas sponsorship")

        packed = self._pack_partial_user_op(user_op)

        request_params = {
            "policyId": self.policy.policy_id,
            "entryPoint": self.entry_point,
            "userOperation": packed,
            "dummySignature": "0x" + get_dummy_signature().hex(),
        }

        if overrides:
            request_params["overrides"] = {
                k: hex(v) for k, v in overrides.items()
            }

        result = self._rpc_call(
            "alchemy_requestGasAndPaymasterAndData",
            [request_params]
        )

        # Parse paymaster data
        paymaster_data = None
        paymaster_and_data = result.get("paymasterAndData", "0x")
        if paymaster_and_data and paymaster_and_data != "0x" and len(paymaster_and_data) >= 106:
            paymaster_data = PaymasterData(
                paymaster="0x" + paymaster_and_data[2:42],
                paymaster_verification_gas_limit=int(paymaster_and_data[42:74], 16),
                paymaster_post_op_gas_limit=int(paymaster_and_data[74:106], 16),
                paymaster_data=bytes.fromhex(paymaster_and_data[106:]) if len(paymaster_and_data) > 106 else b"",
            )

        return GasAndPaymasterResult(
            gas_estimate=GasEstimate(
                verification_gas_limit=int(result.get("verificationGasLimit", "0x0"), 16),
                call_gas_limit=int(result.get("callGasLimit", "0x0"), 16),
                pre_verification_gas=int(result.get("preVerificationGas", "0x0"), 16),
                paymaster_verification_gas_limit=paymaster_data.paymaster_verification_gas_limit if paymaster_data else None,
                paymaster_post_op_gas_limit=paymaster_data.paymaster_post_op_gas_limit if paymaster_data else None,
            ),
            paymaster_data=paymaster_data,
            max_fee_per_gas=int(result.get("maxFeePerGas", "0x0"), 16),
            max_priority_fee_per_gas=int(result.get("maxPriorityFeePerGas", "0x0"), 16),
        )

    def simulate_user_operation_asset_changes(
        self,
        user_op: UserOperation
    ) -> SimulationResult:
        """Simulate asset changes from a UserOperation."""
        packed = user_op.to_packed_dict()

        try:
            result = self._rpc_call(
                "alchemy_simulateUserOperationAssetChanges",
                [{
                    "entryPoint": self.entry_point,
                    "userOperation": packed,
                }]
            )

            changes = []
            for change in result.get("changes", []):
                changes.append(AssetChange(
                    asset_type=change.get("assetType", ""),
                    change_type=change.get("changeType", ""),
                    from_address=change.get("from", ""),
                    to_address=change.get("to", ""),
                    amount=int(change["amount"], 16) if change.get("amount") else None,
                    token_id=int(change["tokenId"], 16) if change.get("tokenId") else None,
                    contract_address=change.get("contractAddress"),
                    symbol=change.get("symbol"),
                    name=change.get("name"),
                    decimals=change.get("decimals"),
                ))

            return SimulationResult(success=True, changes=changes)

        except BundlerError as e:
            return SimulationResult(success=False, error=str(e), changes=[])

    def get_fee_history(self) -> Dict[str, int]:
        """Get fee history for gas estimation."""
        result = self._rpc_call(
            "eth_feeHistory",
            ["0x5", "latest", [25, 50, 75]]
        )

        base_fee_per_gas = result.get("baseFeePerGas", [])
        rewards = result.get("reward", [])

        latest_base_fee = int(base_fee_per_gas[-1], 16) if base_fee_per_gas else 0

        # Get median priority fee
        median_priority_fee = 1000000000  # 1 gwei default
        if rewards:
            mid_idx = len(rewards) // 2
            if rewards[mid_idx]:
                median_priority_fee = int(rewards[mid_idx][1] if len(rewards[mid_idx]) > 1 else rewards[mid_idx][0], 16)

        max_fee_per_gas = latest_base_fee * 2 + median_priority_fee

        return {
            "baseFeePerGas": latest_base_fee,
            "maxPriorityFeePerGas": median_priority_fee,
            "maxFeePerGas": max_fee_per_gas,
        }

    def _pack_partial_user_op(self, user_op: UserOperation) -> Dict[str, Any]:
        """Pack a partial UserOperation for estimation."""
        result: Dict[str, Any] = {
            "sender": user_op.sender,
            "nonce": hex(user_op.nonce),
            "initCode": "0x" + user_op.init_code.hex() if user_op.init_code else "0x",
            "callData": "0x" + user_op.call_data.hex() if user_op.call_data else "0x",
            "paymasterAndData": "0x" + user_op.paymaster_and_data.hex() if user_op.paymaster_and_data else "0x",
            "signature": "0x" + user_op.signature.hex() if user_op.signature else "0x" + get_dummy_signature().hex(),
        }

        if user_op.verification_gas_limit:
            result["verificationGasLimit"] = hex(user_op.verification_gas_limit)
        if user_op.call_gas_limit:
            result["callGasLimit"] = hex(user_op.call_gas_limit)
        if user_op.pre_verification_gas:
            result["preVerificationGas"] = hex(user_op.pre_verification_gas)
        if user_op.max_fee_per_gas:
            result["maxFeePerGas"] = hex(user_op.max_fee_per_gas)
        if user_op.max_priority_fee_per_gas:
            result["maxPriorityFeePerGas"] = hex(user_op.max_priority_fee_per_gas)

        return result


def create_bundler_client(
    provider: str,
    api_key: str,
    chain_id: int,
    **kwargs
) -> Union[GenericBundlerClient, PimlicoBundlerClient, AlchemyBundlerClient]:
    """Factory function to create a bundler client."""
    if provider == "pimlico":
        return PimlicoBundlerClient(
            api_key=api_key,
            chain_id=chain_id,
            bundler_url=kwargs.get("bundler_url"),
            entry_point=kwargs.get("entry_point", ENTRYPOINT_V07_ADDRESS)
        )
    elif provider == "alchemy":
        policy = None
        if kwargs.get("policy_id"):
            policy = AlchemyPolicyConfig(policy_id=kwargs["policy_id"])
        return AlchemyBundlerClient(
            api_key=api_key,
            chain_id=chain_id,
            bundler_url=kwargs.get("bundler_url"),
            entry_point=kwargs.get("entry_point", ENTRYPOINT_V07_ADDRESS),
            policy=policy
        )
    else:
        return GenericBundlerClient(BundlerConfig(
            bundler_url=kwargs.get("bundler_url", ""),
            chain_id=chain_id,
            entry_point=kwargs.get("entry_point", ENTRYPOINT_V07_ADDRESS)
        ))
