import type { Metadata, Viewport } from "next";
import { Geist, JetBrains_Mono, Source_Serif_4 } from "next/font/google";
import Script from "next/script";
import "./globals.css";

const geist = Geist({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-geist-sans",
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-jetbrains-mono",
});

const sourceSerif = Source_Serif_4({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-source-serif",
  weight: ["400", "500", "600", "700"],
  style: ["normal", "italic"],
});

export const metadata: Metadata = {
  title: "T402 - Open-source HTTP Payment Protocol for Stablecoins",
  description:
    "T402 is an open-source HTTP-native payment protocol for stablecoins. Pay with USDT, USDC, and other ERC-20 / TRC-20 / TON tokens across 47 networks (EVM, Solana, TON, TRON, NEAR, Aptos, and more). Zero protocol fees. Instant settlement. Wire-compatible with x402. Built for AI agents.",
  keywords: [
    "USDT",
    "USDT0",
    "payment protocol",
    "stablecoin",
    "HTTP payments",
    "blockchain",
    "Ethereum",
    "Solana",
    "TON",
    "TRON",
    "NEAR",
    "Aptos",
    "AI agents",
    "MCP",
    "A2A",
    "gasless",
    "cross-chain",
    "LayerZero",
  ],
  authors: [{ name: "T402" }],
  metadataBase: new URL("https://t402.io"),
  alternates: {
    canonical: "/",
  },
  openGraph: {
    title: "T402 - Open-source HTTP Payment Protocol for Stablecoins",
    description:
      "HTTP-native stablecoin payments across 47 networks. Zero protocol fees. Instant settlement. Wire-compatible with x402.",
    type: "website",
    siteName: "T402",
    url: "https://t402.io",
    // Note: image is auto-emitted by app/opengraph-image.tsx (editorial cover).
    // No static fallback — old /t402-logo.png contained gem+₮ device mark.
  },
  twitter: {
    card: "summary_large_image",
    title: "T402 - Open-source HTTP Payment Protocol for Stablecoins",
    description:
      "HTTP-native stablecoin payments across 47 networks. Zero protocol fees. Instant settlement. Wire-compatible with x402.",
    // Image is auto-emitted by app/twitter-image.tsx (editorial cover).
  },
  robots: {
    index: true,
    follow: true,
  },
};

// JSON-LD Structured Data
const jsonLd = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "Organization",
      "@id": "https://t402.io/#organization",
      name: "T402",
      url: "https://t402.io",
      logo: {
        "@type": "ImageObject",
        url: "https://t402.io/logo.png",
      },
      sameAs: [
        "https://github.com/t402-io/t402",
        "https://t.me/t402_io",
      ],
    },
    {
      "@type": "WebSite",
      "@id": "https://t402.io/#website",
      url: "https://t402.io",
      name: "T402",
      description: "Open-source HTTP Payment Protocol for Stablecoins",
      publisher: {
        "@id": "https://t402.io/#organization",
      },
    },
    {
      "@type": "SoftwareApplication",
      "@id": "https://t402.io/#software",
      name: "T402 SDK",
      applicationCategory: "DeveloperApplication",
      operatingSystem: "Cross-platform",
      offers: {
        "@type": "Offer",
        price: "0",
        priceCurrency: "USD",
      },
      description:
        "Open-source SDKs for HTTP-native stablecoin payments across multiple blockchains",
      downloadUrl: "https://www.npmjs.com/package/@t402/core",
      softwareVersion: "2.9.0",
      programmingLanguage: ["TypeScript", "Python", "Go", "Java"],
    },
  ],
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  themeColor: "#FAFAF7",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${geist.variable} ${jetbrainsMono.variable} ${sourceSerif.variable} scroll-smooth`}>
      <head>
        <link rel="icon" type="image/svg+xml" href="/favicon.svg" />
        <meta name="apple-mobile-web-app-title" content="T402" />
        <link rel="manifest" href="/site.webmanifest" />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
      </head>
      <body className="antialiased">
        <Script
          src="https://www.googletagmanager.com/gtag/js?id=G-7FRFFD0PH0"
          strategy="afterInteractive"
        />
        <Script id="gtag-init" strategy="afterInteractive">
          {`window.dataLayer = window.dataLayer || [];
function gtag(){dataLayer.push(arguments);}
gtag('js', new Date());
gtag('config', 'G-7FRFFD0PH0');`}
        </Script>
        <a href="#main-content" className="skip-to-content">
          Skip to main content
        </a>
        <main id="main-content">{children}</main>
        {/* SSR-rendered trademark disclaimer — visible in raw HTML for crawlers
            and screen readers without relying on client hydration. */}
        <aside
          aria-label="Trademark notice"
          style={{
            background: "#0F0F0F",
            color: "#918C82",
            fontSize: "11px",
            lineHeight: 1.6,
            padding: "16px 24px",
            textAlign: "center",
            borderTop: "1px solid rgba(255,255,255,0.04)",
            fontFamily: "var(--font-sans)",
            letterSpacing: "0.01em",
          }}
        >
          T402 is an independent open-source project. Not affiliated with,
          endorsed by, sponsored by, or in any way officially connected with
          Tether Operations Limited, Tether Holdings, or any of their
          affiliates. &ldquo;Tether&rdquo;, &ldquo;USDT&rdquo;,
          &ldquo;USDT0&rdquo;, &ldquo;USDC&rdquo;, and other token names and
          logos referenced on this site are trademarks of their respective
          owners and are used nominatively to describe token interoperability
          only.
        </aside>
      </body>
    </html>
  );
}
