import { TonConnectUIProvider } from '@tonconnect/ui-react'
import { WalletConnect } from './WalletConnect'
import { PaymentPage } from './PaymentPage'

const MANIFEST_URL =
  import.meta.env.VITE_TON_CONNECT_MANIFEST_URL ||
  'https://your-domain.com/tonconnect-manifest.json'

/**
 * Main Telegram Mini App component.
 *
 * Sets up TON Connect for wallet management and renders the
 * payment-gated content page.
 */
export function App() {
  return (
    <TonConnectUIProvider manifestUrl={MANIFEST_URL}>
      <div style={styles.app}>
        <header style={styles.header}>
          <h1 style={styles.title}>t402 Content Store</h1>
          <WalletConnect />
        </header>
        <main>
          <PaymentPage />
        </main>
      </div>
    </TonConnectUIProvider>
  )
}

const styles = {
  app: {
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
    minHeight: '100vh',
    backgroundColor: '#F5F5F5',
  },
  header: {
    padding: '16px',
    backgroundColor: '#FFFFFF',
    borderBottom: '1px solid #E0E0E0',
    textAlign: 'center' as const,
  },
  title: {
    fontSize: '18px',
    fontWeight: '600' as const,
    margin: '0 0 8px',
  },
}
