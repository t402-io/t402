"""Constants for USDT0 cross-chain bridging via LayerZero."""

from eth_hash.auto import keccak

# LayerZero Scan API base URL
LAYERZERO_SCAN_BASE_URL = "https://scan.layerzero-api.com/v1"

# Default slippage tolerance (0.5%)
DEFAULT_SLIPPAGE = 0.5

# Estimated bridge completion time in seconds (~5 minutes)
ESTIMATED_BRIDGE_TIME = 300

# Default timeout for waiting (10 minutes in ms)
DEFAULT_TIMEOUT = 600_000

# Default polling interval (10 seconds in ms)
DEFAULT_POLL_INTERVAL = 10_000

# LayerZero Endpoint IDs (v2)
LAYERZERO_ENDPOINT_IDS: dict[str, int] = {
    "ethereum": 30101,
    "arbitrum": 30110,
    "ink": 30291,
    "berachain": 30362,
    "unichain": 30320,
}

# USDT0 OFT Contract Addresses
USDT0_OFT_ADDRESSES: dict[str, str] = {
    "ethereum": "0x6C96dE32CEa08842dcc4058c14d3aaAD7Fa41dee",
    "arbitrum": "0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9",
    "ink": "0x0200C29006150606B650577BBE7B6248F58470c1",
    "berachain": "0x779Ded0c9e1022225f8E0630b35a9b54bE713736",
    "unichain": "0x588ce4F028D8e7B53B687865d6A67b3A54C75518",
}

# Network to chain name mapping
NETWORK_TO_CHAIN: dict[str, str] = {
    "eip155:1": "ethereum",
    "eip155:42161": "arbitrum",
    "eip155:57073": "ink",
    "eip155:80094": "berachain",
    "eip155:130": "unichain",
}

# Chain name to network mapping
CHAIN_TO_NETWORK: dict[str, str] = {
    "ethereum": "eip155:1",
    "arbitrum": "eip155:42161",
    "ink": "eip155:57073",
    "berachain": "eip155:80094",
    "unichain": "eip155:130",
}

# OFTSent event signature hash
# OFTSent(bytes32 indexed guid, uint32 dstEid, address indexed from, uint256 amountSentLD, uint256 amountReceivedLD)
OFT_SENT_EVENT_SIGNATURE = "OFTSent(bytes32,uint32,address,uint256,uint256)"
OFT_SENT_EVENT_TOPIC = "0x" + keccak(OFT_SENT_EVENT_SIGNATURE.encode()).hex()

# Default extra options for LayerZero send (empty)
DEFAULT_EXTRA_OPTIONS = b""

# OFT Send ABI
OFT_SEND_ABI = [
    {
        "inputs": [
            {
                "components": [
                    {"name": "dstEid", "type": "uint32"},
                    {"name": "to", "type": "bytes32"},
                    {"name": "amountLD", "type": "uint256"},
                    {"name": "minAmountLD", "type": "uint256"},
                    {"name": "extraOptions", "type": "bytes"},
                    {"name": "composeMsg", "type": "bytes"},
                    {"name": "oftCmd", "type": "bytes"},
                ],
                "name": "_sendParam",
                "type": "tuple",
            },
            {"name": "_payInLzToken", "type": "bool"},
        ],
        "name": "quoteSend",
        "outputs": [
            {
                "components": [
                    {"name": "nativeFee", "type": "uint256"},
                    {"name": "lzTokenFee", "type": "uint256"},
                ],
                "name": "",
                "type": "tuple",
            }
        ],
        "stateMutability": "view",
        "type": "function",
    },
    {
        "inputs": [
            {
                "components": [
                    {"name": "dstEid", "type": "uint32"},
                    {"name": "to", "type": "bytes32"},
                    {"name": "amountLD", "type": "uint256"},
                    {"name": "minAmountLD", "type": "uint256"},
                    {"name": "extraOptions", "type": "bytes"},
                    {"name": "composeMsg", "type": "bytes"},
                    {"name": "oftCmd", "type": "bytes"},
                ],
                "name": "_sendParam",
                "type": "tuple",
            },
            {
                "components": [
                    {"name": "nativeFee", "type": "uint256"},
                    {"name": "lzTokenFee", "type": "uint256"},
                ],
                "name": "_fee",
                "type": "tuple",
            },
            {"name": "_refundAddress", "type": "address"},
        ],
        "name": "send",
        "outputs": [
            {
                "components": [
                    {"name": "guid", "type": "bytes32"},
                    {"name": "nonce", "type": "uint64"},
                    {
                        "components": [
                            {"name": "nativeFee", "type": "uint256"},
                            {"name": "lzTokenFee", "type": "uint256"},
                        ],
                        "name": "fee",
                        "type": "tuple",
                    },
                ],
                "name": "",
                "type": "tuple",
            },
            {
                "components": [
                    {"name": "amountSentLD", "type": "uint256"},
                    {"name": "amountReceivedLD", "type": "uint256"},
                ],
                "name": "",
                "type": "tuple",
            },
        ],
        "stateMutability": "payable",
        "type": "function",
    },
]

# ERC20 Approve ABI
ERC20_APPROVE_ABI = [
    {
        "inputs": [
            {"name": "owner", "type": "address"},
            {"name": "spender", "type": "address"},
        ],
        "name": "allowance",
        "outputs": [{"name": "", "type": "uint256"}],
        "stateMutability": "view",
        "type": "function",
    },
    {
        "inputs": [
            {"name": "spender", "type": "address"},
            {"name": "amount", "type": "uint256"},
        ],
        "name": "approve",
        "outputs": [{"name": "", "type": "bool"}],
        "stateMutability": "nonpayable",
        "type": "function",
    },
]


def get_endpoint_id(chain: str) -> int | None:
    """Get the LayerZero endpoint ID for a chain name.

    Args:
        chain: Chain name (e.g., 'ethereum', 'arbitrum')

    Returns:
        Endpoint ID if found, None otherwise
    """
    return LAYERZERO_ENDPOINT_IDS.get(chain.lower())


def get_endpoint_id_from_network(network: str) -> int | None:
    """Get the LayerZero endpoint ID from a network identifier.

    Args:
        network: Network identifier (e.g., 'eip155:1')

    Returns:
        Endpoint ID if found, None otherwise
    """
    chain = NETWORK_TO_CHAIN.get(network)
    if chain is None:
        return None
    return get_endpoint_id(chain)


def get_usdt0_oft_address(chain: str) -> str | None:
    """Get the USDT0 OFT contract address for a chain.

    Args:
        chain: Chain name (e.g., 'ethereum', 'arbitrum')

    Returns:
        Contract address if found, None otherwise
    """
    return USDT0_OFT_ADDRESSES.get(chain.lower())


def supports_bridging(chain: str) -> bool:
    """Check if a chain supports USDT0 bridging.

    Args:
        chain: Chain name

    Returns:
        True if the chain supports bridging
    """
    return chain.lower() in USDT0_OFT_ADDRESSES


def get_bridgeable_chains() -> list[str]:
    """Get all chains that support USDT0 bridging.

    Returns:
        List of chain names
    """
    return list(USDT0_OFT_ADDRESSES.keys())


def address_to_bytes32(address: str) -> bytes:
    """Convert an address string to a 32-byte array (left-padded).

    Args:
        address: Ethereum address (with or without 0x prefix)

    Returns:
        32-byte array with address in last 20 bytes

    Raises:
        ValueError: If the address is invalid
    """
    addr = address.lower().removeprefix("0x")

    if len(addr) != 40:
        raise ValueError(f"Invalid address length: expected 40 hex chars, got {len(addr)}")

    try:
        addr_bytes = bytes.fromhex(addr)
    except ValueError as e:
        raise ValueError(f"Invalid address hex: {e}")

    # Left-pad with zeros to 32 bytes
    return b"\x00" * 12 + addr_bytes


def bytes32_to_address(b: bytes) -> str:
    """Convert a 32-byte array to an address string.

    Args:
        b: 32-byte array

    Returns:
        Address string with 0x prefix
    """
    # Take last 20 bytes
    return "0x" + b[-20:].hex()
