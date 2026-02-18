"""Tests for the Payment ID extension."""

import re

import pytest

from t402.extensions.payment_id import (
    PAYMENT_ID_EXTENSION_KEY,
    PaymentIdExtensionInfo,
    PaymentIdPayload,
    declare_payment_id_extension,
    parse_payment_id_payload,
    validate_payment_id,
)

UUID_REGEX = re.compile(
    r"^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$",
    re.IGNORECASE,
)


class TestDeclarePaymentIdExtension:
    def test_generates_uuid(self):
        ext = declare_payment_id_extension()
        assert UUID_REGEX.match(ext.info.id)

    def test_custom_id(self):
        ext = declare_payment_id_extension(id="custom-id")
        assert ext.info.id == "custom-id"

    def test_optional_fields(self):
        ext = declare_payment_id_extension(
            idempotency_key="idem-1",
            group_id="group-1",
            metadata={"orderId": "order-123"},
        )
        assert ext.info.idempotency_key == "idem-1"
        assert ext.info.group_id == "group-1"
        assert ext.info.metadata == {"orderId": "order-123"}

    def test_defaults_omit_optional(self):
        ext = declare_payment_id_extension()
        assert ext.info.idempotency_key is None
        assert ext.info.group_id is None
        assert ext.info.metadata is None

    def test_unique_ids(self):
        ext1 = declare_payment_id_extension()
        ext2 = declare_payment_id_extension()
        assert ext1.info.id != ext2.info.id


class TestParsePaymentIdPayload:
    def test_parse_valid(self):
        extensions = {PAYMENT_ID_EXTENSION_KEY: {"id": "test-id", "clientId": "client-1"}}
        payload = parse_payment_id_payload(extensions)
        assert payload is not None
        assert payload.id == "test-id"
        assert payload.client_id == "client-1"

    def test_returns_none_when_missing(self):
        assert parse_payment_id_payload({}) is None
        assert parse_payment_id_payload(None) is None

    def test_without_client_id(self):
        extensions = {PAYMENT_ID_EXTENSION_KEY: {"id": "test-id"}}
        payload = parse_payment_id_payload(extensions)
        assert payload is not None
        assert payload.client_id is None

    def test_invalid_type(self):
        with pytest.raises(ValueError, match="expected dict"):
            parse_payment_id_payload({PAYMENT_ID_EXTENSION_KEY: "not-a-dict"})

    def test_missing_id(self):
        with pytest.raises(ValueError, match="missing or empty id"):
            parse_payment_id_payload({PAYMENT_ID_EXTENSION_KEY: {"clientId": "test"}})

    def test_empty_id(self):
        with pytest.raises(ValueError, match="missing or empty id"):
            parse_payment_id_payload({PAYMENT_ID_EXTENSION_KEY: {"id": ""}})


class TestValidatePaymentId:
    def test_matching_ids(self):
        payload = PaymentIdPayload(id="test-id")
        expected = PaymentIdExtensionInfo(id="test-id")
        assert validate_payment_id(payload, expected) is True

    def test_mismatched_ids(self):
        payload = PaymentIdPayload(id="id-1")
        expected = PaymentIdExtensionInfo(id="id-2")
        assert validate_payment_id(payload, expected) is False
