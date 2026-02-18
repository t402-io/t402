import { useState } from 'react'
import { useTonConnectUI, useTonAddress } from '@tonconnect/ui-react'
import { fetchResource, fetchWithPayment } from './api'
import type { PaymentRequired, PremiumContent, PaymentStatus } from './types'

const CONTENT_ITEMS = [
  { id: '1', title: 'Market Analysis Report', preview: 'Weekly crypto market overview...', price: '$0.01' },
  { id: '2', title: 'Trading Strategy Guide', preview: 'Advanced DeFi strategies...', price: '$0.05' },
  { id: '3', title: 'Research Deep Dive', preview: 'TON ecosystem analysis...', price: '$0.001' },
]

/**
 * Content purchase page that demonstrates the full t402 payment flow
 * within a Telegram Mini App using TON Connect for wallet signing.
 */
export function PaymentPage() {
  const address = useTonAddress()
  const [tonConnectUI] = useTonConnectUI()
  const [status, setStatus] = useState<PaymentStatus>('idle')
  const [content, setContent] = useState<PremiumContent | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [selectedItem, setSelectedItem] = useState<string | null>(null)

  const handlePurchase = async (contentId: string) => {
    if (!address) {
      setError('Please connect your wallet first')
      return
    }

    setSelectedItem(contentId)
    setStatus('loading')
    setError(null)
    setContent(null)

    try {
      // Step 1: Request the protected content
      const response = await fetchResource(`/api/content/${contentId}`)

      if (response.ok) {
        // Content is already accessible (e.g., already paid)
        const data = await response.json()
        setContent(data)
        setStatus('success')
        return
      }

      if (response.status !== 402) {
        throw new Error(`Unexpected status: ${response.status}`)
      }

      // Step 2: Parse the 402 Payment Required response
      const paymentRequired: PaymentRequired = await response.json()
      const requirement = paymentRequired.accepts[0]
      if (!requirement) {
        throw new Error('No payment requirements available')
      }

      setStatus('paying')

      // Step 3: Build and sign the TON Jetton transfer via TON Connect
      // The actual BOC construction depends on the TON USDT Jetton contract
      const paymentPayload = {
        t402Version: paymentRequired.t402Version,
        resource: paymentRequired.resource,
        accepted: requirement,
        payload: {
          from: address,
          network: requirement.network,
        },
      }

      // Send a transaction via TON Connect (simplified for demo)
      // In production, you would construct a proper Jetton transfer BOC
      await tonConnectUI.sendTransaction({
        validUntil: Math.floor(Date.now() / 1000) + requirement.maxTimeoutSeconds,
        messages: [
          {
            address: requirement.payTo,
            amount: requirement.amount,
          },
        ],
      })

      // Step 4: Resubmit with payment signature
      const paymentSignature = JSON.stringify(paymentPayload)
      const paidResponse = await fetchWithPayment(
        `/api/content/${contentId}`,
        paymentSignature,
      )

      if (!paidResponse.ok) {
        throw new Error('Payment verification failed')
      }

      const data = await paidResponse.json()
      setContent(data)
      setStatus('success')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Payment failed')
      setStatus('error')
    }
  }

  return (
    <div style={styles.container}>
      <h2 style={styles.heading}>Premium Content</h2>

      {!address && (
        <p style={styles.hint}>Connect your TON wallet to purchase content</p>
      )}

      <div style={styles.grid}>
        {CONTENT_ITEMS.map((item) => (
          <div key={item.id} style={styles.card}>
            <h3 style={styles.cardTitle}>{item.title}</h3>
            <p style={styles.cardPreview}>{item.preview}</p>
            <div style={styles.cardFooter}>
              <span style={styles.price}>{item.price} USDT</span>
              <button
                style={styles.buyButton}
                onClick={() => handlePurchase(item.id)}
                disabled={!address || (status === 'loading' && selectedItem === item.id)}
              >
                {status === 'loading' && selectedItem === item.id
                  ? 'Loading...'
                  : status === 'paying' && selectedItem === item.id
                    ? 'Confirm in wallet...'
                    : 'Unlock'}
              </button>
            </div>
          </div>
        ))}
      </div>

      {error && <div style={styles.error}>{error}</div>}

      {content && (
        <div style={styles.contentBox}>
          <h3>{content.title}</h3>
          <p style={styles.author}>By {content.author}</p>
          <p>{content.body}</p>
        </div>
      )}
    </div>
  )
}

const styles = {
  container: { padding: '16px', maxWidth: '480px', margin: '0 auto' },
  heading: { fontSize: '20px', fontWeight: '600' as const, marginBottom: '16px' },
  hint: { color: '#888', fontSize: '14px', marginBottom: '16px' },
  grid: { display: 'flex', flexDirection: 'column' as const, gap: '12px' },
  card: {
    border: '1px solid #e0e0e0',
    borderRadius: '12px',
    padding: '16px',
    backgroundColor: '#fff',
  },
  cardTitle: { fontSize: '16px', fontWeight: '500' as const, margin: '0 0 8px' },
  cardPreview: { fontSize: '14px', color: '#666', margin: '0 0 12px' },
  cardFooter: { display: 'flex', justifyContent: 'space-between', alignItems: 'center' },
  price: { fontWeight: '600' as const, color: '#007AFF' },
  buyButton: {
    backgroundColor: '#007AFF',
    color: '#fff',
    border: 'none',
    borderRadius: '8px',
    padding: '8px 16px',
    fontSize: '14px',
    cursor: 'pointer',
  },
  error: {
    backgroundColor: '#FFF0F0',
    color: '#FF3B30',
    padding: '12px',
    borderRadius: '8px',
    marginTop: '16px',
    fontSize: '14px',
  },
  contentBox: {
    backgroundColor: '#F0FFF0',
    padding: '16px',
    borderRadius: '12px',
    marginTop: '16px',
  },
  author: { fontSize: '12px', color: '#888', marginBottom: '8px' },
}
