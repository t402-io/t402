import type {
  PaymentLifecycleEventType,
  PaymentLifecycleEventUnion,
  PaymentLifecycleListener,
  PaymentLifecycleEmitterInterface,
} from './types'

/**
 * Emitter for payment lifecycle events.
 *
 * Supports SSE-style event streaming for real-time observability
 * of payment processing stages: received, verifying, verified,
 * settling, settled, and failed.
 */
export class PaymentLifecycleEmitter implements PaymentLifecycleEmitterInterface {
  /**
   * Format a lifecycle event as an SSE-compatible string.
   * Suitable for streaming to clients via Server-Sent Events.
   *
   * @param event - The lifecycle event to format
   * @returns SSE-formatted string with event type and JSON data
   */
  static formatSSE(event: PaymentLifecycleEventUnion): string {
    return `event: ${event.type}\ndata: ${JSON.stringify(event)}\n\n`
  }

  private listeners: Map<PaymentLifecycleEventType, Set<PaymentLifecycleListener>> = new Map()
  private allListeners: Set<PaymentLifecycleListener> = new Set()
  private history: PaymentLifecycleEventUnion[] = []
  private readonly maxHistorySize: number

  /**
   * Create a new PaymentLifecycleEmitter.
   *
   * @param maxHistorySize - Maximum number of events to retain in history (default: 100)
   */
  constructor(maxHistorySize: number = 100) {
    this.maxHistorySize = maxHistorySize
  }

  /**
   * Emit a payment lifecycle event to all registered listeners.
   * The event is added to the history buffer and dispatched to
   * both type-specific and catch-all listeners.
   *
   * @param event - The lifecycle event to emit
   */
  emit(event: PaymentLifecycleEventUnion): void {
    // Add to history
    this.history.push(event)
    if (this.history.length > this.maxHistorySize) {
      this.history.shift()
    }

    // Dispatch to type-specific listeners
    const typeListeners = this.listeners.get(event.type)
    if (typeListeners) {
      for (const listener of typeListeners) {
        try {
          listener(event)
        } catch {
          // Swallow listener errors to prevent cascading failures
        }
      }
    }

    // Dispatch to catch-all listeners
    for (const listener of this.allListeners) {
      try {
        listener(event)
      } catch {
        // Swallow listener errors to prevent cascading failures
      }
    }
  }

  /**
   * Register a listener for a specific event type.
   *
   * @param type - The event type to listen for
   * @param listener - The callback function invoked when the event occurs
   */
  on(type: PaymentLifecycleEventType, listener: PaymentLifecycleListener): void {
    if (!this.listeners.has(type)) {
      this.listeners.set(type, new Set())
    }
    this.listeners.get(type)!.add(listener)
  }

  /**
   * Register a listener that receives all event types.
   *
   * @param listener - The callback function invoked for every event
   */
  onAll(listener: PaymentLifecycleListener): void {
    this.allListeners.add(listener)
  }

  /**
   * Remove a listener for a specific event type.
   *
   * @param type - The event type
   * @param listener - The listener function to remove
   */
  off(type: PaymentLifecycleEventType, listener: PaymentLifecycleListener): void {
    const typeListeners = this.listeners.get(type)
    if (typeListeners) {
      typeListeners.delete(listener)
      if (typeListeners.size === 0) {
        this.listeners.delete(type)
      }
    }
  }

  /**
   * Remove a catch-all listener.
   *
   * @param listener - The listener function to remove
   */
  offAll(listener: PaymentLifecycleListener): void {
    this.allListeners.delete(listener)
  }

  /**
   * Get the event history buffer.
   *
   * @returns A copy of the event history array
   */
  getHistory(): PaymentLifecycleEventUnion[] {
    return [...this.history]
  }

  /**
   * Clear all event history.
   */
  clearHistory(): void {
    this.history = []
  }

  /**
   * Get the number of listeners registered for a specific event type.
   *
   * @param type - The event type to query, or undefined for catch-all listeners
   * @returns The number of registered listeners
   */
  listenerCount(type?: PaymentLifecycleEventType): number {
    if (type) {
      return (this.listeners.get(type)?.size ?? 0) + this.allListeners.size
    }
    return this.allListeners.size
  }

  /**
   * Remove all listeners and clear history.
   */
  removeAllListeners(): void {
    this.listeners.clear()
    this.allListeners.clear()
    this.history = []
  }
}
