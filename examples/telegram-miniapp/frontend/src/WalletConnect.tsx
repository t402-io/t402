import { TonConnectButton, useTonConnectUI, useTonAddress } from '@tonconnect/ui-react'

interface WalletConnectProps {
  onConnected?: (address: string) => void
}

/**
 * TON Connect wallet connection component.
 *
 * Renders the TON Connect button and tracks the connected address.
 * Uses @tonconnect/ui-react for the standard TON wallet connection flow.
 */
export function WalletConnect({ onConnected }: WalletConnectProps) {
  const address = useTonAddress()
  const [tonConnectUI] = useTonConnectUI()

  // Notify parent when wallet connects
  if (address && onConnected) {
    onConnected(address)
  }

  return (
    <div style={styles.container}>
      <TonConnectButton />
      {address && (
        <div style={styles.addressContainer}>
          <span style={styles.label}>Connected:</span>
          <span style={styles.address}>
            {address.slice(0, 6)}...{address.slice(-4)}
          </span>
        </div>
      )}
    </div>
  )
}

const styles = {
  container: {
    display: 'flex',
    flexDirection: 'column' as const,
    alignItems: 'center',
    gap: '8px',
    padding: '16px',
  },
  addressContainer: {
    display: 'flex',
    gap: '4px',
    fontSize: '12px',
    color: '#888',
  },
  label: {
    fontWeight: '500' as const,
  },
  address: {
    fontFamily: 'monospace',
  },
}
