const features = [
  {
    title: "HTTP Native",
    description:
      "Built into standard HTTP request-response cycles. No WebSockets, no polling, no additional infrastructure. Just add a header.",
  },
  {
    title: "Gasless (ERC-4337)",
    description:
      "Users pay zero gas fees. EIP-3009 permit signatures and account abstraction handle everything.",
  },
  {
    title: "Multi-Chain",
    description:
      "47 networks across 13 blockchain families. EVM, Solana, TON, TRON, NEAR, Aptos, Tezos, Polkadot, Stacks, and Cosmos.",
  },
  {
    title: "AI Agent Ready",
    description:
      "MCP and A2A protocol support lets AI agents autonomously discover and pay for services.",
  },
  {
    title: "Open Source",
    description:
      "Fully open-source protocol. Self-host the facilitator, audit the code, build on top.",
  },
];

export function FeatureBento() {
  return (
    <section className="section-light py-24 md:py-32">
      <div className="mx-auto max-w-editorial px-6">
        {/* Section mark */}
        <div className="mb-10 flex items-baseline justify-between">
          <span className="editorial-mark text-base md:text-lg">N° 02</span>
          <span className="eyebrow">Features</span>
        </div>

        <hr className="rule" />

        {/* Section heading */}
        <h2 className="mt-12 mb-12 font-serif text-3xl leading-[1.15] text-[var(--color-foreground)] md:text-[2.75rem]">
          A complete payment infrastructure
          <br />
          for the multi-chain future.
        </h2>

        <hr className="rule" />

        {/* Numbered list */}
        <dl className="divide-y divide-[var(--color-rule-soft)]">
          {features.map((feature, i) => {
            const num = String(i + 1).padStart(2, "0");
            return (
              <div
                key={feature.title}
                className="grid grid-cols-12 gap-6 py-8 md:py-10"
              >
                {/* Number column */}
                <dt className="col-span-12 md:col-span-2">
                  <span className="editorial-mark text-base md:text-lg">{num}</span>
                </dt>

                {/* Title column */}
                <dd className="col-span-12 font-serif text-xl leading-tight text-[var(--color-foreground)] md:col-span-4 md:text-2xl">
                  {feature.title}
                </dd>

                {/* Description column */}
                <dd className="col-span-12 text-base leading-[1.65] text-[var(--color-foreground-secondary)] md:col-span-6">
                  {feature.description}
                </dd>
              </div>
            );
          })}
        </dl>
      </div>
    </section>
  );
}
