import type { Metadata } from "next";
import Link from "next/link";
import { NavBar } from "../components/NavBar";
import { Footer } from "../components/Footer";

export const metadata: Metadata = {
  title: "Privacy Policy | T402",
  description:
    "Privacy Policy for T402 protocol services. Learn how we handle your data across our website, documentation, and facilitator services.",
  openGraph: {
    title: "T402 Privacy Policy",
    description:
      "Privacy Policy for T402 protocol services.",
  },
};

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      <NavBar />

      <div className="flex-1">
        <article className="pb-24">
          <header className="max-w-editorial mx-auto px-6 pt-16 sm:pt-20 md:pt-28">
            <div className="mb-10 flex items-baseline justify-between text-foreground-secondary">
              <span className="editorial-mark text-base md:text-lg">T402.PRIV</span>
              <span className="eyebrow">Privacy Policy</span>
            </div>
            <hr className="rule" />
            <h1 className="mt-12 mb-6 font-serif text-4xl leading-[1.1] md:text-6xl">
              Privacy Policy
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
                T402 is an open-source protocol. This privacy policy covers the services operated by the T402 team: the website (t402.io), documentation (docs.t402.io), demo (demo.t402.io), the facilitator service (facilitator.t402.io), and the commercial sibling service t402 Pay (pay.t402.io).
              </p>
            </div>

            {/* What We Collect */}
            <section className="space-y-4">
              <h2 className="text-2xl font-semibold mt-8">1. Information We Collect</h2>

              <h3 className="text-lg font-medium text-foreground mt-4">1.1 Information You Provide</h3>
              <ul className="list-disc pl-5 space-y-2 text-base leading-relaxed text-foreground-secondary">
                <li><strong className="text-foreground">Blockchain Addresses</strong>: When using the facilitator service, your public blockchain address is included in payment verification and settlement requests.</li>
                <li><strong className="text-foreground">Payment Data</strong>: Transaction details (amounts, recipient addresses, network identifiers) submitted for verification or settlement.</li>
                <li><strong className="text-foreground">Feedback</strong>: Any information you voluntarily provide through GitHub issues or community channels.</li>
              </ul>

              <h3 className="text-lg font-medium text-foreground mt-4">1.2 Automatically Collected Information</h3>
              <ul className="list-disc pl-5 space-y-2 text-base leading-relaxed text-foreground-secondary">
                <li><strong className="text-foreground">Usage Data</strong>: Page views, referral sources, and general interaction patterns on our websites (via privacy-respecting analytics).</li>
                <li><strong className="text-foreground">Technical Data</strong>: IP address, browser type, device type, and operating system for security and performance purposes.</li>
                <li><strong className="text-foreground">API Logs</strong>: Request timestamps, endpoints accessed, and response codes for the facilitator service.</li>
              </ul>

              <h3 className="text-lg font-medium text-foreground mt-4">1.3 Information We Do NOT Collect</h3>
              <ul className="list-disc pl-5 space-y-2 text-base leading-relaxed text-foreground-secondary">
                <li>Private keys or seed phrases (these never leave your device)</li>
                <li>Personal identity information (name, email, phone) unless you voluntarily provide it</li>
                <li>Wallet balances or transaction history beyond what you submit to our services</li>
                <li>Cookies for advertising or cross-site tracking</li>
              </ul>
            </section>

            {/* How We Use Information */}
            <section className="space-y-4">
              <h2 className="text-2xl font-semibold mt-8">2. How We Use Information</h2>
              <ul className="list-disc pl-5 space-y-2 text-base leading-relaxed text-foreground-secondary">
                <li><strong className="text-foreground">Payment Processing</strong>: Verify payment signatures and execute on-chain settlements through the facilitator service.</li>
                <li><strong className="text-foreground">Service Operation</strong>: Maintain, monitor, and improve our services&apos; performance and reliability.</li>
                <li><strong className="text-foreground">Security</strong>: Detect and prevent abuse, fraud, or unauthorized access to our services.</li>
                <li><strong className="text-foreground">Rate Limiting</strong>: Ensure fair usage of the facilitator API.</li>
                <li><strong className="text-foreground">Analytics</strong>: Understand usage patterns to improve documentation and developer experience.</li>
              </ul>
            </section>

            {/* Data Sharing */}
            <section className="space-y-4">
              <h2 className="text-2xl font-semibold mt-8">3. Data Sharing</h2>
              <p className="text-base leading-relaxed text-foreground-secondary">
                We do not sell, rent, or share your personal information with third parties for marketing purposes. Information may be shared in the following limited circumstances:
              </p>
              <ul className="list-disc pl-5 space-y-2 text-base leading-relaxed text-foreground-secondary">
                <li><strong className="text-foreground">Blockchain Networks</strong>: Settlement transactions are broadcast to public blockchains by design. Transaction data on-chain is publicly visible.</li>
                <li><strong className="text-foreground">Infrastructure Providers</strong>: We use Cloudflare for hosting and RPC providers for blockchain access. These providers process requests on our behalf.</li>
                <li><strong className="text-foreground">Legal Requirements</strong>: We may disclose information if required by law or valid legal process.</li>
              </ul>
            </section>

            {/* Data Retention */}
            <section className="space-y-4">
              <h2 className="text-2xl font-semibold mt-8">4. Data Retention</h2>
              <ul className="list-disc pl-5 space-y-2 text-base leading-relaxed text-foreground-secondary">
                <li><strong className="text-foreground">API Logs</strong>: Retained for 30 days for debugging and security purposes, then deleted.</li>
                <li><strong className="text-foreground">Analytics Data</strong>: Aggregated and anonymized after 90 days.</li>
                <li><strong className="text-foreground">Settlement Records</strong>: Transaction hashes are retained as proof of settlement. On-chain data is permanent by nature.</li>
              </ul>
            </section>

            {/* Security */}
            <section className="space-y-4">
              <h2 className="text-2xl font-semibold mt-8">5. Security</h2>
              <p className="text-base leading-relaxed text-foreground-secondary">
                We implement industry-standard security measures to protect information:
              </p>
              <ul className="list-disc pl-5 space-y-2 text-base leading-relaxed text-foreground-secondary">
                <li>All services are served over HTTPS/TLS</li>
                <li>Facilitator private keys are stored in encrypted environments</li>
                <li>Rate limiting and abuse detection on all API endpoints</li>
                <li>Regular security audits of the open-source codebase</li>
                <li>Infrastructure monitoring via Grafana dashboards</li>
              </ul>
            </section>

            {/* Your Rights */}
            <section className="space-y-4">
              <h2 className="text-2xl font-semibold mt-8">6. Your Rights</h2>
              <p className="text-base leading-relaxed text-foreground-secondary">
                Depending on your jurisdiction, you may have the right to:
              </p>
              <ul className="list-disc pl-5 space-y-2 text-base leading-relaxed text-foreground-secondary">
                <li>Access the personal data we hold about you</li>
                <li>Request deletion of your data from our systems</li>
                <li>Object to or restrict processing of your data</li>
                <li>Request a copy of your data in a portable format</li>
              </ul>
              <p className="text-base leading-relaxed text-foreground-secondary">
                To exercise these rights, contact us via{" "}
                <Link href="https://github.com/t402-io/t402/issues" target="_blank" rel="noopener noreferrer" className="text-brand hover:text-brand-secondary">
                  GitHub
                </Link>
                {" "}or our community channels.
              </p>
            </section>

            {/* Open Source */}
            <section className="space-y-4">
              <h2 className="text-2xl font-semibold mt-8">7. Open Source Transparency</h2>
              <p className="text-base leading-relaxed text-foreground-secondary">
                T402 is an open-source protocol. The facilitator service code is publicly auditable at{" "}
                <Link href="https://github.com/t402-io/t402" target="_blank" rel="noopener noreferrer" className="text-brand hover:text-brand-secondary">
                  github.com/t402-io/t402
                </Link>
                . You can verify exactly what data is processed and how.
              </p>
              <p className="text-base leading-relaxed text-foreground-secondary">
                Self-hosted facilitator deployments are not covered by this policy. Operators of self-hosted instances are responsible for their own privacy practices.
              </p>
            </section>

            {/* Third-Party Services */}
            <section className="space-y-4">
              <h2 className="text-2xl font-semibold mt-8">8. Third-Party Services</h2>
              <p className="text-base leading-relaxed text-foreground-secondary">
                Our services integrate with or link to:
              </p>
              <ul className="list-disc pl-5 space-y-2 text-base leading-relaxed text-foreground-secondary">
                <li><strong className="text-foreground">Blockchain RPC Providers</strong>: For transaction submission and verification</li>
                <li><strong className="text-foreground">Cloudflare</strong>: For CDN and DDoS protection</li>
                <li><strong className="text-foreground">GitHub</strong>: For source code hosting and issue tracking</li>
              </ul>
              <p className="text-base leading-relaxed text-foreground-secondary">
                Each third-party service has its own privacy policy. We encourage you to review their policies.
              </p>
            </section>

            {/* Changes */}
            <section className="space-y-4">
              <h2 className="text-2xl font-semibold mt-8">9. Changes to This Policy</h2>
              <p className="text-base leading-relaxed text-foreground-secondary">
                We may update this privacy policy from time to time. Changes will be posted on this page with an updated date. Significant changes will be announced through our community channels.
              </p>
            </section>

            {/* Contact */}
            <section className="space-y-4">
              <h2 className="text-2xl font-semibold mt-8">10. Contact</h2>
              <p className="text-base leading-relaxed text-foreground-secondary">
                For privacy-related inquiries:
              </p>
              <ul className="list-disc pl-5 space-y-2 text-base leading-relaxed text-foreground-secondary">
                <li>GitHub Issues:{" "}
                  <Link href="https://github.com/t402-io/t402/issues" target="_blank" rel="noopener noreferrer" className="text-brand hover:text-brand-secondary">
                    github.com/t402-io/t402/issues
                  </Link>
                </li>
                <li>Security concerns:{" "}
                  <Link href="https://github.com/t402-io/t402/security/advisories/new" target="_blank" rel="noopener noreferrer" className="text-brand hover:text-brand-secondary">
                    Security Advisories
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
