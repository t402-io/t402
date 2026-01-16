#!/usr/bin/env python3
"""
T402 CLI - Command-line interface for the T402 payment protocol.

Usage:
    t402 verify <payment-payload> [--facilitator URL]
    t402 settle <payment-payload> [--facilitator URL]
    t402 supported [--facilitator URL]
    t402 encode <json-file>
    t402 decode <base64-string>
    t402 version
"""
from __future__ import annotations

import argparse
import asyncio
import json
import sys
from pathlib import Path
from typing import Any

from . import __version__
from .encoding import decode_payment, encode_payment
from .facilitator import FacilitatorClient, FacilitatorConfig
from .types import PaymentPayload


def create_parser() -> argparse.ArgumentParser:
    """Create the argument parser for the CLI."""
    parser = argparse.ArgumentParser(
        prog="t402",
        description="T402 Payment Protocol CLI",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
    # Verify a payment
    t402 verify <base64-encoded-payload>

    # Settle a payment
    t402 settle <base64-encoded-payload>

    # List supported networks and schemes
    t402 supported

    # Encode a payment payload from JSON
    t402 encode payment.json

    # Decode a base64 payment payload
    t402 decode <base64-string>
        """,
    )
    parser.add_argument(
        "-v", "--version", action="version", version=f"t402 {__version__}"
    )
    parser.add_argument(
        "-f",
        "--facilitator",
        default="https://facilitator.t402.io",
        help="Facilitator URL (default: https://facilitator.t402.io)",
    )
    parser.add_argument(
        "-o",
        "--output",
        choices=["json", "text"],
        default="text",
        help="Output format (default: text)",
    )

    subparsers = parser.add_subparsers(dest="command", help="Available commands")

    # verify command
    verify_parser = subparsers.add_parser("verify", help="Verify a payment payload")
    verify_parser.add_argument("payload", help="Base64-encoded payment payload")

    # settle command
    settle_parser = subparsers.add_parser("settle", help="Settle a payment")
    settle_parser.add_argument("payload", help="Base64-encoded payment payload")

    # supported command
    subparsers.add_parser("supported", help="List supported networks and schemes")

    # encode command
    encode_parser = subparsers.add_parser(
        "encode", help="Encode a payment payload from JSON"
    )
    encode_parser.add_argument(
        "file", type=Path, help="JSON file containing payment payload"
    )

    # decode command
    decode_parser = subparsers.add_parser(
        "decode", help="Decode a base64-encoded payment payload"
    )
    decode_parser.add_argument("payload", help="Base64-encoded payment payload")

    # info command
    info_parser = subparsers.add_parser("info", help="Show information about a network")
    info_parser.add_argument("network", help="Network identifier (e.g., eip155:1)")

    return parser


def output_result(result: Any, output_format: str) -> None:
    """Output result in the specified format."""
    if output_format == "json":
        if hasattr(result, "model_dump"):
            print(json.dumps(result.model_dump(), indent=2))
        elif isinstance(result, dict):
            print(json.dumps(result, indent=2))
        else:
            print(json.dumps({"result": str(result)}, indent=2))
    else:
        if isinstance(result, dict):
            for key, value in result.items():
                print(f"{key}: {value}")
        else:
            print(result)


async def cmd_verify(args: argparse.Namespace) -> int:
    """Verify a payment payload."""
    try:
        config = FacilitatorConfig(base_url=args.facilitator)
        client = FacilitatorClient(config)

        # Decode the payload first
        payload_dict = decode_payment(args.payload)
        payload = PaymentPayload.model_validate(payload_dict)

        result = await client.verify(payload)

        if args.output == "json":
            print(json.dumps({"valid": result.valid, "error": result.error}, indent=2))
        else:
            if result.valid:
                print("Payment is VALID")
            else:
                print(f"Payment is INVALID: {result.error}")

        return 0 if result.valid else 1
    except Exception as e:
        print(f"Error: {e}", file=sys.stderr)
        return 1


async def cmd_settle(args: argparse.Namespace) -> int:
    """Settle a payment."""
    try:
        config = FacilitatorConfig(base_url=args.facilitator)
        client = FacilitatorClient(config)

        # Decode the payload first
        payload_dict = decode_payment(args.payload)
        payload = PaymentPayload.model_validate(payload_dict)

        result = await client.settle(payload)

        if args.output == "json":
            print(
                json.dumps(
                    {
                        "success": result.success,
                        "transaction_hash": result.transaction_hash,
                        "error": result.error,
                    },
                    indent=2,
                )
            )
        else:
            if result.success:
                print("Payment settled successfully!")
                print(f"Transaction hash: {result.transaction_hash}")
            else:
                print(f"Settlement failed: {result.error}")

        return 0 if result.success else 1
    except Exception as e:
        print(f"Error: {e}", file=sys.stderr)
        return 1


async def cmd_supported(args: argparse.Namespace) -> int:
    """List supported networks and schemes."""
    try:
        config = FacilitatorConfig(base_url=args.facilitator)
        client = FacilitatorClient(config)

        result = await client.list_supported()

        if args.output == "json":
            print(
                json.dumps(
                    {
                        "kinds": [k.model_dump() for k in result.kinds],
                        "signers": result.signers,
                        "extensions": result.extensions,
                    },
                    indent=2,
                )
            )
        else:
            print("Supported Payment Kinds:")
            print("-" * 50)
            for kind in result.kinds:
                print(f"  Scheme: {kind.scheme}")
                print(f"  Network: {kind.network}")
                if hasattr(kind, "token") and kind.token:
                    print(f"  Token: {kind.token}")
                print()

            if result.signers:
                print("Supported Signers:")
                for signer in result.signers:
                    print(f"  - {signer}")
                print()

            if result.extensions:
                print("Supported Extensions:")
                for ext in result.extensions:
                    print(f"  - {ext}")

        return 0
    except Exception as e:
        print(f"Error: {e}", file=sys.stderr)
        return 1


def cmd_encode(args: argparse.Namespace) -> int:
    """Encode a payment payload from JSON."""
    try:
        with open(args.file) as f:
            payload_dict = json.load(f)

        encoded = encode_payment(payload_dict)
        print(encoded)
        return 0
    except FileNotFoundError:
        print(f"Error: File not found: {args.file}", file=sys.stderr)
        return 1
    except json.JSONDecodeError as e:
        print(f"Error: Invalid JSON: {e}", file=sys.stderr)
        return 1
    except Exception as e:
        print(f"Error: {e}", file=sys.stderr)
        return 1


def cmd_decode(args: argparse.Namespace) -> int:
    """Decode a base64-encoded payment payload."""
    try:
        decoded = decode_payment(args.payload)

        if args.output == "json":
            print(json.dumps(decoded, indent=2))
        else:
            print(json.dumps(decoded, indent=2))

        return 0
    except Exception as e:
        print(f"Error: Failed to decode payload: {e}", file=sys.stderr)
        return 1


def cmd_info(args: argparse.Namespace) -> int:
    """Show information about a network."""
    from .networks import is_evm_network, is_ton_network, is_tron_network

    network = args.network

    info = {
        "network": network,
        "is_evm": is_evm_network(network),
        "is_ton": is_ton_network(network),
        "is_tron": is_tron_network(network),
    }

    # Add chain-specific info
    if is_evm_network(network):
        from .chains import EVM_CHAINS

        chain_id = network.split(":")[1] if ":" in network else network
        if chain_id in EVM_CHAINS:
            chain = EVM_CHAINS[chain_id]
            info["chain_name"] = chain.get("name", "Unknown")
            info["currency"] = chain.get("currency", "Unknown")

    if args.output == "json":
        print(json.dumps(info, indent=2))
    else:
        for key, value in info.items():
            print(f"{key}: {value}")

    return 0


def main() -> int:
    """Main entry point for the CLI."""
    parser = create_parser()
    args = parser.parse_args()

    if not args.command:
        parser.print_help()
        return 0

    # Route to the appropriate command handler
    if args.command == "verify":
        return asyncio.run(cmd_verify(args))
    elif args.command == "settle":
        return asyncio.run(cmd_settle(args))
    elif args.command == "supported":
        return asyncio.run(cmd_supported(args))
    elif args.command == "encode":
        return cmd_encode(args)
    elif args.command == "decode":
        return cmd_decode(args)
    elif args.command == "info":
        return cmd_info(args)
    else:
        parser.print_help()
        return 0


if __name__ == "__main__":
    sys.exit(main())
