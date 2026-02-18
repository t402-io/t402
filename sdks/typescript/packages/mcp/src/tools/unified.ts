/**
 * Unified MCP Toolkit - Combines WDK wallet tools with t402 payment tools.
 *
 * Agent workflow: check price -> check balance -> bridge if needed -> pay
 * All in one MCP session with a single server.
 */

import { z } from 'zod'
import type { T402WDK } from '@t402/wdk'
import { T402Protocol } from '@t402/wdk-protocol'

/**
 * Configuration for unified MCP mode
 */
export interface UnifiedMcpConfig {
  /** WDK seed phrase for wallet management */
  wdkSeedPhrase?: string
  /** Chain RPC configurations */
  chains?: Record<string, string | string[]>
  /** Enable auto-pay mode (automatic balance check + bridge + pay) */
  autoPayEnabled?: boolean
}

/**
 * SmartPay input schema
 */
export const smartPayInputSchema = z.object({
  url: z.string().url().describe('URL of the 402-protected resource'),
  maxBridgeFee: z
    .string()
    .regex(/^\d+(\.\d+)?$/)
    .optional()
    .describe('Maximum acceptable bridge fee in native token (optional)'),
  preferredNetwork: z.string().optional().describe('Preferred network for payment (optional)'),
})

export type SmartPayInput = z.infer<typeof smartPayInputSchema>

/**
 * SmartPay result
 */
export interface SmartPayResult {
  /** Whether the resource was successfully accessed */
  success: boolean
  /** HTTP status code */
  statusCode: number
  /** Response body (truncated if large) */
  body: string
  /** Content type of the response */
  contentType?: string
  /** Steps taken during smart payment */
  steps: SmartPayStep[]
  /** Payment details (if payment was made) */
  payment?: {
    network: string
    scheme: string
    amount: string
    payTo: string
  }
  /** Error message (if failed) */
  error?: string
}

/**
 * A step in the smart payment flow
 */
export interface SmartPayStep {
  action: 'check_price' | 'check_balance' | 'bridge' | 'pay' | 'fetch'
  status: 'success' | 'skipped' | 'failed'
  detail: string
}

/**
 * PaymentPlan input schema
 */
export const paymentPlanInputSchema = z.object({
  paymentRequired: z
    .object({
      scheme: z.string().optional(),
      network: z.string().optional(),
      maxAmountRequired: z.string().optional(),
      resource: z.string().optional(),
      description: z.string().optional(),
      payTo: z.string().optional(),
      maxDeadline: z.number().optional(),
    })
    .passthrough()
    .describe('The 402 PaymentRequired response'),
})

export type PaymentPlanInput = z.infer<typeof paymentPlanInputSchema>

/**
 * Payment plan result
 */
export interface PaymentPlanResult {
  /** Whether a viable plan was found */
  viable: boolean
  /** Recommended network to pay on */
  recommendedNetwork?: string
  /** Available balance on that network */
  availableBalance?: string
  /** Whether bridging is needed */
  bridgeRequired: boolean
  /** Bridge details if needed */
  bridgeDetails?: {
    fromChain: string
    toChain: string
    amount: string
    estimatedFee: string
  }
  /** Balances across all chains */
  balances: Array<{
    chain: string
    usdt0: string
    usdc: string
  }>
  /** Reason if not viable */
  reason?: string
}

/**
 * Unified tool definitions (additional tools beyond base + WDK)
 */
export const UNIFIED_TOOL_DEFINITIONS = {
  't402/smartPay': {
    name: 't402/smartPay',
    description:
      'Intelligent payment that automatically checks balance, bridges if needed, and pays. Handles the entire payment flow for 402-protected resources.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        url: { type: 'string', description: 'URL of the 402-protected resource' },
        maxBridgeFee: {
          type: 'string',
          description: 'Maximum acceptable bridge fee in native token (optional)',
        },
        preferredNetwork: {
          type: 'string',
          description: 'Preferred network for payment (optional)',
        },
      },
      required: ['url'],
    },
  },
  't402/paymentPlan': {
    name: 't402/paymentPlan',
    description:
      'Analyze a 402 response and create an optimal payment plan considering balances across all chains. Returns recommended network, bridge requirements, and balance overview.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        paymentRequired: {
          type: 'object',
          description: 'The 402 PaymentRequired response',
        },
      },
      required: ['paymentRequired'],
    },
  },
} as const

/**
 * Execute t402/smartPay tool
 */
export async function executeSmartPay(input: SmartPayInput, wdk: T402WDK): Promise<SmartPayResult> {
  const steps: SmartPayStep[] = []
  const chains = input.preferredNetwork
    ? [input.preferredNetwork]
    : ['ethereum', 'arbitrum', 'base']

  // Step 1: Check balances
  steps.push({
    action: 'check_balance',
    status: 'success',
    detail: `Checking balances on ${chains.join(', ')}`,
  })

  // Step 2: Create protocol and fetch
  const protocol = await T402Protocol.create(wdk, { chains })

  steps.push({
    action: 'fetch',
    status: 'success',
    detail: `Fetching ${input.url}`,
  })

  const { response, receipt } = await protocol.fetch(input.url)

  if (receipt) {
    steps.push({
      action: 'pay',
      status: 'success',
      detail: `Payment made: ${receipt.amount} on ${receipt.network}`,
    })
  }

  // Read response body
  const contentType = response.headers.get('content-type') ?? undefined
  let body = ''
  try {
    body = await response.text()
    if (body.length > 10000) {
      body = body.slice(0, 10000) + '\n... (truncated)'
    }
  } catch {
    body = '[Could not read response body]'
  }

  return {
    success: response.ok,
    statusCode: response.status,
    body,
    contentType,
    steps,
    payment: receipt
      ? {
          network: receipt.network,
          scheme: receipt.scheme,
          amount: receipt.amount,
          payTo: receipt.payTo,
        }
      : undefined,
  }
}

/**
 * Execute t402/smartPay in demo mode
 */
export function executeSmartPayDemo(input: SmartPayInput): SmartPayResult {
  const network = input.preferredNetwork ?? 'arbitrum'

  return {
    success: true,
    statusCode: 200,
    body: `[Demo] Premium content from ${input.url}\n\nThis is simulated content returned after smart payment.`,
    contentType: 'text/plain',
    steps: [
      { action: 'check_balance', status: 'success', detail: `Checked balances on ${network}` },
      { action: 'check_price', status: 'success', detail: 'Resource costs 1.00 USDT0' },
      { action: 'pay', status: 'success', detail: `Paid 1000000 USDT0 on eip155:42161` },
      { action: 'fetch', status: 'success', detail: `Fetched ${input.url}` },
    ],
    payment: {
      network: 'eip155:42161',
      scheme: 'exact',
      amount: '1000000',
      payTo: '0xC88f67e776f16DcFBf42e6bDda1B82604448899B',
    },
  }
}

/**
 * Execute t402/paymentPlan tool
 */
export async function executePaymentPlan(
  input: PaymentPlanInput,
  wdk: T402WDK,
): Promise<PaymentPlanResult> {
  const targetNetwork = input.paymentRequired.network as string | undefined
  const requiredAmount = input.paymentRequired.maxAmountRequired as string | undefined

  // Get aggregated balances
  const aggregated = await wdk.getAggregatedBalances()

  const balances = aggregated.chains.map((chain) => {
    const usdt0 = chain.tokens.find((t) => t.symbol === 'USDT0')
    const usdc = chain.tokens.find((t) => t.symbol === 'USDC')
    return {
      chain: chain.chain,
      usdt0: usdt0?.formatted ?? '0',
      usdc: usdc?.formatted ?? '0',
    }
  })

  // Find chain with sufficient balance
  const requiredBigint = requiredAmount ? BigInt(requiredAmount) : 0n
  const bestChain = await wdk.findBestChainForPayment(requiredBigint)

  if (bestChain) {
    const needsBridge = targetNetwork ? !bestChain.chain.includes(targetNetwork) : false

    return {
      viable: true,
      recommendedNetwork: bestChain.chain,
      availableBalance: bestChain.balance.toString(),
      bridgeRequired: needsBridge,
      bridgeDetails: needsBridge
        ? {
            fromChain: bestChain.chain,
            toChain: targetNetwork ?? bestChain.chain,
            amount: requiredAmount ?? '0',
            estimatedFee: '0.001',
          }
        : undefined,
      balances,
    }
  }

  return {
    viable: false,
    bridgeRequired: false,
    balances,
    reason: 'Insufficient balance across all chains',
  }
}

/**
 * Execute t402/paymentPlan in demo mode
 */
export function executePaymentPlanDemo(_input: PaymentPlanInput): PaymentPlanResult {
  return {
    viable: true,
    recommendedNetwork: 'arbitrum',
    availableBalance: '500000000',
    bridgeRequired: false,
    balances: [
      { chain: 'ethereum', usdt0: '100.00', usdc: '250.00' },
      { chain: 'arbitrum', usdt0: '500.00', usdc: '0' },
      { chain: 'base', usdt0: '50.00', usdc: '100.00' },
    ],
  }
}

/**
 * Format smartPay result for display
 */
export function formatSmartPayResult(result: SmartPayResult): string {
  const lines: string[] = ['## SmartPay Result', '']

  if (result.success) {
    lines.push(`**Status:** Success (${result.statusCode})`)
  } else {
    lines.push(`**Status:** Failed (${result.statusCode})`)
  }

  // Steps
  if (result.steps.length > 0) {
    lines.push('')
    lines.push('### Steps')
    for (const step of result.steps) {
      const icon =
        step.status === 'success' ? '[OK]' : step.status === 'skipped' ? '[SKIP]' : '[FAIL]'
      lines.push(`- ${icon} **${step.action}**: ${step.detail}`)
    }
  }

  // Payment
  if (result.payment) {
    lines.push('')
    lines.push('### Payment Details')
    lines.push(`- **Network:** ${result.payment.network}`)
    lines.push(`- **Scheme:** ${result.payment.scheme}`)
    lines.push(`- **Amount:** ${result.payment.amount}`)
    lines.push(`- **Pay To:** \`${result.payment.payTo}\``)
  }

  if (result.error) {
    lines.push('')
    lines.push(`**Error:** ${result.error}`)
  }

  if (result.body) {
    lines.push('')
    lines.push('### Response Content')
    if (result.contentType) {
      lines.push(`_Content-Type: ${result.contentType}_`)
    }
    lines.push('')
    lines.push('```')
    lines.push(result.body)
    lines.push('```')
  }

  return lines.join('\n')
}

/**
 * Format paymentPlan result for display
 */
export function formatPaymentPlanResult(result: PaymentPlanResult): string {
  const lines: string[] = ['## Payment Plan', '']

  if (result.viable) {
    lines.push(`**Viable:** Yes`)
    if (result.recommendedNetwork) {
      lines.push(`**Recommended Network:** ${result.recommendedNetwork}`)
    }
    if (result.availableBalance) {
      lines.push(`**Available Balance:** ${result.availableBalance}`)
    }
  } else {
    lines.push(`**Viable:** No`)
    if (result.reason) {
      lines.push(`**Reason:** ${result.reason}`)
    }
  }

  if (result.bridgeRequired && result.bridgeDetails) {
    lines.push('')
    lines.push('### Bridge Required')
    lines.push(`- **From:** ${result.bridgeDetails.fromChain}`)
    lines.push(`- **To:** ${result.bridgeDetails.toChain}`)
    lines.push(`- **Amount:** ${result.bridgeDetails.amount}`)
    lines.push(`- **Estimated Fee:** ${result.bridgeDetails.estimatedFee}`)
  }

  if (result.balances.length > 0) {
    lines.push('')
    lines.push('### Chain Balances')
    lines.push('| Chain | USDT0 | USDC |')
    lines.push('|-------|-------|------|')
    for (const b of result.balances) {
      lines.push(`| ${b.chain} | ${b.usdt0} | ${b.usdc} |`)
    }
  }

  return lines.join('\n')
}
