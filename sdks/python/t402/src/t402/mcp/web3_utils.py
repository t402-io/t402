"""Web3 utilities for T402 MCP Server blockchain interactions."""

import asyncio
from typing import Any, Optional

from web3 import Web3
from web3.contract import Contract
from web3.types import TxReceipt

# Minimal ERC-20 ABI for balanceOf, decimals, symbol, transfer, approve, allowance
ERC20_ABI = [
    {
        "inputs": [{"name": "account", "type": "address"}],
        "name": "balanceOf",
        "outputs": [{"name": "", "type": "uint256"}],
        "stateMutability": "view",
        "type": "function",
    },
    {
        "inputs": [],
        "name": "decimals",
        "outputs": [{"name": "", "type": "uint8"}],
        "stateMutability": "view",
        "type": "function",
    },
    {
        "inputs": [],
        "name": "symbol",
        "outputs": [{"name": "", "type": "string"}],
        "stateMutability": "view",
        "type": "function",
    },
    {
        "inputs": [
            {"name": "to", "type": "address"},
            {"name": "amount", "type": "uint256"},
        ],
        "name": "transfer",
        "outputs": [{"name": "", "type": "bool"}],
        "stateMutability": "nonpayable",
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
]

# OFT ABI for LayerZero quoteSend and send
OFT_ABI = [
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
                "name": "msgFee",
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
                "name": "msgReceipt",
                "type": "tuple",
            },
            {
                "components": [
                    {"name": "amountSentLD", "type": "uint256"},
                    {"name": "amountReceivedLD", "type": "uint256"},
                ],
                "name": "oftReceipt",
                "type": "tuple",
            },
        ],
        "stateMutability": "payable",
        "type": "function",
    },
]

# OFTSent event signature: OFTSent(bytes32,uint32,address,uint256,uint256)
OFT_SENT_EVENT_SIGNATURE = "OFTSent(bytes32,uint32,address,uint256,uint256)"


def get_web3_provider(rpc_url: str) -> Web3:
    """Create a Web3 instance connected to the given RPC URL.

    Args:
        rpc_url: The RPC endpoint URL

    Returns:
        Connected Web3 instance
    """
    return Web3(Web3.HTTPProvider(rpc_url))


def get_erc20_contract(w3: Web3, token_address: str) -> Contract:
    """Get an ERC-20 contract instance.

    Args:
        w3: Web3 instance
        token_address: Token contract address

    Returns:
        Contract instance
    """
    return w3.eth.contract(
        address=Web3.to_checksum_address(token_address), abi=ERC20_ABI
    )


def get_oft_contract(w3: Web3, token_address: str) -> Contract:
    """Get an OFT contract instance for LayerZero operations.

    Args:
        w3: Web3 instance
        token_address: OFT contract address

    Returns:
        Contract instance
    """
    return w3.eth.contract(
        address=Web3.to_checksum_address(token_address), abi=OFT_ABI
    )


def get_erc20_balance(w3: Web3, token_address: str, owner_address: str) -> int:
    """Query ERC-20 token balance for an address.

    Args:
        w3: Web3 instance
        token_address: Token contract address
        owner_address: Wallet address to check

    Returns:
        Raw token balance (integer, not formatted)
    """
    contract = get_erc20_contract(w3, token_address)
    return contract.functions.balanceOf(
        Web3.to_checksum_address(owner_address)
    ).call()


def get_erc20_decimals(w3: Web3, token_address: str) -> int:
    """Query ERC-20 token decimals.

    Args:
        w3: Web3 instance
        token_address: Token contract address

    Returns:
        Token decimals
    """
    contract = get_erc20_contract(w3, token_address)
    return contract.functions.decimals().call()


def get_erc20_symbol(w3: Web3, token_address: str) -> str:
    """Query ERC-20 token symbol.

    Args:
        w3: Web3 instance
        token_address: Token contract address

    Returns:
        Token symbol
    """
    contract = get_erc20_contract(w3, token_address)
    return contract.functions.symbol().call()


def get_native_balance(w3: Web3, address: str) -> int:
    """Get native token balance for an address.

    Args:
        w3: Web3 instance
        address: Wallet address

    Returns:
        Native balance in wei
    """
    return w3.eth.get_balance(Web3.to_checksum_address(address))


def transfer_erc20(
    w3: Web3,
    private_key: str,
    token_address: str,
    to: str,
    amount: int,
) -> TxReceipt:
    """Build, sign, send, and wait for an ERC-20 transfer transaction.

    Args:
        w3: Web3 instance
        private_key: Sender's private key (hex with 0x prefix)
        token_address: Token contract address
        to: Recipient address
        amount: Raw token amount to transfer

    Returns:
        Transaction receipt

    Raises:
        ValueError: If balance is insufficient or transaction fails
    """
    contract = get_erc20_contract(w3, token_address)
    account = w3.eth.account.from_key(private_key)
    from_address = account.address

    # Check balance
    balance = contract.functions.balanceOf(from_address).call()
    if balance < amount:
        raise ValueError(
            f"Insufficient token balance: have {balance}, need {amount}"
        )

    # Build transaction
    tx = contract.functions.transfer(
        Web3.to_checksum_address(to), amount
    ).build_transaction(
        {
            "from": from_address,
            "nonce": w3.eth.get_transaction_count(from_address),
            "gas": 0,  # Will be estimated
            "gasPrice": w3.eth.gas_price,
        }
    )

    # Estimate gas with 20% buffer
    gas_estimate = w3.eth.estimate_gas(tx)
    tx["gas"] = int(gas_estimate * 1.2)

    # Sign and send
    signed_tx = w3.eth.account.sign_transaction(tx, private_key)
    tx_hash = w3.eth.send_raw_transaction(signed_tx.raw_transaction)

    # Wait for receipt
    receipt = w3.eth.wait_for_transaction_receipt(tx_hash, timeout=120)

    if receipt["status"] != 1:
        raise ValueError(f"Transaction failed: {tx_hash.hex()}")

    return receipt


def format_wei_to_ether(wei_amount: int) -> str:
    """Format a wei amount to ether string.

    Args:
        wei_amount: Amount in wei

    Returns:
        Formatted ether string
    """
    return str(Web3.from_wei(wei_amount, "ether"))


def address_to_bytes32(address: str) -> bytes:
    """Convert an Ethereum address to bytes32 (left-padded).

    Args:
        address: Ethereum address with 0x prefix

    Returns:
        32-byte array with address right-aligned
    """
    addr = address.lower().removeprefix("0x")
    addr_bytes = bytes.fromhex(addr)
    return b"\x00" * 12 + addr_bytes


def quote_bridge_fee(
    w3: Web3,
    oft_address: str,
    dst_eid: int,
    recipient: str,
    amount: int,
    min_amount: int,
) -> tuple[int, int]:
    """Query LayerZero OFT quoteSend for bridge fee.

    Args:
        w3: Web3 instance
        oft_address: USDT0 OFT contract address
        dst_eid: Destination LayerZero endpoint ID
        recipient: Recipient address on destination chain
        amount: Amount to send (raw, 6 decimals)
        min_amount: Minimum amount to receive

    Returns:
        Tuple of (native_fee, lz_token_fee) in wei
    """
    contract = get_oft_contract(w3, oft_address)

    send_param = (
        dst_eid,
        address_to_bytes32(recipient),
        amount,
        min_amount,
        b"",  # extraOptions
        b"",  # composeMsg
        b"",  # oftCmd
    )

    result = contract.functions.quoteSend(send_param, False).call()

    # Result is a tuple (nativeFee, lzTokenFee)
    if isinstance(result, (list, tuple)):
        return int(result[0]), int(result[1])
    return int(result["nativeFee"]), int(result["lzTokenFee"])


def execute_bridge_send(
    w3: Web3,
    private_key: str,
    oft_address: str,
    dst_eid: int,
    recipient: str,
    amount: int,
    min_amount: int,
    native_fee: int,
) -> TxReceipt:
    """Execute a LayerZero OFT bridge send transaction.

    Args:
        w3: Web3 instance
        private_key: Sender's private key (hex with 0x prefix)
        oft_address: USDT0 OFT contract address
        dst_eid: Destination LayerZero endpoint ID
        recipient: Recipient address on destination chain
        amount: Amount to send (raw, 6 decimals)
        min_amount: Minimum amount to receive
        native_fee: Native fee from quoteSend (with buffer)

    Returns:
        Transaction receipt

    Raises:
        ValueError: If transaction fails
    """
    contract = get_oft_contract(w3, oft_address)
    account = w3.eth.account.from_key(private_key)
    from_address = account.address

    send_param = (
        dst_eid,
        address_to_bytes32(recipient),
        amount,
        min_amount,
        b"",  # extraOptions
        b"",  # composeMsg
        b"",  # oftCmd
    )

    fee_param = (native_fee, 0)  # (nativeFee, lzTokenFee)

    tx = contract.functions.send(
        send_param, fee_param, from_address
    ).build_transaction(
        {
            "from": from_address,
            "value": native_fee,
            "nonce": w3.eth.get_transaction_count(from_address),
            "gas": 0,
            "gasPrice": w3.eth.gas_price,
        }
    )

    gas_estimate = w3.eth.estimate_gas(tx)
    tx["gas"] = int(gas_estimate * 1.2)

    signed_tx = w3.eth.account.sign_transaction(tx, private_key)
    tx_hash = w3.eth.send_raw_transaction(signed_tx.raw_transaction)

    receipt = w3.eth.wait_for_transaction_receipt(tx_hash, timeout=120)

    if receipt["status"] != 1:
        raise ValueError(f"Bridge transaction failed: {tx_hash.hex()}")

    return receipt


def extract_message_guid_from_receipt(receipt: TxReceipt) -> Optional[str]:
    """Extract LayerZero message GUID from OFTSent event in receipt logs.

    Args:
        receipt: Transaction receipt

    Returns:
        Message GUID hex string, or None if not found
    """
    oft_sent_topic = Web3.keccak(text=OFT_SENT_EVENT_SIGNATURE).hex()

    for log in receipt.get("logs", []):
        topics = log.get("topics", [])
        if len(topics) >= 2:
            topic0 = topics[0].hex() if isinstance(topics[0], bytes) else topics[0]
            if topic0.lower() == oft_sent_topic.lower():
                guid = topics[1].hex() if isinstance(topics[1], bytes) else topics[1]
                if not guid.startswith("0x"):
                    guid = "0x" + guid
                return guid

    return None


async def run_sync_in_executor(func: Any, *args: Any) -> Any:
    """Run a synchronous function in an executor for async compatibility.

    Args:
        func: Synchronous function to call
        *args: Arguments to pass to the function

    Returns:
        Result of the function
    """
    loop = asyncio.get_event_loop()
    return await loop.run_in_executor(None, func, *args)
