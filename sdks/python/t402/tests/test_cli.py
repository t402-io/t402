"""Tests for the T402 CLI module."""

import argparse
import json
import tempfile
from pathlib import Path
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from t402.cli import (
    create_parser,
    output_result,
    cmd_encode,
    cmd_decode,
    cmd_info,
    cmd_verify,
    cmd_settle,
    cmd_supported,
    main,
)
from t402.exact import encode_payment


class TestCreateParser:
    """Tests for the argument parser creation."""

    def test_parser_creation(self):
        """Test that parser is created successfully."""
        parser = create_parser()
        assert parser is not None
        assert isinstance(parser, argparse.ArgumentParser)

    def test_parser_prog_name(self):
        """Test parser program name."""
        parser = create_parser()
        assert parser.prog == "t402"

    def test_verify_command(self):
        """Test verify command parsing."""
        parser = create_parser()
        args = parser.parse_args(["verify", "test_payload"])
        assert args.command == "verify"
        assert args.payload == "test_payload"

    def test_settle_command(self):
        """Test settle command parsing."""
        parser = create_parser()
        args = parser.parse_args(["settle", "test_payload"])
        assert args.command == "settle"
        assert args.payload == "test_payload"

    def test_supported_command(self):
        """Test supported command parsing."""
        parser = create_parser()
        args = parser.parse_args(["supported"])
        assert args.command == "supported"

    def test_encode_command(self):
        """Test encode command parsing."""
        parser = create_parser()
        args = parser.parse_args(["encode", "test.json"])
        assert args.command == "encode"
        assert args.file == Path("test.json")

    def test_decode_command(self):
        """Test decode command parsing."""
        parser = create_parser()
        args = parser.parse_args(["decode", "base64_string"])
        assert args.command == "decode"
        assert args.payload == "base64_string"

    def test_info_command(self):
        """Test info command parsing."""
        parser = create_parser()
        args = parser.parse_args(["info", "eip155:1"])
        assert args.command == "info"
        assert args.network == "eip155:1"

    def test_facilitator_option(self):
        """Test custom facilitator URL option."""
        parser = create_parser()
        args = parser.parse_args(["-f", "https://custom.facilitator.com", "supported"])
        assert args.facilitator == "https://custom.facilitator.com"

    def test_default_facilitator(self):
        """Test default facilitator URL."""
        parser = create_parser()
        args = parser.parse_args(["supported"])
        assert args.facilitator == "https://facilitator.t402.io"

    def test_output_format_json(self):
        """Test JSON output format option."""
        parser = create_parser()
        args = parser.parse_args(["-o", "json", "supported"])
        assert args.output == "json"

    def test_output_format_text(self):
        """Test text output format option."""
        parser = create_parser()
        args = parser.parse_args(["-o", "text", "supported"])
        assert args.output == "text"

    def test_default_output_format(self):
        """Test default output format."""
        parser = create_parser()
        args = parser.parse_args(["supported"])
        assert args.output == "text"


class TestOutputResult:
    """Tests for the output_result function."""

    def test_json_output_dict(self, capsys):
        """Test JSON output with dict."""
        result = {"key": "value", "number": 42}
        output_result(result, "json")
        captured = capsys.readouterr()
        assert json.loads(captured.out) == result

    def test_json_output_model(self, capsys):
        """Test JSON output with model that has model_dump."""
        mock_model = MagicMock()
        mock_model.model_dump.return_value = {"field": "value"}
        output_result(mock_model, "json")
        captured = capsys.readouterr()
        assert json.loads(captured.out) == {"field": "value"}

    def test_json_output_string(self, capsys):
        """Test JSON output with string."""
        output_result("test string", "json")
        captured = capsys.readouterr()
        assert json.loads(captured.out) == {"result": "test string"}

    def test_text_output_dict(self, capsys):
        """Test text output with dict."""
        result = {"key": "value", "number": 42}
        output_result(result, "text")
        captured = capsys.readouterr()
        assert "key: value" in captured.out
        assert "number: 42" in captured.out

    def test_text_output_string(self, capsys):
        """Test text output with string."""
        output_result("test string", "text")
        captured = capsys.readouterr()
        assert "test string" in captured.out


class TestCmdEncode:
    """Tests for the encode command."""

    def test_encode_valid_json(self, capsys):
        """Test encoding a valid JSON file."""
        payload = {
            "scheme": "exact",
            "network": "eip155:8453",
            "payload": {"test": "data"},
        }

        with tempfile.NamedTemporaryFile(
            mode="w", suffix=".json", delete=False
        ) as f:
            json.dump(payload, f)
            f.flush()

            args = argparse.Namespace(file=Path(f.name), output="text")
            result = cmd_encode(args)

            assert result == 0
            captured = capsys.readouterr()
            # The output should be a base64 string
            assert len(captured.out.strip()) > 0

    def test_encode_file_not_found(self, capsys):
        """Test encoding with non-existent file."""
        args = argparse.Namespace(file=Path("/nonexistent/file.json"), output="text")
        result = cmd_encode(args)
        assert result == 1
        captured = capsys.readouterr()
        assert "File not found" in captured.err

    def test_encode_invalid_json(self, capsys):
        """Test encoding with invalid JSON file."""
        with tempfile.NamedTemporaryFile(
            mode="w", suffix=".json", delete=False
        ) as f:
            f.write("not valid json {{{")
            f.flush()

            args = argparse.Namespace(file=Path(f.name), output="text")
            result = cmd_encode(args)

            assert result == 1
            captured = capsys.readouterr()
            assert "Invalid JSON" in captured.err


class TestCmdDecode:
    """Tests for the decode command."""

    def test_decode_valid_payload(self, capsys):
        """Test decoding a valid base64 payload."""
        payload = {"scheme": "exact", "network": "eip155:8453"}
        encoded = encode_payment(payload)

        args = argparse.Namespace(payload=encoded, output="json")
        result = cmd_decode(args)

        assert result == 0
        captured = capsys.readouterr()
        decoded = json.loads(captured.out)
        assert decoded["scheme"] == "exact"
        assert decoded["network"] == "eip155:8453"

    def test_decode_invalid_base64(self, capsys):
        """Test decoding invalid base64."""
        args = argparse.Namespace(payload="not valid base64!!!", output="json")
        result = cmd_decode(args)

        assert result == 1
        captured = capsys.readouterr()
        assert "Error" in captured.err


class TestCmdInfo:
    """Tests for the info command."""

    def test_info_evm_network(self, capsys):
        """Test info for an EVM network (using human-readable name)."""
        # Note: is_evm_network uses human-readable names, not CAIP-2 format
        args = argparse.Namespace(network="ethereum", output="json")
        result = cmd_info(args)

        assert result == 0
        captured = capsys.readouterr()
        info = json.loads(captured.out)
        assert info["network"] == "ethereum"
        assert info["is_evm"] is True
        assert info["is_ton"] is False
        assert info["is_tron"] is False
        assert info["chain_id"] == 1

    def test_info_ton_network(self, capsys):
        """Test info for a TON network."""
        args = argparse.Namespace(network="ton:mainnet", output="json")
        result = cmd_info(args)

        assert result == 0
        captured = capsys.readouterr()
        info = json.loads(captured.out)
        assert info["network"] == "ton:mainnet"
        assert info["is_ton"] is True

    def test_info_tron_network(self, capsys):
        """Test info for a TRON network."""
        args = argparse.Namespace(network="tron:mainnet", output="json")
        result = cmd_info(args)

        assert result == 0
        captured = capsys.readouterr()
        info = json.loads(captured.out)
        assert info["network"] == "tron:mainnet"
        assert info["is_tron"] is True

    def test_info_text_output(self, capsys):
        """Test info with text output."""
        args = argparse.Namespace(network="base", output="text")
        result = cmd_info(args)

        assert result == 0
        captured = capsys.readouterr()
        assert "network:" in captured.out
        assert "is_evm:" in captured.out


class TestCmdVerify:
    """Tests for the verify command."""

    @pytest.mark.asyncio
    async def test_verify_valid_payment(self, capsys):
        """Test verifying a valid payment."""
        # Use a valid V2 EVM exact payload structure
        payload = {
            "t402Version": 2,
            "scheme": "exact",
            "network": "eip155:8453",
            "payload": {
                "authorization": {
                    "from": "0x1234567890123456789012345678901234567890",
                    "to": "0x0987654321098765432109876543210987654321",
                    "value": "1000000",
                    "validAfter": "0",
                    "validBefore": "9999999999",
                    "nonce": "0x" + "a" * 64,
                },
                "signature": "0x" + "a" * 130,
            },
        }
        encoded = encode_payment(payload)

        with patch("t402.cli.FacilitatorClient") as MockClient, \
             patch("t402.cli.PaymentPayload") as MockPayload:
            # Mock the PaymentPayload validation to return a mock object
            mock_payload_instance = MagicMock()
            MockPayload.model_validate.return_value = mock_payload_instance

            mock_client = MockClient.return_value
            mock_result = MagicMock()
            mock_result.valid = True
            mock_result.error = None
            mock_client.verify = AsyncMock(return_value=mock_result)

            args = argparse.Namespace(
                payload=encoded,
                facilitator="https://facilitator.t402.io",
                output="text",
            )
            result = await cmd_verify(args)

            assert result == 0
            captured = capsys.readouterr()
            assert "VALID" in captured.out

    @pytest.mark.asyncio
    async def test_verify_invalid_payment(self, capsys):
        """Test verifying an invalid payment."""
        payload = {
            "t402Version": 2,
            "scheme": "exact",
            "network": "eip155:8453",
            "payload": {
                "authorization": {
                    "from": "0x1234567890123456789012345678901234567890",
                    "to": "0x0987654321098765432109876543210987654321",
                    "value": "1000000",
                    "validAfter": "0",
                    "validBefore": "9999999999",
                    "nonce": "0x" + "a" * 64,
                },
                "signature": "0x" + "b" * 130,
            },
        }
        encoded = encode_payment(payload)

        with patch("t402.cli.FacilitatorClient") as MockClient, \
             patch("t402.cli.PaymentPayload") as MockPayload:
            mock_payload_instance = MagicMock()
            MockPayload.model_validate.return_value = mock_payload_instance

            mock_client = MockClient.return_value
            mock_result = MagicMock()
            mock_result.valid = False
            mock_result.error = "Invalid signature"
            mock_client.verify = AsyncMock(return_value=mock_result)

            args = argparse.Namespace(
                payload=encoded,
                facilitator="https://facilitator.t402.io",
                output="text",
            )
            result = await cmd_verify(args)

            assert result == 1
            captured = capsys.readouterr()
            assert "INVALID" in captured.out

    @pytest.mark.asyncio
    async def test_verify_json_output(self, capsys):
        """Test verify with JSON output."""
        payload = {
            "t402Version": 2,
            "scheme": "exact",
            "network": "eip155:8453",
            "payload": {
                "authorization": {
                    "from": "0x1234567890123456789012345678901234567890",
                    "to": "0x0987654321098765432109876543210987654321",
                    "value": "1000000",
                    "validAfter": "0",
                    "validBefore": "9999999999",
                    "nonce": "0x" + "a" * 64,
                },
                "signature": "0x" + "a" * 130,
            },
        }
        encoded = encode_payment(payload)

        with patch("t402.cli.FacilitatorClient") as MockClient, \
             patch("t402.cli.PaymentPayload") as MockPayload:
            mock_payload_instance = MagicMock()
            MockPayload.model_validate.return_value = mock_payload_instance

            mock_client = MockClient.return_value
            mock_result = MagicMock()
            mock_result.valid = True
            mock_result.error = None
            mock_client.verify = AsyncMock(return_value=mock_result)

            args = argparse.Namespace(
                payload=encoded,
                facilitator="https://facilitator.t402.io",
                output="json",
            )
            result = await cmd_verify(args)

            assert result == 0
            captured = capsys.readouterr()
            output = json.loads(captured.out)
            assert output["valid"] is True


class TestCmdSettle:
    """Tests for the settle command."""

    @pytest.mark.asyncio
    async def test_settle_success(self, capsys):
        """Test successful settlement."""
        payload = {
            "t402Version": 2,
            "scheme": "exact",
            "network": "eip155:8453",
            "payload": {
                "authorization": {
                    "from": "0x1234567890123456789012345678901234567890",
                    "to": "0x0987654321098765432109876543210987654321",
                    "value": "1000000",
                    "validAfter": "0",
                    "validBefore": "9999999999",
                    "nonce": "0x" + "a" * 64,
                },
                "signature": "0x" + "a" * 130,
            },
        }
        encoded = encode_payment(payload)

        with patch("t402.cli.FacilitatorClient") as MockClient, \
             patch("t402.cli.PaymentPayload") as MockPayload:
            mock_payload_instance = MagicMock()
            MockPayload.model_validate.return_value = mock_payload_instance

            mock_client = MockClient.return_value
            mock_result = MagicMock()
            mock_result.success = True
            mock_result.transaction_hash = "0xabc123"
            mock_result.error = None
            mock_client.settle = AsyncMock(return_value=mock_result)

            args = argparse.Namespace(
                payload=encoded,
                facilitator="https://facilitator.t402.io",
                output="text",
            )
            result = await cmd_settle(args)

            assert result == 0
            captured = capsys.readouterr()
            assert "successfully" in captured.out
            assert "0xabc123" in captured.out

    @pytest.mark.asyncio
    async def test_settle_failure(self, capsys):
        """Test settlement failure."""
        payload = {
            "t402Version": 2,
            "scheme": "exact",
            "network": "eip155:8453",
            "payload": {
                "authorization": {
                    "from": "0x1234567890123456789012345678901234567890",
                    "to": "0x0987654321098765432109876543210987654321",
                    "value": "1000000",
                    "validAfter": "0",
                    "validBefore": "9999999999",
                    "nonce": "0x" + "a" * 64,
                },
                "signature": "0x" + "b" * 130,
            },
        }
        encoded = encode_payment(payload)

        with patch("t402.cli.FacilitatorClient") as MockClient, \
             patch("t402.cli.PaymentPayload") as MockPayload:
            mock_payload_instance = MagicMock()
            MockPayload.model_validate.return_value = mock_payload_instance

            mock_client = MockClient.return_value
            mock_result = MagicMock()
            mock_result.success = False
            mock_result.transaction_hash = None
            mock_result.error = "Insufficient funds"
            mock_client.settle = AsyncMock(return_value=mock_result)

            args = argparse.Namespace(
                payload=encoded,
                facilitator="https://facilitator.t402.io",
                output="text",
            )
            result = await cmd_settle(args)

            assert result == 1
            captured = capsys.readouterr()
            assert "failed" in captured.out


class TestCmdSupported:
    """Tests for the supported command."""

    @pytest.mark.asyncio
    async def test_supported_list(self, capsys):
        """Test listing supported networks."""
        with patch("t402.cli.FacilitatorClient") as MockClient:
            mock_client = MockClient.return_value
            mock_kind = MagicMock()
            mock_kind.scheme = "exact"
            mock_kind.network = "eip155:8453"
            mock_kind.model_dump.return_value = {
                "scheme": "exact",
                "network": "eip155:8453",
            }

            mock_result = MagicMock()
            mock_result.kinds = [mock_kind]
            mock_result.signers = ["eoa", "erc6492"]
            mock_result.extensions = ["siwx"]
            mock_client.list_supported = AsyncMock(return_value=mock_result)

            args = argparse.Namespace(
                facilitator="https://facilitator.t402.io",
                output="text",
            )
            result = await cmd_supported(args)

            assert result == 0
            captured = capsys.readouterr()
            assert "exact" in captured.out
            assert "eip155:8453" in captured.out

    @pytest.mark.asyncio
    async def test_supported_json_output(self, capsys):
        """Test supported with JSON output."""
        with patch("t402.cli.FacilitatorClient") as MockClient:
            mock_client = MockClient.return_value
            mock_kind = MagicMock()
            mock_kind.model_dump.return_value = {
                "scheme": "exact",
                "network": "eip155:8453",
            }

            mock_result = MagicMock()
            mock_result.kinds = [mock_kind]
            mock_result.signers = ["eoa"]
            mock_result.extensions = []
            mock_client.list_supported = AsyncMock(return_value=mock_result)

            args = argparse.Namespace(
                facilitator="https://facilitator.t402.io",
                output="json",
            )
            result = await cmd_supported(args)

            assert result == 0
            captured = capsys.readouterr()
            output = json.loads(captured.out)
            assert "kinds" in output
            assert "signers" in output


class TestMain:
    """Tests for the main entry point."""

    def test_main_no_command(self, capsys):
        """Test main with no command shows help."""
        with patch("sys.argv", ["t402"]):
            result = main()
            assert result == 0

    def test_main_encode_command(self):
        """Test main with encode command."""
        payload = {"scheme": "exact", "network": "eip155:8453"}

        with tempfile.NamedTemporaryFile(
            mode="w", suffix=".json", delete=False
        ) as f:
            json.dump(payload, f)
            f.flush()

            with patch("sys.argv", ["t402", "encode", f.name]):
                result = main()
                assert result == 0

    def test_main_decode_command(self):
        """Test main with decode command."""
        payload = {"scheme": "exact", "network": "eip155:8453"}
        encoded = encode_payment(payload)

        with patch("sys.argv", ["t402", "decode", encoded]):
            result = main()
            assert result == 0

    def test_main_info_command(self):
        """Test main with info command."""
        with patch("sys.argv", ["t402", "info", "eip155:1"]):
            result = main()
            assert result == 0


class TestEncodeDecodeRoundtrip:
    """Tests for encode/decode roundtrip."""

    def test_roundtrip_simple_payload(self, capsys):
        """Test encode/decode roundtrip with simple payload."""
        payload = {
            "scheme": "exact",
            "network": "eip155:8453",
            "payload": {"from": "0x123", "to": "0x456"},
        }

        # Encode
        with tempfile.NamedTemporaryFile(
            mode="w", suffix=".json", delete=False
        ) as f:
            json.dump(payload, f)
            f.flush()

            args_encode = argparse.Namespace(file=Path(f.name), output="text")
            cmd_encode(args_encode)
            captured = capsys.readouterr()
            encoded = captured.out.strip()

        # Decode
        args_decode = argparse.Namespace(payload=encoded, output="json")
        cmd_decode(args_decode)
        captured = capsys.readouterr()
        decoded = json.loads(captured.out)

        assert decoded["scheme"] == payload["scheme"]
        assert decoded["network"] == payload["network"]
        assert decoded["payload"]["from"] == payload["payload"]["from"]
        assert decoded["payload"]["to"] == payload["payload"]["to"]

    def test_roundtrip_v2_payload(self, capsys):
        """Test encode/decode roundtrip with V2 payload."""
        payload = {
            "t402Version": 2,
            "scheme": "exact",
            "network": "eip155:8453",
            "payload": {
                "from": "0x1234567890123456789012345678901234567890",
                "to": "0x0987654321098765432109876543210987654321",
                "amount": "1000000",
                "nonce": "0xabc123",
            },
        }

        # Encode
        with tempfile.NamedTemporaryFile(
            mode="w", suffix=".json", delete=False
        ) as f:
            json.dump(payload, f)
            f.flush()

            args_encode = argparse.Namespace(file=Path(f.name), output="text")
            cmd_encode(args_encode)
            captured = capsys.readouterr()
            encoded = captured.out.strip()

        # Decode
        args_decode = argparse.Namespace(payload=encoded, output="json")
        cmd_decode(args_decode)
        captured = capsys.readouterr()
        decoded = json.loads(captured.out)

        assert decoded["t402Version"] == 2
        assert decoded["payload"]["amount"] == "1000000"
