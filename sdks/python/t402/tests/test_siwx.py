"""Tests for the SIWx extension."""

from datetime import datetime, timedelta, timezone

import pytest

from t402.extensions.siwx import (
    SIWX_EXTENSION_KEY,
    SIWxPayload,
    declare_siwx_extension,
    parse_siwx_payload,
    validate_siwx_message,
)


class TestDeclareSIWxExtension:
    def test_creates_extension_with_domain(self):
        ext = declare_siwx_extension("https://api.example.com/premium", "eip155:8453")
        assert ext.info.domain == "api.example.com"
        assert ext.info.uri == "https://api.example.com/premium"
        assert ext.info.chain_id == "eip155:8453"
        assert ext.info.version == "1"
        assert len(ext.info.nonce) == 32  # 16 bytes hex
        assert ext.info.resources == ["https://api.example.com/premium"]

    def test_with_statement(self):
        ext = declare_siwx_extension(
            "https://api.example.com/resource",
            "eip155:1",
            statement="Sign in to access",
        )
        assert ext.info.statement == "Sign in to access"

    def test_with_custom_expiration(self):
        custom_exp = "2030-01-01T00:00:00+00:00"
        ext = declare_siwx_extension(
            "https://api.example.com/resource",
            "eip155:1",
            expiration_time=custom_exp,
        )
        assert ext.info.expiration_time == custom_exp

    def test_with_signature_scheme(self):
        ext = declare_siwx_extension(
            "https://api.example.com/resource",
            "solana:mainnet",
            signature_scheme="siws",
        )
        assert ext.info.signature_scheme == "siws"

    def test_unique_nonces(self):
        ext1 = declare_siwx_extension("https://example.com", "eip155:1")
        ext2 = declare_siwx_extension("https://example.com", "eip155:1")
        assert ext1.info.nonce != ext2.info.nonce


class TestParseSIWxPayload:
    def test_parse_valid(self):
        extensions = {
            SIWX_EXTENSION_KEY: {
                "domain": "api.example.com",
                "address": "0x1234",
                "uri": "https://api.example.com/resource",
                "version": "1",
                "chainId": "eip155:8453",
                "nonce": "abc123",
                "issuedAt": "2025-01-01T00:00:00.000Z",
                "signature": "0xsig",
            }
        }
        payload = parse_siwx_payload(extensions)
        assert payload is not None
        assert payload.domain == "api.example.com"
        assert payload.address == "0x1234"

    def test_returns_none_when_missing(self):
        assert parse_siwx_payload({}) is None
        assert parse_siwx_payload(None) is None

    def test_invalid_type(self):
        with pytest.raises(ValueError, match="expected dict"):
            parse_siwx_payload({SIWX_EXTENSION_KEY: "invalid"})

    def test_missing_required_field(self):
        with pytest.raises(ValueError, match="missing required field"):
            parse_siwx_payload({SIWX_EXTENSION_KEY: {"domain": "example.com"}})


class TestValidateSIWxMessage:
    def _make_payload(self, **overrides) -> SIWxPayload:
        defaults = {
            "domain": "api.example.com",
            "address": "0x1234",
            "uri": "https://api.example.com/resource",
            "version": "1",
            "chain_id": "eip155:8453",
            "nonce": "abc123",
            "issued_at": datetime.now(timezone.utc).isoformat(),
            "signature": "0xsig",
        }
        defaults.update(overrides)
        return SIWxPayload(**defaults)

    def test_valid_message(self):
        payload = self._make_payload()
        result = validate_siwx_message(payload, "https://api.example.com/resource")
        assert result is None

    def test_domain_mismatch(self):
        payload = self._make_payload()
        result = validate_siwx_message(payload, "https://other.example.com/resource")
        assert result is not None
        assert "Domain mismatch" in result

    def test_uri_mismatch(self):
        payload = self._make_payload()
        result = validate_siwx_message(payload, "https://api.example.com/other")
        assert result is not None
        assert "URI mismatch" in result

    def test_unsupported_version(self):
        payload = self._make_payload(version="99")
        result = validate_siwx_message(payload, "https://api.example.com/resource")
        assert result is not None
        assert "Unsupported version" in result

    def test_expired_issued_at(self):
        old = (datetime.now(timezone.utc) - timedelta(minutes=10)).isoformat()
        payload = self._make_payload(issued_at=old)
        result = validate_siwx_message(
            payload, "https://api.example.com/resource", max_age_seconds=300
        )
        assert result is not None
        assert "expired" in result.lower()

    def test_expired_expiration_time(self):
        past = (datetime.now(timezone.utc) - timedelta(seconds=10)).isoformat()
        payload = self._make_payload(expiration_time=past)
        result = validate_siwx_message(payload, "https://api.example.com/resource")
        assert result is not None
        assert "expired" in result.lower()

    def test_not_before_in_future(self):
        future = (datetime.now(timezone.utc) + timedelta(minutes=5)).isoformat()
        payload = self._make_payload(not_before=future)
        result = validate_siwx_message(payload, "https://api.example.com/resource")
        assert result is not None
        assert "notBefore" in result
