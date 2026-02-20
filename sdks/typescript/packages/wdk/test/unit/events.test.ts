import { describe, it, expect, vi } from 'vitest'
import { T402EventEmitter } from '../../src/events'

describe('T402EventEmitter', () => {
  describe('on / emit', () => {
    it('should call registered handler when event is emitted', () => {
      const emitter = new T402EventEmitter()
      const handler = vi.fn()
      emitter.on('payment:start', handler)
      emitter.emit('payment:start', {
        url: 'https://example.com',
        network: 'eip155:42161',
        amount: '100',
      })
      expect(handler).toHaveBeenCalledOnce()
      expect(handler).toHaveBeenCalledWith({
        url: 'https://example.com',
        network: 'eip155:42161',
        amount: '100',
      })
    })

    it('should support multiple handlers for the same event', () => {
      const emitter = new T402EventEmitter()
      const h1 = vi.fn()
      const h2 = vi.fn()
      emitter.on('payment:failed', h1)
      emitter.on('payment:failed', h2)
      emitter.emit('payment:failed', { url: 'https://x.com', error: 'timeout' })
      expect(h1).toHaveBeenCalledOnce()
      expect(h2).toHaveBeenCalledOnce()
    })

    it('should return true when handlers exist, false otherwise', () => {
      const emitter = new T402EventEmitter()
      expect(emitter.emit('payment:start', { url: '', network: '', amount: '' })).toBe(false)
      emitter.on('payment:start', () => {})
      expect(emitter.emit('payment:start', { url: '', network: '', amount: '' })).toBe(true)
    })

    it('should support chaining on()', () => {
      const emitter = new T402EventEmitter()
      const result = emitter.on('payment:start', () => {}).on('payment:failed', () => {})
      expect(result).toBe(emitter)
    })
  })

  describe('off', () => {
    it('should remove a specific handler', () => {
      const emitter = new T402EventEmitter()
      const handler = vi.fn()
      emitter.on('bridge:start', handler)
      emitter.off('bridge:start', handler)
      emitter.emit('bridge:start', { fromChain: 'arbitrum', toChain: 'base', amount: 100n })
      expect(handler).not.toHaveBeenCalled()
    })

    it('should not throw when removing a handler that was never added', () => {
      const emitter = new T402EventEmitter()
      expect(() => emitter.off('bridge:start', () => {})).not.toThrow()
    })

    it('should only remove the specified handler, not others', () => {
      const emitter = new T402EventEmitter()
      const keep = vi.fn()
      const remove = vi.fn()
      emitter.on('payment:complete', keep)
      emitter.on('payment:complete', remove)
      emitter.off('payment:complete', remove)
      emitter.emit('payment:complete', { url: '', success: true })
      expect(keep).toHaveBeenCalledOnce()
      expect(remove).not.toHaveBeenCalled()
    })
  })

  describe('once', () => {
    it('should fire handler only once then auto-remove', () => {
      const emitter = new T402EventEmitter()
      const handler = vi.fn()
      emitter.once('signer:initialized', handler)
      emitter.emit('signer:initialized', { chain: 'arbitrum', address: '0x123', family: 'evm' })
      emitter.emit('signer:initialized', { chain: 'base', address: '0x456', family: 'evm' })
      expect(handler).toHaveBeenCalledOnce()
      expect(handler).toHaveBeenCalledWith({ chain: 'arbitrum', address: '0x123', family: 'evm' })
    })

    it('should support chaining once()', () => {
      const emitter = new T402EventEmitter()
      const result = emitter.once('payment:start', () => {})
      expect(result).toBe(emitter)
    })
  })

  describe('removeAllListeners', () => {
    it('should remove all listeners for a specific event', () => {
      const emitter = new T402EventEmitter()
      const h1 = vi.fn()
      const h2 = vi.fn()
      emitter.on('bridge:confirmed', h1)
      emitter.on('bridge:confirmed', h2)
      emitter.removeAllListeners('bridge:confirmed')
      emitter.emit('bridge:confirmed', { txHash: '0x', fromChain: 'a', toChain: 'b' })
      expect(h1).not.toHaveBeenCalled()
      expect(h2).not.toHaveBeenCalled()
    })

    it('should remove all listeners across all events when no event specified', () => {
      const emitter = new T402EventEmitter()
      const h1 = vi.fn()
      const h2 = vi.fn()
      emitter.on('payment:start', h1)
      emitter.on('bridge:start', h2)
      emitter.removeAllListeners()
      emitter.emit('payment:start', { url: '', network: '', amount: '' })
      emitter.emit('bridge:start', { fromChain: '', toChain: '', amount: 0n })
      expect(h1).not.toHaveBeenCalled()
      expect(h2).not.toHaveBeenCalled()
    })

    it('should support chaining removeAllListeners()', () => {
      const emitter = new T402EventEmitter()
      const result = emitter.removeAllListeners()
      expect(result).toBe(emitter)
    })
  })

  describe('listenerCount', () => {
    it('should return 0 for events with no listeners', () => {
      const emitter = new T402EventEmitter()
      expect(emitter.listenerCount('payment:start')).toBe(0)
    })

    it('should return the correct count of listeners', () => {
      const emitter = new T402EventEmitter()
      emitter.on('payment:start', () => {})
      emitter.on('payment:start', () => {})
      emitter.on('payment:failed', () => {})
      expect(emitter.listenerCount('payment:start')).toBe(2)
      expect(emitter.listenerCount('payment:failed')).toBe(1)
    })

    it('should decrease after removing a listener', () => {
      const emitter = new T402EventEmitter()
      const handler = () => {}
      emitter.on('bridge:delivered', handler)
      expect(emitter.listenerCount('bridge:delivered')).toBe(1)
      emitter.off('bridge:delivered', handler)
      expect(emitter.listenerCount('bridge:delivered')).toBe(0)
    })
  })

  describe('balance:changed event', () => {
    it('should pass bigint values correctly', () => {
      const emitter = new T402EventEmitter()
      const handler = vi.fn()
      emitter.on('balance:changed', handler)
      emitter.emit('balance:changed', {
        chain: 'arbitrum',
        token: 'USDT0',
        previousBalance: 1000000n,
        newBalance: 500000n,
      })
      expect(handler).toHaveBeenCalledWith({
        chain: 'arbitrum',
        token: 'USDT0',
        previousBalance: 1000000n,
        newBalance: 500000n,
      })
    })
  })
})
