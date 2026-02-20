from typing import Callable, Optional
from typing_extensions import (
    TypedDict,
)  # use `typing_extensions.TypedDict` instead of `typing.TypedDict` on Python < 3.12
import httpx
from t402.types import (
    PaymentPayload,
    PaymentRequirements,
    VerifyResponse,
    SettleResponse,
    ListDiscoveryResourcesRequest,
    ListDiscoveryResourcesResponse,
    DiscoveryItem,
    RegisterResourceRequest,
    RegisterResourceResponse,
    UpdateResourceRequest,
)


class FacilitatorConfig(TypedDict, total=False):
    """Configuration for the T402 facilitator service.

    Attributes:
        url: The base URL for the facilitator service
        create_headers: Optional function to create authentication headers
    """

    url: str
    create_headers: Callable[[], dict[str, dict[str, str]]]


class FacilitatorClient:
    """Client for interacting with the T402 facilitator service.

    Provides methods for verifying and settling payments, as well as
    managing discoverable resources in the Bazaar.
    """

    def __init__(self, config: Optional[FacilitatorConfig] = None) -> None:
        """Initialize the facilitator client.

        Args:
            config: Optional configuration. Defaults to production facilitator URL.
        """
        if config is None:
            config = {"url": "https://facilitator.t402.io"}

        # Validate URL format
        url = config.get("url", "")
        if not url.startswith(("http://", "https://")):
            raise ValueError(f"Invalid URL {url}, must start with http:// or https://")
        if url.endswith("/"):
            url = url[:-1]

        self.config = {"url": url, "create_headers": config.get("create_headers")}

    async def verify(
        self, payment: PaymentPayload, payment_requirements: PaymentRequirements
    ) -> VerifyResponse:
        """Verify a payment header is valid and a request should be processed.

        Args:
            payment: The payment payload to verify
            payment_requirements: The payment requirements to verify against

        Returns:
            VerifyResponse indicating validity, with payer address if valid
        """
        headers = {"Content-Type": "application/json"}

        if self.config.get("create_headers"):
            custom_headers = await self.config["create_headers"]()
            headers.update(custom_headers.get("verify", {}))

        async with httpx.AsyncClient() as client:
            response = await client.post(
                f"{self.config['url']}/verify",
                json={
                    "t402Version": payment.t402_version,
                    "paymentPayload": payment.model_dump(by_alias=True),
                    "paymentRequirements": payment_requirements.model_dump(
                        by_alias=True, exclude_none=True
                    ),
                },
                headers=headers,
                follow_redirects=True,
            )

            data = response.json()
            return VerifyResponse(**data)

    async def settle(
        self, payment: PaymentPayload, payment_requirements: PaymentRequirements
    ) -> SettleResponse:
        """Settle a verified payment, executing the on-chain transfer.

        Args:
            payment: The payment payload to settle
            payment_requirements: The payment requirements that were matched

        Returns:
            SettleResponse with settlement status and transaction details
        """
        headers = {"Content-Type": "application/json"}

        if self.config.get("create_headers"):
            custom_headers = await self.config["create_headers"]()
            headers.update(custom_headers.get("settle", {}))

        async with httpx.AsyncClient() as client:
            response = await client.post(
                f"{self.config['url']}/settle",
                json={
                    "t402Version": payment.t402_version,
                    "paymentPayload": payment.model_dump(by_alias=True),
                    "paymentRequirements": payment_requirements.model_dump(
                        by_alias=True, exclude_none=True
                    ),
                },
                headers=headers,
                follow_redirects=True,
            )
            data = response.json()
            return SettleResponse(**data)

    async def list(
        self, request: Optional[ListDiscoveryResourcesRequest] = None
    ) -> ListDiscoveryResourcesResponse:
        """List discovery resources from the facilitator service.

        Args:
            request: Optional parameters for filtering and pagination

        Returns:
            ListDiscoveryResourcesResponse containing the list of discovery resources and pagination info
        """
        if request is None:
            request = ListDiscoveryResourcesRequest()

        headers = {"Content-Type": "application/json"}

        if self.config.get("create_headers"):
            custom_headers = await self.config["create_headers"]()
            headers.update(custom_headers.get("list", {}))

        # Build query parameters, excluding None values
        params = {
            k: str(v)
            for k, v in request.model_dump(by_alias=True).items()
            if v is not None
        }

        async with httpx.AsyncClient() as client:
            response = await client.get(
                f"{self.config['url']}/discovery/resources",
                params=params,
                headers=headers,
                follow_redirects=True,
            )

            if response.status_code != 200:
                raise ValueError(
                    f"Failed to list discovery resources: {response.status_code} {response.text}"
                )

            data = response.json()
            return ListDiscoveryResourcesResponse(**data)

    async def get_resource(self, resource_id: str) -> DiscoveryItem:
        """Get details of a specific discoverable resource.

        Args:
            resource_id: The unique ID of the resource

        Returns:
            DiscoveryItem with resource details
        """
        headers = {"Content-Type": "application/json"}

        if self.config.get("create_headers"):
            custom_headers = await self.config["create_headers"]()
            headers.update(custom_headers.get("discovery", {}))

        async with httpx.AsyncClient() as client:
            response = await client.get(
                f"{self.config['url']}/discovery/resources/{resource_id}",
                headers=headers,
                follow_redirects=True,
            )

            if response.status_code != 200:
                raise ValueError(
                    f"Failed to get resource: {response.status_code} {response.text}"
                )

            data = response.json()
            return DiscoveryItem(**data)

    async def register_resource(
        self, request: RegisterResourceRequest
    ) -> RegisterResourceResponse:
        """Register a new resource in the Bazaar.

        Args:
            request: Resource registration data

        Returns:
            RegisterResourceResponse with the new resource ID and metadata
        """
        headers = {"Content-Type": "application/json"}

        if self.config.get("create_headers"):
            custom_headers = await self.config["create_headers"]()
            headers.update(custom_headers.get("discovery", {}))

        async with httpx.AsyncClient() as client:
            response = await client.post(
                f"{self.config['url']}/discovery/register",
                json=request.model_dump(by_alias=True, exclude_none=True),
                headers=headers,
                follow_redirects=True,
            )

            if response.status_code != 201:
                raise ValueError(
                    f"Failed to register resource: {response.status_code} {response.text}"
                )

            data = response.json()
            return RegisterResourceResponse(**data)

    async def update_resource(
        self, resource_id: str, request: UpdateResourceRequest
    ) -> DiscoveryItem:
        """Update an existing resource in the Bazaar.

        Args:
            resource_id: The unique ID of the resource to update
            request: Resource update data

        Returns:
            DiscoveryItem with updated resource details
        """
        headers = {"Content-Type": "application/json"}

        if self.config.get("create_headers"):
            custom_headers = await self.config["create_headers"]()
            headers.update(custom_headers.get("discovery", {}))

        async with httpx.AsyncClient() as client:
            response = await client.put(
                f"{self.config['url']}/discovery/resources/{resource_id}",
                json=request.model_dump(by_alias=True, exclude_none=True),
                headers=headers,
                follow_redirects=True,
            )

            if response.status_code != 200:
                raise ValueError(
                    f"Failed to update resource: {response.status_code} {response.text}"
                )

            data = response.json()
            return DiscoveryItem(**data)

    async def delete_resource(self, resource_id: str) -> None:
        """Delete a resource from the Bazaar.

        Args:
            resource_id: The unique ID of the resource to delete
        """
        headers = {"Content-Type": "application/json"}

        if self.config.get("create_headers"):
            custom_headers = await self.config["create_headers"]()
            headers.update(custom_headers.get("discovery", {}))

        async with httpx.AsyncClient() as client:
            response = await client.delete(
                f"{self.config['url']}/discovery/resources/{resource_id}",
                headers=headers,
                follow_redirects=True,
            )

            if response.status_code != 204:
                raise ValueError(
                    f"Failed to delete resource: {response.status_code} {response.text}"
                )
