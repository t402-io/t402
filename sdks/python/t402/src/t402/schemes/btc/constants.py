"""Bitcoin & Lightning Network constants for the T402 protocol.

This module contains network configurations, dust limits, fee constants,
and address validation utilities for Bitcoin on-chain and Lightning payments.
"""

from __future__ import annotations

from typing import List, Optional


# Scheme identifier
SCHEME_EXACT = "exact"

# CAIP-2 Network Identifiers for Bitcoin (BIP-122 genesis block hashes)
BTC_MAINNET = "bip122:000000000019d6689c085ae165831e93"
BTC_TESTNET = "bip122:000000000933ea01ad0ee984209779ba"
BTC_SIGNET = "bip122:00000008819873e925422c1ff0f99f7c"

# CAIP-2 Network Identifiers for Lightning Network
LIGHTNING_MAINNET = "lightning:mainnet"
LIGHTNING_TESTNET = "lightning:testnet"

# All supported BTC on-chain networks
BTC_NETWORKS: List[str] = [BTC_MAINNET, BTC_TESTNET, BTC_SIGNET]

# All supported Lightning networks
LIGHTNING_NETWORKS: List[str] = [LIGHTNING_MAINNET, LIGHTNING_TESTNET]

# All supported networks (on-chain + Lightning)
ALL_NETWORKS: List[str] = BTC_NETWORKS + LIGHTNING_NETWORKS

# Dust limit in satoshis - minimum viable output value
DUST_LIMIT = 546

# Minimum relay fee in satoshis
MIN_RELAY_FEE = 1000

# Satoshis per BTC
SATS_PER_BTC = 100_000_000

# Default timeout for payment validity (in seconds)
DEFAULT_VALIDITY_DURATION = 3600  # 1 hour

# Bitcoin address prefixes for basic validation
MAINNET_ADDRESS_PREFIXES = ["bc1", "1", "3"]
TESTNET_ADDRESS_PREFIXES = ["tb1", "m", "n", "2"]
SIGNET_ADDRESS_PREFIXES = ["tb1", "m", "n", "2"]  # Signet uses same prefixes as testnet

# CAIP family patterns
BTC_CAIP_FAMILY = "bip122:*"
LIGHTNING_CAIP_FAMILY = "lightning:*"


def is_valid_btc_network(network: str) -> bool:
    """Check if a network identifier is a supported BTC on-chain network.

    Args:
        network: The CAIP-2 network identifier.

    Returns:
        True if the network is a supported BTC on-chain network.
    """
    return network in BTC_NETWORKS


def is_valid_lightning_network(network: str) -> bool:
    """Check if a network identifier is a supported Lightning network.

    Args:
        network: The CAIP-2 network identifier.

    Returns:
        True if the network is a supported Lightning network.
    """
    return network in LIGHTNING_NETWORKS


def is_valid_network(network: str) -> bool:
    """Check if a network identifier is any supported BTC/Lightning network.

    Args:
        network: The CAIP-2 network identifier.

    Returns:
        True if the network is supported.
    """
    return network in ALL_NETWORKS


def validate_bitcoin_address(address: str) -> bool:
    """Validate a Bitcoin address (basic format validation).

    Checks address prefix against known formats:
    - Mainnet: bc1 (bech32), 1 (P2PKH), 3 (P2SH)
    - Testnet/Signet: tb1 (bech32), m/n (P2PKH), 2 (P2SH)

    Args:
        address: Bitcoin address to validate.

    Returns:
        True if the address has a valid format.
    """
    if not address or len(address) < 14 or len(address) > 90:
        return False

    all_prefixes = MAINNET_ADDRESS_PREFIXES + TESTNET_ADDRESS_PREFIXES
    return any(address.startswith(prefix) for prefix in all_prefixes)


def is_mainnet_address(address: str) -> bool:
    """Check if a Bitcoin address is for mainnet.

    Args:
        address: Bitcoin address.

    Returns:
        True if mainnet address.
    """
    return any(address.startswith(prefix) for prefix in MAINNET_ADDRESS_PREFIXES)


def is_testnet_address(address: str) -> bool:
    """Check if a Bitcoin address is for testnet/signet.

    Args:
        address: Bitcoin address.

    Returns:
        True if testnet/signet address.
    """
    return any(address.startswith(prefix) for prefix in TESTNET_ADDRESS_PREFIXES)


def validate_bolt11_invoice(invoice: str) -> bool:
    """Validate a BOLT11 Lightning invoice (basic format validation).

    BOLT11 invoices follow the format:
    - lnbc... for mainnet
    - lntb... for testnet
    - lnbcrt... for regtest

    Args:
        invoice: BOLT11 invoice string.

    Returns:
        True if the invoice has a valid format.
    """
    if not invoice or len(invoice) < 20:
        return False

    lower = invoice.lower()
    return lower.startswith("lnbc") or lower.startswith("lntb") or lower.startswith("lnbcrt")


def is_valid_hex(hex_str: str, expected_length: Optional[int] = None) -> bool:
    """Validate a hex-encoded string.

    Args:
        hex_str: String to validate.
        expected_length: Expected byte length (hex length / 2).

    Returns:
        True if valid hex of expected length.
    """
    if not hex_str:
        return False

    try:
        int(hex_str, 16)
    except ValueError:
        return False

    if expected_length is not None and len(hex_str) != expected_length * 2:
        return False

    return True


def satoshis_to_btc(sats: int) -> str:
    """Convert satoshis to BTC string representation.

    Args:
        sats: Amount in satoshis.

    Returns:
        Amount in BTC as string (to avoid floating point issues).
    """
    whole = sats // SATS_PER_BTC
    frac = sats % SATS_PER_BTC

    if frac == 0:
        return str(whole)

    frac_str = str(frac).zfill(8)
    result = f"{whole}.{frac_str}".rstrip("0").rstrip(".")
    return result


def btc_to_satoshis(btc: str) -> int:
    """Convert BTC string to satoshis.

    Args:
        btc: Amount in BTC (string).

    Returns:
        Amount in satoshis as integer.
    """
    parts = btc.split(".")
    whole_part = parts[0]
    frac_part = parts[1] if len(parts) > 1 else ""

    padded_frac = (frac_part + "00000000")[:8]
    combined = whole_part + padded_frac
    result = int(combined.lstrip("0") or "0")
    return result


def get_supported_networks() -> List[str]:
    """Get a list of all supported BTC/Lightning network identifiers.

    Returns:
        List of CAIP-2 network identifier strings.
    """
    return list(ALL_NETWORKS)
