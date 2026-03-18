/**
 * Simple product catalog for the demo.
 */

export interface Product {
  id: string;
  name: string;
  description: string;
  priceUsd: number;
  category: string;
  inStock: boolean;
}

export const CATALOG: Product[] = [
  {
    id: "prod-001",
    name: "GPT-4 API Credit Pack",
    description: "1000 API calls to GPT-4 inference endpoint",
    priceUsd: 25.0,
    category: "ai-services",
    inStock: true,
  },
  {
    id: "prod-002",
    name: "Weather Data Bundle",
    description: "30 days of global weather data (hourly resolution)",
    priceUsd: 5.0,
    category: "data",
    inStock: true,
  },
  {
    id: "prod-003",
    name: "Premium Market Report",
    description: "Weekly DeFi market analysis with trading signals",
    priceUsd: 50.0,
    category: "reports",
    inStock: true,
  },
  {
    id: "prod-004",
    name: "Image Generation Credits",
    description: "100 high-res image generations via Stable Diffusion",
    priceUsd: 10.0,
    category: "ai-services",
    inStock: true,
  },
  {
    id: "prod-005",
    name: "Blockchain Analytics Access",
    description: "24h access to on-chain analytics dashboard",
    priceUsd: 15.0,
    category: "data",
    inStock: false,
  },
];

export function searchProducts(query: string): Product[] {
  const q = query.toLowerCase();
  return CATALOG.filter(
    (p) =>
      p.inStock &&
      (p.name.toLowerCase().includes(q) ||
        p.description.toLowerCase().includes(q) ||
        p.category.toLowerCase().includes(q)),
  );
}

export function getProduct(id: string): Product | undefined {
  return CATALOG.find((p) => p.id === id);
}
