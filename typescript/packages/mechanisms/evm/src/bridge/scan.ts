/**
 * LayerZero Scan API Client
 *
 * Provides tracking for cross-chain messages via LayerZero Scan.
 *
 * @see https://docs.layerzero.network/v2/tools/api/scan/mainnet
 *
 * @example
 * ```typescript
 * import { LayerZeroScanClient } from '@t402/evm';
 *
 * const scanClient = new LayerZeroScanClient();
 *
 * // Get message status
 * const message = await scanClient.getMessage(messageGuid);
 * console.log(`Status: ${message.status}`);
 *
 * // Wait for delivery
 * const delivered = await scanClient.waitForDelivery(messageGuid, {
 *   onStatusChange: (status) => console.log(`Status changed: ${status}`),
 * });
 * console.log(`Delivered! Destination TX: ${delivered.dstTxHash}`);
 * ```
 */

import type {
  LayerZeroMessage,
  LayerZeroMessageStatus,
  WaitForDeliveryOptions,
} from "./types.js";

/**
 * LayerZero Scan API base URL
 */
export const LAYERZERO_SCAN_BASE_URL = "https://scan.layerzero-api.com/v1";

/**
 * Default timeout for waiting (10 minutes)
 */
const DEFAULT_TIMEOUT = 600_000;

/**
 * Default poll interval (10 seconds)
 */
const DEFAULT_POLL_INTERVAL = 10_000;

/**
 * LayerZero Scan API Client
 *
 * Use this client to track the status of cross-chain messages sent via LayerZero.
 */
export class LayerZeroScanClient {
  private readonly baseUrl: string;

  /**
   * Create a new LayerZero Scan client
   *
   * @param baseUrl - API base URL (default: production endpoint)
   */
  constructor(baseUrl: string = LAYERZERO_SCAN_BASE_URL) {
    this.baseUrl = baseUrl;
  }

  /**
   * Get message by GUID
   *
   * @param guid - LayerZero message GUID
   * @returns Message details including status
   * @throws Error if message not found or API error
   */
  async getMessage(guid: string): Promise<LayerZeroMessage> {
    const url = `${this.baseUrl}/messages/guid/${guid}`;

    const response = await fetch(url, {
      method: "GET",
      headers: {
        Accept: "application/json",
      },
    });

    if (!response.ok) {
      if (response.status === 404) {
        throw new Error(`Message not found: ${guid}`);
      }
      throw new Error(`LayerZero Scan API error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    return this.mapApiResponse(data);
  }

  /**
   * Get messages by wallet address
   *
   * @param address - Wallet address that initiated messages
   * @param limit - Maximum number of messages to return (default: 20)
   * @returns Array of messages
   */
  async getMessagesByWallet(
    address: string,
    limit: number = 20,
  ): Promise<LayerZeroMessage[]> {
    const url = `${this.baseUrl}/messages/wallet/${address}?limit=${limit}`;

    const response = await fetch(url, {
      method: "GET",
      headers: {
        Accept: "application/json",
      },
    });

    if (!response.ok) {
      throw new Error(`LayerZero Scan API error: ${response.status} ${response.statusText}`);
    }

    const data = (await response.json()) as Record<string, unknown>;
    const messages = (data.messages ?? data.data ?? []) as unknown[];
    return messages.map((msg: unknown) => this.mapApiResponse(msg));
  }

  /**
   * Poll message status until delivered or failed
   *
   * @param guid - LayerZero message GUID
   * @param options - Wait configuration options
   * @returns Final message state (DELIVERED)
   * @throws Error if message fails, is blocked, or times out
   */
  async waitForDelivery(
    guid: string,
    options: WaitForDeliveryOptions = {},
  ): Promise<LayerZeroMessage> {
    const {
      timeout = DEFAULT_TIMEOUT,
      pollInterval = DEFAULT_POLL_INTERVAL,
      onStatusChange,
    } = options;

    const startTime = Date.now();
    let lastStatus: LayerZeroMessageStatus | null = null;

    while (Date.now() - startTime < timeout) {
      try {
        const message = await this.getMessage(guid);

        // Notify on status change
        if (lastStatus !== message.status) {
          lastStatus = message.status;
          onStatusChange?.(message.status);
        }

        // Check terminal states
        if (message.status === "DELIVERED") {
          return message;
        }

        if (message.status === "FAILED") {
          throw new Error(`Bridge message failed: ${guid}`);
        }

        if (message.status === "BLOCKED") {
          throw new Error(`Bridge message blocked by DVN: ${guid}`);
        }

        // Continue polling for INFLIGHT/CONFIRMING
        await this.sleep(pollInterval);
      } catch (error) {
        // Message not yet indexed, retry
        if ((error as Error).message.includes("not found")) {
          await this.sleep(pollInterval);
          continue;
        }
        throw error;
      }
    }

    throw new Error(`Timeout waiting for message delivery: ${guid}`);
  }

  /**
   * Check if a message has been delivered
   *
   * @param guid - LayerZero message GUID
   * @returns True if delivered, false otherwise
   */
  async isDelivered(guid: string): Promise<boolean> {
    try {
      const message = await this.getMessage(guid);
      return message.status === "DELIVERED";
    } catch {
      return false;
    }
  }

  /**
   * Map API response to our interface
   */
  private mapApiResponse(data: unknown): LayerZeroMessage {
    const msg = data as Record<string, unknown>;
    return {
      guid: (msg.guid ?? msg.messageGuid ?? "") as string,
      srcEid: (msg.srcEid ?? msg.srcChainId ?? 0) as number,
      dstEid: (msg.dstEid ?? msg.dstChainId ?? 0) as number,
      srcUaAddress: (msg.srcUaAddress ?? msg.srcAddress ?? "") as string,
      dstUaAddress: (msg.dstUaAddress ?? msg.dstAddress ?? "") as string,
      srcTxHash: (msg.srcTxHash ?? "") as string,
      dstTxHash: (msg.dstTxHash ?? undefined) as string | undefined,
      status: (msg.status ?? "INFLIGHT") as LayerZeroMessageStatus,
      srcBlockNumber: (msg.srcBlockNumber ?? 0) as number,
      dstBlockNumber: (msg.dstBlockNumber ?? undefined) as number | undefined,
      created: (msg.created ?? msg.createdAt ?? "") as string,
      updated: (msg.updated ?? msg.updatedAt ?? "") as string,
    };
  }

  /**
   * Sleep helper
   */
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

/**
 * Create a LayerZero Scan client
 *
 * @param baseUrl - Optional custom API base URL
 */
export function createLayerZeroScanClient(
  baseUrl?: string,
): LayerZeroScanClient {
  return new LayerZeroScanClient(baseUrl);
}
