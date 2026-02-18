import React, { createContext, useContext, useMemo } from 'react'
import type { T402ProviderConfig, T402ContextValue } from './types.js'

const T402Context = createContext<T402ContextValue | null>(null)

/**
 * T402 React Native provider.
 *
 * Wraps your application to provide t402 payment context to all child
 * components. Configure with a facilitator URL and optional signer or
 * WDK seed phrase.
 *
 * @example
 * ```tsx
 * import { T402Provider } from '@t402/react-native';
 *
 * function App() {
 *   return (
 *     <T402Provider config={{
 *       facilitatorUrl: 'https://facilitator.t402.io',
 *       networks: ['eip155:42161', 'ton:mainnet'],
 *     }}>
 *       <MyApp />
 *     </T402Provider>
 *   );
 * }
 * ```
 */
export function T402Provider({
  config,
  children,
}: {
  config: T402ProviderConfig
  children: React.ReactNode
}) {
  const value = useMemo<T402ContextValue>(
    () => ({
      config,
      signer: config.signer ?? null,
      isReady: Boolean(config.facilitatorUrl),
    }),
    [config],
  )

  return <T402Context.Provider value={value}>{children}</T402Context.Provider>
}

/**
 * Access the T402 context.
 *
 * Must be used within a T402Provider. Throws if called outside the provider tree.
 *
 * @returns The T402 context value containing config, signer, and readiness state.
 */
export function useT402Context(): T402ContextValue {
  const ctx = useContext(T402Context)
  if (!ctx) {
    throw new Error('useT402Context must be used within a T402Provider')
  }
  return ctx
}

export { T402Context }
