import type { Metadata } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import { WagmiProviderWrapper } from "./providers/WagmiProvider";
import { DemoProvider } from "./providers/DemoProvider";
import { NavigationProvider } from "./providers/NavigationProvider";
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
  title: "T402 Demo — Live Interactive Demo",
  description:
    "Live demo of the t402 payment protocol. Connect your wallet, trigger HTTP 402 flows, and see real on-chain settlement.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={`${inter.variable} ${jetbrainsMono.variable}`}>
      <body className="bg-[var(--color-background)] text-[var(--color-foreground)] antialiased">
        <WagmiProviderWrapper>
          <DemoProvider>
            <NavigationProvider>
              {children}
            </NavigationProvider>
          </DemoProvider>
        </WagmiProviderWrapper>
      </body>
    </html>
  );
}
