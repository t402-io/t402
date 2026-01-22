import type { Metadata, Viewport } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-sans",
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-mono",
});

export const metadata: Metadata = {
  title: "T402 - The Official Payment Protocol for USDT",
  description:
    "T402 is the official payment protocol for USDT. HTTP-native stablecoin payments across Ethereum, TON, TRON, and Solana. Zero fees. Instant settlement. Built for AI agents.",
  keywords: [
    "USDT",
    "payment protocol",
    "stablecoin",
    "HTTP payments",
    "blockchain",
    "Ethereum",
    "TON",
    "TRON",
    "Solana",
    "AI agents",
    "MCP",
    "gasless",
  ],
  authors: [{ name: "T402" }],
  metadataBase: new URL("https://t402.io"),
  alternates: {
    canonical: "/",
  },
  openGraph: {
    title: "T402 - The Official Payment Protocol for USDT",
    description:
      "HTTP-native stablecoin payments across Ethereum, TON, TRON, and Solana. Zero fees. Instant settlement.",
    type: "website",
    siteName: "T402",
    url: "https://t402.io",
  },
  twitter: {
    card: "summary_large_image",
    title: "T402 - The Official Payment Protocol for USDT",
    description:
      "HTTP-native stablecoin payments across Ethereum, TON, TRON, and Solana. Zero fees. Instant settlement.",
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
      description: "The Official Payment Protocol for USDT",
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
      softwareVersion: "2.3.0",
      programmingLanguage: ["TypeScript", "Python", "Go", "Java"],
    },
  ],
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  themeColor: "#0A0A0B",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${inter.variable} ${jetbrainsMono.variable}`}>
      <head>
        <link rel="icon" type="image/svg+xml" href="/favicon.svg" />
        <link rel="icon" type="image/png" href="/favicon.png" />
        <link rel="apple-touch-icon" href="/apple-touch-icon.png" />
        <meta name="apple-mobile-web-app-title" content="T402" />
        <link rel="manifest" href="/site.webmanifest" />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
      </head>
      <body className="antialiased">
        <a href="#main-content" className="skip-to-content">
          Skip to main content
        </a>
        <main id="main-content">{children}</main>
      </body>
    </html>
  );
}
