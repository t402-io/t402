import type { Metadata } from "next";
import Link from "next/link";
import { NavBar } from "../components/NavBar";
import { Footer } from "../components/Footer";

export const metadata: Metadata = {
  title: "Terms of Service | T402",
  description:
    "Terms of Service for T402 protocol services. Understand the terms governing use of our protocol, SDKs, facilitator service, and related tools.",
  openGraph: {
    title: "T402 Terms of Service",
    description:
      "Terms of Service for T402 protocol services.",
  },
};

export default function TermsPage() {
  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      <NavBar />

      <div className="flex-1">
        <article className="pb-24">
          <header className="max-w-editorial mx-auto px-6 pt-16 sm:pt-20 md:pt-28">
            <div className="mb-10 flex items-baseline justify-between text-foreground-secondary">
              <span className="editorial-mark text-base md:text-lg">N° 402.TOS</span>
              <span className="eyebrow">Terms of Service</span>
            </div>
            <hr className="rule" />
            <h1 className="mt-12 mb-6 font-serif text-4xl leading-[1.1] md:text-6xl">
              Terms of Service
            </h1>
            <p className="eyebrow text-foreground-tertiary mb-10">
              Last updated · May 28, 2026
            </p>
            <hr className="rule" />
          </header>

          <section className="max-w-editorial mx-auto px-6 mt-12 space-y-8">
            {/* Introduction */}
            <div className="border-l-2 pl-6 py-2" style={{ borderColor: "var(--color-brand)" }}>
              <p className="font-serif text-base italic leading-relaxed text-foreground-secondary md:text-lg">
                These Terms of Service (&quot;Terms&quot;) govern your use of the T402 protocol, related services, SDKs, and tools. By using any T402 service, you agree to these Terms.
              </p>
            </div>

            {/* Definitions */}
            <section className="space-y-4">
              <h2 className="text-2xl font-semibold mt-8">1. Definitions</h2>
              <ul className="list-disc pl-5 space-y-2 text-base leading-relaxed text-foreground-secondary">
                <li><strong className="text-foreground">&quot;Protocol&quot;</strong>: The T402 HTTP 402 payment protocol specification and its implementations.</li>
                <li><strong className="text-foreground">&quot;Services&quot;</strong>: The websites (t402.io, docs.t402.io, demo.t402.io, pay.t402.io), facilitator API (facilitator.t402.io), and related infrastructure operated by the T402 team.</li>
                <li><strong className="text-foreground">&quot;SDKs&quot;</strong>: The open-source software development kits published under the @t402 namespace on npm, PyPI, Go Modules, and Maven Central.</li>
                <li><strong className="text-foreground">&quot;Facilitator&quot;</strong>: The service that verifies payment authorizations and executes on-chain settlements.</li>
                <li><strong className="text-foreground">&quot;User&quot;</strong>: Any individual or entity that uses the Protocol, Services, or SDKs.</li>
              </ul>
            </section>

            {/* License */}
            <section className="space-y-4">
              <h2 className="text-2xl font-semibold mt-8">2. Open Source License</h2>
              <p className="text-base leading-relaxed text-foreground-secondary">
                The T402 protocol specification and SDKs are released under the Apache 2.0 License. You are free to use, modify, and distribute the code subject to the Apache 2.0 License terms. The full license text is available in the{" "}
                <Link href="https://github.com/t402-io/t402/blob/main/LICENSE" target="_blank" rel="noopener noreferrer" className="text-brand hover:text-brand-secondary">
                  repository
                </Link>.
              </p>
              <p className="text-base leading-relaxed text-foreground-secondary">
                These Terms apply specifically to the hosted Services operated by the T402 team, not to the open-source code itself.
              </p>
            </section>

            {/* Use of Services */}
            <section className="space-y-4">
              <h2 className="text-2xl font-semibold mt-8">3. Use of Services</h2>

              <h3 className="text-lg font-medium text-foreground mt-4">3.1 Eligibility</h3>
              <p className="text-base leading-relaxed text-foreground-secondary">
                You must be of legal age in your jurisdiction to use the Services. By using the Services, you represent that you have the legal capacity to enter into these Terms.
              </p>

              <h3 className="text-lg font-medium text-foreground mt-4">3.2 Acceptable Use</h3>
              <p className="text-base leading-relaxed text-foreground-secondary">
                You agree not to:
              </p>
              <ul className="list-disc pl-5 space-y-2 text-base leading-relaxed text-foreground-secondary">
                <li>Use the Services for any illegal purpose or in violation of applicable laws</li>
                <li>Attempt to circumvent rate limits or security measures</li>
                <li>Submit fraudulent payment authorizations or manipulated signatures</li>
                <li>Use the Services to launder money or finance prohibited activities</li>
                <li>Interfere with or disrupt the Services or their infrastructure</li>
                <li>Reverse-engineer the facilitator&apos;s private systems beyond the open-source code</li>
              </ul>

              <h3 className="text-lg font-medium text-foreground mt-4">3.3 Rate Limits</h3>
              <p className="text-base leading-relaxed text-foreground-secondary">
                The facilitator API is subject to rate limits. Current limits are published in the API documentation. Excessive usage may result in temporary or permanent access restrictions.
              </p>
            </section>

            {/* Facilitator Service */}
            <section className="space-y-4">
              <h2 className="text-2xl font-semibold mt-8">4. Facilitator Service</h2>

              <h3 className="text-lg font-medium text-foreground mt-4">4.1 Role</h3>
              <p className="text-base leading-relaxed text-foreground-secondary">
                The facilitator verifies payment authorization signatures and executes on-chain token transfers. It acts as a neutral intermediary between clients (payers) and servers (payees).
              </p>

              <h3 className="text-lg font-medium text-foreground mt-4">4.2 No Custody</h3>
              <p className="text-base leading-relaxed text-foreground-secondary">
                The facilitator does not hold, custody, or control user funds. Payments are executed directly on-chain from the payer&apos;s wallet to the payee&apos;s address. The facilitator only possesses the authority granted by specific payment authorizations (e.g., EIP-3009 TransferWithAuthorization).
              </p>

              <h3 className="text-lg font-medium text-foreground mt-4">4.3 Availability</h3>
              <p className="text-base leading-relaxed text-foreground-secondary">
                We strive for high availability but do not guarantee uninterrupted service. The facilitator may be unavailable due to maintenance, blockchain network issues, or force majeure events. You are encouraged to deploy your own facilitator instance for production-critical applications.
              </p>

              <h3 className="text-lg font-medium text-foreground mt-4">4.4 Fees</h3>
              <p className="text-base leading-relaxed text-foreground-secondary">
                The T402 protocol charges zero protocol fees. Users are responsible for blockchain network gas fees incurred during settlement. The hosted facilitator service is provided free of charge; this may change with advance notice.
              </p>
            </section>

            {/* Blockchain Risks */}
            <section className="space-y-4">
              <h2 className="text-2xl font-semibold mt-8">5. Blockchain Risks</h2>
              <p className="text-base leading-relaxed text-foreground-secondary">
                By using T402 for blockchain payments, you acknowledge and accept:
              </p>
              <ul className="list-disc pl-5 space-y-2 text-base leading-relaxed text-foreground-secondary">
                <li><strong className="text-foreground">Irreversibility</strong>: Blockchain transactions are final and cannot be reversed once confirmed.</li>
                <li><strong className="text-foreground">Network Risks</strong>: Blockchain networks may experience congestion, forks, or outages beyond our control.</li>
                <li><strong className="text-foreground">Smart Contract Risk</strong>: Token contracts (USDT, USDT0) are operated by their respective issuers and may be subject to pausing, freezing, or other administrative actions.</li>
                <li><strong className="text-foreground">Key Management</strong>: You are solely responsible for the security of your private keys and wallet access.</li>
                <li><strong className="text-foreground">Regulatory Risk</strong>: Cryptocurrency regulations vary by jurisdiction and may change.</li>
              </ul>
            </section>

            {/* Intellectual Property */}
            <section className="space-y-4">
              <h2 className="text-2xl font-semibold mt-8">6. Intellectual Property</h2>
              <p className="text-base leading-relaxed text-foreground-secondary">
                The T402 name, logo, and branding are trademarks of the T402 project. The open-source code is licensed under Apache 2.0. Documentation content is available for reference and educational use.
              </p>
              <p className="text-base leading-relaxed text-foreground-secondary">
                You may use the T402 name to accurately describe compatibility with the protocol (e.g., &quot;T402-compatible&quot;) but may not imply official endorsement without permission.
              </p>
            </section>

            {/* Disclaimers */}
            <section className="space-y-4">
              <h2 className="text-2xl font-semibold mt-8">7. Disclaimers</h2>
              <div className="border-l-2 pl-6 py-2 space-y-3" style={{ borderColor: "var(--color-rule-soft)" }}>
                <p className="text-base leading-relaxed text-foreground-secondary">
                  THE SERVICES AND SDKS ARE PROVIDED &quot;AS IS&quot; AND &quot;AS AVAILABLE&quot; WITHOUT WARRANTIES OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE, AND NON-INFRINGEMENT.
                </p>
                <p className="text-base leading-relaxed text-foreground-secondary">
                  WE DO NOT WARRANT THAT THE SERVICES WILL BE UNINTERRUPTED, ERROR-FREE, OR SECURE, OR THAT DEFECTS WILL BE CORRECTED.
                </p>
                <p className="text-base leading-relaxed text-foreground-secondary">
                  THE T402 TEAM DOES NOT PROVIDE FINANCIAL ADVICE. USE OF THE PROTOCOL FOR PAYMENTS IS AT YOUR OWN RISK AND DISCRETION.
                </p>
              </div>
            </section>

            {/* Limitation of Liability */}
            <section className="space-y-4">
              <h2 className="text-2xl font-semibold mt-8">8. Limitation of Liability</h2>
              <p className="text-base leading-relaxed text-foreground-secondary">
                To the maximum extent permitted by applicable law, the T402 team shall not be liable for any indirect, incidental, special, consequential, or punitive damages, including but not limited to:
              </p>
              <ul className="list-disc pl-5 space-y-2 text-base leading-relaxed text-foreground-secondary">
                <li>Loss of funds due to incorrect addresses, failed transactions, or key compromise</li>
                <li>Service downtime or unavailability</li>
                <li>Bugs in open-source code</li>
                <li>Actions by blockchain networks or token issuers</li>
                <li>Regulatory actions affecting cryptocurrency usage</li>
              </ul>
            </section>

            {/* Indemnification */}
            <section className="space-y-4">
              <h2 className="text-2xl font-semibold mt-8">9. Indemnification</h2>
              <p className="text-base leading-relaxed text-foreground-secondary">
                You agree to indemnify and hold harmless the T402 team from any claims, damages, or expenses arising from your use of the Services, violation of these Terms, or infringement of any third-party rights.
              </p>
            </section>

            {/* Modifications */}
            <section className="space-y-4">
              <h2 className="text-2xl font-semibold mt-8">10. Modifications</h2>
              <p className="text-base leading-relaxed text-foreground-secondary">
                We reserve the right to modify these Terms at any time. Changes become effective when posted on this page. Continued use of the Services after changes constitutes acceptance of the modified Terms. Significant changes will be announced through our community channels.
              </p>
            </section>

            {/* Termination */}
            <section className="space-y-4">
              <h2 className="text-2xl font-semibold mt-8">11. Termination</h2>
              <p className="text-base leading-relaxed text-foreground-secondary">
                We may suspend or terminate access to the Services for users who violate these Terms or applicable laws. Since the protocol is open-source, termination only affects access to our hosted Services; you remain free to use the open-source code independently.
              </p>
            </section>

            {/* Governing Law */}
            <section className="space-y-4">
              <h2 className="text-2xl font-semibold mt-8">12. Governing Law</h2>
              <p className="text-base leading-relaxed text-foreground-secondary">
                These Terms shall be governed by and construed in accordance with applicable laws. Any disputes shall be resolved through good-faith negotiation before pursuing formal legal proceedings.
              </p>
            </section>

            {/* Contact */}
            <section className="space-y-4">
              <h2 className="text-2xl font-semibold mt-8">13. Contact</h2>
              <p className="text-base leading-relaxed text-foreground-secondary">
                For questions about these Terms:
              </p>
              <ul className="list-disc pl-5 space-y-2 text-base leading-relaxed text-foreground-secondary">
                <li>GitHub:{" "}
                  <Link href="https://github.com/t402-io/t402" target="_blank" rel="noopener noreferrer" className="text-brand hover:text-brand-secondary">
                    github.com/t402-io/t402
                  </Link>
                </li>
                <li>Community:{" "}
                  <Link href="https://t.me/t402_io" target="_blank" rel="noopener noreferrer" className="text-brand hover:text-brand-secondary">
                    Telegram
                  </Link>
                </li>
              </ul>
            </section>
          </section>
        </article>
      </div>

      <Footer />
    </div>
  );
}
