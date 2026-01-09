"""
ERC-4337 Paymaster Clients for T402

This module provides paymaster client implementations for ERC-4337
gas sponsorship, including Pimlico, Biconomy, and Stackup clients.
"""

import httpx
from dataclasses import dataclass
from typing import Optional, List, Dict, Any, Union
from abc import ABC, abstractmethod

from .types import (
    UserOperation,
    PaymasterData,
    TokenQuote,
    GasEstimate,
    ENTRYPOINT_V07_ADDRESS,
    PIMLICO_NETWORKS,
    DEFAULT_GAS_LIMITS,
    get_dummy_signature,
)


class PaymasterError(Exception):
    """Error from paymaster operations."""

    def __init__(self, message: str, code: Optional[int] = None, data: Any = None):
        super().__init__(message)
        self.code = code
        self.data = data


class PaymasterClient(ABC):
    """Abstract base class for paymaster clients."""

    @abstractmethod
    def get_paymaster_data(
        self,
        user_op: UserOperation,
        chain_id: int,
        entry_point: str
    ) -> PaymasterData:
        """Get paymaster data for a UserOperation."""
        pass

    @abstractmethod
    def will_sponsor(
        self,
        user_op: UserOperation,
        chain_id: int,
        entry_point: str
    ) -> bool:
        """Check if the paymaster will sponsor this operation."""
        pass


def _pack_user_op_for_paymaster(user_op: UserOperation) -> Dict[str, Any]:
    """Pack UserOperation for paymaster RPC calls."""
    return {
        "sender": user_op.sender,
        "nonce": hex(user_op.nonce),
        "initCode": "0x" + user_op.init_code.hex() if user_op.init_code else "0x",
        "callData": "0x" + user_op.call_data.hex() if user_op.call_data else "0x",
        "verificationGasLimit": hex(user_op.verification_gas_limit or DEFAULT_GAS_LIMITS.verification_gas_limit),
        "callGasLimit": hex(user_op.call_gas_limit or DEFAULT_GAS_LIMITS.call_gas_limit),
        "preVerificationGas": hex(user_op.pre_verification_gas or DEFAULT_GAS_LIMITS.pre_verification_gas),
        "maxFeePerGas": hex(user_op.max_fee_per_gas) if user_op.max_fee_per_gas else "0x0",
        "maxPriorityFeePerGas": hex(user_op.max_priority_fee_per_gas) if user_op.max_priority_fee_per_gas else "0x0",
        "paymasterAndData": "0x" + user_op.paymaster_and_data.hex() if user_op.paymaster_and_data else "0x",
        "signature": "0x" + user_op.signature.hex() if user_op.signature else "0x" + get_dummy_signature().hex(),
    }


class PimlicoPaymaster(PaymasterClient):
    """Pimlico paymaster client."""

    def __init__(
        self,
        api_key: str,
        chain_id: int,
        paymaster_url: Optional[str] = None,
        entry_point: str = ENTRYPOINT_V07_ADDRESS,
        sponsorship_policy_id: Optional[str] = None
    ):
        network = PIMLICO_NETWORKS.get(chain_id, str(chain_id))
        self.paymaster_url = paymaster_url or f"https://api.pimlico.io/v2/{network}/rpc?apikey={api_key}"
        self.api_key = api_key
        self.chain_id = chain_id
        self.entry_point = entry_point
        self.sponsorship_policy_id = sponsorship_policy_id
        self._request_id = 0
        self._client = httpx.Client(timeout=30.0)

    def get_paymaster_data(
        self,
        user_op: UserOperation,
        chain_id: int,
        entry_point: str
    ) -> PaymasterData:
        """Get paymaster data for sponsorship."""
        return self.sponsor_user_operation(user_op)

    def will_sponsor(
        self,
        user_op: UserOperation,
        chain_id: int,
        entry_point: str
    ) -> bool:
        """Check if the paymaster will sponsor this operation."""
        try:
            self.sponsor_user_operation(user_op)
            return True
        except PaymasterError:
            return False

    def sponsor_user_operation(self, user_op: UserOperation) -> PaymasterData:
        """Sponsor a UserOperation."""
        packed = _pack_user_op_for_paymaster(user_op)

        params: List[Any] = [packed, self.entry_point]
        if self.sponsorship_policy_id:
            params.append({"sponsorshipPolicyId": self.sponsorship_policy_id})

        result = self._rpc_call("pm_sponsorUserOperation", params)

        return self._parse_paymaster_response(result)

    def get_token_quotes(
        self,
        user_op: UserOperation,
        tokens: List[str]
    ) -> List[TokenQuote]:
        """Get quotes for paying gas with tokens."""
        packed = _pack_user_op_for_paymaster(user_op)

        result = self._rpc_call(
            "pimlico_getTokenQuotes",
            [packed, self.entry_point, tokens]
        )

        quotes = []
        for r in result:
            quotes.append(TokenQuote(
                token=r.get("token", ""),
                symbol=r.get("symbol", ""),
                decimals=r.get("decimals", 18),
                fee=int(r.get("fee", "0x0"), 16),
                exchange_rate=int(r.get("exchangeRate", "0x0"), 16),
            ))

        return quotes

    def _parse_paymaster_response(self, result: Dict[str, Any]) -> PaymasterData:
        """Parse paymaster response into PaymasterData."""
        # Try v0.7 format first (separate fields)
        if result.get("paymaster"):
            return PaymasterData(
                paymaster=result["paymaster"],
                paymaster_verification_gas_limit=int(result.get("paymasterVerificationGasLimit", "0x0"), 16),
                paymaster_post_op_gas_limit=int(result.get("paymasterPostOpGasLimit", "0x0"), 16),
                paymaster_data=bytes.fromhex(result.get("paymasterData", "0x")[2:]) if result.get("paymasterData") else b"",
            )

        # Fall back to v0.6 format (packed)
        paymaster_and_data = result.get("paymasterAndData", "0x")
        if paymaster_and_data and paymaster_and_data != "0x":
            data = bytes.fromhex(paymaster_and_data[2:])
            if len(data) >= 20:
                return PaymasterData(
                    paymaster="0x" + data[:20].hex(),
                    paymaster_data=data[20:] if len(data) > 20 else b"",
                )

        raise PaymasterError("Invalid paymaster response")

    def _rpc_call(self, method: str, params: List[Any]) -> Any:
        """Make a JSON-RPC call to the paymaster."""
        self._request_id += 1

        request = {
            "jsonrpc": "2.0",
            "id": self._request_id,
            "method": method,
            "params": params,
        }

        response = self._client.post(
            self.paymaster_url,
            json=request,
            headers={"Content-Type": "application/json"}
        )

        if response.status_code != 200:
            raise PaymasterError(f"HTTP error {response.status_code}: {response.text}")

        data = response.json()

        if "error" in data and data["error"]:
            error = data["error"]
            raise PaymasterError(
                error.get("message", "Unknown error"),
                code=error.get("code"),
                data=error.get("data")
            )

        return data.get("result")


class BiconomyPaymaster(PaymasterClient):
    """Biconomy paymaster client."""

    def __init__(
        self,
        api_key: str,
        chain_id: int,
        paymaster_url: str,
        mode: str = "sponsored"  # "sponsored" or "erc20"
    ):
        self.api_key = api_key
        self.chain_id = chain_id
        self.paymaster_url = paymaster_url
        self.mode = mode
        self._request_id = 0
        self._client = httpx.Client(timeout=30.0)

    def get_paymaster_data(
        self,
        user_op: UserOperation,
        chain_id: int,
        entry_point: str
    ) -> PaymasterData:
        """Get paymaster data for sponsorship."""
        packed = _pack_user_op_for_paymaster(user_op)

        request_data = {
            "method": "pm_sponsorUserOperation",
            "userOperation": packed,
            "entryPoint": entry_point,
            "chainId": chain_id,
            "mode": self.mode,
        }

        result = self._rpc_call("pm_sponsorUserOperation", [request_data])

        return self._parse_paymaster_response(result)

    def will_sponsor(
        self,
        user_op: UserOperation,
        chain_id: int,
        entry_point: str
    ) -> bool:
        """Check if the paymaster will sponsor this operation."""
        try:
            self.get_paymaster_data(user_op, chain_id, entry_point)
            return True
        except PaymasterError:
            return False

    def get_fee_quotes(
        self,
        user_op: UserOperation,
        tokens: List[str]
    ) -> List[TokenQuote]:
        """Get fee quotes for ERC20 token payment."""
        packed = _pack_user_op_for_paymaster(user_op)

        result = self._rpc_call("pm_getFeeQuotes", [packed, tokens])

        quotes = []
        for r in result:
            quotes.append(TokenQuote(
                token=r.get("token", ""),
                symbol=r.get("symbol", ""),
                decimals=r.get("decimals", 18),
                fee=int(r.get("fee", "0x0"), 16),
                exchange_rate=int(r.get("exchangeRate", "0x0"), 16),
            ))

        return quotes

    def check_sponsorship(
        self,
        user_op: UserOperation,
        entry_point: str
    ) -> bool:
        """Check if the operation can be sponsored."""
        packed = _pack_user_op_for_paymaster(user_op)

        try:
            result = self._rpc_call("pm_checkSponsorship", [packed, entry_point])
            return result.get("isSponsored", False)
        except PaymasterError:
            return False

    def _parse_paymaster_response(self, result: Dict[str, Any]) -> PaymasterData:
        """Parse paymaster response into PaymasterData."""
        if result.get("paymaster"):
            return PaymasterData(
                paymaster=result["paymaster"],
                paymaster_verification_gas_limit=int(result.get("paymasterVerificationGasLimit", "0x0"), 16),
                paymaster_post_op_gas_limit=int(result.get("paymasterPostOpGasLimit", "0x0"), 16),
                paymaster_data=bytes.fromhex(result.get("paymasterData", "0x")[2:]) if result.get("paymasterData") else b"",
            )

        paymaster_and_data = result.get("paymasterAndData", "0x")
        if paymaster_and_data and paymaster_and_data != "0x":
            data = bytes.fromhex(paymaster_and_data[2:])
            if len(data) >= 20:
                return PaymasterData(
                    paymaster="0x" + data[:20].hex(),
                    paymaster_data=data[20:] if len(data) > 20 else b"",
                )

        raise PaymasterError("Invalid paymaster response")

    def _rpc_call(self, method: str, params: List[Any]) -> Any:
        """Make a JSON-RPC call to the paymaster."""
        self._request_id += 1

        request = {
            "jsonrpc": "2.0",
            "id": self._request_id,
            "method": method,
            "params": params,
        }

        response = self._client.post(
            self.paymaster_url,
            json=request,
            headers={
                "Content-Type": "application/json",
                "x-api-key": self.api_key,
            }
        )

        if response.status_code != 200:
            raise PaymasterError(f"HTTP error {response.status_code}: {response.text}")

        data = response.json()

        if "error" in data and data["error"]:
            error = data["error"]
            raise PaymasterError(
                error.get("message", "Unknown error"),
                code=error.get("code"),
                data=error.get("data")
            )

        return data.get("result")


class StackupPaymaster(PaymasterClient):
    """Stackup paymaster client."""

    def __init__(
        self,
        api_key: str,
        chain_id: int,
        paymaster_url: str,
        paymaster_type: Optional[str] = None
    ):
        self.api_key = api_key
        self.chain_id = chain_id
        self.paymaster_url = paymaster_url
        self.paymaster_type = paymaster_type
        self._request_id = 0
        self._client = httpx.Client(timeout=30.0)

    def get_paymaster_data(
        self,
        user_op: UserOperation,
        chain_id: int,
        entry_point: str
    ) -> PaymasterData:
        """Get paymaster data for sponsorship."""
        packed = _pack_user_op_for_paymaster(user_op)

        context: Dict[str, Any] = {}
        if self.paymaster_type:
            context["type"] = self.paymaster_type

        result = self._rpc_call("pm_getPaymasterStubData", [
            packed,
            entry_point,
            hex(chain_id),
            context
        ])

        return self._parse_paymaster_response(result)

    def will_sponsor(
        self,
        user_op: UserOperation,
        chain_id: int,
        entry_point: str
    ) -> bool:
        """Check if the paymaster will sponsor this operation."""
        try:
            self.get_paymaster_data(user_op, chain_id, entry_point)
            return True
        except PaymasterError:
            return False

    def _parse_paymaster_response(self, result: Dict[str, Any]) -> PaymasterData:
        """Parse paymaster response into PaymasterData."""
        if result.get("paymaster"):
            return PaymasterData(
                paymaster=result["paymaster"],
                paymaster_verification_gas_limit=int(result.get("paymasterVerificationGasLimit", "0x0"), 16),
                paymaster_post_op_gas_limit=int(result.get("paymasterPostOpGasLimit", "0x0"), 16),
                paymaster_data=bytes.fromhex(result.get("paymasterData", "0x")[2:]) if result.get("paymasterData") else b"",
            )

        paymaster_and_data = result.get("paymasterAndData", "0x")
        if paymaster_and_data and paymaster_and_data != "0x":
            data = bytes.fromhex(paymaster_and_data[2:])
            if len(data) >= 20:
                return PaymasterData(
                    paymaster="0x" + data[:20].hex(),
                    paymaster_data=data[20:] if len(data) > 20 else b"",
                )

        raise PaymasterError("Invalid paymaster response")

    def _rpc_call(self, method: str, params: List[Any]) -> Any:
        """Make a JSON-RPC call to the paymaster."""
        self._request_id += 1

        request = {
            "jsonrpc": "2.0",
            "id": self._request_id,
            "method": method,
            "params": params,
        }

        response = self._client.post(
            self.paymaster_url,
            json=request,
            headers={
                "Content-Type": "application/json",
                "Authorization": f"Bearer {self.api_key}",
            }
        )

        if response.status_code != 200:
            raise PaymasterError(f"HTTP error {response.status_code}: {response.text}")

        data = response.json()

        if "error" in data and data["error"]:
            error = data["error"]
            raise PaymasterError(
                error.get("message", "Unknown error"),
                code=error.get("code"),
                data=error.get("data")
            )

        return data.get("result")


def create_paymaster(
    provider: str,
    api_key: str,
    chain_id: int,
    **kwargs
) -> PaymasterClient:
    """Factory function to create a paymaster client."""
    if provider == "pimlico":
        return PimlicoPaymaster(
            api_key=api_key,
            chain_id=chain_id,
            paymaster_url=kwargs.get("paymaster_url"),
            entry_point=kwargs.get("entry_point", ENTRYPOINT_V07_ADDRESS),
            sponsorship_policy_id=kwargs.get("sponsorship_policy_id")
        )
    elif provider == "biconomy":
        return BiconomyPaymaster(
            api_key=api_key,
            chain_id=chain_id,
            paymaster_url=kwargs.get("paymaster_url", ""),
            mode=kwargs.get("mode", "sponsored")
        )
    elif provider == "stackup":
        return StackupPaymaster(
            api_key=api_key,
            chain_id=chain_id,
            paymaster_url=kwargs.get("paymaster_url", ""),
            paymaster_type=kwargs.get("paymaster_type")
        )
    else:
        raise PaymasterError(f"Unknown paymaster provider: {provider}")


class UnifiedPaymaster:
    """Unified paymaster that tries multiple providers."""

    def __init__(self, paymasters: List[PaymasterClient]):
        self.paymasters = paymasters

    def get_paymaster_data(
        self,
        user_op: UserOperation,
        chain_id: int,
        entry_point: str
    ) -> PaymasterData:
        """Try each paymaster until one succeeds."""
        last_error: Optional[Exception] = None

        for paymaster in self.paymasters:
            try:
                return paymaster.get_paymaster_data(user_op, chain_id, entry_point)
            except PaymasterError as e:
                last_error = e
                continue

        raise PaymasterError(
            f"All paymasters failed. Last error: {last_error}"
        )

    def will_sponsor(
        self,
        user_op: UserOperation,
        chain_id: int,
        entry_point: str
    ) -> bool:
        """Check if any paymaster will sponsor."""
        for paymaster in self.paymasters:
            if paymaster.will_sponsor(user_op, chain_id, entry_point):
                return True
        return False
