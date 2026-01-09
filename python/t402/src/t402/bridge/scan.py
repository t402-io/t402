"""LayerZero Scan API Client for tracking cross-chain messages."""

import asyncio
from typing import Optional

import httpx

from .constants import (
    DEFAULT_POLL_INTERVAL,
    DEFAULT_TIMEOUT,
    LAYERZERO_SCAN_BASE_URL,
)
from .types import (
    LayerZeroMessage,
    LayerZeroMessageStatus,
    WaitForDeliveryOptions,
)


class LayerZeroScanClient:
    """LayerZero Scan API Client.

    Provides tracking for cross-chain messages via LayerZero Scan.

    Example:
        ```python
        from t402.bridge import LayerZeroScanClient

        client = LayerZeroScanClient()

        # Get message status
        message = await client.get_message(message_guid)
        print(f"Status: {message.status}")

        # Wait for delivery
        delivered = await client.wait_for_delivery(
            message_guid,
            on_status_change=lambda s: print(f"Status: {s}")
        )
        print(f"Delivered! Dest TX: {delivered.dst_tx_hash}")
        ```
    """

    def __init__(self, base_url: str = LAYERZERO_SCAN_BASE_URL) -> None:
        """Create a new LayerZero Scan client.

        Args:
            base_url: API base URL (default: production endpoint)
        """
        self.base_url = base_url
        self._client: Optional[httpx.AsyncClient] = None

    async def _get_client(self) -> httpx.AsyncClient:
        """Get or create the HTTP client."""
        if self._client is None:
            self._client = httpx.AsyncClient(timeout=30.0)
        return self._client

    async def close(self) -> None:
        """Close the HTTP client."""
        if self._client is not None:
            await self._client.aclose()
            self._client = None

    async def get_message(self, guid: str) -> LayerZeroMessage:
        """Get message by GUID.

        Args:
            guid: LayerZero message GUID

        Returns:
            Message details including status

        Raises:
            ValueError: If message not found
            httpx.HTTPError: If API error
        """
        client = await self._get_client()
        url = f"{self.base_url}/messages/guid/{guid}"

        response = await client.get(url, headers={"Accept": "application/json"})

        if response.status_code == 404:
            raise ValueError(f"Message not found: {guid}")

        response.raise_for_status()
        data = response.json()
        return self._map_api_response(data)

    async def get_messages_by_wallet(
        self, address: str, limit: int = 20
    ) -> list[LayerZeroMessage]:
        """Get messages by wallet address.

        Args:
            address: Wallet address that initiated messages
            limit: Maximum number of messages to return (default: 20)

        Returns:
            List of messages

        Raises:
            httpx.HTTPError: If API error
        """
        client = await self._get_client()
        url = f"{self.base_url}/messages/wallet/{address}?limit={limit}"

        response = await client.get(url, headers={"Accept": "application/json"})
        response.raise_for_status()

        data = response.json()
        messages_data = data.get("messages") or data.get("data") or []
        return [self._map_api_response(msg) for msg in messages_data]

    async def wait_for_delivery(
        self,
        guid: str,
        options: Optional[WaitForDeliveryOptions] = None,
    ) -> LayerZeroMessage:
        """Poll message status until delivered or failed.

        Args:
            guid: LayerZero message GUID
            options: Wait configuration options

        Returns:
            Final message state (DELIVERED)

        Raises:
            ValueError: If message fails, is blocked, or times out
        """
        timeout_ms = DEFAULT_TIMEOUT
        poll_interval_ms = DEFAULT_POLL_INTERVAL
        on_status_change = None

        if options is not None:
            if options.timeout > 0:
                timeout_ms = options.timeout
            if options.poll_interval > 0:
                poll_interval_ms = options.poll_interval
            on_status_change = options.on_status_change

        timeout_sec = timeout_ms / 1000
        poll_interval_sec = poll_interval_ms / 1000
        elapsed = 0.0
        last_status: Optional[LayerZeroMessageStatus] = None

        while elapsed < timeout_sec:
            try:
                message = await self.get_message(guid)

                # Notify on status change
                if message.status != last_status:
                    last_status = message.status
                    if on_status_change is not None:
                        on_status_change(message.status)

                # Check terminal states
                if message.status == LayerZeroMessageStatus.DELIVERED:
                    return message

                if message.status == LayerZeroMessageStatus.FAILED:
                    raise ValueError(f"Bridge message failed: {guid}")

                if message.status == LayerZeroMessageStatus.BLOCKED:
                    raise ValueError(f"Bridge message blocked by DVN: {guid}")

                # Continue polling for INFLIGHT/CONFIRMING
                await asyncio.sleep(poll_interval_sec)
                elapsed += poll_interval_sec

            except ValueError as e:
                # Message not yet indexed, retry
                if "not found" in str(e).lower():
                    await asyncio.sleep(poll_interval_sec)
                    elapsed += poll_interval_sec
                    continue
                raise

        raise ValueError(f"Timeout waiting for message delivery: {guid}")

    async def is_delivered(self, guid: str) -> bool:
        """Check if a message has been delivered.

        Args:
            guid: LayerZero message GUID

        Returns:
            True if delivered, False otherwise
        """
        try:
            message = await self.get_message(guid)
            return message.status == LayerZeroMessageStatus.DELIVERED
        except ValueError:
            return False

    def _map_api_response(self, data: dict) -> LayerZeroMessage:
        """Map API response to LayerZeroMessage."""
        return LayerZeroMessage(
            guid=data.get("guid") or data.get("messageGuid") or "",
            src_eid=int(data.get("srcEid") or data.get("srcChainId") or 0),
            dst_eid=int(data.get("dstEid") or data.get("dstChainId") or 0),
            src_ua_address=data.get("srcUaAddress") or data.get("srcAddress") or "",
            dst_ua_address=data.get("dstUaAddress") or data.get("dstAddress") or "",
            src_tx_hash=data.get("srcTxHash") or "",
            dst_tx_hash=data.get("dstTxHash"),
            status=LayerZeroMessageStatus(data.get("status") or "INFLIGHT"),
            src_block_number=int(data.get("srcBlockNumber") or 0),
            dst_block_number=int(data.get("dstBlockNumber")) if data.get("dstBlockNumber") else None,
            created=data.get("created") or data.get("createdAt") or "",
            updated=data.get("updated") or data.get("updatedAt") or "",
        )


def create_layerzero_scan_client(
    base_url: str = LAYERZERO_SCAN_BASE_URL,
) -> LayerZeroScanClient:
    """Create a LayerZero Scan client.

    Args:
        base_url: Optional custom API base URL

    Returns:
        New client instance
    """
    return LayerZeroScanClient(base_url)
