import type { Metadata, Viewport } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import Script from "next/script";
import { ClientProviders } from "./providers/ClientProviders";
import "./globals.css";

// Force dynamic rendering for all pages - wallet SDKs require browser-only APIs
export const dynamic = "force-dynamic";

const inter = Inter({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-inter",
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-mono",
});

export const metadata: Metadata = {
  metadataBase: new URL("https://demo.t402.io"),
  title: "T402 Demo — HTTP 402 Payments with USDT",
  description:
    "Interactive demo of the T402 payment protocol. Experience HTTP 402 flows with USDT/USDT0 across 44 networks and 10 chain families — from AI API monetization to content paywalls.",
  icons: {
    icon: [
      { url: "/favicon.svg", type: "image/svg+xml" },
      { url: "/favicon.ico", sizes: "32x32" },
      { url: "/favicon-96x96.png", sizes: "96x96", type: "image/png" },
    ],
    apple: "/apple-touch-icon.png",
  },
  openGraph: {
    title: "T402 Demo — HTTP 402 Payments",
    description: "Pay for web resources with USDT across 44 networks and 10 chain families. No API keys, no subscriptions. Request → 402 → Sign → Settle → Access.",
    siteName: "T402",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "T402 Demo — HTTP 402 Payments",
    description: "Pay for web resources with USDT across 44 networks — no API keys, no subscriptions.",
  },
  alternates: {
    canonical: "https://demo.t402.io",
  },
  robots: {
    index: true,
    follow: true,
  },
};

export const viewport: Viewport = {
  themeColor: "#0A0A0B",
};

const jsonLd = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "Organization",
      name: "T402",
      url: "https://t402.io",
      logo: "https://t402.io/favicon.svg",
      sameAs: ["https://github.com/t402-io/t402"],
    },
    {
      "@type": "WebApplication",
      name: "T402 Demo",
      url: "https://demo.t402.io",
      applicationCategory: "DeveloperApplication",
      operatingSystem: "Web",
      description:
        "Interactive demo of the T402 payment protocol. Experience HTTP 402 flows with USDT/USDT0 across 44 networks and 10 chain families.",
      offers: {
        "@type": "Offer",
        price: "0",
        priceCurrency: "USD",
      },
    },
  ],
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={`${inter.variable} ${jetbrainsMono.variable}`}>
      <body className="bg-[var(--color-background)] text-[var(--color-foreground)] antialiased">
        <a
          href="#main-content"
          className="sr-only focus:not-sr-only focus:fixed focus:top-4 focus:left-4 focus:z-[100] focus:px-4 focus:py-2 focus:bg-[var(--color-brand)] focus:text-black focus:rounded-lg focus:text-sm focus:font-medium"
        >
          Skip to content
        </a>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
        <noscript>
          <div style={{
            position: "fixed",
            inset: 0,
            zIndex: 9999,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: "#0A0A0B",
            color: "#A1A1AA",
            fontFamily: "system-ui, sans-serif",
            fontSize: "1.125rem",
            textAlign: "center",
            padding: "2rem",
          }}>
            This demo requires JavaScript to run. Please enable JavaScript in your browser.
          </div>
        </noscript>
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
        <ClientProviders>
          {children}
        </ClientProviders>
      </body>
    </html>
  );
}
