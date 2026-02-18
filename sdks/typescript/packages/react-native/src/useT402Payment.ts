import { useState, useCallback } from 'react'
import type { PaymentRequired } from '@t402/core/types'
import { useT402Context } from './T402Provider.js'
import type { PaymentState, PaymentOptions, PaymentResult, UseT402PaymentReturn } from './types.js'

const INITIAL_STATE: PaymentState = { status: 'idle' }

/**
 * Hook for managing the full t402 payment flow in React Native.
 *
 * Handles fetching a protected resource, detecting 402 responses,
 * signing payments, and resubmitting with the payment header.
 *
 * @returns Payment state, pay function, and reset function.
 *
 * @example
 * ```tsx
 * import { useT402Payment } from '@t402/react-native';
 *
 * function PremiumContent() {
 *   const { state, pay, reset } = useT402Payment();
 *
 *   const handlePurchase = async () => {
 *     const result = await pay({ url: 'https://api.example.com/content/123' });
 *     if (result.success) {
 *       const data = await result.response?.json();
 *       // Display purchased content
 *     }
 *   };
 *
 *   return (
 *     <View>
 *       <Text>Status: {state.status}</Text>
 *       <TouchableOpacity onPress={handlePurchase}>
 *         <Text>Purchase</Text>
 *       </TouchableOpacity>
 *     </View>
 *   );
 * }
 * ```
 */
export function useT402Payment(): UseT402PaymentReturn {
  const ctx = useT402Context()
  const [state, setState] = useState<PaymentState>(INITIAL_STATE)

  const pay = useCallback(
    async (options: PaymentOptions): Promise<PaymentResult> => {
      const { url, method = 'GET', headers = {}, body, preferredNetwork } = options

      try {
        // Step 1: Fetch the resource
        setState({ status: 'loading' })
        const initialResponse = await fetch(url, { method, headers, body })

        // If not 402, return directly
        if (initialResponse.status !== 402) {
          if (initialResponse.ok) {
            setState({ status: 'success' })
            return { success: true, response: initialResponse }
          }
          const error = new Error(`Request failed with status ${initialResponse.status}`)
          setState({ status: 'error', error })
          return { success: false, error }
        }

        // Step 2: Parse payment requirements
        const paymentRequired = (await initialResponse.json()) as PaymentRequired
        setState({ status: 'awaiting_payment', paymentRequired })

        // Select a payment requirement (prefer the requested network if available)
        const requirement = preferredNetwork
          ? paymentRequired.accepts.find((r) => r.network === preferredNetwork) ??
            paymentRequired.accepts[0]
          : paymentRequired.accepts[0]

        if (!requirement) {
          const error = new Error('No acceptable payment requirements found')
          setState({ status: 'error', error })
          return { success: false, error }
        }

        // Step 3: Sign the payment
        setState({ status: 'signing', paymentRequired })

        if (!ctx.signer) {
          const error = new Error(
            'No signer configured. Provide a signer or wdkSeedPhrase in T402ProviderConfig.',
          )
          setState({ status: 'error', error })
          return { success: false, error }
        }

        // Construct payment payload
        const payload = {
          t402Version: paymentRequired.t402Version,
          resource: paymentRequired.resource,
          accepted: requirement,
          payload: {},
        }

        // Sign via the configured signer
        const signer = ctx.signer as {
          createPaymentPayload?: (
            req: typeof requirement,
          ) => Promise<{ payload: Record<string, unknown> }>
        }

        let signedPayload: Record<string, unknown> = {}
        if (signer.createPaymentPayload) {
          const signed = await signer.createPaymentPayload(requirement)
          signedPayload = signed.payload
        }

        const paymentSignature = JSON.stringify({
          ...payload,
          payload: signedPayload,
        })

        // Step 4: Resubmit with payment header
        setState({ status: 'verifying', paymentRequired })

        const paidResponse = await fetch(url, {
          method,
          headers: {
            ...headers,
            'Payment-Signature': paymentSignature,
          },
          body,
        })

        if (paidResponse.ok) {
          const txHash = paidResponse.headers.get('X-Payment-TxHash') ?? undefined
          setState({ status: 'success', txHash, paymentRequired })
          return { success: true, response: paidResponse, txHash }
        }

        const error = new Error(`Payment verification failed with status ${paidResponse.status}`)
        setState({ status: 'error', error, paymentRequired })
        return { success: false, error }
      } catch (err) {
        const error = err instanceof Error ? err : new Error(String(err))
        setState({ status: 'error', error })
        return { success: false, error }
      }
    },
    [ctx.signer],
  )

  const reset = useCallback(() => {
    setState(INITIAL_STATE)
  }, [])

  return { state, pay, reset }
}
