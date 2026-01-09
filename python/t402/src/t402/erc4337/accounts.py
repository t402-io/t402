"""
ERC-4337 Smart Account Implementations for T402

This module provides smart account implementations for ERC-4337,
including Safe smart account with 4337 module support.
"""

from dataclasses import dataclass
from typing import Optional, List, Tuple
from abc import ABC, abstractmethod
from eth_account import Account
from eth_account.messages import encode_defunct
from eth_utils import keccak

from .types import (
    ENTRYPOINT_V07_ADDRESS,
    SAFE_4337_ADDRESSES,
)


class SmartAccountError(Exception):
    """Error from smart account operations."""
    pass


class SmartAccountSigner(ABC):
    """Abstract interface for smart account signers."""

    @abstractmethod
    def get_address(self) -> str:
        """Get the smart account address."""
        pass

    @abstractmethod
    def sign_user_op_hash(self, user_op_hash: bytes) -> bytes:
        """Sign a UserOperation hash."""
        pass

    @abstractmethod
    def get_init_code(self) -> bytes:
        """Get the account's init code for deployment."""
        pass

    @abstractmethod
    def is_deployed(self) -> bool:
        """Check if the account is deployed."""
        pass

    @abstractmethod
    def encode_execute(self, target: str, value: int, data: bytes) -> bytes:
        """Encode a call to the account's execute function."""
        pass

    @abstractmethod
    def encode_execute_batch(
        self,
        targets: List[str],
        values: List[int],
        datas: List[bytes]
    ) -> bytes:
        """Encode a batch call to the account's executeBatch function."""
        pass


@dataclass
class SafeAccountConfig:
    """Configuration for Safe smart account."""
    owner_private_key: str
    chain_id: int
    salt: int = 0
    entry_point: str = ENTRYPOINT_V07_ADDRESS
    threshold: int = 1


class SafeSmartAccount(SmartAccountSigner):
    """Safe smart account implementation for ERC-4337."""

    # MultiSend library address (v1.3.0)
    MULTI_SEND_ADDRESS = "0x38869bf66a61cF6bDB996A6aE40D5853Fd43B526"

    def __init__(self, config: SafeAccountConfig):
        self.owner_account = Account.from_key(config.owner_private_key)
        self.owner_address = self.owner_account.address
        self.chain_id = config.chain_id
        self.salt = config.salt
        self.entry_point = config.entry_point
        self.threshold = config.threshold

        self._cached_address: Optional[str] = None
        self._cached_init_code: Optional[bytes] = None

    def get_address(self) -> str:
        """Get the counterfactual Safe address."""
        if self._cached_address:
            return self._cached_address

        # Calculate counterfactual address via CREATE2
        init_code = self.get_init_code()

        factory_address = bytes.fromhex(SAFE_4337_ADDRESSES["proxy_factory"][2:])
        salt_hash = self._calculate_salt()
        proxy_init_code = self._get_proxy_creation_code()
        init_code_hash = keccak(proxy_init_code)

        # CREATE2 address: keccak256(0xff ++ factory ++ salt ++ keccak256(initCode))[12:]
        data = bytes([0xff]) + factory_address + salt_hash + init_code_hash
        address_hash = keccak(data)

        self._cached_address = "0x" + address_hash[12:].hex()
        return self._cached_address

    def sign_user_op_hash(self, user_op_hash: bytes) -> bytes:
        """Sign a UserOperation hash."""
        # For Safe 4337, we sign with Ethereum signed message prefix
        message_hash = self._get_safe_user_op_hash(user_op_hash)

        # Sign with owner key
        signed = self.owner_account.sign_message(
            encode_defunct(primitive=message_hash)
        )

        return signed.signature

    def get_init_code(self) -> bytes:
        """Get the init code for deploying the Safe."""
        if self._cached_init_code:
            return self._cached_init_code

        factory_address = bytes.fromhex(SAFE_4337_ADDRESSES["proxy_factory"][2:])

        # Build the initializer data for Safe setup
        initializer = self._build_initializer()

        # Encode createProxyWithNonce call
        # Function selector: 0x1688f0b9
        selector = bytes.fromhex("1688f0b9")

        # ABI encode the parameters
        singleton = bytes.fromhex(SAFE_4337_ADDRESSES["singleton"][2:])
        encoded = self._encode_create_proxy_with_nonce(singleton, initializer, self.salt)

        self._cached_init_code = factory_address + selector + encoded
        return self._cached_init_code

    def is_deployed(self) -> bool:
        """Check if the account is deployed."""
        # This would require an RPC call to check code at address
        # For now, return False (caller should check via eth_getCode)
        return False

    def encode_execute(self, target: str, value: int, data: bytes) -> bytes:
        """Encode a call to Safe's executeUserOp function."""
        # Function: executeUserOp(address to, uint256 value, bytes data, uint8 operation)
        # Selector: 0x541d63c8
        selector = bytes.fromhex("541d63c8")

        # Operation 0 = CALL
        operation = 0

        encoded = self._encode_execute_user_op(target, value, data, operation)

        return selector + encoded

    def encode_execute_batch(
        self,
        targets: List[str],
        values: List[int],
        datas: List[bytes]
    ) -> bytes:
        """Encode a batch call using multiSend."""
        if len(targets) != len(values) or len(targets) != len(datas):
            raise SmartAccountError("targets, values, and datas must have same length")

        # Build multiSend data
        multi_send_data = b""
        for target, value, data in zip(targets, values, datas):
            tx_data = self._encode_multi_send_tx(target, value, data)
            multi_send_data += tx_data

        # Encode multiSend(bytes transactions)
        # Selector: 0x8d80ff0a
        multi_send_selector = bytes.fromhex("8d80ff0a")
        multi_send_call = self._encode_bytes(multi_send_data)
        multi_send_calldata = multi_send_selector + multi_send_call

        # Execute via Safe 4337 module with DELEGATECALL (operation = 1)
        selector = bytes.fromhex("541d63c8")  # executeUserOp
        operation = 1  # DELEGATECALL

        encoded = self._encode_execute_user_op(
            self.MULTI_SEND_ADDRESS,
            0,
            multi_send_calldata,
            operation
        )

        return selector + encoded

    def _build_initializer(self) -> bytes:
        """Build the Safe setup initializer data."""
        # Safe.setup(
        #   address[] _owners,
        #   uint256 _threshold,
        #   address to,
        #   bytes data,
        #   address fallbackHandler,
        #   address paymentToken,
        #   uint256 payment,
        #   address paymentReceiver
        # )
        # Selector: 0xb63e800d

        selector = bytes.fromhex("b63e800d")

        owners = [self.owner_address]
        threshold = self.threshold

        # to = AddModulesLib to enable 4337 module
        to_address = SAFE_4337_ADDRESSES["add_modules_lib"]

        # data = enableModules([Safe4337Module])
        module_setup_data = self._encode_enable_modules([SAFE_4337_ADDRESSES["module"]])

        fallback_handler = SAFE_4337_ADDRESSES["fallback_handler"]
        payment_token = "0x" + "00" * 20
        payment = 0
        payment_receiver = "0x" + "00" * 20

        encoded = self._encode_setup(
            owners,
            threshold,
            to_address,
            module_setup_data,
            fallback_handler,
            payment_token,
            payment,
            payment_receiver
        )

        return selector + encoded

    def _calculate_salt(self) -> bytes:
        """Calculate the CREATE2 salt."""
        # Salt = keccak256(keccak256(initializer) ++ saltNonce)
        initializer = self._build_initializer()
        init_hash = keccak(initializer)

        salt_bytes = self.salt.to_bytes(32, 'big')
        salt_data = init_hash + salt_bytes

        return keccak(salt_data)

    def _get_proxy_creation_code(self) -> bytes:
        """Get the proxy creation code."""
        # This is simplified - actual implementation would use the real Safe proxy bytecode
        singleton = bytes.fromhex(SAFE_4337_ADDRESSES["singleton"][2:])

        # Simplified proxy creation code
        # In production, this should match the actual Safe proxy bytecode
        code = bytes([0x60, 0x20])  # PUSH1 0x20
        code += singleton

        return code

    def _get_safe_user_op_hash(self, user_op_hash: bytes) -> bytes:
        """Create the Safe-specific user op hash for signing."""
        # For EOA owners, we just return the userOpHash directly
        # The Safe module verifies using ecrecover
        return user_op_hash

    def _encode_create_proxy_with_nonce(
        self,
        singleton: bytes,
        initializer: bytes,
        salt_nonce: int
    ) -> bytes:
        """ABI encode createProxyWithNonce parameters."""
        # (address, bytes, uint256)
        result = b""

        # singleton address (padded to 32 bytes)
        result += singleton.rjust(32, b"\x00")

        # offset to initializer bytes (96)
        result += (96).to_bytes(32, 'big')

        # saltNonce
        result += salt_nonce.to_bytes(32, 'big')

        # initializer bytes
        result += self._encode_bytes(initializer)

        return result

    def _encode_execute_user_op(
        self,
        to: str,
        value: int,
        data: bytes,
        operation: int
    ) -> bytes:
        """ABI encode executeUserOp parameters."""
        # (address, uint256, bytes, uint8)
        result = b""

        # to address
        to_bytes = bytes.fromhex(to[2:]) if to.startswith("0x") else bytes.fromhex(to)
        result += to_bytes.rjust(32, b"\x00")

        # value
        result += value.to_bytes(32, 'big')

        # offset to data bytes (128)
        result += (128).to_bytes(32, 'big')

        # operation
        result += operation.to_bytes(32, 'big')

        # data bytes
        result += self._encode_bytes(data)

        return result

    def _encode_bytes(self, data: bytes) -> bytes:
        """ABI encode bytes type."""
        # length + padded data
        length = len(data)
        padded_length = ((length + 31) // 32) * 32

        result = length.to_bytes(32, 'big')
        result += data.ljust(padded_length, b"\x00")

        return result

    def _encode_setup(
        self,
        owners: List[str],
        threshold: int,
        to: str,
        data: bytes,
        fallback_handler: str,
        payment_token: str,
        payment: int,
        payment_receiver: str
    ) -> bytes:
        """ABI encode Safe.setup parameters."""
        result = b""

        # Calculate offsets
        owners_encoded_len = 32 + 32 * len(owners)  # length + addresses
        data_offset = 256 + owners_encoded_len

        # offset to owners array (256)
        result += (256).to_bytes(32, 'big')

        # threshold
        result += threshold.to_bytes(32, 'big')

        # to
        to_bytes = bytes.fromhex(to[2:]) if to.startswith("0x") else bytes.fromhex(to)
        result += to_bytes.rjust(32, b"\x00")

        # data offset
        result += data_offset.to_bytes(32, 'big')

        # fallbackHandler
        fh_bytes = bytes.fromhex(fallback_handler[2:]) if fallback_handler.startswith("0x") else bytes.fromhex(fallback_handler)
        result += fh_bytes.rjust(32, b"\x00")

        # paymentToken
        pt_bytes = bytes.fromhex(payment_token[2:]) if payment_token.startswith("0x") else bytes.fromhex(payment_token)
        result += pt_bytes.rjust(32, b"\x00")

        # payment
        result += payment.to_bytes(32, 'big')

        # paymentReceiver
        pr_bytes = bytes.fromhex(payment_receiver[2:]) if payment_receiver.startswith("0x") else bytes.fromhex(payment_receiver)
        result += pr_bytes.rjust(32, b"\x00")

        # owners array
        result += len(owners).to_bytes(32, 'big')
        for owner in owners:
            owner_bytes = bytes.fromhex(owner[2:]) if owner.startswith("0x") else bytes.fromhex(owner)
            result += owner_bytes.rjust(32, b"\x00")

        # data bytes
        result += self._encode_bytes(data)

        return result

    def _encode_enable_modules(self, modules: List[str]) -> bytes:
        """ABI encode enableModules call."""
        # enableModules(address[])
        # Selector: 0xa3f4df7e
        selector = bytes.fromhex("a3f4df7e")

        # offset to array (32)
        encoded = (32).to_bytes(32, 'big')

        # array length
        encoded += len(modules).to_bytes(32, 'big')

        # array elements
        for module in modules:
            module_bytes = bytes.fromhex(module[2:]) if module.startswith("0x") else bytes.fromhex(module)
            encoded += module_bytes.rjust(32, b"\x00")

        return selector + encoded

    def _encode_multi_send_tx(self, to: str, value: int, data: bytes) -> bytes:
        """Encode a single transaction for multiSend."""
        # operation (1) + to (20) + value (32) + dataLength (32) + data
        result = bytes([0])  # CALL operation

        to_bytes = bytes.fromhex(to[2:]) if to.startswith("0x") else bytes.fromhex(to)
        result += to_bytes

        result += value.to_bytes(32, 'big')
        result += len(data).to_bytes(32, 'big')
        result += data

        return result


def create_smart_account(
    account_type: str,
    config: SafeAccountConfig
) -> SmartAccountSigner:
    """Factory function to create a smart account."""
    if account_type == "safe":
        return SafeSmartAccount(config)
    else:
        raise SmartAccountError(f"Unknown smart account type: {account_type}")
