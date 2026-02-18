import { describe, it, expect, vi, afterEach } from 'vitest'
import {
  FailoverProvider,
  createFailoverProvider,
  resolveRpcUrl,
} from '../../src/failover'

const URL_1 = 'https://arb1.arbitrum.io/rpc'
const URL_2 = 'https://arb-fallback-1.example.com'
const URL_3 = 'https://arb-fallback-2.example.com'

describe('FailoverProvider', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('should throw if no URLs provided', () => {
    expect(() => new FailoverProvider({ urls: [] })).toThrow('at least one URL')
  })

  it('should return first URL as current', () => {
    const provider = new FailoverProvider({
      urls: [URL_1, URL_2],
      healthCheckInterval: 0,
    })
    expect(provider.getCurrentUrl()).toBe(URL_1)
    provider.dispose()
  })

  it('should not switch on single failure below threshold', () => {
    const provider = new FailoverProvider({
      urls: [URL_1, URL_2],
      maxFailures: 3,
      healthCheckInterval: 0,
    })

    const result = provider.reportFailure()
    expect(result).toBeNull() // No switch
    expect(provider.getCurrentUrl()).toBe(URL_1)
    provider.dispose()
  })

  it('should switch to next URL after reaching failure threshold', () => {
    const provider = new FailoverProvider({
      urls: [URL_1, URL_2],
      maxFailures: 2,
      healthCheckInterval: 0,
    })

    provider.reportFailure() // 1
    const switched = provider.reportFailure() // 2 -> threshold reached

    expect(switched).toBe(URL_2)
    expect(provider.getCurrentUrl()).toBe(URL_2)
    provider.dispose()
  })

  it('should reset failure counter on success', () => {
    const provider = new FailoverProvider({
      urls: [URL_1, URL_2],
      maxFailures: 3,
      healthCheckInterval: 0,
    })

    provider.reportFailure() // 1
    provider.reportFailure() // 2
    provider.reportSuccess() // reset

    // Should not switch since counter was reset
    const result = provider.reportFailure() // 1 again
    expect(result).toBeNull()
    expect(provider.getCurrentUrl()).toBe(URL_1)
    provider.dispose()
  })

  it('should return null from switchToNext when all providers unhealthy', () => {
    const provider = new FailoverProvider({
      urls: [URL_1, URL_2],
      maxFailures: 1,
      healthCheckInterval: 0,
    })

    // Make first unhealthy
    provider.reportFailure() // switches to URL_2
    // Make second unhealthy
    provider.reportFailure() // tries to switch but no healthy left

    const result = provider.switchToNext()
    expect(result).toBeNull()
    provider.dispose()
  })

  it('should wrap around to first provider in switchToNext', () => {
    const provider = new FailoverProvider({
      urls: [URL_1, URL_2, URL_3],
      maxFailures: 1,
      healthCheckInterval: 0,
    })

    // Make URL_1 unhealthy
    provider.reportFailure() // switches to URL_2
    expect(provider.getCurrentUrl()).toBe(URL_2)

    // Make URL_2 unhealthy
    provider.reportFailure() // switches to URL_3
    expect(provider.getCurrentUrl()).toBe(URL_3)

    provider.dispose()
  })

  it('should return all provider statuses', () => {
    const provider = new FailoverProvider({
      urls: [URL_1, URL_2],
      healthCheckInterval: 0,
    })

    const statuses = provider.getStatus()
    expect(statuses).toHaveLength(2)
    expect(statuses[0].url).toBe(URL_1)
    expect(statuses[0].healthy).toBe(true)
    expect(statuses[0].consecutiveFailures).toBe(0)
    expect(statuses[1].url).toBe(URL_2)
    expect(statuses[1].healthy).toBe(true)

    provider.dispose()
  })

  it('should return defensive copies from getStatus', () => {
    const provider = new FailoverProvider({
      urls: [URL_1],
      healthCheckInterval: 0,
    })

    const statuses = provider.getStatus()
    statuses[0].healthy = false // Mutate copy

    // Original should be unchanged
    expect(provider.getStatus()[0].healthy).toBe(true)
    provider.dispose()
  })

  it('should use default maxFailures of 3', () => {
    const provider = new FailoverProvider({
      urls: [URL_1, URL_2],
      healthCheckInterval: 0,
    })

    provider.reportFailure() // 1
    provider.reportFailure() // 2
    expect(provider.getCurrentUrl()).toBe(URL_1) // Still on URL_1
    provider.reportFailure() // 3 -> switch
    expect(provider.getCurrentUrl()).toBe(URL_2)
    provider.dispose()
  })

  it('should expose requestTimeout', () => {
    const provider = new FailoverProvider({
      urls: [URL_1],
      requestTimeout: 10_000,
      healthCheckInterval: 0,
    })
    expect(provider.getRequestTimeout()).toBe(10_000)
    provider.dispose()
  })

  it('should use default requestTimeout of 5000', () => {
    const provider = new FailoverProvider({
      urls: [URL_1],
      healthCheckInterval: 0,
    })
    expect(provider.getRequestTimeout()).toBe(5_000)
    provider.dispose()
  })

  it('should stop health checks on dispose', () => {
    const provider = new FailoverProvider({
      urls: [URL_1, URL_2],
      healthCheckInterval: 100,
    })

    // Should not throw
    provider.dispose()
    provider.dispose() // Double dispose is safe
  })

  it('should force switch to next healthy provider', () => {
    const provider = new FailoverProvider({
      urls: [URL_1, URL_2, URL_3],
      healthCheckInterval: 0,
    })

    const result = provider.switchToNext()
    expect(result).toBe(URL_2)
    expect(provider.getCurrentUrl()).toBe(URL_2)
    provider.dispose()
  })
})

describe('createFailoverProvider', () => {
  it('should return null for a single string URL', () => {
    const result = createFailoverProvider(URL_1)
    expect(result).toBeNull()
  })

  it('should create FailoverProvider for an array of URLs', () => {
    const result = createFailoverProvider([URL_1, URL_2])
    expect(result).toBeInstanceOf(FailoverProvider)
    expect(result!.getCurrentUrl()).toBe(URL_1)
    result!.dispose()
  })

  it('should create FailoverProvider for a FailoverConfig object', () => {
    const result = createFailoverProvider({
      urls: [URL_1, URL_2],
      maxFailures: 5,
      healthCheckInterval: 0,
    })
    expect(result).toBeInstanceOf(FailoverProvider)
    expect(result!.getCurrentUrl()).toBe(URL_1)
    result!.dispose()
  })
})

describe('resolveRpcUrl', () => {
  it('should return the string directly', () => {
    expect(resolveRpcUrl(URL_1)).toBe(URL_1)
  })

  it('should return first URL from array', () => {
    expect(resolveRpcUrl([URL_1, URL_2])).toBe(URL_1)
  })

  it('should return first URL from FailoverConfig', () => {
    expect(resolveRpcUrl({ urls: [URL_2, URL_1] })).toBe(URL_2)
  })
})
