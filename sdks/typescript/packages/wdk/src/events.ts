/**
 * T402 Payment Event Emitter
 *
 * Provides typed event emission for tracking payment lifecycle,
 * balance changes, bridge operations, and signer initialization.
 */

/** T402 event types */
export interface T402Events {
  'payment:start': { url: string; network: string; amount: string }
  'payment:signed': { url: string; scheme: string; network: string }
  'payment:submitted': { url: string; statusCode: number }
  'payment:complete': { url: string; success: boolean; receipt?: unknown }
  'payment:failed': { url: string; error: string }
  'balance:changed': {
    chain: string
    token: string
    previousBalance: bigint
    newBalance: bigint
  }
  'bridge:start': { fromChain: string; toChain: string; amount: bigint }
  'bridge:confirmed': { txHash: string; fromChain: string; toChain: string }
  'bridge:delivered': { txHash: string; dstTxHash?: string; status: string }
  'signer:initialized': { chain: string; address: string; family: string }
}

type EventHandler<T> = (data: T) => void

export class T402EventEmitter {
  private handlers = new Map<string, Set<Function>>()

  on<K extends keyof T402Events>(event: K, handler: EventHandler<T402Events[K]>): this {
    let set = this.handlers.get(event)
    if (!set) {
      set = new Set()
      this.handlers.set(event, set)
    }
    set.add(handler)
    return this
  }

  off<K extends keyof T402Events>(event: K, handler: EventHandler<T402Events[K]>): this {
    const set = this.handlers.get(event)
    if (set) {
      set.delete(handler)
      if (set.size === 0) {
        this.handlers.delete(event)
      }
    }
    return this
  }

  once<K extends keyof T402Events>(event: K, handler: EventHandler<T402Events[K]>): this {
    const wrapper = (data: T402Events[K]) => {
      this.off(event, wrapper as EventHandler<T402Events[K]>)
      handler(data)
    }
    return this.on(event, wrapper as EventHandler<T402Events[K]>)
  }

  emit<K extends keyof T402Events>(event: K, data: T402Events[K]): boolean {
    const set = this.handlers.get(event)
    if (!set || set.size === 0) {
      return false
    }
    for (const handler of set) {
      handler(data)
    }
    return true
  }

  removeAllListeners(event?: keyof T402Events): this {
    if (event) {
      this.handlers.delete(event)
    } else {
      this.handlers.clear()
    }
    return this
  }

  listenerCount(event: keyof T402Events): number {
    return this.handlers.get(event)?.size ?? 0
  }
}
