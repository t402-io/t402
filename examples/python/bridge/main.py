#!/usr/bin/env python3
"""
USDT0 Cross-Chain Bridge Example

This example demonstrates how to:
1. Check supported bridging chains
2. Get a bridge quote
3. Execute a bridge transaction
4. Track message delivery via LayerZero Scan

Prerequisites:
- Private key with USDT0 balance on source chain
- Native token for gas fees on source chain

Usage:
    PRIVATE_KEY=0x... python main.py
"""

import asyncio
import os
from dataclasses import dataclass

from t402.bridge import (
    Usdt0Bridge,
    LayerZeroScanClient,
    CrossChainPaymentRouter,
    BridgeQuoteParams,
    BridgeExecuteParams,
    CrossChainPaymentParams,
    get_bridgeable_chains,
    supports_bridging,
    LAYERZERO_ENDPOINT_IDS,
    USDT0_OFT_ADDRESSES,
)

# Demo mode flag - set to False to execute real transactions
DEMO_MODE = True

# Amount to bridge (100 USDT0 = 100_000000 with 6 decimals)
BRIDGE_AMOUNT = 100_000000


@dataclass
class DemoSigner:
    """Demo signer for illustration purposes."""

    address: str = "0x1234567890123456789012345678901234567890"

    async def read_contract(self, address: str, abi: list, function_name: str, *args):
        raise NotImplementedError("Demo signer: not implemented")

    async def write_contract(
        self, address: str, abi: list, function_name: str, *args, value: int = 0
    ) -> str:
        raise NotImplementedError("Demo signer: not implemented")

    async def wait_for_transaction_receipt(self, tx_hash: str):
        raise NotImplementedError("Demo signer: not implemented")


async def main():
    print("=== USDT0 Cross-Chain Bridge Example ===")
    print()

    # 1. Check supported chains
    print("Supported bridging chains:")
    chains = get_bridgeable_chains()
    for chain in chains:
        print(f"  - {chain}")
    print()

    # 2. Verify chain support
    print("Checking chain support:")
    print(f"  Arbitrum supports bridging: {supports_bridging('arbitrum')}")
    print(f"  Ethereum supports bridging: {supports_bridging('ethereum')}")
    print(f"  Base supports bridging: {supports_bridging('base')}")
    print()

    # 3. Get LayerZero endpoint IDs
    print("LayerZero Endpoint IDs:")
    for chain, eid in LAYERZERO_ENDPOINT_IDS.items():
        print(f"  {chain}: {eid}")
    print()

    # 4. Get USDT0 OFT addresses
    print("USDT0 OFT Addresses:")
    for chain, addr in USDT0_OFT_ADDRESSES.items():
        print(f"  {chain}: {addr}")
    print()

    if DEMO_MODE:
        print("[DEMO MODE] Showing example flow without real transactions")
        print()
        demonstrate_demo_mode()
        return

    # Real transaction mode
    private_key = os.environ.get("PRIVATE_KEY")
    if not private_key:
        print("ERROR: PRIVATE_KEY environment variable required")
        return

    # Create signer (you would implement this with your preferred Ethereum client)
    signer = DemoSigner()

    # Create bridge client
    bridge = Usdt0Bridge(signer, "arbitrum")
    print("Created bridge client for Arbitrum")
    print(f"Supported destinations: {', '.join(bridge.get_supported_destinations())}")
    print()

    # Get quote
    print("Getting bridge quote...")
    quote = await bridge.quote(
        BridgeQuoteParams(
            from_chain="arbitrum",
            to_chain="ethereum",
            amount=BRIDGE_AMOUNT,
            recipient=signer.address,
        )
    )

    print("Bridge Quote:")
    print(f"  Amount to send: {quote.amount_to_send}")
    print(f"  Min amount to receive: {quote.min_amount_to_receive}")
    print(f"  Native fee: {quote.native_fee} wei")
    print(f"  Estimated time: {quote.estimated_time} seconds")
    print()

    # Execute bridge
    print("Executing bridge transaction...")
    result = await bridge.send(
        BridgeExecuteParams(
            from_chain="arbitrum",
            to_chain="ethereum",
            amount=BRIDGE_AMOUNT,
            recipient=signer.address,
            slippage_tolerance=0.5,
        )
    )

    print("Bridge Result:")
    print(f"  TX Hash: {result.tx_hash}")
    print(f"  Message GUID: {result.message_guid}")
    print(f"  Amount sent: {result.amount_sent}")
    print(f"  Amount to receive: {result.amount_to_receive}")
    print()

    # Track message delivery
    print("Tracking message delivery via LayerZero Scan...")
    scan_client = LayerZeroScanClient()

    def on_status_change(status):
        print(f"  Status changed: {status}")

    message = await scan_client.wait_for_delivery(
        result.message_guid,
        timeout=600000,  # 10 minutes
        poll_interval=10000,  # 10 seconds
        on_status_change=on_status_change,
    )

    print()
    print("Delivery complete!")
    print(f"  Final status: {message.status}")
    print(f"  Destination TX: {message.dst_tx_hash}")

    await scan_client.close()


def demonstrate_demo_mode():
    """Demonstrate the API without real transactions."""
    print("Example: Get Bridge Quote")
    print(
        """
    bridge = Usdt0Bridge(signer, 'arbitrum')

    quote = await bridge.quote(BridgeQuoteParams(
        from_chain='arbitrum',
        to_chain='ethereum',
        amount=100_000000,  # 100 USDT0
        recipient='0x...',
    ))

    print(f'Fee: {quote.native_fee} wei')
"""
    )

    print("Example: Execute Bridge")
    print(
        """
    result = await bridge.send(BridgeExecuteParams(
        from_chain='arbitrum',
        to_chain='ethereum',
        amount=100_000000,
        recipient='0x...',
    ))

    print(f'TX: {result.tx_hash}')
    print(f'GUID: {result.message_guid}')
"""
    )

    print("Example: Track Delivery")
    print(
        """
    scan_client = LayerZeroScanClient()

    message = await scan_client.wait_for_delivery(
        result.message_guid,
        on_status_change=lambda s: print(f'Status: {s}'),
    )

    print(f'Delivered! Dest TX: {message.dst_tx_hash}')
"""
    )

    print("Example: Cross-Chain Payment Router")
    print(
        """
    router = CrossChainPaymentRouter(signer, 'arbitrum')

    payment_result = await router.route_payment(CrossChainPaymentParams(
        source_chain='arbitrum',
        destination_chain='ethereum',
        amount=100_000000,
        pay_to=recipient_address,
        payer=user_address,
    ))

    # Wait for delivery
    await router.wait_for_delivery(payment_result.message_guid)
"""
    )


if __name__ == "__main__":
    asyncio.run(main())
