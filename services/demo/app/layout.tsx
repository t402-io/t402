import type { Metadata } from "next";
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
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={`${inter.variable} ${jetbrainsMono.variable}`}>
      <body className="bg-[var(--color-background)] text-[var(--color-foreground)] antialiased">
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
