"""Tests for Spark (Bitcoin L2) payment scheme.

Ports the Go test suite from mechanisms/spark/exact/facilitator/scheme_test.go.
"""

import hashlib

import pytest

from t402.schemes.spark import (
    SparkFacilitatorScheme,
    SparkPayload,
    SparkSigner,
    TransferInfo,
    TransferStatus,
    SparkRequirementsExtra,
    SPARK_MAINNET,
    SPARK_TESTNET,
    SCHEME_EXACT,
    SPARK_CAIP_FAMILY,
    SPARK_NETWORKS,
    PAYMENT_TYPE_SPARK,
    PAYMENT_TYPE_LIGHTNING,
)


# =============================================================================
# Mock Signer
# =============================================================================


class MockSparkSigner:
    """Mock implementation of SparkSigner for testing."""

    def __init__(self, address: str = "spark:server123"):
        self._transfers: dict[str, TransferInfo] = {}
        self._address = address

    def add_transfer(self, transfer: TransferInfo) -> None:
        self._transfers[transfer.id] = transfer

    def get_transfer(self, transfer_id: str) -> TransferInfo:
        if transfer_id not in self._transfers:
            raise ValueError(f"transfer not found: {transfer_id}")
        return self._transfers[transfer_id]

    def get_address(self) -> str:
        return self._address


def make_signer(*transfers: TransferInfo) -> MockSparkSigner:
    """Create a mock signer with optional pre-loaded transfers."""
    signer = MockSparkSigner()
    for t in transfers:
        signer.add_transfer(t)
    return signer


# =============================================================================
# Test Constants
# =============================================================================


class TestConstants:
    """Test Spark constants."""

    def test_network_identifiers(self):
        assert SPARK_MAINNET == "spark:mainnet"
        assert SPARK_TESTNET == "spark:testnet"

    def test_scheme_exact(self):
        assert SCHEME_EXACT == "exact"

    def test_caip_family(self):
        assert SPARK_CAIP_FAMILY == "spark:*"

    def test_networks_list(self):
        assert SPARK_MAINNET in SPARK_NETWORKS
        assert SPARK_TESTNET in SPARK_NETWORKS

    def test_payment_types(self):
        assert PAYMENT_TYPE_SPARK == "spark"
        assert PAYMENT_TYPE_LIGHTNING == "lightning"


# =============================================================================
# Test Types
# =============================================================================


class TestTransferStatus:
    """Test TransferStatus enum."""

    def test_pending(self):
        assert TransferStatus.PENDING == 0

    def test_completed(self):
        assert TransferStatus.COMPLETED == 5

    def test_failed(self):
        assert TransferStatus.FAILED == 9


class TestTransferInfo:
    """Test TransferInfo model."""

    def test_create(self):
        info = TransferInfo(
            id="tx-001",
            amount=1000,
            sender="spark:sender",
            receiver="spark:receiver",
            status=TransferStatus.COMPLETED,
        )
        assert info.id == "tx-001"
        assert info.amount == 1000
        assert info.sender == "spark:sender"
        assert info.receiver == "spark:receiver"
        assert info.status == TransferStatus.COMPLETED


class TestSparkPayload:
    """Test SparkPayload model."""

    def test_spark_payload(self):
        payload = SparkPayload(
            payment_type="spark",
            transfer_id="tx-001",
        )
        assert payload.payment_type == "spark"
        assert payload.transfer_id == "tx-001"

    def test_lightning_payload(self):
        payload = SparkPayload(
            payment_type="lightning",
            preimage="aabbccdd",
            payment_hash="eeff0011",
        )
        assert payload.payment_type == "lightning"
        assert payload.preimage == "aabbccdd"
        assert payload.payment_hash == "eeff0011"

    def test_to_map_spark(self):
        payload = SparkPayload(payment_type="spark", transfer_id="tx-001")
        m = payload.to_map()
        assert m["paymentType"] == "spark"
        assert m["transferId"] == "tx-001"
        assert "preimage" not in m
        assert "paymentHash" not in m

    def test_to_map_lightning(self):
        payload = SparkPayload(
            payment_type="lightning",
            preimage="aabb",
            payment_hash="ccdd",
        )
        m = payload.to_map()
        assert m["paymentType"] == "lightning"
        assert m["preimage"] == "aabb"
        assert m["paymentHash"] == "ccdd"
        assert "transferId" not in m

    def test_from_map(self):
        data = {"paymentType": "spark", "transferId": "tx-002"}
        payload = SparkPayload.from_map(data)
        assert payload.payment_type == "spark"
        assert payload.transfer_id == "tx-002"

    def test_from_map_lightning(self):
        data = {
            "paymentType": "lightning",
            "preimage": "aabb",
            "paymentHash": "ccdd",
        }
        payload = SparkPayload.from_map(data)
        assert payload.payment_type == "lightning"
        assert payload.preimage == "aabb"
        assert payload.payment_hash == "ccdd"


class TestSparkRequirementsExtra:
    """Test SparkRequirementsExtra model."""

    def test_create(self):
        extra = SparkRequirementsExtra(
            spark_address="spark:addr1",
            payment_id="pay-001",
        )
        assert extra.spark_address == "spark:addr1"
        assert extra.payment_id == "pay-001"
        assert extra.lightning_invoice is None

    def test_with_lightning_invoice(self):
        extra = SparkRequirementsExtra(
            spark_address="spark:addr1",
            lightning_invoice="lnbc10u1p...",
            payment_id="pay-002",
        )
        assert extra.lightning_invoice == "lnbc10u1p..."


# =============================================================================
# Test SparkSigner Protocol
# =============================================================================


class TestSparkSigner:
    """Test that MockSparkSigner satisfies the SparkSigner protocol."""

    def test_mock_is_signer(self):
        signer = MockSparkSigner()
        assert isinstance(signer, SparkSigner)

    def test_get_address(self):
        signer = MockSparkSigner(address="spark:myaddr")
        assert signer.get_address() == "spark:myaddr"

    def test_get_transfer_found(self):
        signer = make_signer(
            TransferInfo(
                id="tx-001",
                amount=500,
                sender="spark:a",
                receiver="spark:b",
                status=TransferStatus.COMPLETED,
            )
        )
        t = signer.get_transfer("tx-001")
        assert t.id == "tx-001"
        assert t.amount == 500

    def test_get_transfer_not_found(self):
        signer = make_signer()
        with pytest.raises(ValueError, match="transfer not found"):
            signer.get_transfer("nonexistent")


# =============================================================================
# Test Facilitator Scheme Properties
# =============================================================================


class TestFacilitatorSchemeProperties:
    """Test SparkFacilitatorScheme scheme and family properties."""

    def test_scheme(self):
        f = SparkFacilitatorScheme(make_signer())
        assert f.scheme == "exact"

    def test_caip_family(self):
        f = SparkFacilitatorScheme(make_signer())
        assert f.caip_family == "spark:*"


# =============================================================================
# Test Spark Verify
# =============================================================================


class TestVerifySparkTransfer:
    """Test Spark direct transfer verification."""

    @pytest.mark.asyncio
    async def test_verify_success(self):
        """Successful Spark transfer verification."""
        signer = make_signer(
            TransferInfo(
                id="tx-001",
                amount=1000,
                sender="spark:sender",
                receiver="spark:server123",
                status=TransferStatus.COMPLETED,
            )
        )
        f = SparkFacilitatorScheme(signer)

        result = await f.verify(
            {"paymentType": "spark", "transferId": "tx-001"},
            {"scheme": "exact", "network": "spark:mainnet", "amount": "1000"},
        )
        assert result.is_valid is True
        assert result.payer == "spark:sender"

    @pytest.mark.asyncio
    async def test_verify_insufficient_amount(self):
        """Verify fails when transfer amount is less than required."""
        signer = make_signer(
            TransferInfo(
                id="tx-001",
                amount=500,
                sender="spark:sender",
                receiver="spark:server123",
                status=TransferStatus.COMPLETED,
            )
        )
        f = SparkFacilitatorScheme(signer)

        result = await f.verify(
            {"paymentType": "spark", "transferId": "tx-001"},
            {"scheme": "exact", "network": "spark:mainnet", "amount": "1000"},
        )
        assert result.is_valid is False
        assert result.invalid_reason == "insufficient_amount"

    @pytest.mark.asyncio
    async def test_verify_wrong_recipient(self):
        """Verify fails when transfer receiver does not match server address."""
        signer = make_signer(
            TransferInfo(
                id="tx-001",
                amount=1000,
                sender="spark:sender",
                receiver="spark:wrong",
                status=TransferStatus.COMPLETED,
            )
        )
        f = SparkFacilitatorScheme(signer)

        result = await f.verify(
            {"paymentType": "spark", "transferId": "tx-001"},
            {"scheme": "exact", "network": "spark:mainnet", "amount": "1000"},
        )
        assert result.is_valid is False
        assert result.invalid_reason == "wrong_recipient"

    @pytest.mark.asyncio
    async def test_verify_not_completed(self):
        """Verify fails when transfer is still pending."""
        signer = make_signer(
            TransferInfo(
                id="tx-001",
                amount=1000,
                sender="spark:sender",
                receiver="spark:server123",
                status=TransferStatus.PENDING,
            )
        )
        f = SparkFacilitatorScheme(signer)

        result = await f.verify(
            {"paymentType": "spark", "transferId": "tx-001"},
            {"scheme": "exact", "network": "spark:mainnet", "amount": "1000"},
        )
        assert result.is_valid is False
        assert result.invalid_reason == "transfer_not_completed"

    @pytest.mark.asyncio
    async def test_verify_transfer_not_found(self):
        """Verify fails when transfer ID does not exist."""
        signer = make_signer()
        f = SparkFacilitatorScheme(signer)

        result = await f.verify(
            {"paymentType": "spark", "transferId": "tx-nonexistent"},
            {"scheme": "exact", "network": "spark:mainnet", "amount": "1000"},
        )
        assert result.is_valid is False
        assert result.invalid_reason == "transfer_not_found"

    @pytest.mark.asyncio
    async def test_verify_replay_protection(self):
        """Second verify of same transfer_id is rejected."""
        signer = make_signer(
            TransferInfo(
                id="tx-001",
                amount=1000,
                sender="spark:sender",
                receiver="spark:server123",
                status=TransferStatus.COMPLETED,
            )
        )
        f = SparkFacilitatorScheme(signer)

        # First verify succeeds
        result1 = await f.verify(
            {"paymentType": "spark", "transferId": "tx-001"},
            {"scheme": "exact", "network": "spark:mainnet", "amount": "1000"},
        )
        assert result1.is_valid is True

        # Second verify fails (replay)
        result2 = await f.verify(
            {"paymentType": "spark", "transferId": "tx-001"},
            {"scheme": "exact", "network": "spark:mainnet", "amount": "1000"},
        )
        assert result2.is_valid is False
        assert result2.invalid_reason == "replay_detected"

    @pytest.mark.asyncio
    async def test_verify_missing_transfer_id(self):
        """Verify fails when transfer_id is missing."""
        signer = make_signer()
        f = SparkFacilitatorScheme(signer)

        result = await f.verify(
            {"paymentType": "spark"},
            {"scheme": "exact", "network": "spark:mainnet", "amount": "1000"},
        )
        assert result.is_valid is False
        assert result.invalid_reason == "missing_transfer_id"

    @pytest.mark.asyncio
    async def test_verify_overpayment_accepted(self):
        """Verify succeeds when transfer amount exceeds required (overpayment)."""
        signer = make_signer(
            TransferInfo(
                id="tx-001",
                amount=2000,
                sender="spark:sender",
                receiver="spark:server123",
                status=TransferStatus.COMPLETED,
            )
        )
        f = SparkFacilitatorScheme(signer)

        result = await f.verify(
            {"paymentType": "spark", "transferId": "tx-001"},
            {"scheme": "exact", "network": "spark:mainnet", "amount": "1000"},
        )
        assert result.is_valid is True

    @pytest.mark.asyncio
    async def test_verify_failed_transfer(self):
        """Verify fails when transfer status is FAILED."""
        signer = make_signer(
            TransferInfo(
                id="tx-001",
                amount=1000,
                sender="spark:sender",
                receiver="spark:server123",
                status=TransferStatus.FAILED,
            )
        )
        f = SparkFacilitatorScheme(signer)

        result = await f.verify(
            {"paymentType": "spark", "transferId": "tx-001"},
            {"scheme": "exact", "network": "spark:mainnet", "amount": "1000"},
        )
        assert result.is_valid is False
        assert result.invalid_reason == "transfer_not_completed"


# =============================================================================
# Test Lightning Verify
# =============================================================================


class TestVerifyLightning:
    """Test Lightning payment verification via preimage."""

    @pytest.mark.asyncio
    async def test_verify_success(self):
        """Successful Lightning verification with valid preimage."""
        preimage = b"secret-preimage-32bytes-padding!"
        computed_hash = hashlib.sha256(preimage).hexdigest()
        preimage_hex = preimage.hex()

        signer = make_signer()
        f = SparkFacilitatorScheme(signer)

        result = await f.verify(
            {
                "paymentType": "lightning",
                "preimage": preimage_hex,
                "paymentHash": computed_hash,
            },
            {"scheme": "exact", "network": "spark:mainnet", "amount": "1000"},
        )
        assert result.is_valid is True
        assert result.payer is not None
        assert result.payer.startswith("lightning:")

    @pytest.mark.asyncio
    async def test_verify_bad_preimage(self):
        """Lightning verification fails when preimage does not match hash."""
        signer = make_signer()
        f = SparkFacilitatorScheme(signer)

        result = await f.verify(
            {
                "paymentType": "lightning",
                "preimage": "aabbccdd",
                "paymentHash": "0000000000000000000000000000000000000000000000000000000000000000",
            },
            {"scheme": "exact", "network": "spark:mainnet", "amount": "1000"},
        )
        assert result.is_valid is False
        assert result.invalid_reason == "preimage_mismatch"

    @pytest.mark.asyncio
    async def test_verify_missing_preimage(self):
        """Lightning verification fails when preimage is missing."""
        signer = make_signer()
        f = SparkFacilitatorScheme(signer)

        result = await f.verify(
            {
                "paymentType": "lightning",
                "paymentHash": "aabbccdd",
            },
            {"scheme": "exact", "network": "spark:mainnet", "amount": "1000"},
        )
        assert result.is_valid is False
        assert result.invalid_reason == "missing_lightning_proof"

    @pytest.mark.asyncio
    async def test_verify_missing_payment_hash(self):
        """Lightning verification fails when payment_hash is missing."""
        signer = make_signer()
        f = SparkFacilitatorScheme(signer)

        result = await f.verify(
            {
                "paymentType": "lightning",
                "preimage": "aabbccdd",
            },
            {"scheme": "exact", "network": "spark:mainnet", "amount": "1000"},
        )
        assert result.is_valid is False
        assert result.invalid_reason == "missing_lightning_proof"

    @pytest.mark.asyncio
    async def test_verify_with_0x_prefix(self):
        """Lightning verification works with 0x-prefixed hex strings."""
        preimage = b"test-preimage-data-32bytespad!!"
        computed_hash = hashlib.sha256(preimage).hexdigest()
        preimage_hex = "0x" + preimage.hex()
        hash_hex = "0x" + computed_hash

        signer = make_signer()
        f = SparkFacilitatorScheme(signer)

        result = await f.verify(
            {
                "paymentType": "lightning",
                "preimage": preimage_hex,
                "paymentHash": hash_hex,
            },
            {"scheme": "exact", "network": "spark:mainnet", "amount": "1000"},
        )
        assert result.is_valid is True

    @pytest.mark.asyncio
    async def test_verify_invalid_hex_preimage(self):
        """Lightning verification fails with invalid hex preimage."""
        signer = make_signer()
        f = SparkFacilitatorScheme(signer)

        result = await f.verify(
            {
                "paymentType": "lightning",
                "preimage": "not-valid-hex!!!",
                "paymentHash": "aabbccdd",
            },
            {"scheme": "exact", "network": "spark:mainnet", "amount": "1000"},
        )
        assert result.is_valid is False
        assert result.invalid_reason == "invalid_preimage"


# =============================================================================
# Test Unsupported Payment Type
# =============================================================================


class TestUnsupportedPaymentType:
    """Test unsupported payment type handling."""

    @pytest.mark.asyncio
    async def test_unsupported_type(self):
        """Verify fails for unsupported payment type."""
        f = SparkFacilitatorScheme(make_signer())

        result = await f.verify(
            {"paymentType": "l1"},
            {"scheme": "exact", "network": "spark:mainnet", "amount": "1000"},
        )
        assert result.is_valid is False
        assert "unsupported_payment_type" in result.invalid_reason


# =============================================================================
# Test Settle
# =============================================================================


class TestSettle:
    """Test settlement."""

    @pytest.mark.asyncio
    async def test_settle_spark_success(self):
        """Successful Spark transfer settlement."""
        signer = make_signer(
            TransferInfo(
                id="tx-001",
                amount=1000,
                sender="spark:sender",
                receiver="spark:server123",
                status=TransferStatus.COMPLETED,
            )
        )
        f = SparkFacilitatorScheme(signer)

        result = await f.settle(
            {"paymentType": "spark", "transferId": "tx-001"},
            {"scheme": "exact", "network": "spark:mainnet", "amount": "1000"},
        )
        assert result.success is True
        assert result.transaction == "tx-001"
        assert result.network == "spark:mainnet"
        assert result.payer == "spark:sender"

    @pytest.mark.asyncio
    async def test_settle_lightning_success(self):
        """Successful Lightning settlement returns payment_hash as tx."""
        preimage = b"secret-preimage-32bytes-padding!"
        computed_hash = hashlib.sha256(preimage).hexdigest()
        preimage_hex = preimage.hex()

        signer = make_signer()
        f = SparkFacilitatorScheme(signer)

        result = await f.settle(
            {
                "paymentType": "lightning",
                "preimage": preimage_hex,
                "paymentHash": computed_hash,
            },
            {"scheme": "exact", "network": "spark:mainnet", "amount": "1000"},
        )
        assert result.success is True
        assert result.transaction == computed_hash
        assert result.network == "spark:mainnet"

    @pytest.mark.asyncio
    async def test_settle_verify_failure(self):
        """Settlement fails when underlying verification fails."""
        signer = make_signer(
            TransferInfo(
                id="tx-001",
                amount=500,
                sender="spark:sender",
                receiver="spark:server123",
                status=TransferStatus.COMPLETED,
            )
        )
        f = SparkFacilitatorScheme(signer)

        result = await f.settle(
            {"paymentType": "spark", "transferId": "tx-001"},
            {"scheme": "exact", "network": "spark:mainnet", "amount": "1000"},
        )
        assert result.success is False
        assert result.error_reason == "insufficient_amount"

    @pytest.mark.asyncio
    async def test_settle_not_found(self):
        """Settlement fails when transfer not found."""
        signer = make_signer()
        f = SparkFacilitatorScheme(signer)

        result = await f.settle(
            {"paymentType": "spark", "transferId": "tx-nonexistent"},
            {"scheme": "exact", "network": "spark:mainnet", "amount": "1000"},
        )
        assert result.success is False
        assert result.error_reason == "transfer_not_found"
