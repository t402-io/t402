"""Tests for T402 MCP Server real tool implementations.

Tests the web3_utils module and the real (non-demo) tool handlers
with mocked web3 calls.
"""

import io
import json
from unittest.mock import MagicMock, patch

import pytest

from t402.mcp import T402McpServer, ServerConfig
from t402.mcp.web3_utils import (
    ERC20_ABI,
    OFT_ABI,
    OFT_SENT_EVENT_SIGNATURE,
    address_to_bytes32,
    extract_message_guid_from_receipt,
    format_wei_to_ether,
    get_erc20_balance,
    get_native_balance,
    get_web3_provider,
)
from t402.mcp.constants import (
    CHAIN_IDS,
    LAYERZERO_ENDPOINT_IDS,
    NATIVE_SYMBOLS,
    TOKEN_DECIMALS,
    USDT0_ADDRESSES,
    format_token_amount,
    parse_token_amount,
)


# --- Helper fixtures ---

SAMPLE_ADDRESS = "0x1234567890abcdef1234567890abcdef12345678"
SAMPLE_RECIPIENT = "0xabcdefabcdefabcdefabcdefabcdefabcdefabcd"
SAMPLE_PRIVATE_KEY = "0x" + "ab" * 32
SAMPLE_TX_HASH = bytes.fromhex("aa" * 32)
SAMPLE_RPC_URL = "https://mock-rpc.example.com"


def make_mock_w3():
    """Create a mock Web3 instance with common methods."""
    w3 = MagicMock()
    w3.eth.get_balance.return_value = 1_000_000_000_000_000_000  # 1 ETH
    w3.eth.gas_price = 20_000_000_000  # 20 gwei
    w3.eth.get_transaction_count.return_value = 5
    w3.eth.chain_id = 1

    # Mock account from_key
    mock_account = MagicMock()
    mock_account.address = SAMPLE_ADDRESS
    w3.eth.account.from_key.return_value = mock_account

    return w3


def make_mock_contract(balance=100_000_000, decimals=6, symbol="USDC"):
    """Create a mock contract with standard ERC-20 return values."""
    contract = MagicMock()
    contract.functions.balanceOf.return_value.call.return_value = balance
    contract.functions.decimals.return_value.call.return_value = decimals
    contract.functions.symbol.return_value.call.return_value = symbol

    # For transfer
    contract.functions.transfer.return_value.build_transaction.return_value = {
        "from": SAMPLE_ADDRESS,
        "nonce": 5,
        "gas": 0,
        "gasPrice": 20_000_000_000,
    }

    return contract


# ---- web3_utils unit tests ----


class TestWeb3Utils:
    """Tests for web3_utils module functions."""

    def test_get_web3_provider(self):
        """Test get_web3_provider creates a Web3 instance."""
        with patch("t402.mcp.web3_utils.Web3") as MockWeb3:
            mock_instance = MagicMock()
            MockWeb3.return_value = mock_instance
            result = get_web3_provider("https://eth.llamarpc.com")
            assert result == mock_instance
            MockWeb3.HTTPProvider.assert_called_once_with("https://eth.llamarpc.com")

    def test_address_to_bytes32(self):
        """Test address_to_bytes32 pads correctly."""
        addr = "0x1234567890abcdef1234567890abcdef12345678"
        result = address_to_bytes32(addr)

        assert len(result) == 32
        # First 12 bytes should be zero padding
        assert result[:12] == b"\x00" * 12
        # Last 20 bytes should be the address
        assert result[12:] == bytes.fromhex(addr[2:])

    def test_address_to_bytes32_lowercase(self):
        """Test address_to_bytes32 handles mixed case."""
        addr = "0xAbCdEf1234567890AbCdEf1234567890AbCdEf12"
        result = address_to_bytes32(addr)
        assert len(result) == 32

    def test_format_wei_to_ether(self):
        """Test format_wei_to_ether conversion."""
        with patch("t402.mcp.web3_utils.Web3") as MockWeb3:
            MockWeb3.from_wei.return_value = 1.5
            result = format_wei_to_ether(1_500_000_000_000_000_000)
            MockWeb3.from_wei.assert_called_once_with(
                1_500_000_000_000_000_000, "ether"
            )
            assert result == "1.5"

    def test_get_erc20_balance(self):
        """Test get_erc20_balance calls balanceOf."""
        w3 = MagicMock()
        mock_contract = make_mock_contract(balance=50_000_000)
        w3.eth.contract.return_value = mock_contract

        with patch("t402.mcp.web3_utils.Web3") as MockWeb3:
            MockWeb3.to_checksum_address.side_effect = lambda x: x
            # Patch the module-level Web3 reference
            with patch("t402.mcp.web3_utils.get_erc20_contract", return_value=mock_contract):
                result = get_erc20_balance(w3, "0xtoken", SAMPLE_ADDRESS)

        # The mock returns 50_000_000 through the chain:
        # contract.functions.balanceOf(address).call()
        assert result == 50_000_000

    def test_get_native_balance(self):
        """Test get_native_balance calls eth.get_balance."""
        w3 = MagicMock()
        w3.eth.get_balance.return_value = 2_000_000_000_000_000_000

        with patch("t402.mcp.web3_utils.Web3") as MockWeb3:
            MockWeb3.to_checksum_address.side_effect = lambda x: x
            result = get_native_balance(w3, SAMPLE_ADDRESS)

        assert result == 2_000_000_000_000_000_000

    def test_extract_message_guid_from_receipt_found(self):
        """Test GUID extraction from OFTSent event."""
        from web3 import Web3

        topic0 = Web3.keccak(text=OFT_SENT_EVENT_SIGNATURE)
        guid_bytes = bytes.fromhex("bb" * 32)

        receipt = {
            "logs": [
                {
                    "topics": [topic0, guid_bytes],
                    "data": b"",
                }
            ]
        }

        result = extract_message_guid_from_receipt(receipt)
        assert result is not None
        assert result.startswith("0x")
        assert "bb" * 32 in result.lower()

    def test_extract_message_guid_from_receipt_not_found(self):
        """Test GUID extraction returns None when not found."""
        receipt = {
            "logs": [
                {
                    "topics": [bytes.fromhex("00" * 32)],
                    "data": b"",
                }
            ]
        }

        result = extract_message_guid_from_receipt(receipt)
        assert result is None

    def test_extract_message_guid_empty_logs(self):
        """Test GUID extraction with empty logs."""
        receipt = {"logs": []}
        result = extract_message_guid_from_receipt(receipt)
        assert result is None

    def test_erc20_abi_has_required_functions(self):
        """Test ERC20 ABI has balanceOf, transfer, approve, decimals, symbol, allowance."""
        function_names = {item["name"] for item in ERC20_ABI if item.get("type") == "function"}
        assert "balanceOf" in function_names
        assert "transfer" in function_names
        assert "approve" in function_names
        assert "decimals" in function_names
        assert "symbol" in function_names
        assert "allowance" in function_names

    def test_oft_abi_has_required_functions(self):
        """Test OFT ABI has quoteSend and send."""
        function_names = {item["name"] for item in OFT_ABI if item.get("type") == "function"}
        assert "quoteSend" in function_names
        assert "send" in function_names


# ---- Server tool handler tests with mocked web3 ----


class TestGetBalanceReal:
    """Tests for getBalance tool with mocked blockchain queries."""

    @pytest.mark.asyncio
    async def test_get_balance_real_mode(self):
        """Test getBalance in real mode with mocked web3 calls."""
        config = ServerConfig(
            rpc_urls={"ethereum": SAMPLE_RPC_URL},
        )
        server = T402McpServer(config)

        mock_w3 = make_mock_w3()

        with patch.object(server, "_get_web3", return_value=mock_w3):
            with patch(
                "t402.mcp.server.get_native_balance", return_value=1_500_000_000_000_000_000
            ):
                with patch(
                    "t402.mcp.server.get_erc20_balance", return_value=100_000_000
                ):
                    result = await server._handle_get_balance(
                        {"address": SAMPLE_ADDRESS, "network": "ethereum"}
                    )

        assert not result.isError
        text = result.content[0].text
        assert "## Balance on ethereum" in text
        assert "ETH" in text

    @pytest.mark.asyncio
    async def test_get_balance_invalid_network(self):
        """Test getBalance with invalid network."""
        config = ServerConfig()
        server = T402McpServer(config)

        result = await server._handle_get_balance(
            {"address": SAMPLE_ADDRESS, "network": "invalid_chain"}
        )

        assert result.isError
        assert "Invalid network" in result.content[0].text

    @pytest.mark.asyncio
    async def test_get_balance_demo_mode(self):
        """Test getBalance returns placeholder in demo mode."""
        config = ServerConfig(demo_mode=True)
        server = T402McpServer(config)

        result = await server._handle_get_balance(
            {"address": SAMPLE_ADDRESS, "network": "ethereum"}
        )

        assert not result.isError
        text = result.content[0].text
        assert "## Balance on ethereum" in text
        assert "0.0" in text

    @pytest.mark.asyncio
    async def test_get_balance_rpc_error_handled(self):
        """Test getBalance handles RPC errors gracefully."""
        config = ServerConfig(
            rpc_urls={"ethereum": SAMPLE_RPC_URL},
        )
        server = T402McpServer(config)

        with patch.object(server, "_get_web3", side_effect=Exception("Connection failed")):
            result = await server._handle_get_balance(
                {"address": SAMPLE_ADDRESS, "network": "ethereum"}
            )

        # Should get a result with an error message in the NetworkBalance
        assert not result.isError
        text = result.content[0].text
        assert "Connection failed" in text


class TestGetAllBalancesReal:
    """Tests for getAllBalances tool with mocked blockchain queries."""

    @pytest.mark.asyncio
    async def test_get_all_balances_demo_mode(self):
        """Test getAllBalances in demo mode."""
        config = ServerConfig(demo_mode=True)
        server = T402McpServer(config)

        result = await server._handle_get_all_balances(
            {"address": SAMPLE_ADDRESS}
        )

        assert not result.isError
        text = result.content[0].text
        assert "## Balances Across All Networks" in text
        assert "ethereum" in text
        assert "base" in text

    @pytest.mark.asyncio
    async def test_get_all_balances_real_mode_parallel(self):
        """Test getAllBalances queries networks in parallel."""
        config = ServerConfig(
            rpc_urls={"ethereum": SAMPLE_RPC_URL},
        )
        server = T402McpServer(config)

        async def mock_fetch_balance(address, network):
            from t402.mcp.types import NetworkBalance, BalanceInfo

            return NetworkBalance(
                network=network,
                native=BalanceInfo(
                    token=NATIVE_SYMBOLS.get(network, "ETH"),
                    balance="1.0",
                    raw="1000000000000000000",
                ),
                tokens=[],
            )

        with patch.object(server, "_fetch_single_balance", side_effect=mock_fetch_balance):
            result = await server._handle_get_all_balances(
                {"address": SAMPLE_ADDRESS}
            )

        assert not result.isError
        text = result.content[0].text
        assert "## Balances Across All Networks" in text
        # Should have entries for all 9 networks
        assert "ethereum" in text
        assert "base" in text
        assert "arbitrum" in text

    @pytest.mark.asyncio
    async def test_get_all_balances_partial_errors(self):
        """Test getAllBalances handles per-network errors gracefully."""
        config = ServerConfig()
        server = T402McpServer(config)

        call_count = 0

        async def mock_fetch_balance(address, network):
            nonlocal call_count
            call_count += 1
            from t402.mcp.types import NetworkBalance, BalanceInfo

            if network == "ethereum":
                return NetworkBalance(network=network, error="RPC timeout")
            return NetworkBalance(
                network=network,
                native=BalanceInfo(token="ETH", balance="0", raw="0"),
                tokens=[],
            )

        with patch.object(server, "_fetch_single_balance", side_effect=mock_fetch_balance):
            result = await server._handle_get_all_balances(
                {"address": SAMPLE_ADDRESS}
            )

        assert not result.isError
        text = result.content[0].text
        assert "RPC timeout" in text
        # Should have been called for all 9 networks
        assert call_count == 9


class TestPayReal:
    """Tests for pay tool with mocked web3 calls."""

    @pytest.mark.asyncio
    async def test_pay_demo_mode(self):
        """Test pay in demo mode."""
        config = ServerConfig(demo_mode=True)
        server = T402McpServer(config)

        result = await server._handle_pay({
            "to": SAMPLE_RECIPIENT,
            "amount": "100",
            "token": "USDC",
            "network": "ethereum",
        })

        assert not result.isError
        text = result.content[0].text
        assert "Demo Mode" in text
        assert "100" in text
        assert "USDC" in text

    @pytest.mark.asyncio
    async def test_pay_no_private_key(self):
        """Test pay without private key or demo mode."""
        config = ServerConfig()
        server = T402McpServer(config)

        result = await server._handle_pay({
            "to": SAMPLE_RECIPIENT,
            "amount": "100",
            "token": "USDC",
            "network": "ethereum",
        })

        assert result.isError
        assert "Private key not configured" in result.content[0].text

    @pytest.mark.asyncio
    async def test_pay_unsupported_token(self):
        """Test pay with unsupported token on network."""
        config = ServerConfig(demo_mode=True)
        server = T402McpServer(config)

        result = await server._handle_pay({
            "to": SAMPLE_RECIPIENT,
            "amount": "100",
            "token": "USDT",
            "network": "base",  # base doesn't have USDT
        })

        assert result.isError
        assert "not supported" in result.content[0].text

    @pytest.mark.asyncio
    async def test_pay_real_mode_builds_correct_tx(self):
        """Test pay in real mode builds and sends correct ERC-20 transfer."""
        config = ServerConfig(
            private_key=SAMPLE_PRIVATE_KEY,
            rpc_urls={"ethereum": SAMPLE_RPC_URL},
        )
        server = T402McpServer(config)

        mock_w3 = make_mock_w3()

        fake_receipt = {
            "transactionHash": SAMPLE_TX_HASH,
            "status": 1,
        }

        with patch.object(server, "_get_web3", return_value=mock_w3):
            with patch(
                "t402.mcp.server.transfer_erc20",
                return_value=fake_receipt,
            ) as mock_transfer:
                result = await server._handle_pay({
                    "to": SAMPLE_RECIPIENT,
                    "amount": "50.5",
                    "token": "USDC",
                    "network": "ethereum",
                })

        assert not result.isError
        text = result.content[0].text
        assert "## Payment Successful" in text
        assert "50.5" in text
        assert "USDC" in text

        # Verify transfer was called with correct parameters
        mock_transfer.assert_called_once()
        call_args = mock_transfer.call_args
        assert call_args[0][0] == mock_w3  # web3 instance
        assert call_args[0][1] == SAMPLE_PRIVATE_KEY  # private key
        # token_address should be USDC on ethereum
        assert call_args[0][3] == SAMPLE_RECIPIENT  # to address
        assert call_args[0][4] == parse_token_amount("50.5", TOKEN_DECIMALS)  # amount

    @pytest.mark.asyncio
    async def test_pay_invalid_network(self):
        """Test pay with invalid network."""
        config = ServerConfig(private_key=SAMPLE_PRIVATE_KEY)
        server = T402McpServer(config)

        result = await server._handle_pay({
            "to": SAMPLE_RECIPIENT,
            "amount": "100",
            "token": "USDC",
            "network": "solana",
        })

        assert result.isError
        assert "Invalid network" in result.content[0].text


class TestPayGaslessReal:
    """Tests for payGasless tool."""

    @pytest.mark.asyncio
    async def test_pay_gasless_demo_mode(self):
        """Test payGasless in demo mode."""
        config = ServerConfig(demo_mode=True)
        server = T402McpServer(config)

        result = await server._handle_pay_gasless({
            "to": SAMPLE_RECIPIENT,
            "amount": "100",
            "token": "USDC",
            "network": "ethereum",
        })

        assert not result.isError
        text = result.content[0].text
        assert "Demo Mode" in text
        assert "gasless" in result.content[0].text.lower() or "100" in text

    @pytest.mark.asyncio
    async def test_pay_gasless_unsupported_network(self):
        """Test payGasless with unsupported network."""
        config = ServerConfig(demo_mode=True)
        server = T402McpServer(config)

        result = await server._handle_pay_gasless({
            "to": SAMPLE_RECIPIENT,
            "amount": "100",
            "token": "USDC",
            "network": "ink",  # ink doesn't support gasless
        })

        assert result.isError
        assert "does not support gasless" in result.content[0].text

    @pytest.mark.asyncio
    async def test_pay_gasless_no_bundler(self):
        """Test payGasless without bundler configured."""
        config = ServerConfig()  # No bundler_url, no demo_mode
        server = T402McpServer(config)

        result = await server._handle_pay_gasless({
            "to": SAMPLE_RECIPIENT,
            "amount": "100",
            "token": "USDC",
            "network": "ethereum",
        })

        assert result.isError
        assert "Bundler URL not configured" in result.content[0].text

    @pytest.mark.asyncio
    async def test_pay_gasless_real_mode_requires_private_key(self):
        """Test payGasless in real mode requires private key."""
        config = ServerConfig(
            bundler_url="https://bundler.example.com",
        )
        server = T402McpServer(config)

        result = await server._handle_pay_gasless({
            "to": SAMPLE_RECIPIENT,
            "amount": "100",
            "token": "USDC",
            "network": "ethereum",
        })

        assert result.isError
        assert "Private key not configured" in result.content[0].text


class TestGetBridgeFeeReal:
    """Tests for getBridgeFee tool with mocked web3 calls."""

    @pytest.mark.asyncio
    async def test_get_bridge_fee_demo_mode(self):
        """Test getBridgeFee in demo mode."""
        config = ServerConfig(demo_mode=True)
        server = T402McpServer(config)

        result = await server._handle_get_bridge_fee({
            "fromChain": "arbitrum",
            "toChain": "ethereum",
            "amount": "100",
            "recipient": SAMPLE_RECIPIENT,
        })

        assert not result.isError
        text = result.content[0].text
        assert "## Bridge Fee Quote" in text
        assert "arbitrum" in text
        assert "ethereum" in text
        assert "0.001" in text

    @pytest.mark.asyncio
    async def test_get_bridge_fee_same_chain(self):
        """Test getBridgeFee with same source and destination."""
        config = ServerConfig(demo_mode=True)
        server = T402McpServer(config)

        result = await server._handle_get_bridge_fee({
            "fromChain": "ethereum",
            "toChain": "ethereum",
            "amount": "100",
            "recipient": SAMPLE_RECIPIENT,
        })

        assert result.isError
        assert "different" in result.content[0].text

    @pytest.mark.asyncio
    async def test_get_bridge_fee_unbridgeable(self):
        """Test getBridgeFee with non-bridgeable chain."""
        config = ServerConfig(demo_mode=True)
        server = T402McpServer(config)

        result = await server._handle_get_bridge_fee({
            "fromChain": "base",
            "toChain": "ethereum",
            "amount": "100",
            "recipient": SAMPLE_RECIPIENT,
        })

        assert result.isError
        assert "does not support USDT0 bridging" in result.content[0].text

    @pytest.mark.asyncio
    async def test_get_bridge_fee_real_mode(self):
        """Test getBridgeFee in real mode queries contract."""
        config = ServerConfig(
            rpc_urls={"arbitrum": SAMPLE_RPC_URL},
        )
        server = T402McpServer(config)

        mock_w3 = make_mock_w3()
        # quote returns (nativeFee, lzTokenFee)
        mock_native_fee = 500_000_000_000_000  # 0.0005 ETH

        with patch.object(server, "_get_web3", return_value=mock_w3):
            with patch(
                "t402.mcp.server.quote_bridge_fee",
                return_value=(mock_native_fee, 0),
            ):
                with patch(
                    "t402.mcp.server.format_wei_to_ether",
                    return_value="0.0005",
                ):
                    result = await server._handle_get_bridge_fee({
                        "fromChain": "arbitrum",
                        "toChain": "ethereum",
                        "amount": "100",
                        "recipient": SAMPLE_RECIPIENT,
                    })

        assert not result.isError
        text = result.content[0].text
        assert "## Bridge Fee Quote" in text
        assert "0.0005" in text
        assert "arbitrum" in text
        assert "ethereum" in text


class TestBridgeReal:
    """Tests for bridge tool with mocked web3 calls."""

    @pytest.mark.asyncio
    async def test_bridge_demo_mode(self):
        """Test bridge in demo mode."""
        config = ServerConfig(demo_mode=True)
        server = T402McpServer(config)

        result = await server._handle_bridge({
            "fromChain": "arbitrum",
            "toChain": "ethereum",
            "amount": "100",
            "recipient": SAMPLE_RECIPIENT,
        })

        assert not result.isError
        text = result.content[0].text
        assert "Demo Mode" in text
        assert "LayerZero Scan" in text

    @pytest.mark.asyncio
    async def test_bridge_no_private_key(self):
        """Test bridge without private key."""
        config = ServerConfig()
        server = T402McpServer(config)

        result = await server._handle_bridge({
            "fromChain": "arbitrum",
            "toChain": "ethereum",
            "amount": "100",
            "recipient": SAMPLE_RECIPIENT,
        })

        assert result.isError
        assert "Private key not configured" in result.content[0].text

    @pytest.mark.asyncio
    async def test_bridge_same_chain(self):
        """Test bridge with same chain."""
        config = ServerConfig(demo_mode=True)
        server = T402McpServer(config)

        result = await server._handle_bridge({
            "fromChain": "arbitrum",
            "toChain": "arbitrum",
            "amount": "100",
            "recipient": SAMPLE_RECIPIENT,
        })

        assert result.isError
        assert "different" in result.content[0].text

    @pytest.mark.asyncio
    async def test_bridge_unbridgeable_chain(self):
        """Test bridge with non-bridgeable chain."""
        config = ServerConfig(demo_mode=True)
        server = T402McpServer(config)

        result = await server._handle_bridge({
            "fromChain": "polygon",
            "toChain": "ethereum",
            "amount": "100",
            "recipient": SAMPLE_RECIPIENT,
        })

        assert result.isError
        assert "does not support USDT0 bridging" in result.content[0].text

    @pytest.mark.asyncio
    async def test_bridge_real_mode_executes_send(self):
        """Test bridge in real mode executes LayerZero send."""
        config = ServerConfig(
            private_key=SAMPLE_PRIVATE_KEY,
            rpc_urls={"arbitrum": SAMPLE_RPC_URL},
        )
        server = T402McpServer(config)

        mock_w3 = make_mock_w3()
        mock_native_fee = 500_000_000_000_000

        # Mock the OFTSent event GUID
        fake_guid = "0x" + "cc" * 32
        fake_receipt = {
            "transactionHash": SAMPLE_TX_HASH,
            "status": 1,
            "logs": [],
        }

        with patch.object(server, "_get_web3", return_value=mock_w3):
            with patch(
                "t402.mcp.server.quote_bridge_fee",
                return_value=(mock_native_fee, 0),
            ):
                with patch(
                    "t402.mcp.server.get_erc20_balance",
                    return_value=200_000_000,  # 200 USDT0
                ):
                    with patch(
                        "t402.mcp.server.execute_bridge_send",
                        return_value=fake_receipt,
                    ) as mock_send:
                        with patch(
                            "t402.mcp.server.extract_message_guid_from_receipt",
                            return_value=fake_guid,
                        ):
                            result = await server._handle_bridge({
                                "fromChain": "arbitrum",
                                "toChain": "ethereum",
                                "amount": "100",
                                "recipient": SAMPLE_RECIPIENT,
                            })

        assert not result.isError
        text = result.content[0].text
        assert "## Bridge Initiated" in text
        assert "LayerZero Scan" in text
        assert "100" in text
        assert "arbitrum" in text
        assert "ethereum" in text

        # Verify send was called
        mock_send.assert_called_once()

    @pytest.mark.asyncio
    async def test_bridge_insufficient_balance(self):
        """Test bridge fails with insufficient USDT0 balance."""
        config = ServerConfig(
            private_key=SAMPLE_PRIVATE_KEY,
            rpc_urls={"arbitrum": SAMPLE_RPC_URL},
        )
        server = T402McpServer(config)

        mock_w3 = make_mock_w3()

        with patch.object(server, "_get_web3", return_value=mock_w3):
            with patch(
                "t402.mcp.server.quote_bridge_fee",
                return_value=(500_000_000_000_000, 0),
            ):
                with patch(
                    "t402.mcp.server.get_erc20_balance",
                    return_value=10_000_000,  # Only 10 USDT0
                ):
                    result = await server._handle_bridge({
                        "fromChain": "arbitrum",
                        "toChain": "ethereum",
                        "amount": "100",
                        "recipient": SAMPLE_RECIPIENT,
                    })

        assert result.isError
        assert "Insufficient USDT0 balance" in result.content[0].text

    @pytest.mark.asyncio
    async def test_bridge_no_guid_extracted(self):
        """Test bridge handles missing GUID in logs."""
        config = ServerConfig(
            private_key=SAMPLE_PRIVATE_KEY,
            rpc_urls={"arbitrum": SAMPLE_RPC_URL},
        )
        server = T402McpServer(config)

        mock_w3 = make_mock_w3()
        fake_receipt = {
            "transactionHash": SAMPLE_TX_HASH,
            "status": 1,
            "logs": [],
        }

        with patch.object(server, "_get_web3", return_value=mock_w3):
            with patch(
                "t402.mcp.server.quote_bridge_fee",
                return_value=(500_000_000_000_000, 0),
            ):
                with patch(
                    "t402.mcp.server.get_erc20_balance",
                    return_value=200_000_000,
                ):
                    with patch(
                        "t402.mcp.server.execute_bridge_send",
                        return_value=fake_receipt,
                    ):
                        with patch(
                            "t402.mcp.server.extract_message_guid_from_receipt",
                            return_value=None,
                        ):
                            result = await server._handle_bridge({
                                "fromChain": "arbitrum",
                                "toChain": "ethereum",
                                "amount": "100",
                                "recipient": SAMPLE_RECIPIENT,
                            })

        assert result.isError
        assert "failed to extract message GUID" in result.content[0].text


class TestFetchSingleBalance:
    """Tests for _fetch_single_balance helper."""

    @pytest.mark.asyncio
    async def test_fetch_balance_with_tokens(self):
        """Test _fetch_single_balance returns native and token balances."""
        config = ServerConfig(
            rpc_urls={"ethereum": SAMPLE_RPC_URL},
        )
        server = T402McpServer(config)

        mock_w3 = make_mock_w3()

        with patch.object(server, "_get_web3", return_value=mock_w3):
            with patch(
                "t402.mcp.server.get_native_balance",
                return_value=2_500_000_000_000_000_000,
            ):
                with patch(
                    "t402.mcp.server.get_erc20_balance",
                    side_effect=[
                        100_000_000,  # 100 USDC
                        50_000_000,   # 50 USDT
                        0,            # 0 USDT0
                    ],
                ):
                    result = await server._fetch_single_balance(
                        SAMPLE_ADDRESS, "ethereum"
                    )

        assert result.error is None
        assert result.network == "ethereum"
        assert result.native is not None
        assert result.native.token == "ETH"
        assert result.native.raw == "2500000000000000000"
        # Should have USDC and USDT but not USDT0 (0 balance)
        assert len(result.tokens) == 2
        assert result.tokens[0].token == "USDC"
        assert result.tokens[1].token == "USDT"

    @pytest.mark.asyncio
    async def test_fetch_balance_rpc_failure(self):
        """Test _fetch_single_balance captures RPC errors."""
        config = ServerConfig(
            rpc_urls={"ethereum": SAMPLE_RPC_URL},
        )
        server = T402McpServer(config)

        with patch.object(server, "_get_web3", side_effect=Exception("Connection refused")):
            result = await server._fetch_single_balance(
                SAMPLE_ADDRESS, "ethereum"
            )

        assert result.network == "ethereum"
        assert result.error is not None
        assert "Connection refused" in result.error


class TestEndToEndJsonRpc:
    """Tests for full JSON-RPC request flow with real handlers."""

    @pytest.mark.asyncio
    async def test_get_balance_real_via_jsonrpc(self):
        """Test getBalance through the full JSON-RPC flow."""
        config = ServerConfig(
            rpc_urls={"ethereum": SAMPLE_RPC_URL},
        )

        request = {
            "jsonrpc": "2.0",
            "id": 1,
            "method": "tools/call",
            "params": {
                "name": "t402/getBalance",
                "arguments": {
                    "address": SAMPLE_ADDRESS,
                    "network": "ethereum",
                },
            },
        }
        stdin = io.StringIO(json.dumps(request) + "\n")
        stdout = io.StringIO()

        server = T402McpServer(config, stdin=stdin, stdout=stdout)

        mock_w3 = make_mock_w3()

        with patch.object(server, "_get_web3", return_value=mock_w3):
            with patch(
                "t402.mcp.server.get_native_balance",
                return_value=1_000_000_000_000_000_000,
            ):
                with patch(
                    "t402.mcp.server.get_erc20_balance",
                    return_value=0,
                ):
                    await server.run()

        stdout.seek(0)
        response = json.loads(stdout.read())

        assert response["jsonrpc"] == "2.0"
        assert response["id"] == 1
        assert "result" in response
        assert response["result"]["isError"] is False
        assert "## Balance on ethereum" in response["result"]["content"][0]["text"]

    @pytest.mark.asyncio
    async def test_pay_real_via_jsonrpc(self):
        """Test pay through the full JSON-RPC flow."""
        config = ServerConfig(
            private_key=SAMPLE_PRIVATE_KEY,
            rpc_urls={"ethereum": SAMPLE_RPC_URL},
        )

        request = {
            "jsonrpc": "2.0",
            "id": 2,
            "method": "tools/call",
            "params": {
                "name": "t402/pay",
                "arguments": {
                    "to": SAMPLE_RECIPIENT,
                    "amount": "25",
                    "token": "USDC",
                    "network": "ethereum",
                },
            },
        }
        stdin = io.StringIO(json.dumps(request) + "\n")
        stdout = io.StringIO()

        server = T402McpServer(config, stdin=stdin, stdout=stdout)
        mock_w3 = make_mock_w3()

        fake_receipt = {
            "transactionHash": SAMPLE_TX_HASH,
            "status": 1,
        }

        with patch.object(server, "_get_web3", return_value=mock_w3):
            with patch(
                "t402.mcp.server.transfer_erc20",
                return_value=fake_receipt,
            ):
                await server.run()

        stdout.seek(0)
        response = json.loads(stdout.read())

        assert response["result"]["isError"] is False
        text = response["result"]["content"][0]["text"]
        assert "## Payment Successful" in text
        assert "25" in text
        assert "USDC" in text
        assert "etherscan.io" in text


class TestConstants:
    """Tests to verify constant integrity for real handlers."""

    def test_all_bridgeable_chains_have_usdt0(self):
        """All bridgeable chains must have a USDT0 address."""
        from t402.mcp.constants import BRIDGEABLE_CHAINS

        for chain in BRIDGEABLE_CHAINS:
            assert chain in USDT0_ADDRESSES, f"Missing USDT0 address for {chain}"

    def test_all_bridgeable_chains_have_endpoint_id(self):
        """All bridgeable chains must have a LayerZero endpoint ID."""
        from t402.mcp.constants import BRIDGEABLE_CHAINS

        for chain in BRIDGEABLE_CHAINS:
            assert chain in LAYERZERO_ENDPOINT_IDS, (
                f"Missing LZ endpoint ID for {chain}"
            )

    def test_all_networks_have_chain_id(self):
        """All networks must have a chain ID."""
        from t402.mcp.constants import ALL_NETWORKS

        for network in ALL_NETWORKS:
            assert network in CHAIN_IDS, f"Missing chain ID for {network}"

    def test_all_networks_have_native_symbol(self):
        """All networks must have a native symbol."""
        from t402.mcp.constants import ALL_NETWORKS

        for network in ALL_NETWORKS:
            assert network in NATIVE_SYMBOLS, f"Missing native symbol for {network}"

    def test_parse_and_format_roundtrip(self):
        """Test parse_token_amount and format_token_amount are inverse."""
        test_amounts = ["1", "100", "0.5", "1000.123456", "0.000001"]

        for amount_str in test_amounts:
            raw = parse_token_amount(amount_str, TOKEN_DECIMALS)
            formatted = format_token_amount(raw, TOKEN_DECIMALS)
            assert formatted == amount_str, (
                f"Roundtrip failed: {amount_str} -> {raw} -> {formatted}"
            )
