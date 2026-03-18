/**
 * Agentic Commerce Server
 *
 * A simple API with t402-protected purchase endpoints.
 * Free endpoints: search, browse catalog
 * Paid endpoints: purchase (returns 402 Payment Required)
 *
 * Usage: npx tsx src/server.ts
 */

import express from "express";
import { searchProducts, getProduct, CATALOG } from "./catalog.js";

const app = express();
app.use(express.json());

const PORT = process.env.PORT || 3402;
const SELLER_ADDRESS = process.env.SELLER_ADDRESS || "0x209693Bc6afc0C5328bA36FaF03C514EF312287C";
const NETWORK = "eip155:8453"; // Base
const ASSET = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913"; // USDC on Base

/**
 * GET /products — Browse catalog (free)
 */
app.get("/products", (_req, res) => {
  res.json({
    products: CATALOG.filter((p) => p.inStock),
    count: CATALOG.filter((p) => p.inStock).length,
  });
});

/**
 * GET /products/search?q=... — Search products (free)
 */
app.get("/products/search", (req, res) => {
  const query = (req.query.q as string) || "";
  if (!query) {
    res.status(400).json({ error: "Missing query parameter ?q=" });
    return;
  }
  const results = searchProducts(query);
  res.json({ results, count: results.length, query });
});

/**
 * GET /products/:id — Get product details (free)
 */
app.get("/products/:id", (req, res) => {
  const product = getProduct(req.params.id);
  if (!product) {
    res.status(404).json({ error: "Product not found" });
    return;
  }
  res.json(product);
});

/**
 * POST /purchase/:id — Purchase a product (PAID — returns 402)
 *
 * This is the t402-protected endpoint. Without a valid payment header,
 * it returns 402 with payment requirements. With a valid payment,
 * it returns the purchased resource.
 */
app.post("/purchase/:id", (req, res) => {
  const product = getProduct(req.params.id);
  if (!product) {
    res.status(404).json({ error: "Product not found" });
    return;
  }

  if (!product.inStock) {
    res.status(409).json({ error: "Product out of stock" });
    return;
  }

  // Check for payment header (t402 V2 or V1)
  const paymentHeader =
    req.headers["payment-signature"] || req.headers["x-payment"];

  if (!paymentHeader) {
    // Return 402 Payment Required with t402 requirements
    const amountInSmallestUnit = Math.round(product.priceUsd * 1e6).toString(); // USDC has 6 decimals

    res.status(402).json({
      t402Version: 2,
      accepts: [
        {
          scheme: "exact",
          network: NETWORK,
          asset: ASSET,
          amount: amountInSmallestUnit,
          payTo: SELLER_ADDRESS,
          maxTimeoutSeconds: 300,
          extra: {
            name: "USD Coin",
            version: "2",
            decimals: 6,
          },
        },
      ],
      resource: {
        url: `/purchase/${product.id}`,
        description: `Purchase: ${product.name}`,
        mimeType: "application/json",
      },
    });
    return;
  }

  // Payment present — in a real implementation, the t402 middleware
  // would verify and settle the payment before reaching here.
  // For this demo, we simulate a successful purchase.
  res.json({
    success: true,
    purchase: {
      productId: product.id,
      productName: product.name,
      amount: product.priceUsd,
      currency: "USD",
      network: NETWORK,
      timestamp: new Date().toISOString(),
    },
    resource: {
      type: product.category,
      accessUrl: `https://api.example.com/access/${product.id}`,
      expiresAt: new Date(Date.now() + 86400000).toISOString(),
      instructions: `Your ${product.name} is ready. Access it at the URL above within 24 hours.`,
    },
  });
});

/**
 * GET /health — Health check
 */
app.get("/health", (_req, res) => {
  res.json({ status: "ok", service: "t402-agentic-commerce" });
});

app.listen(PORT, () => {
  console.log(`🛒 Agentic Commerce Server running on http://localhost:${PORT}`);
  console.log(`   Seller: ${SELLER_ADDRESS}`);
  console.log(`   Network: ${NETWORK} (Base)`);
  console.log(`\nEndpoints:`);
  console.log(`   GET  /products          — Browse catalog`);
  console.log(`   GET  /products/search   — Search (?q=...)`);
  console.log(`   GET  /products/:id      — Product details`);
  console.log(`   POST /purchase/:id      — Purchase (402 protected)`);
});
