import { describe, it, expect, vi, beforeEach } from 'vitest'
import React from 'react'
import { renderToString } from 'react-dom/server'

// We need to test the hook logic without a full React Native environment.
// We mock the T402Provider context and use a simplified hook runner.

const mockContext = {
  config: {
    facilitatorUrl: 'https://facilitator.t402.io',
    networks: ['eip155:42161'],
  },
  signer: null as unknown,
  isReady: true,
}

vi.mock('../../src/T402Provider', () => ({
  useT402Context: () => mockContext,
  T402Provider: ({ children }: { children: React.ReactNode }) => children,
  T402Context: React.createContext(null),
}))

import { useT402Payment } from '../../src/useT402Payment'
import type { PaymentRequired } from '@t402/core/types'

// Hook runner: captures the return value of a hook during SSR render
function runHook() {
  let result: ReturnType<typeof useT402Payment>

  function Capture() {
    result = useT402Payment()
    return null
  }

  renderToString(React.createElement(Capture))
  return result!
}

const mock402Response: PaymentRequired = {
  t402Version: 2,
  resource: {
    url: '/api/content',
    description: 'Premium content',
    mimeType: 'application/json',
  },
  accepts: [
    {
      scheme: 'exact',
      network: 'eip155:42161',
      asset: 'usdt0',
      amount: '1000000',
      payTo: '0x1234567890abcdef1234567890abcdef12345678',
      maxTimeoutSeconds: 300,
      extra: {},
    },
  ],
}

describe('useT402Payment', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
    mockContext.signer = null
  })

  it('returns initial idle state', () => {
    const { state } = runHook()
    expect(state.status).toBe('idle')
    expect(state.error).toBeUndefined()
    expect(state.txHash).toBeUndefined()
    expect(state.paymentRequired).toBeUndefined()
  })

  it('pay function is callable', () => {
    const { pay } = runHook()
    expect(typeof pay).toBe('function')
  })

  it('reset function is callable', () => {
    const { reset } = runHook()
    expect(typeof reset).toBe('function')
  })

  it('pay returns success for non-402 ok response', async () => {
    const mockResponse = new Response(JSON.stringify({ data: 'ok' }), { status: 200 })
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(mockResponse)

    const { pay } = runHook()
    const result = await pay({ url: 'https://api.example.com/free' })

    expect(result.success).toBe(true)
    expect(result.response).toBeDefined()
  })

  it('pay returns error for non-402 non-ok response', async () => {
    const mockResponse = new Response('Not found', { status: 404 })
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(mockResponse)

    const { pay } = runHook()
    const result = await pay({ url: 'https://api.example.com/missing' })

    expect(result.success).toBe(false)
    expect(result.error?.message).toContain('404')
  })

  it('pay returns error when 402 received but no signer', async () => {
    const mock402 = new Response(JSON.stringify(mock402Response), {
      status: 402,
      headers: { 'Content-Type': 'application/json' },
    })
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(mock402)

    mockContext.signer = null

    const { pay } = runHook()
    const result = await pay({ url: 'https://api.example.com/paid' })

    expect(result.success).toBe(false)
    expect(result.error?.message).toContain('No signer configured')
  })

  it('pay completes full flow with signer', async () => {
    const mock402 = new Response(JSON.stringify(mock402Response), {
      status: 402,
      headers: { 'Content-Type': 'application/json' },
    })
    const mockPaidResponse = new Response(JSON.stringify({ content: 'premium' }), {
      status: 200,
      headers: { 'X-Payment-TxHash': '0xabc123' },
    })

    vi.spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(mock402)
      .mockResolvedValueOnce(mockPaidResponse)

    mockContext.signer = {
      createPaymentPayload: vi.fn().mockResolvedValue({
        payload: { signature: '0xsig123' },
      }),
    }

    const { pay } = runHook()
    const result = await pay({ url: 'https://api.example.com/paid' })

    expect(result.success).toBe(true)
    expect(result.txHash).toBe('0xabc123')
  })

  it('pay handles fetch errors gracefully', async () => {
    vi.spyOn(globalThis, 'fetch').mockRejectedValueOnce(new Error('Network error'))

    const { pay } = runHook()
    const result = await pay({ url: 'https://api.example.com/offline' })

    expect(result.success).toBe(false)
    expect(result.error?.message).toBe('Network error')
  })

  it('pay uses preferredNetwork to select requirement', async () => {
    const multiNetworkResponse: PaymentRequired = {
      ...mock402Response,
      accepts: [
        ...mock402Response.accepts,
        {
          scheme: 'exact',
          network: 'ton:mainnet',
          asset: 'usdt',
          amount: '1000000',
          payTo: 'EQAbcdef',
          maxTimeoutSeconds: 300,
          extra: {},
        },
      ],
    }

    const mock402 = new Response(JSON.stringify(multiNetworkResponse), {
      status: 402,
      headers: { 'Content-Type': 'application/json' },
    })
    const mockPaidResponse = new Response(JSON.stringify({ ok: true }), { status: 200 })

    const createPaymentPayload = vi.fn().mockResolvedValue({ payload: { sig: '123' } })

    vi.spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(mock402)
      .mockResolvedValueOnce(mockPaidResponse)

    mockContext.signer = { createPaymentPayload }

    const { pay } = runHook()
    await pay({ url: 'https://api.example.com/paid', preferredNetwork: 'ton:mainnet' })

    expect(createPaymentPayload).toHaveBeenCalledWith(
      expect.objectContaining({ network: 'ton:mainnet' }),
    )
  })

  it('pay handles empty accepts array', async () => {
    const emptyAccepts: PaymentRequired = {
      ...mock402Response,
      accepts: [],
    }

    const mock402 = new Response(JSON.stringify(emptyAccepts), {
      status: 402,
      headers: { 'Content-Type': 'application/json' },
    })
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(mock402)

    mockContext.signer = { createPaymentPayload: vi.fn() }

    const { pay } = runHook()
    const result = await pay({ url: 'https://api.example.com/paid' })

    expect(result.success).toBe(false)
    expect(result.error?.message).toContain('No acceptable payment requirements')
  })

  it('pay sends Payment-Signature header on retry', async () => {
    const mock402 = new Response(JSON.stringify(mock402Response), {
      status: 402,
      headers: { 'Content-Type': 'application/json' },
    })
    const mockPaidResponse = new Response('ok', { status: 200 })

    const fetchSpy = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(mock402)
      .mockResolvedValueOnce(mockPaidResponse)

    mockContext.signer = {
      createPaymentPayload: vi.fn().mockResolvedValue({ payload: { sig: 'test' } }),
    }

    const { pay } = runHook()
    await pay({ url: 'https://api.example.com/paid' })

    // Second call should include Payment-Signature header
    const secondCall = fetchSpy.mock.calls[1]
    expect(secondCall).toBeDefined()
    const headers = secondCall![1]?.headers as Record<string, string>
    expect(headers['Payment-Signature']).toBeDefined()
  })
})
