import { describe, it, expect, vi } from 'vitest'
import React from 'react'
import { renderToString } from 'react-dom/server'
import { T402Provider, useT402Context } from '../../src/T402Provider'
import type { T402ProviderConfig } from '../../src/types'

const testConfig: T402ProviderConfig = {
  facilitatorUrl: 'https://facilitator.t402.io',
  networks: ['eip155:42161', 'ton:mainnet'],
}

// Helper to run a hook inside T402Provider using SSR
function captureContext(config: T402ProviderConfig): {
  current: ReturnType<typeof useT402Context>
} {
  const ref = { current: null as unknown as ReturnType<typeof useT402Context> }

  function Capture() {
    ref.current = useT402Context()
    return null
  }

  renderToString(
    <T402Provider config={config}>
      <Capture />
    </T402Provider>,
  )

  return ref
}

describe('T402Provider', () => {
  it('throws when useT402Context is used outside provider', () => {
    function BadComponent() {
      useT402Context()
      return null
    }

    expect(() => renderToString(<BadComponent />)).toThrow(
      'useT402Context must be used within a T402Provider',
    )
  })

  it('provides context with config', () => {
    const ref = captureContext(testConfig)

    expect(ref.current.config).toEqual(testConfig)
    expect(ref.current.isReady).toBe(true)
    expect(ref.current.signer).toBeNull()
  })

  it('provides signer when configured', () => {
    const mockSigner = { sign: vi.fn() }
    const ref = captureContext({ ...testConfig, signer: mockSigner })

    expect(ref.current.signer).toBe(mockSigner)
  })

  it('reports not ready when facilitatorUrl is empty', () => {
    const ref = captureContext({ facilitatorUrl: '' })

    expect(ref.current.isReady).toBe(false)
  })

  it('preserves networks in config', () => {
    const ref = captureContext(testConfig)

    expect(ref.current.config.networks).toEqual(['eip155:42161', 'ton:mainnet'])
  })

  it('preserves chains in config', () => {
    const ref = captureContext({
      ...testConfig,
      chains: { arbitrum: 'https://arb1.arbitrum.io/rpc' },
    })

    expect(ref.current.config.chains).toEqual({ arbitrum: 'https://arb1.arbitrum.io/rpc' })
  })
})
