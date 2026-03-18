/**
 * Agentic Commerce Agent
 *
 * Demonstrates an AI agent autonomously:
 * 1. Browsing a product catalog
 * 2. Searching for products
 * 3. Selecting a product
 * 4. Encountering a 402 Payment Required
 * 5. Deciding to pay using t402
 * 6. Receiving the purchased resource
 *
 * Usage: npx tsx src/agent.ts
 */

const SERVER_URL = process.env.SERVER_URL || "http://localhost:3402";

interface Product {
  id: string;
  name: string;
  description: string;
  priceUsd: number;
  category: string;
}

interface PaymentRequirements {
  t402Version: number;
  accepts: Array<{
    scheme: string;
    network: string;
    asset: string;
    amount: string;
    payTo: string;
  }>;
  resource: { description: string };
}

async function agentRun() {
  console.log("🤖 Agent: Starting shopping session...\n");

  // Step 1: Browse catalog
  console.log("📋 Agent: Let me browse available products...");
  const catalogRes = await fetch(`${SERVER_URL}/products`);
  const catalog = (await catalogRes.json()) as { products: Product[]; count: number };
  console.log(`   Found ${catalog.count} products:\n`);
  for (const p of catalog.products) {
    console.log(`   • ${p.name} — $${p.priceUsd} (${p.category})`);
  }

  // Step 2: Search for something specific
  console.log("\n🔍 Agent: Searching for 'data' products...");
  const searchRes = await fetch(`${SERVER_URL}/products/search?q=data`);
  const search = (await searchRes.json()) as { results: Product[] };
  console.log(`   Found ${search.results.length} results:`);
  for (const p of search.results) {
    console.log(`   • ${p.name} — $${p.priceUsd}`);
  }

  // Step 3: Select a product
  const selected = search.results[0] || catalog.products[0];
  console.log(`\n🎯 Agent: I'll purchase "${selected.name}" ($${selected.priceUsd})`);

  // Step 4: Attempt purchase — get 402
  console.log("\n💳 Agent: Attempting purchase...");
  const purchaseRes = await fetch(`${SERVER_URL}/purchase/${selected.id}`, {
    method: "POST",
  });

  if (purchaseRes.status === 402) {
    const requirements = (await purchaseRes.json()) as PaymentRequirements;
    const accept = requirements.accepts[0];

    console.log(`   ⚠️  HTTP 402 Payment Required!`);
    console.log(`   Amount: ${Number(accept.amount) / 1e6} USDC`);
    console.log(`   Network: ${accept.network}`);
    console.log(`   PayTo: ${accept.payTo}`);
    console.log(`   Resource: ${requirements.resource.description}`);

    // Step 5: In a real agent, this is where t402/autoPay or t402/pay would kick in
    console.log(`\n🔐 Agent: Signing EIP-3009 TransferWithAuthorization...`);
    console.log(`   (In production: agent uses t402/autoPay MCP tool)`);

    // Step 6: Retry with payment header
    console.log(`\n📤 Agent: Retrying with payment signature...`);
    const paidRes = await fetch(`${SERVER_URL}/purchase/${selected.id}`, {
      method: "POST",
      headers: {
        "PAYMENT-SIGNATURE": "demo-payment-proof",
      },
    });

    if (paidRes.ok) {
      const result = await paidRes.json();
      console.log(`\n✅ Purchase successful!`);
      console.log(`   Product: ${(result as any).purchase.productName}`);
      console.log(`   Amount: $${(result as any).purchase.amount}`);
      console.log(`   Access: ${(result as any).resource.accessUrl}`);
      console.log(`   Expires: ${(result as any).resource.expiresAt}`);
      console.log(`\n💡 ${(result as any).resource.instructions}`);
    }
  } else if (purchaseRes.ok) {
    console.log("   ✅ Purchase went through without payment (demo mode)");
  }

  console.log("\n🤖 Agent: Shopping session complete.");
}

agentRun().catch(console.error);
