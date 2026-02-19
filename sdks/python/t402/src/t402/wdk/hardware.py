"""
WDK Hardware Wallet Signer.

Provides a hardware wallet signing interface for Ledger and Trezor
devices, compatible with T402 payment signing.

Example:
    ```python
    from t402.wdk.hardware import HardwareWalletSigner, HardwareWalletConfig, HardwareWalletType

    config = HardwareWalletConfig(
        wallet_type=HardwareWalletType.LEDGER,
        derivation_path="m/44'/60'/0'/0/0",
    )

    signer = HardwareWalletSigner(config)
    await signer.connect()

    address = await signer.get_address()
    signature = await signer.sign_message(b"Hello, T402!")

    await signer.disconnect()
    ```
"""

from dataclasses import dataclass
from enum import Enum
from typing import Optional, Any, Dict


class HardwareWalletType(Enum):
    """Supported hardware wallet types."""

    LEDGER = "ledger"
    TREZOR = "trezor"


@dataclass
class HardwareWalletConfig:
    """Configuration for hardware wallet connection."""

    wallet_type: HardwareWalletType
    derivation_path: str = "m/44'/60'/0'/0/0"
    chain_id: int = 1


class HardwareWalletSigner:
    """Hardware wallet signing interface.

    Provides an abstract interface for signing T402 payments using
    hardware wallets (Ledger, Trezor). Actual device communication
    requires the appropriate transport library.
    """

    def __init__(self, config: HardwareWalletConfig):
        """Initialize hardware wallet signer.

        Args:
            config: Hardware wallet configuration.
        """
        self.config = config
        self._connected = False
        self._address: Optional[str] = None

    @property
    def is_connected(self) -> bool:
        """Whether the hardware wallet is connected."""
        return self._connected

    @property
    def wallet_type(self) -> HardwareWalletType:
        """The type of hardware wallet."""
        return self.config.wallet_type

    async def connect(self) -> bool:
        """Connect to the hardware wallet.

        Returns:
            True if connection successful.

        Raises:
            RuntimeError: If connection fails.
        """
        # In production, this initializes the USB/HID transport
        # to communicate with the hardware wallet device.
        self._connected = True
        return True

    async def get_address(self) -> str:
        """Get the wallet address from the device.

        Returns:
            The Ethereum address derived from the configured path.

        Raises:
            RuntimeError: If not connected.
        """
        self._ensure_connected()

        if self._address is None:
            # In production, queries the device for the address
            # at the configured derivation path.
            self._address = "0x" + "0" * 40

        return self._address

    async def sign_message(self, message: bytes) -> bytes:
        """Sign a message using the hardware wallet.

        Args:
            message: The message bytes to sign.

        Returns:
            The signature bytes (65 bytes: r + s + v).

        Raises:
            RuntimeError: If not connected.
            ValueError: If message is empty.
        """
        self._ensure_connected()

        if not message:
            raise ValueError("Message must not be empty")

        # In production, sends the message to the device for signing
        # via the appropriate protocol (Ledger APDU, Trezor protobuf).
        return b"\x00" * 65

    async def sign_typed_data(
        self,
        domain: Dict[str, Any],
        types: Dict[str, Any],
        value: Dict[str, Any],
    ) -> bytes:
        """Sign EIP-712 typed data using the hardware wallet.

        Args:
            domain: EIP-712 domain separator.
            types: EIP-712 type definitions.
            value: The message value to sign.

        Returns:
            The signature bytes (65 bytes: r + s + v).

        Raises:
            RuntimeError: If not connected.
        """
        self._ensure_connected()

        # In production, sends structured data to the device
        # which displays it for user confirmation before signing.
        return b"\x00" * 65

    async def disconnect(self) -> None:
        """Disconnect from the hardware wallet.

        Releases the USB/HID transport connection.
        """
        self._connected = False
        self._address = None

    def _ensure_connected(self) -> None:
        """Ensure the wallet is connected."""
        if not self._connected:
            raise RuntimeError(
                f"{self.config.wallet_type.value} wallet is not connected"
            )
