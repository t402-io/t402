"""
Tests for T402 Multi-sig (Safe) support.
"""

import time
import pytest

from t402.multisig import (
    SignatureType,
    OperationType,
    SafeTransaction,
    SafeSignature,
    TransactionRequest,
    TransactionBuilder,
    BatchTransactionBuilder,
    SignatureCollector,
    erc20_transfer,
    eth_transfer,
    is_valid_threshold,
    are_addresses_unique,
    get_owner_index,
    sort_addresses,
    combine_signatures,
    SAFE_MULTISEND,
    MIN_THRESHOLD,
)


class TestTransactionBuilder:
    """Tests for TransactionBuilder."""

    def test_basic_build(self):
        """Test basic transaction building."""
        to = "0x1234567890123456789012345678901234567890"
        value = 1000000
        data = b"\xa9\x05\x9c\xbb"

        tx = (
            TransactionBuilder()
            .to(to)
            .value(value)
            .data(data)
            .build()
        )

        assert tx.to.lower() == to.lower()
        assert tx.value == value
        assert tx.data == data
        assert tx.operation == OperationType.CALL

    def test_delegate_call(self):
        """Test delegate call operation."""
        tx = (
            TransactionBuilder()
            .to("0x1234567890123456789012345678901234567890")
            .delegate_call()
            .build()
        )

        assert tx.operation == OperationType.DELEGATE_CALL

    def test_gas_settings(self):
        """Test gas-related settings."""
        tx = (
            TransactionBuilder()
            .to("0x1234567890123456789012345678901234567890")
            .safe_tx_gas(100000)
            .base_gas(50000)
            .gas_price(20000000000)
            .build()
        )

        assert tx.safe_tx_gas == 100000
        assert tx.base_gas == 50000
        assert tx.gas_price == 20000000000


class TestTransactionHelpers:
    """Tests for transaction helper functions."""

    def test_erc20_transfer(self):
        """Test ERC20 transfer transaction creation."""
        token = "0xdAC17F958D2ee523a2206206994597C13D831ec7"
        to = "0x1234567890123456789012345678901234567890"
        amount = 1000000

        tx = erc20_transfer(token, to, amount)

        assert tx.to.lower() == token.lower()
        # Check transfer selector
        assert tx.data[:4] == b"\xa9\x05\x9c\xbb"

    def test_eth_transfer(self):
        """Test ETH transfer transaction creation."""
        to = "0x1234567890123456789012345678901234567890"
        amount = 1000000000000000000  # 1 ETH

        tx = eth_transfer(to, amount)

        assert tx.to.lower() == to.lower()
        assert tx.value == amount
        assert tx.data == b""


class TestBatchTransactionBuilder:
    """Tests for BatchTransactionBuilder."""

    def test_batch_build(self):
        """Test batch transaction building."""
        token = "0xdAC17F958D2ee523a2206206994597C13D831ec7"
        to1 = "0x1111111111111111111111111111111111111111"
        to2 = "0x2222222222222222222222222222222222222222"
        amount = 1000000

        batch = (
            BatchTransactionBuilder()
            .add_transfer(token, to1, amount)
            .add_transfer(token, to2, amount)
        )

        txs = batch.build()
        assert len(txs) == 2

    def test_batch_multisend(self):
        """Test MultiSend transaction creation."""
        token = "0xdAC17F958D2ee523a2206206994597C13D831ec7"
        to1 = "0x1111111111111111111111111111111111111111"
        to2 = "0x2222222222222222222222222222222222222222"
        amount = 1000000

        batch = (
            BatchTransactionBuilder()
            .add_transfer(token, to1, amount)
            .add_transfer(token, to2, amount)
        )

        multisend_tx = batch.build_multisend()

        assert multisend_tx.to.lower() == SAFE_MULTISEND.lower()
        assert multisend_tx.operation == OperationType.DELEGATE_CALL
        # Check multiSend selector
        assert multisend_tx.data[:4] == b"\x8d\x80\xff\x0a"


class TestSignatureCollector:
    """Tests for SignatureCollector."""

    def test_create_request(self):
        """Test request creation."""
        collector = SignatureCollector()

        safe_addr = "0x1234567890123456789012345678901234567890"
        tx = TransactionBuilder().to("0xabcdef1234567890123456789012345678901234").build()
        tx_hash = "0x" + "12" * 32
        owners = [
            "0xAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA",
            "0xBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB",
        ]
        threshold = 2

        request = collector.create_request(safe_addr, tx, tx_hash, owners, threshold)

        assert request.id.startswith("msig_")
        assert request.threshold == threshold
        assert not request.is_ready()

    def test_add_signature(self):
        """Test adding signatures."""
        collector = SignatureCollector()

        safe_addr = "0x1234567890123456789012345678901234567890"
        tx = TransactionBuilder().to("0xabcdef1234567890123456789012345678901234").build()
        tx_hash = "0x" + "12" * 32
        owners = [
            "0xAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA",
            "0xBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB",
        ]

        request = collector.create_request(safe_addr, tx, tx_hash, owners, 2)

        # Add first signature
        sig1 = SafeSignature(
            signer=owners[0],
            signature=b"\x00" * 65,
            signature_type=SignatureType.EOA,
        )
        collector.add_signature(request.id, sig1)

        req = collector.get_request(request.id)
        assert req is not None
        assert req.collected_count() == 1
        assert not req.is_ready()

        # Add second signature
        sig2 = SafeSignature(
            signer=owners[1],
            signature=b"\x00" * 65,
            signature_type=SignatureType.EOA,
        )
        collector.add_signature(request.id, sig2)

        req = collector.get_request(request.id)
        assert req is not None
        assert req.collected_count() == 2
        assert req.is_ready()

    def test_duplicate_signature(self):
        """Test duplicate signature rejection."""
        collector = SignatureCollector()

        safe_addr = "0x1234567890123456789012345678901234567890"
        tx = TransactionBuilder().build()
        tx_hash = "0x" + "12" * 32
        owners = ["0xAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA"]

        request = collector.create_request(safe_addr, tx, tx_hash, owners, 1)

        sig = SafeSignature(
            signer=owners[0],
            signature=b"\x00" * 65,
            signature_type=SignatureType.EOA,
        )

        # First should succeed
        collector.add_signature(request.id, sig)

        # Second should fail
        with pytest.raises(ValueError, match="Already signed"):
            collector.add_signature(request.id, sig)

    def test_expiration(self):
        """Test request expiration."""
        collector = SignatureCollector(expiration_seconds=1)

        safe_addr = "0x1234567890123456789012345678901234567890"
        tx = TransactionBuilder().build()
        tx_hash = "0x" + "12" * 32
        owners = ["0xAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA"]

        request = collector.create_request(safe_addr, tx, tx_hash, owners, 1)

        # Wait for expiration
        time.sleep(2)

        # Should return None
        req = collector.get_request(request.id)
        assert req is None


class TestTransactionRequest:
    """Tests for TransactionRequest."""

    def test_is_ready(self):
        """Test is_ready with various signature counts."""
        test_cases = [
            (0, 2, False),
            (1, 2, False),
            (2, 2, True),
            (3, 2, True),
            (1, 1, True),
        ]

        for sig_count, threshold, expected in test_cases:
            request = TransactionRequest(
                id="test",
                safe_address="0x0000000000000000000000000000000000000000",
                transaction=SafeTransaction(to="0x0000000000000000000000000000000000000000"),
                transaction_hash="0x" + "00" * 32,
                signatures={
                    f"0x{i:040x}": SafeSignature(
                        signer=f"0x{i:040x}",
                        signature=b"\x00" * 65,
                    )
                    for i in range(sig_count)
                },
                threshold=threshold,
            )
            assert request.is_ready() == expected


class TestUtilities:
    """Tests for utility functions."""

    def test_is_valid_threshold(self):
        """Test threshold validation."""
        assert not is_valid_threshold(0, 3)
        assert is_valid_threshold(1, 3)
        assert is_valid_threshold(2, 3)
        assert is_valid_threshold(3, 3)
        assert not is_valid_threshold(4, 3)
        assert is_valid_threshold(1, 1)
        assert not is_valid_threshold(0, 1)

    def test_are_addresses_unique(self):
        """Test address uniqueness check."""
        addr1 = "0x1111111111111111111111111111111111111111"
        addr2 = "0x2222222222222222222222222222222222222222"
        addr3 = "0x3333333333333333333333333333333333333333"

        assert are_addresses_unique([])
        assert are_addresses_unique([addr1])
        assert are_addresses_unique([addr1, addr2, addr3])
        assert not are_addresses_unique([addr1, addr2, addr1])
        assert not are_addresses_unique([addr1, addr1, addr1])

    def test_get_owner_index(self):
        """Test owner index lookup."""
        owners = [
            "0x1111111111111111111111111111111111111111",
            "0x2222222222222222222222222222222222222222",
            "0x3333333333333333333333333333333333333333",
        ]

        assert get_owner_index(owners[0], owners) == 0
        assert get_owner_index(owners[1], owners) == 1
        assert get_owner_index(owners[2], owners) == 2
        assert get_owner_index("0x4444444444444444444444444444444444444444", owners) == -1

    def test_sort_addresses(self):
        """Test address sorting."""
        addrs = [
            "0x3333333333333333333333333333333333333333",
            "0x1111111111111111111111111111111111111111",
            "0x2222222222222222222222222222222222222222",
        ]

        sorted_addrs = sort_addresses(addrs)

        assert sorted_addrs[0].lower() < sorted_addrs[1].lower()
        assert sorted_addrs[1].lower() < sorted_addrs[2].lower()

    def test_combine_signatures(self):
        """Test signature combination."""
        addr1 = "0x1111111111111111111111111111111111111111"
        addr2 = "0x2222222222222222222222222222222222222222"

        sig1 = b"\x11" + b"\x00" * 64
        sig2 = b"\x22" + b"\x00" * 64

        sigs = {
            addr2.lower(): SafeSignature(signer=addr2, signature=sig2),  # Out of order
            addr1.lower(): SafeSignature(signer=addr1, signature=sig1),
        }

        combined = combine_signatures(sigs)

        # Should be sorted by address
        assert len(combined) == 130
        assert combined[0] == 0x11  # addr1's signature first
        assert combined[65] == 0x22  # addr2's signature second


class TestConstants:
    """Tests for constants."""

    def test_min_threshold(self):
        """Test MIN_THRESHOLD is 1."""
        assert MIN_THRESHOLD == 1

    def test_safe_addresses_are_valid(self):
        """Test Safe contract addresses are valid Ethereum addresses."""
        from t402.multisig import (
            SAFE_4337_MODULE,
            SAFE_MODULE_SETUP,
            SAFE_SINGLETON,
            SAFE_PROXY_FACTORY,
            SAFE_FALLBACK_HANDLER,
            ENTRYPOINT_V07,
        )

        for addr in [
            SAFE_4337_MODULE,
            SAFE_MODULE_SETUP,
            SAFE_SINGLETON,
            SAFE_PROXY_FACTORY,
            SAFE_FALLBACK_HANDLER,
            ENTRYPOINT_V07,
        ]:
            assert addr.startswith("0x")
            assert len(addr) == 42
