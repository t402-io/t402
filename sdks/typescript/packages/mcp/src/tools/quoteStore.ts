/**
 * Quote Store - In-memory quote storage with TTL
 */

import { randomUUID } from 'crypto'

/** Default quote TTL in milliseconds (5 minutes) */
const DEFAULT_TTL_MS = 5 * 60 * 1000

/** Quote data stored in the quote store */
export interface QuoteData {
  id: string
  type: 'swap' | 'bridge'
  createdAt: number
  expiresAt: number
  data: Record<string, unknown>
}

/** In-memory quote store */
const quotes = new Map<string, QuoteData>()

/** Cleanup interval handle */
let cleanupInterval: ReturnType<typeof setInterval> | null = null

/**
 * Start auto-cleanup of expired quotes (runs every 60s)
 */
function ensureCleanup(): void {
  if (cleanupInterval) return
  cleanupInterval = setInterval(() => {
    const now = Date.now()
    for (const [id, quote] of quotes) {
      if (now > quote.expiresAt) {
        quotes.delete(id)
      }
    }
  }, 60_000)
  // Allow process to exit without waiting for cleanup
  if (cleanupInterval.unref) {
    cleanupInterval.unref()
  }
}

/**
 * Create a new quote and store it
 *
 * @param type - Quote type ('swap' or 'bridge')
 * @param data - Quote data to store
 * @param ttlMs - Time-to-live in milliseconds (default: 5 minutes)
 * @returns Quote ID (UUID)
 */
export function createQuote(
  type: 'swap' | 'bridge',
  data: Record<string, unknown>,
  ttlMs: number = DEFAULT_TTL_MS,
): string {
  ensureCleanup()
  const id = randomUUID()
  const now = Date.now()
  quotes.set(id, {
    id,
    type,
    createdAt: now,
    expiresAt: now + ttlMs,
    data,
  })
  return id
}

/**
 * Get a quote by ID (returns null if expired or not found)
 */
export function getQuote(quoteId: string): QuoteData | null {
  const quote = quotes.get(quoteId)
  if (!quote) return null
  if (Date.now() > quote.expiresAt) {
    quotes.delete(quoteId)
    return null
  }
  return quote
}

/**
 * Delete a quote by ID
 */
export function deleteQuote(quoteId: string): void {
  quotes.delete(quoteId)
}

/**
 * Clear all quotes (useful for testing)
 */
export function clearQuoteStore(): void {
  quotes.clear()
}
