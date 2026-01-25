import type { Metadata } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
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
    "Interactive demo of the T402 payment protocol. Experience HTTP 402 flows with USDT/USDT0 — from AI API monetization to content paywalls.",
  openGraph: {
    title: "T402 Demo — HTTP 402 Payments",
    description: "Pay for web resources with USDT — no API keys, no subscriptions. Request → 402 → Sign → Settle → Access.",
    siteName: "T402",
    type: "website",
    images: [{ url: "/og-image.png", width: 1200, height: 630 }],
  },
  twitter: {
    card: "summary_large_image",
    title: "T402 Demo — HTTP 402 Payments",
    description: "Pay for web resources with USDT — no API keys, no subscriptions.",
    images: ["/og-image.png"],
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
        <ClientProviders>
          {children}
        </ClientProviders>
      </body>
    </html>
  );
}
