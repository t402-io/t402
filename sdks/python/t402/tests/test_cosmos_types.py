"""Tests for Cosmos/Noble types.

Tests cover:
- ExactDirectPayload model
- TransactionResult parsing
- MsgSend parsing and denom lookup
- Coin type
"""

from __future__ import annotations

from typing import List

import pytest

from t402.schemes.cosmos.types import (
    ExactDirectPayload,
    TransactionResult,
    MsgSend,
    Coin,
    ClientCosmosSigner,
    FacilitatorCosmosSigner,
)
from t402.schemes.cosmos.constants import MSG_TYPE_SEND


# =============================================================================
# Coin Tests
# =============================================================================


class TestCoin:
    """Test Coin data type."""

    def test_create_coin(self):
        coin = Coin(denom="uusdc", amount="1000000")
        assert coin.denom == "uusdc"
        assert coin.amount == "1000000"

    def test_to_dict(self):
        coin = Coin(denom="uusdc", amount="1000000")
        result = coin.to_dict()
        assert result == {"denom": "uusdc", "amount": "1000000"}

    def test_from_dict(self):
        coin = Coin.from_dict({"denom": "uusdc", "amount": "500000"})
        assert coin.denom == "uusdc"
        assert coin.amount == "500000"

    def test_from_dict_missing_fields(self):
        coin = Coin.from_dict({})
        assert coin.denom == ""
        assert coin.amount == "0"


# =============================================================================
# MsgSend Tests
# =============================================================================


class TestMsgSend:
    """Test MsgSend parsing and methods."""

    def test_from_dict_valid(self):
        data = {
            "@type": MSG_TYPE_SEND,
            "from_address": "noble1sender",
            "to_address": "noble1receiver",
            "amount": [{"denom": "uusdc", "amount": "1000000"}],
        }
        msg = MsgSend.from_dict(data)
        assert msg is not None
        assert msg.type == MSG_TYPE_SEND
        assert msg.from_address == "noble1sender"
        assert msg.to_address == "noble1receiver"
        assert len(msg.amount) == 1
        assert msg.amount[0].denom == "uusdc"

    def test_from_dict_wrong_type(self):
        data = {
            "@type": "/cosmos.staking.v1beta1.MsgDelegate",
            "delegator_address": "noble1abc",
        }
        msg = MsgSend.from_dict(data)
        assert msg is None

    def test_from_dict_no_type(self):
        data = {
            "from_address": "noble1sender",
            "to_address": "noble1receiver",
        }
        msg = MsgSend.from_dict(data)
        assert msg is None

    def test_get_amount_by_denom_found(self):
        msg = MsgSend(
            type=MSG_TYPE_SEND,
            from_address="noble1sender",
            to_address="noble1receiver",
            amount=[
                Coin(denom="uusdc", amount="1000000"),
                Coin(denom="uatom", amount="500"),
            ],
        )
        assert msg.get_amount_by_denom("uusdc") == "1000000"
        assert msg.get_amount_by_denom("uatom") == "500"

    def test_get_amount_by_denom_not_found(self):
        msg = MsgSend(
            type=MSG_TYPE_SEND,
            from_address="noble1sender",
            to_address="noble1receiver",
            amount=[Coin(denom="uusdc", amount="1000000")],
        )
        assert msg.get_amount_by_denom("uatom") == ""

    def test_get_amount_by_denom_empty(self):
        msg = MsgSend(
            type=MSG_TYPE_SEND,
            from_address="noble1sender",
            to_address="noble1receiver",
            amount=[],
        )
        assert msg.get_amount_by_denom("uusdc") == ""


# =============================================================================
# TransactionResult Tests
# =============================================================================


class TestTransactionResult:
    """Test TransactionResult parsing and methods."""

    def test_is_success_code_zero(self):
        result = TransactionResult(code=0)
        assert result.is_success() is True

    def test_is_success_code_nonzero(self):
        result = TransactionResult(code=1)
        assert result.is_success() is False

    def test_find_msg_send_found(self):
        result = TransactionResult(
            messages=[
                {
                    "@type": MSG_TYPE_SEND,
                    "from_address": "noble1sender",
                    "to_address": "noble1receiver",
                    "amount": [{"denom": "uusdc", "amount": "1000000"}],
                }
            ],
        )
        msg = result.find_msg_send()
        assert msg is not None
        assert msg.from_address == "noble1sender"

    def test_find_msg_send_not_found(self):
        result = TransactionResult(
            messages=[
                {
                    "@type": "/cosmos.staking.v1beta1.MsgDelegate",
                    "delegator_address": "noble1abc",
                }
            ],
        )
        msg = result.find_msg_send()
        assert msg is None

    def test_find_msg_send_empty(self):
        result = TransactionResult()
        msg = result.find_msg_send()
        assert msg is None

    def test_from_dict_direct_format(self):
        data = {
            "txhash": "AABB1122",
            "height": "12345",
            "code": 0,
            "raw_log": "success",
            "gas_wanted": "200000",
            "gas_used": "150000",
            "timestamp": "2026-01-01T00:00:00Z",
            "logs": [],
            "tx": {
                "body": {
                    "messages": [
                        {
                            "@type": MSG_TYPE_SEND,
                            "from_address": "noble1sender",
                            "to_address": "noble1receiver",
                            "amount": [{"denom": "uusdc", "amount": "1000000"}],
                        }
                    ],
                    "memo": "",
                },
            },
        }
        result = TransactionResult.from_dict(data)
        assert result.tx_hash == "AABB1122"
        assert result.height == "12345"
        assert result.code == 0
        assert result.is_success() is True
        assert len(result.messages) == 1

    def test_from_dict_nested_format(self):
        data = {
            "tx_response": {
                "txhash": "CCDD3344",
                "height": "67890",
                "code": 0,
                "raw_log": "",
                "gas_wanted": "200000",
                "gas_used": "100000",
                "logs": [],
                "timestamp": "2026-01-01T00:00:00Z",
            },
            "tx": {
                "body": {
                    "messages": [
                        {
                            "@type": MSG_TYPE_SEND,
                            "from_address": "noble1sender",
                            "to_address": "noble1receiver",
                            "amount": [{"denom": "uusdc", "amount": "500000"}],
                        }
                    ],
                    "memo": "test",
                },
            },
        }
        result = TransactionResult.from_dict(data)
        assert result.tx_hash == "CCDD3344"
        assert result.height == "67890"
        assert result.code == 0
        msg = result.find_msg_send()
        assert msg is not None
        assert msg.get_amount_by_denom("uusdc") == "500000"

    def test_from_dict_failed_tx(self):
        data = {
            "txhash": "FAILED",
            "height": "100",
            "code": 5,
            "raw_log": "insufficient funds",
            "logs": [],
            "tx": {"body": {"messages": []}},
        }
        result = TransactionResult.from_dict(data)
        assert result.code == 5
        assert result.is_success() is False
        assert result.raw_log == "insufficient funds"


# =============================================================================
# ExactDirectPayload Tests
# =============================================================================


class TestExactDirectPayload:
    """Test ExactDirectPayload model."""

    def test_create_payload(self):
        payload = ExactDirectPayload(
            tx_hash="AABB1122",
            from_address="noble1sender",
            to_address="noble1receiver",
            amount="1000000",
        )
        assert payload.tx_hash == "AABB1122"
        assert payload.from_address == "noble1sender"
        assert payload.to_address == "noble1receiver"
        assert payload.amount == "1000000"
        assert payload.denom == ""

    def test_create_payload_with_denom(self):
        payload = ExactDirectPayload(
            tx_hash="AABB1122",
            from_address="noble1sender",
            to_address="noble1receiver",
            amount="1000000",
            denom="uusdc",
        )
        assert payload.denom == "uusdc"

    def test_create_from_alias(self):
        data = {
            "txHash": "AABB1122",
            "from": "noble1sender",
            "to": "noble1receiver",
            "amount": "1000000",
            "denom": "uusdc",
        }
        payload = ExactDirectPayload.model_validate(data)
        assert payload.tx_hash == "AABB1122"
        assert payload.from_address == "noble1sender"
        assert payload.denom == "uusdc"

    def test_to_map_without_denom(self):
        payload = ExactDirectPayload(
            tx_hash="AABB1122",
            from_address="noble1sender",
            to_address="noble1receiver",
            amount="1000000",
        )
        result = payload.to_map()
        assert result["txHash"] == "AABB1122"
        assert result["from"] == "noble1sender"
        assert result["to"] == "noble1receiver"
        assert result["amount"] == "1000000"
        assert "denom" not in result

    def test_to_map_with_denom(self):
        payload = ExactDirectPayload(
            tx_hash="AABB1122",
            from_address="noble1sender",
            to_address="noble1receiver",
            amount="1000000",
            denom="uusdc",
        )
        result = payload.to_map()
        assert result["denom"] == "uusdc"

    def test_from_map(self):
        data = {
            "txHash": "AABB1122",
            "from": "noble1sender",
            "to": "noble1receiver",
            "amount": "1000000",
            "denom": "uusdc",
        }
        payload = ExactDirectPayload.from_map(data)
        assert payload.tx_hash == "AABB1122"
        assert payload.from_address == "noble1sender"
        assert payload.denom == "uusdc"

    def test_from_map_without_denom(self):
        data = {
            "txHash": "AABB1122",
            "from": "noble1sender",
            "to": "noble1receiver",
            "amount": "1000000",
        }
        payload = ExactDirectPayload.from_map(data)
        assert payload.denom == ""

    def test_invalid_amount(self):
        with pytest.raises(ValueError):
            ExactDirectPayload(
                tx_hash="abc",
                from_address="noble1sender",
                to_address="noble1receiver",
                amount="not-a-number",
            )

    def test_zero_amount(self):
        payload = ExactDirectPayload(
            tx_hash="abc",
            from_address="noble1sender",
            to_address="noble1receiver",
            amount="0",
        )
        assert payload.amount == "0"


# =============================================================================
# Protocol Compliance Tests
# =============================================================================


class TestProtocolCompliance:
    """Test that mock signers satisfy the Protocol interfaces."""

    def test_client_signer_protocol(self):
        """A class with address() and send_tokens() should satisfy ClientCosmosSigner."""

        class MockSigner:
            def address(self) -> str:
                return "noble1abc"

            async def send_tokens(
                self, network: str, to: str, amount: str, denom: str
            ) -> str:
                return "tx_hash"

        signer = MockSigner()
        assert isinstance(signer, ClientCosmosSigner)

    def test_facilitator_signer_protocol(self):
        """A class with the right methods should satisfy FacilitatorCosmosSigner."""

        class MockFacilitator:
            def get_addresses(self, network: str) -> List[str]:
                return ["noble1fac"]

            async def query_transaction(
                self, network: str, tx_hash: str
            ) -> TransactionResult:
                return TransactionResult()

            async def get_balance(
                self, network: str, address: str, denom: str
            ) -> str:
                return "0"

        fac = MockFacilitator()
        assert isinstance(fac, FacilitatorCosmosSigner)
