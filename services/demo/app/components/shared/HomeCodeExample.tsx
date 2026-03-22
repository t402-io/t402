"use client";

import { CodeTabs } from "./CodeTabs";

const SERVER_CODE = `import { t402 } from '@t402/express';

app.get('/api/premium', t402({
  scheme: 'exact',
  network: 'eip155:8453',
  amount: '1000',  // 0.001 USDT
}), (req, res) => {
  res.json({ data: 'Premium content' });
});`;

const CLIENT_CODE = `const res = await fetch('/api/premium');

if (res.status === 402) {
  const requirements = JSON.parse(
    atob(res.headers.get('Payment-Required'))
  );
  const signed = await wallet.signPayment(requirements);
  const paid = await fetch('/api/premium', {
    headers: { 'Payment-Signature': btoa(JSON.stringify(signed)) }
  });
  return paid.json();
}`;

const CURL_CODE = `# 1. Get payment requirements
curl -i https://api.example.com/premium
# -> HTTP 402, Payment-Required: <base64>

# 2. Sign and retry with payment
curl -H "Payment-Signature: <signed-base64>" \\
  https://api.example.com/premium
# -> HTTP 200, { "data": "Premium content" }`;

const TABS = [
  { label: "Server", language: "typescript" as const, code: SERVER_CODE },
  { label: "Client", language: "typescript" as const, code: CLIENT_CODE },
  { label: "curl", language: "bash" as const, code: CURL_CODE },
];

export function HomeCodeExample() {
  return <CodeTabs tabs={TABS} />;
}
