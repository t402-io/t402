"""Tests for Bazaar discovery client methods."""

import pytest
import httpx
from unittest.mock import AsyncMock, patch
from t402.facilitator import FacilitatorClient
from t402.types import (
    DiscoveryItem,
    DiscoveryPaymentOption,
    DiscoveryResourceMetadata,
    RegisterResourceRequest,
    RegisterResourceResponse,
    UpdateResourceRequest,
)


@pytest.fixture
def client():
    return FacilitatorClient({"url": "https://facilitator.t402.io"})


def _mock_response(status_code: int, json_data=None):
    resp = httpx.Response(status_code=status_code, request=httpx.Request("GET", "http://test"))
    if json_data is not None:
        resp._content = httpx.Response(
            status_code=status_code,
            request=httpx.Request("GET", "http://test"),
            json=json_data,
        )._content
    return resp


@pytest.mark.asyncio
async def test_get_resource(client):
    mock_data = {
        "id": "res-123",
        "resource": "https://example.com/api",
        "type": "http",
        "t402Version": 2,
        "accepts": [
            {
                "scheme": "exact",
                "network": "eip155:8453",
                "amount": "100",
                "asset": "USDT",
                "payTo": "0xabc",
                "maxTimeoutSeconds": 3600,
            }
        ],
        "lastUpdated": 1700000000,
    }

    with patch("httpx.AsyncClient.get", new_callable=AsyncMock) as mock_get:
        mock_get.return_value = httpx.Response(
            status_code=200,
            json=mock_data,
            request=httpx.Request("GET", "http://test"),
        )
        item = await client.get_resource("res-123")

    assert isinstance(item, DiscoveryItem)
    assert item.id == "res-123"
    assert len(item.accepts) == 1
    assert item.accepts[0].scheme == "exact"


@pytest.mark.asyncio
async def test_get_resource_not_found(client):
    with patch("httpx.AsyncClient.get", new_callable=AsyncMock) as mock_get:
        mock_get.return_value = httpx.Response(
            status_code=404,
            text="not found",
            request=httpx.Request("GET", "http://test"),
        )
        with pytest.raises(ValueError, match="Failed to get resource"):
            await client.get_resource("nonexistent")


@pytest.mark.asyncio
async def test_register_resource(client):
    mock_data = {
        "id": "res-new",
        "resource": "https://example.com/api",
        "type": "http",
        "t402Version": 2,
        "createdAt": "2026-01-15T10:00:00Z",
    }

    with patch("httpx.AsyncClient.post", new_callable=AsyncMock) as mock_post:
        mock_post.return_value = httpx.Response(
            status_code=201,
            json=mock_data,
            request=httpx.Request("POST", "http://test"),
        )
        resp = await client.register_resource(
            RegisterResourceRequest(
                resource="https://example.com/api",
                type="http",
                accepts=[
                    DiscoveryPaymentOption(
                        scheme="exact",
                        network="eip155:8453",
                        amount="100",
                        asset="USDT",
                        pay_to="0xabc",
                    )
                ],
            )
        )

    assert isinstance(resp, RegisterResourceResponse)
    assert resp.id == "res-new"


@pytest.mark.asyncio
async def test_register_resource_conflict(client):
    with patch("httpx.AsyncClient.post", new_callable=AsyncMock) as mock_post:
        mock_post.return_value = httpx.Response(
            status_code=409,
            text="already exists",
            request=httpx.Request("POST", "http://test"),
        )
        with pytest.raises(ValueError, match="Failed to register resource"):
            await client.register_resource(
                RegisterResourceRequest(
                    resource="https://example.com/api",
                    type="http",
                    accepts=[
                        DiscoveryPaymentOption(
                            scheme="exact",
                            network="eip155:8453",
                            amount="100",
                            asset="USDT",
                            pay_to="0xabc",
                        )
                    ],
                )
            )


@pytest.mark.asyncio
async def test_update_resource(client):
    mock_data = {
        "id": "res-123",
        "resource": "https://example.com/api",
        "type": "http",
        "t402Version": 2,
        "accepts": [
            {
                "scheme": "exact",
                "network": "eip155:8453",
                "amount": "200",
                "asset": "USDT",
                "payTo": "0xabc",
                "maxTimeoutSeconds": 3600,
            }
        ],
        "lastUpdated": 1700000000,
    }

    with patch("httpx.AsyncClient.put", new_callable=AsyncMock) as mock_put:
        mock_put.return_value = httpx.Response(
            status_code=200,
            json=mock_data,
            request=httpx.Request("PUT", "http://test"),
        )
        item = await client.update_resource(
            "res-123",
            UpdateResourceRequest(active=True),
        )

    assert isinstance(item, DiscoveryItem)
    assert item.id == "res-123"


@pytest.mark.asyncio
async def test_delete_resource(client):
    with patch("httpx.AsyncClient.delete", new_callable=AsyncMock) as mock_delete:
        mock_delete.return_value = httpx.Response(
            status_code=204,
            request=httpx.Request("DELETE", "http://test"),
        )
        await client.delete_resource("res-123")


@pytest.mark.asyncio
async def test_delete_resource_forbidden(client):
    with patch("httpx.AsyncClient.delete", new_callable=AsyncMock) as mock_delete:
        mock_delete.return_value = httpx.Response(
            status_code=403,
            text="not authorized",
            request=httpx.Request("DELETE", "http://test"),
        )
        with pytest.raises(ValueError, match="Failed to delete resource"):
            await client.delete_resource("res-123")


def test_discovery_payment_option_model():
    opt = DiscoveryPaymentOption(
        scheme="exact",
        network="eip155:8453",
        amount="100",
        asset="USDT",
        pay_to="0xabc",
    )
    assert opt.scheme == "exact"
    assert opt.pay_to == "0xabc"
    dumped = opt.model_dump(by_alias=True)
    assert dumped["payTo"] == "0xabc"
    assert dumped["maxTimeoutSeconds"] == 3600


def test_discovery_resource_metadata_model():
    meta = DiscoveryResourceMetadata(
        category="ai",
        provider="example",
        tags=["llm", "api"],
    )
    assert meta.category == "ai"
    assert meta.tags == ["llm", "api"]


def test_register_resource_request_model():
    req = RegisterResourceRequest(
        resource="https://example.com/api",
        type="http",
        accepts=[
            DiscoveryPaymentOption(
                scheme="exact",
                network="eip155:8453",
                amount="100",
                asset="USDT",
                pay_to="0xabc",
            )
        ],
        metadata=DiscoveryResourceMetadata(category="ai"),
    )
    dumped = req.model_dump(by_alias=True, exclude_none=True)
    assert dumped["resource"] == "https://example.com/api"
    assert dumped["t402Version"] == 2
    assert len(dumped["accepts"]) == 1
    assert dumped["metadata"]["category"] == "ai"


def test_update_resource_request_model():
    req = UpdateResourceRequest(active=False)
    dumped = req.model_dump(by_alias=True, exclude_none=True)
    assert dumped["active"] is False
    assert "accepts" not in dumped


def test_discovery_item_model():
    item = DiscoveryItem(
        id="res-1",
        resource="https://example.com/api",
        type="http",
        t402_version=2,
        accepts=[
            DiscoveryPaymentOption(
                scheme="exact",
                network="eip155:8453",
                amount="100",
                asset="USDT",
                pay_to="0xabc",
            )
        ],
        last_updated=1700000000,
    )
    assert item.id == "res-1"
    assert item.last_updated == 1700000000
