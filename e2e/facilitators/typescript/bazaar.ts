import type { DiscoveryInfo } from "@t402/extensions/bazaar";
import type { PaymentRequirements } from "@t402/core/types";

export interface DiscoveredResource {
  resource: string;
  type: "http";
  t402Version: number;
  accepts: PaymentRequirements[];
  discoveryInfo?: DiscoveryInfo;
  lastUpdated: string;
  metadata?: Record<string, unknown>;
}

export class BazaarCatalog {
  private discoveredResources = new Map<string, DiscoveredResource>();

  catalogResource(
    resourceUrl: string,
    method: string,
    t402Version: number,
    discoveryInfo: DiscoveryInfo,
    paymentRequirements: PaymentRequirements,
  ): void {
    console.log(`📝 Discovered resource: ${resourceUrl}`);
    console.log(`   Method: ${method}`);
    console.log(`   t402 Version: ${t402Version}`);

    this.discoveredResources.set(resourceUrl, {
      resource: resourceUrl,
      type: "http",
      t402Version,
      accepts: [paymentRequirements],
      discoveryInfo,
      lastUpdated: new Date().toISOString(),
      metadata: {},
    });
  }

  getResources(limit: number = 100, offset: number = 0) {
    const allResources = Array.from(this.discoveredResources.values());
    const total = allResources.length;
    const items = allResources.slice(offset, offset + limit);

    return {
      t402Version: 1,
      items,
      pagination: {
        limit,
        offset,
        total,
      },
    };
  }

  getCount(): number {
    return this.discoveredResources.size;
  }
}

