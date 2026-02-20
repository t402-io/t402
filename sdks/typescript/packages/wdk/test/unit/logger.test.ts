import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { defaultLogger, noopLogger, createCorrelationId } from '../../src/logger'
import type { T402Logger } from '../../src/logger'

describe('T402Logger', () => {
  describe('defaultLogger', () => {
    let debugSpy: ReturnType<typeof vi.spyOn>
    let infoSpy: ReturnType<typeof vi.spyOn>
    let warnSpy: ReturnType<typeof vi.spyOn>
    let errorSpy: ReturnType<typeof vi.spyOn>

    beforeEach(() => {
      debugSpy = vi.spyOn(console, 'debug').mockImplementation(() => {})
      infoSpy = vi.spyOn(console, 'info').mockImplementation(() => {})
      warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
      errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    })

    afterEach(() => {
      vi.restoreAllMocks()
    })

    it('should log debug messages with prefix', () => {
      defaultLogger.debug('test debug')
      expect(debugSpy).toHaveBeenCalledWith('[t402] test debug')
    })

    it('should log info messages with context', () => {
      defaultLogger.info('user paid', { chain: 'arbitrum', amount: '1.00' })
      expect(infoSpy).toHaveBeenCalledWith('[t402] user paid', {
        chain: 'arbitrum',
        amount: '1.00',
      })
    })

    it('should log warn messages', () => {
      defaultLogger.warn('low balance')
      expect(warnSpy).toHaveBeenCalledWith('[t402] low balance')
    })

    it('should log error messages with context', () => {
      defaultLogger.error('tx failed', { code: 500 })
      expect(errorSpy).toHaveBeenCalledWith('[t402] tx failed', { code: 500 })
    })

    it('should not pass context if empty object', () => {
      defaultLogger.info('no context', {})
      expect(infoSpy).toHaveBeenCalledWith('[t402] no context')
    })

    it('should not pass context if undefined', () => {
      defaultLogger.info('no context')
      expect(infoSpy).toHaveBeenCalledWith('[t402] no context')
    })
  })

  describe('noopLogger', () => {
    it('should have all required methods', () => {
      expect(typeof noopLogger.debug).toBe('function')
      expect(typeof noopLogger.info).toBe('function')
      expect(typeof noopLogger.warn).toBe('function')
      expect(typeof noopLogger.error).toBe('function')
    })

    it('should not throw when called', () => {
      expect(() => noopLogger.debug('test')).not.toThrow()
      expect(() => noopLogger.info('test', { key: 'value' })).not.toThrow()
      expect(() => noopLogger.warn('test')).not.toThrow()
      expect(() => noopLogger.error('test')).not.toThrow()
    })

    it('should not call console methods', () => {
      const spy = vi.spyOn(console, 'debug').mockImplementation(() => {})
      noopLogger.debug('silent')
      expect(spy).not.toHaveBeenCalled()
      spy.mockRestore()
    })
  })

  describe('createCorrelationId', () => {
    it('should return a hex string', () => {
      const id = createCorrelationId()
      expect(id).toMatch(/^[0-9a-f]{16}$/)
    })

    it('should return unique IDs', () => {
      const ids = new Set(Array.from({ length: 100 }, () => createCorrelationId()))
      expect(ids.size).toBe(100)
    })
  })

  describe('T402Logger interface compliance', () => {
    it('defaultLogger satisfies T402Logger', () => {
      const logger: T402Logger = defaultLogger
      expect(logger).toBeDefined()
    })

    it('noopLogger satisfies T402Logger', () => {
      const logger: T402Logger = noopLogger
      expect(logger).toBeDefined()
    })

    it('custom logger satisfies T402Logger', () => {
      const logs: string[] = []
      const logger: T402Logger = {
        debug: (msg) => logs.push(`DEBUG: ${msg}`),
        info: (msg) => logs.push(`INFO: ${msg}`),
        warn: (msg) => logs.push(`WARN: ${msg}`),
        error: (msg) => logs.push(`ERROR: ${msg}`),
      }
      logger.info('test')
      expect(logs).toEqual(['INFO: test'])
    })
  })
})
