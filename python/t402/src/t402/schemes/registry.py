"""Scheme Registry for T402 Protocol.

This module provides the SchemeRegistry class for managing payment scheme
implementations across different blockchain networks and protocol versions.

The registry supports:
- Registering schemes by network (exact match) or network pattern (wildcards)
- Looking up schemes by network and scheme name
- Separate registries for client, server, and facilitator schemes
"""

from __future__ import annotations

import re
import threading
from typing import (
    Any,
    Dict,
    Generic,
    List,
    Optional,
    TypeVar,
)

from t402.types import (
    Network,
    T402_VERSION_V1,
    T402_VERSION_V2,
)
from t402.schemes.interfaces import (
    SchemeNetworkClient,
    SchemeNetworkServer,
    SchemeNetworkFacilitator,
)

# Type variable for generic scheme types
T = TypeVar("T")


def _matches_network_pattern(pattern: str, network: str) -> bool:
    """Check if a network matches a pattern.

    Supports:
    - Exact match: "eip155:8453" matches "eip155:8453"
    - Wildcard: "eip155:*" matches any "eip155:..." network
    - Full wildcard: "*" matches any network

    Args:
        pattern: Network pattern (may include wildcards)
        network: Actual network identifier

    Returns:
        True if network matches pattern
    """
    if pattern == "*":
        return True

    if "*" in pattern:
        # Convert glob pattern to regex
        # e.g., "eip155:*" -> "^eip155:.*$"
        regex_pattern = "^" + pattern.replace("*", ".*") + "$"
        return bool(re.match(regex_pattern, network))

    return pattern == network


def _extract_caip_family(network: str) -> str:
    """Extract CAIP-2 family from network identifier.

    Args:
        network: Network identifier (e.g., "eip155:8453", "solana:mainnet")

    Returns:
        Family pattern (e.g., "eip155:*", "solana:*")
    """
    if ":" in network:
        namespace = network.split(":")[0]
        return f"{namespace}:*"
    return network


class SchemeRegistry(Generic[T]):
    """Registry for managing payment scheme implementations.

    This class provides a thread-safe registry for registering and looking up
    payment scheme implementations. Schemes can be registered with exact network
    identifiers or wildcard patterns.

    The registry is organized by:
    - Protocol version (V1 or V2)
    - Network identifier or pattern
    - Scheme name

    Example:
        ```python
        registry = SchemeRegistry[SchemeNetworkClient]()

        # Register for exact network
        registry.register("eip155:8453", evm_client)

        # Register with wildcard (all EVM networks)
        registry.register("eip155:*", evm_client)

        # Look up scheme
        client = registry.get("eip155:8453", "exact")
        ```
    """

    def __init__(self, default_version: int = T402_VERSION_V2):
        """Initialize the registry.

        Args:
            default_version: Default protocol version for registrations
        """
        self._default_version = default_version
        self._lock = threading.RLock()

        # Structure: {version: {network_pattern: {scheme: implementation}}}
        self._schemes: Dict[int, Dict[str, Dict[str, T]]] = {
            T402_VERSION_V1: {},
            T402_VERSION_V2: {},
        }

        # Cache for pattern-based lookups
        self._patterns: Dict[int, List[str]] = {
            T402_VERSION_V1: [],
            T402_VERSION_V2: [],
        }

    def register(
        self,
        network: Network,
        scheme: T,
        version: Optional[int] = None,
    ) -> "SchemeRegistry[T]":
        """Register a scheme for a network.

        Args:
            network: Network identifier or pattern (e.g., "eip155:8453" or "eip155:*")
            scheme: Scheme implementation (must have 'scheme' attribute)
            version: Protocol version (defaults to current default)

        Returns:
            Self for chaining

        Raises:
            ValueError: If scheme doesn't have 'scheme' attribute
        """
        if not hasattr(scheme, "scheme"):
            raise ValueError("Scheme must have 'scheme' attribute")

        scheme_name = scheme.scheme
        v = version or self._default_version

        with self._lock:
            if v not in self._schemes:
                self._schemes[v] = {}
                self._patterns[v] = []

            if network not in self._schemes[v]:
                self._schemes[v][network] = {}

            self._schemes[v][network][scheme_name] = scheme

            # Track patterns for wildcard matching
            if "*" in network and network not in self._patterns[v]:
                self._patterns[v].append(network)

        return self

    def register_v1(
        self,
        network: Network,
        scheme: T,
    ) -> "SchemeRegistry[T]":
        """Register a scheme for V1 protocol.

        Args:
            network: V1 network identifier (e.g., "base-sepolia")
            scheme: Scheme implementation

        Returns:
            Self for chaining
        """
        return self.register(network, scheme, T402_VERSION_V1)

    def register_v2(
        self,
        network: Network,
        scheme: T,
    ) -> "SchemeRegistry[T]":
        """Register a scheme for V2 protocol.

        Args:
            network: V2 network identifier (CAIP-2 format)
            scheme: Scheme implementation

        Returns:
            Self for chaining
        """
        return self.register(network, scheme, T402_VERSION_V2)

    def get(
        self,
        network: Network,
        scheme_name: str,
        version: Optional[int] = None,
    ) -> Optional[T]:
        """Get a scheme for a specific network and scheme name.

        Lookup order:
        1. Exact network match
        2. Pattern match (e.g., "eip155:*" for "eip155:8453")

        Args:
            network: Network identifier
            scheme_name: Scheme name (e.g., "exact")
            version: Protocol version (defaults to current default)

        Returns:
            Scheme implementation or None if not found
        """
        v = version or self._default_version

        with self._lock:
            if v not in self._schemes:
                return None

            # Try exact match first
            if network in self._schemes[v]:
                schemes = self._schemes[v][network]
                if scheme_name in schemes:
                    return schemes[scheme_name]

            # Try pattern matching
            for pattern in self._patterns.get(v, []):
                if _matches_network_pattern(pattern, network):
                    schemes = self._schemes[v].get(pattern, {})
                    if scheme_name in schemes:
                        return schemes[scheme_name]

            return None

    def get_for_network(
        self,
        network: Network,
        version: Optional[int] = None,
    ) -> Dict[str, T]:
        """Get all schemes registered for a network.

        Args:
            network: Network identifier
            version: Protocol version

        Returns:
            Dict of scheme_name -> scheme implementation
        """
        v = version or self._default_version
        result: Dict[str, T] = {}

        with self._lock:
            if v not in self._schemes:
                return result

            # Exact match
            if network in self._schemes[v]:
                result.update(self._schemes[v][network])

            # Pattern matches
            for pattern in self._patterns.get(v, []):
                if _matches_network_pattern(pattern, network):
                    # Don't override exact matches
                    for scheme_name, scheme in self._schemes[v].get(pattern, {}).items():
                        if scheme_name not in result:
                            result[scheme_name] = scheme

            return result

    def has_scheme(
        self,
        network: Network,
        scheme_name: str,
        version: Optional[int] = None,
    ) -> bool:
        """Check if a scheme is registered for a network.

        Args:
            network: Network identifier
            scheme_name: Scheme name
            version: Protocol version

        Returns:
            True if scheme is registered
        """
        return self.get(network, scheme_name, version) is not None

    def get_registered_networks(
        self,
        version: Optional[int] = None,
    ) -> List[str]:
        """Get all registered network patterns.

        Args:
            version: Protocol version

        Returns:
            List of network identifiers/patterns
        """
        v = version or self._default_version

        with self._lock:
            return list(self._schemes.get(v, {}).keys())

    def get_registered_schemes(
        self,
        network: Network,
        version: Optional[int] = None,
    ) -> List[str]:
        """Get all scheme names registered for a network.

        Args:
            network: Network identifier
            version: Protocol version

        Returns:
            List of scheme names
        """
        schemes = self.get_for_network(network, version)
        return list(schemes.keys())

    def clear(self, version: Optional[int] = None) -> None:
        """Clear all registered schemes.

        Args:
            version: If provided, only clear that version. Otherwise clear all.
        """
        with self._lock:
            if version is not None:
                self._schemes[version] = {}
                self._patterns[version] = []
            else:
                for v in self._schemes:
                    self._schemes[v] = {}
                    self._patterns[v] = []


class ClientSchemeRegistry(SchemeRegistry[SchemeNetworkClient]):
    """Registry specifically for client schemes."""

    pass


class ServerSchemeRegistry(SchemeRegistry[SchemeNetworkServer]):
    """Registry specifically for server schemes."""

    pass


class FacilitatorSchemeRegistry(SchemeRegistry[SchemeNetworkFacilitator]):
    """Registry specifically for facilitator schemes.

    Provides additional methods for building /supported responses.
    """

    def get_supported_kinds(
        self,
        version: int = T402_VERSION_V2,
    ) -> List[Dict[str, Any]]:
        """Get all supported kinds for the /supported endpoint.

        Returns:
            List of SupportedKind dicts
        """
        result: List[Dict[str, Any]] = []

        with self._lock:
            for network, schemes in self._schemes.get(version, {}).items():
                # Skip wildcard patterns - they represent capabilities, not specific networks
                if "*" in network:
                    continue

                for scheme_name, scheme in schemes.items():
                    kind: Dict[str, Any] = {
                        "t402Version": version,
                        "scheme": scheme_name,
                        "network": network,
                    }

                    # Add extra data if available
                    if hasattr(scheme, "get_extra"):
                        extra = scheme.get_extra(network)
                        if extra:
                            kind["extra"] = extra

                    result.append(kind)

        return result

    def get_signers_by_family(
        self,
        version: int = T402_VERSION_V2,
    ) -> Dict[str, List[str]]:
        """Get signer addresses grouped by CAIP family.

        Returns:
            Dict of caip_family -> list of signer addresses
        """
        result: Dict[str, List[str]] = {}
        seen_schemes: Dict[str, set] = {}  # Track seen scheme instances by family

        with self._lock:
            for network, schemes in self._schemes.get(version, {}).items():
                for scheme_name, scheme in schemes.items():
                    if not hasattr(scheme, "caip_family") or not hasattr(scheme, "get_signers"):
                        continue

                    family = scheme.caip_family

                    # Initialize family tracking
                    if family not in result:
                        result[family] = []
                        seen_schemes[family] = set()

                    # Avoid duplicate signers from same scheme instance
                    scheme_id = id(scheme)
                    if scheme_id in seen_schemes[family]:
                        continue
                    seen_schemes[family].add(scheme_id)

                    # Get signers
                    try:
                        signers = scheme.get_signers(network)
                        for signer in signers:
                            if signer not in result[family]:
                                result[family].append(signer)
                    except Exception:
                        pass  # Ignore errors from get_signers

        return result


# Global registry instances (optional convenience)
_client_registry: Optional[ClientSchemeRegistry] = None
_server_registry: Optional[ServerSchemeRegistry] = None
_facilitator_registry: Optional[FacilitatorSchemeRegistry] = None


def get_client_registry() -> ClientSchemeRegistry:
    """Get the global client scheme registry."""
    global _client_registry
    if _client_registry is None:
        _client_registry = ClientSchemeRegistry()
    return _client_registry


def get_server_registry() -> ServerSchemeRegistry:
    """Get the global server scheme registry."""
    global _server_registry
    if _server_registry is None:
        _server_registry = ServerSchemeRegistry()
    return _server_registry


def get_facilitator_registry() -> FacilitatorSchemeRegistry:
    """Get the global facilitator scheme registry."""
    global _facilitator_registry
    if _facilitator_registry is None:
        _facilitator_registry = FacilitatorSchemeRegistry()
    return _facilitator_registry


def reset_global_registries() -> None:
    """Reset all global registries. Useful for testing."""
    global _client_registry, _server_registry, _facilitator_registry
    _client_registry = None
    _server_registry = None
    _facilitator_registry = None
