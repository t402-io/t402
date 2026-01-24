import type { Metadata } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import { WagmiProviderWrapper } from "./providers/WagmiProvider";
import { TonConnectProvider } from "./providers/TonConnectProvider";
import { SolanaProvider } from "./providers/SolanaProvider";
import { ChainProvider } from "./providers/ChainProvider";
import { DemoProvider } from "./providers/DemoProvider";
import "./globals.css";

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
  title: "T402 Demo — HTTP 402 Payments with USDT",
  description:
    "Interactive demo of the T402 payment protocol. Experience HTTP 402 flows with USDT/USDT0 — from AI API monetization to content paywalls.",
  openGraph: {
    title: "T402 Demo — HTTP 402 Payments",
    description: "Pay for web resources with USDT — no API keys, no subscriptions. Request → 402 → Sign → Settle → Access.",
    siteName: "T402",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "T402 Demo — HTTP 402 Payments",
    description: "Pay for web resources with USDT — no API keys, no subscriptions.",
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
        <ChainProvider>
          <TonConnectProvider>
            <SolanaProvider>
              <WagmiProviderWrapper>
                <DemoProvider>
                  {children}
                </DemoProvider>
              </WagmiProviderWrapper>
            </SolanaProvider>
          </TonConnectProvider>
        </ChainProvider>
      </body>
    </html>
  );
}
