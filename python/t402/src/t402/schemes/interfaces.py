"""Scheme Interface Definitions for T402 Protocol.

This module defines the abstract interfaces for payment schemes in the T402 protocol.
Schemes implement these interfaces to provide payment functionality for specific
blockchain networks.

The three main interfaces are:
- SchemeNetworkClient: For clients creating payment payloads
- SchemeNetworkServer: For servers parsing prices and building requirements
- SchemeNetworkFacilitator: For facilitators verifying and settling payments
"""

from __future__ import annotations

from abc import ABC, abstractmethod
from typing import Any, Dict, List, Optional, Protocol, TypeVar, Union, runtime_checkable

from t402.types import (
    Network,
    PaymentRequirementsV2,
    PaymentPayloadV2,
    VerifyResponse,
    SettleResponse,
    T402_VERSION_V2,
)


# Type aliases for clarity
Price = Union[str, int, float, Dict[str, Any]]  # e.g., "$0.10", 0.10, {"amount": "100000", "asset": "..."}
AssetAmount = Dict[str, Any]  # {"amount": str, "asset": str, "extra"?: dict}
SupportedKindDict = Dict[str, Any]  # {"t402Version": int, "scheme": str, "network": str, "extra"?: dict}


@runtime_checkable
class SchemeNetworkClient(Protocol):
    """Protocol for client-side payment scheme implementations.

    Clients use this interface to create payment payloads when responding
    to 402 Payment Required responses.

    Attributes:
        scheme: The scheme identifier (e.g., "exact")

    Example:
        ```python
        class ExactEvmClientScheme:
            scheme = "exact"

            async def create_payment_payload(
                self,
                t402_version: int,
                requirements: PaymentRequirementsV2,
            ) -> Dict[str, Any]:
                # Sign EIP-3009 authorization
                signature = await self.signer.sign(...)
                return {
                    "t402Version": t402_version,
                    "payload": {"signature": signature, "authorization": {...}}
                }
        ```
    """

    @property
    def scheme(self) -> str:
        """The scheme identifier (e.g., 'exact', 'streaming')."""
        ...

    async def create_payment_payload(
        self,
        t402_version: int,
        requirements: Union[PaymentRequirementsV2, Dict[str, Any]],
    ) -> Dict[str, Any]:
        """Create a payment payload for the given requirements.

        This method should:
        1. Extract payment parameters from requirements
        2. Create and sign the appropriate authorization
        3. Return a partial PaymentPayload (t402Version + payload fields)

        Args:
            t402_version: The T402 protocol version
            requirements: The payment requirements to fulfill

        Returns:
            Dict containing at minimum:
            - t402Version: Protocol version
            - payload: Scheme-specific payload data

        Raises:
            ValueError: If requirements are invalid
            SigningError: If signing fails
        """
        ...


@runtime_checkable
class SchemeNetworkServer(Protocol):
    """Protocol for server-side payment scheme implementations.

    Servers use this interface to:
    - Parse user-friendly prices into atomic amounts
    - Enhance payment requirements with scheme-specific data

    Attributes:
        scheme: The scheme identifier (e.g., "exact")

    Example:
        ```python
        class ExactEvmServerScheme:
            scheme = "exact"

            async def parse_price(self, price: Price, network: Network) -> AssetAmount:
                # Convert "$0.10" to {"amount": "100000", "asset": "0xUSDC..."}
                ...

            async def enhance_requirements(
                self,
                requirements: PaymentRequirementsV2,
                supported_kind: SupportedKindDict,
                extensions: List[str],
            ) -> PaymentRequirementsV2:
                # Add EIP-712 domain info to extra
                ...
        ```
    """

    @property
    def scheme(self) -> str:
        """The scheme identifier (e.g., 'exact', 'streaming')."""
        ...

    async def parse_price(
        self,
        price: Price,
        network: Network,
    ) -> AssetAmount:
        """Convert a user-friendly price to atomic amount and asset.

        This method should:
        1. Parse the price (handling "$0.10", 0.10, or TokenAmount formats)
        2. Look up the appropriate token/asset for the network
        3. Convert to atomic units

        Args:
            price: User-friendly price (e.g., "$0.10", 0.10, or TokenAmount dict)
            network: The network identifier (CAIP-2 format)

        Returns:
            AssetAmount dict with:
            - amount: Atomic amount as string
            - asset: Asset/token address
            - extra: Optional extra metadata (e.g., decimals, symbol)

        Raises:
            ValueError: If price format is invalid or network unsupported
        """
        ...

    async def enhance_requirements(
        self,
        requirements: Union[PaymentRequirementsV2, Dict[str, Any]],
        supported_kind: SupportedKindDict,
        facilitator_extensions: List[str],
    ) -> Union[PaymentRequirementsV2, Dict[str, Any]]:
        """Enhance payment requirements with scheme-specific data.

        This method should add any scheme-specific metadata to the requirements
        that clients need to create valid payments (e.g., EIP-712 domain info,
        fee payer addresses, etc.).

        Args:
            requirements: Base payment requirements with amount/asset set
            supported_kind: The matched SupportedKind from facilitator
            facilitator_extensions: Extensions supported by the facilitator

        Returns:
            Enhanced PaymentRequirementsV2 with additional data in 'extra' field
        """
        ...


@runtime_checkable
class SchemeNetworkFacilitator(Protocol):
    """Protocol for facilitator-side payment scheme implementations.

    Facilitators use this interface to:
    - Verify payment signatures before granting access
    - Settle payments on-chain after successful delivery

    Attributes:
        scheme: The scheme identifier (e.g., "exact")
        caip_family: CAIP-2 family pattern (e.g., "eip155:*", "solana:*")

    Example:
        ```python
        class ExactEvmFacilitatorScheme:
            scheme = "exact"
            caip_family = "eip155:*"

            def get_signers(self, network: str) -> List[str]:
                return [self.signer.address]

            async def verify(self, payload, requirements) -> VerifyResponse:
                # Verify EIP-3009 signature
                ...

            async def settle(self, payload, requirements) -> SettleResponse:
                # Submit EIP-3009 transferWithAuthorization
                ...
        ```
    """

    @property
    def scheme(self) -> str:
        """The scheme identifier (e.g., 'exact', 'streaming')."""
        ...

    @property
    def caip_family(self) -> str:
        """CAIP-2 family pattern for network matching.

        Used to group signers by blockchain family in the supported response.

        Examples:
            - "eip155:*" for all EVM networks
            - "solana:*" for all Solana networks
            - "ton:*" for all TON networks
        """
        ...

    def get_extra(self, network: Network) -> Optional[Dict[str, Any]]:
        """Get mechanism-specific extra data for supported kinds.

        Called when building the facilitator's /supported response.
        Return None if no extra data is needed.

        Args:
            network: The network identifier

        Returns:
            Optional dict with extra metadata (e.g., {"feePayer": "..."})
        """
        ...

    def get_signers(self, network: Network) -> List[str]:
        """Get signer addresses for this facilitator.

        Returns addresses that may sign/pay for transactions on behalf
        of the facilitator. Used in the /supported response.

        Args:
            network: The network identifier

        Returns:
            List of signer addresses
        """
        ...

    async def verify(
        self,
        payload: Union[PaymentPayloadV2, Dict[str, Any]],
        requirements: Union[PaymentRequirementsV2, Dict[str, Any]],
    ) -> VerifyResponse:
        """Verify a payment payload against requirements.

        This method should:
        1. Validate the signature/authorization
        2. Check amount, recipient, and timing constraints
        3. Return verification result

        Args:
            payload: The payment payload to verify
            requirements: The payment requirements to verify against

        Returns:
            VerifyResponse indicating validity and payer address
        """
        ...

    async def settle(
        self,
        payload: Union[PaymentPayloadV2, Dict[str, Any]],
        requirements: Union[PaymentRequirementsV2, Dict[str, Any]],
    ) -> SettleResponse:
        """Settle a verified payment on-chain.

        This method should:
        1. Submit the payment transaction to the blockchain
        2. Wait for confirmation (or return pending status)
        3. Return settlement result

        Args:
            payload: The verified payment payload
            requirements: The payment requirements

        Returns:
            SettleResponse with transaction hash and status
        """
        ...


# Abstract Base Classes (for those who prefer inheritance)


class BaseSchemeNetworkClient(ABC):
    """Abstract base class for client schemes.

    Use this if you prefer inheritance over Protocol typing.
    """

    @property
    @abstractmethod
    def scheme(self) -> str:
        """The scheme identifier."""
        pass

    @abstractmethod
    async def create_payment_payload(
        self,
        t402_version: int,
        requirements: Union[PaymentRequirementsV2, Dict[str, Any]],
    ) -> Dict[str, Any]:
        """Create a payment payload."""
        pass


class BaseSchemeNetworkServer(ABC):
    """Abstract base class for server schemes.

    Use this if you prefer inheritance over Protocol typing.
    """

    @property
    @abstractmethod
    def scheme(self) -> str:
        """The scheme identifier."""
        pass

    @abstractmethod
    async def parse_price(
        self,
        price: Price,
        network: Network,
    ) -> AssetAmount:
        """Parse a price to atomic amount."""
        pass

    @abstractmethod
    async def enhance_requirements(
        self,
        requirements: Union[PaymentRequirementsV2, Dict[str, Any]],
        supported_kind: SupportedKindDict,
        facilitator_extensions: List[str],
    ) -> Union[PaymentRequirementsV2, Dict[str, Any]]:
        """Enhance payment requirements."""
        pass


class BaseSchemeNetworkFacilitator(ABC):
    """Abstract base class for facilitator schemes.

    Use this if you prefer inheritance over Protocol typing.
    """

    @property
    @abstractmethod
    def scheme(self) -> str:
        """The scheme identifier."""
        pass

    @property
    @abstractmethod
    def caip_family(self) -> str:
        """CAIP-2 family pattern."""
        pass

    def get_extra(self, network: Network) -> Optional[Dict[str, Any]]:
        """Get extra data for supported kinds. Override if needed."""
        return None

    @abstractmethod
    def get_signers(self, network: Network) -> List[str]:
        """Get signer addresses."""
        pass

    @abstractmethod
    async def verify(
        self,
        payload: Union[PaymentPayloadV2, Dict[str, Any]],
        requirements: Union[PaymentRequirementsV2, Dict[str, Any]],
    ) -> VerifyResponse:
        """Verify a payment."""
        pass

    @abstractmethod
    async def settle(
        self,
        payload: Union[PaymentPayloadV2, Dict[str, Any]],
        requirements: Union[PaymentRequirementsV2, Dict[str, Any]],
    ) -> SettleResponse:
        """Settle a payment."""
        pass
