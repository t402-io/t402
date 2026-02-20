/**
 * Bridge Delivery Tracking
 *
 * Tracks LayerZero cross-chain bridge message delivery status
 * by polling the LayerZero Scan API.
 */

/** Bridge delivery status (mirrors @t402/wdk-bridge BridgeDeliveryStatus) */
export type BridgeDeliveryStatus = 'INFLIGHT' | 'CONFIRMING' | 'DELIVERED' | 'FAILED' | 'BLOCKED'

/** Options for waiting for delivery */
export interface WaitOptions {
  timeout?: number
  pollInterval?: number
  onStatusChange?: (status: BridgeDeliveryStatus) => void
}

/** Result of delivery confirmation */
export interface DeliveryResult {
  success: boolean
  status: BridgeDeliveryStatus
  dstTxHash?: `0x${string}`
  srcTxHash: `0x${string}`
  messageGuid: `0x${string}`
  error?: string
}

const LAYERZERO_SCAN_API = 'https://scan.layerzero-api.com/v1'

export interface BridgeTrackerConfig {
  apiBaseUrl?: string // Override for testing
}

export class BridgeTracker {
  private apiBaseUrl: string

  constructor(config?: BridgeTrackerConfig) {
    this.apiBaseUrl = config?.apiBaseUrl ?? LAYERZERO_SCAN_API
  }

  /** Get current status of a bridge message */
  async getStatus(txHash: string): Promise<{ status: BridgeDeliveryStatus; dstTxHash?: string }> {
    const response = await fetch(`${this.apiBaseUrl}/messages/tx/${txHash}`)
    if (!response.ok) {
      if (response.status === 404) return { status: 'INFLIGHT' }
      throw new Error(`LayerZero API error: ${response.status}`)
    }
    const data = await response.json()
    return mapLayerZeroStatus(data)
  }

  /** Wait for delivery with polling */
  async waitForDelivery(txHash: string, options?: WaitOptions): Promise<DeliveryResult> {
    const timeout = options?.timeout ?? 600_000 // 10 min default
    const pollInterval = options?.pollInterval ?? 10_000 // 10s default
    const startTime = Date.now()

    while (Date.now() - startTime < timeout) {
      const { status, dstTxHash } = await this.getStatus(txHash)
      options?.onStatusChange?.(status)

      if (status === 'DELIVERED') {
        return {
          success: true,
          status,
          dstTxHash: dstTxHash as `0x${string}`,
          srcTxHash: txHash as `0x${string}`,
          messageGuid: txHash as `0x${string}`,
        }
      }
      if (status === 'FAILED' || status === 'BLOCKED') {
        return {
          success: false,
          status,
          srcTxHash: txHash as `0x${string}`,
          messageGuid: txHash as `0x${string}`,
          error: `Bridge ${status.toLowerCase()}`,
        }
      }

      await new Promise((r) => setTimeout(r, pollInterval))
    }

    return {
      success: false,
      status: 'INFLIGHT',
      srcTxHash: txHash as `0x${string}`,
      messageGuid: txHash as `0x${string}`,
      error: 'Timeout waiting for delivery',
    }
  }
}

export function mapLayerZeroStatus(data: unknown): {
  status: BridgeDeliveryStatus
  dstTxHash?: string
} {
  const obj = data as Record<string, unknown> | null
  if (!obj) return { status: 'INFLIGHT' }

  const messages = (obj.messages ?? obj.data ?? []) as unknown
  const msg = (Array.isArray(messages) ? messages[0] : messages) as Record<string, unknown> | null
  if (!msg) return { status: 'INFLIGHT' }

  const lzStatus = ((msg.status as string) ?? (msg.msgStatus as string) ?? '').toUpperCase()

  if (lzStatus === 'DELIVERED' || lzStatus === 'DESTINATION_FINALIZED') {
    return { status: 'DELIVERED', dstTxHash: msg.dstTxHash as string | undefined }
  }
  if (lzStatus === 'FAILED') return { status: 'FAILED' }
  if (lzStatus === 'BLOCKED') return { status: 'BLOCKED' }
  if (lzStatus.includes('CONFIRM')) return { status: 'CONFIRMING' }
  return { status: 'INFLIGHT' }
}
