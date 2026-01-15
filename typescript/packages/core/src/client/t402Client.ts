import { t402Version } from "..";
import { SchemeNetworkClient } from "../types/mechanisms";
import { PaymentPayload, PaymentRequirements } from "../types/payments";
import { Network, PaymentRequired } from "../types";
import { findByNetworkAndScheme, findSchemesByNetwork } from "../utils";

/**
 * Client Hook Context Interfaces
 */

export interface PaymentCreationContext {
  paymentRequired: PaymentRequired;
  selectedRequirements: PaymentRequirements;
}

export interface PaymentCreatedContext extends PaymentCreationContext {
  paymentPayload: PaymentPayload;
}

export interface PaymentCreationFailureContext extends PaymentCreationContext {
  error: Error;
}

/**
 * Client Hook Type Definitions
 */

export type BeforePaymentCreationHook = (
  context: PaymentCreationContext,
) => Promise<void | { abort: true; reason: string }>;

export type AfterPaymentCreationHook = (context: PaymentCreatedContext) => Promise<void>;

export type OnPaymentCreationFailureHook = (
  context: PaymentCreationFailureContext,
) => Promise<void | { recovered: true; payload: PaymentPayload }>;

export type SelectPaymentRequirements = (t402Version: number, paymentRequirements: PaymentRequirements[]) => PaymentRequirements;

/**
 * A policy function that filters or transforms payment requirements.
 * Policies are applied in order before the selector chooses the final option.
 *
 * @param t402Version - The t402 protocol version
 * @param paymentRequirements - Array of payment requirements to filter/transform
 * @returns Filtered array of payment requirements
 */
export type PaymentPolicy = (t402Version: number, paymentRequirements: PaymentRequirements[]) => PaymentRequirements[];


/**
 * Configuration for registering a payment scheme with a specific network
 */
export interface SchemeRegistration {
  /**
   * The network identifier (e.g., 'eip155:8453', 'solana:mainnet')
   */
  network: Network;

  /**
   * The scheme client implementation for this network
   */
  client: SchemeNetworkClient;

  /**
   * The t402 protocol version to use for this scheme
   *
   * @default 2
   */
  t402Version?: number;
}

/**
 * Configuration options for the fetch wrapper
 */
export interface t402ClientConfig {
  /**
   * Array of scheme registrations defining which payment methods are supported
   */
  schemes: SchemeRegistration[];

  /**
   * Policies to apply to the client
   */
  policies?: PaymentPolicy[];

  /**
   * Custom payment requirements selector function
   * If not provided, uses the default selector (first available option)
   */
  paymentRequirementsSelector?: SelectPaymentRequirements;
}

/**
 * Core client for managing t402 payment schemes and creating payment payloads.
 *
 * Handles registration of payment schemes, policy-based filtering of payment requirements,
 * and creation of payment payloads based on server requirements.
 */
export class t402Client {
  private readonly paymentRequirementsSelector: SelectPaymentRequirements;
  private readonly registeredClientSchemes: Map<number, Map<string, Map<string, SchemeNetworkClient>>> = new Map();
  private readonly policies: PaymentPolicy[] = [];

  private beforePaymentCreationHooks: BeforePaymentCreationHook[] = [];
  private afterPaymentCreationHooks: AfterPaymentCreationHook[] = [];
  private onPaymentCreationFailureHooks: OnPaymentCreationFailureHook[] = [];

  /**
   * Creates a new t402Client instance.
   *
   * @param paymentRequirementsSelector - Function to select payment requirements from available options
   */
  constructor(paymentRequirementsSelector?: SelectPaymentRequirements) {
    this.paymentRequirementsSelector = paymentRequirementsSelector || ((_t402Version, accepts) => accepts[0]);
  }

  /**
   * Creates a new t402Client instance from a configuration object.
   *
   * @param config - The client configuration including schemes, policies, and payment requirements selector
   * @returns A configured t402Client instance
   */
  static fromConfig(config: t402ClientConfig): t402Client {
    const client = new t402Client(config.paymentRequirementsSelector);
    config.schemes.forEach(scheme => {
      if (scheme.t402Version === 1) {
        client.registerV1(scheme.network, scheme.client);
      } else {
        client.register(scheme.network, scheme.client);
      }
    });
    config.policies?.forEach(policy => {
      client.registerPolicy(policy);
    });
    return client;
  }

  /**
   * Registers a scheme client for the current t402 version.
   *
   * @param network - The network to register the client for
   * @param client - The scheme network client to register
   * @returns The t402Client instance for chaining
   */
  register(network: Network, client: SchemeNetworkClient): t402Client {
    return this._registerScheme(t402Version, network, client);
  }

  /**
   * Registers a scheme client for t402 version 1.
   *
   * @param network - The v1 network identifier (e.g., 'base-sepolia', 'solana-devnet')
   * @param client - The scheme network client to register
   * @returns The t402Client instance for chaining
   */
  registerV1(network: string, client: SchemeNetworkClient): t402Client {
    return this._registerScheme(1, network as Network, client);
  }

  /**
   * Registers a policy to filter or transform payment requirements.
   *
   * Policies are applied in order after filtering by registered schemes
   * and before the selector chooses the final payment requirement.
   *
   * @param policy - Function to filter/transform payment requirements
   * @returns The t402Client instance for chaining
   *
   * @example
   * ```typescript
   * // Prefer cheaper options
   * client.registerPolicy((version, reqs) =>
   *   reqs.filter(r => BigInt(r.value) < BigInt('1000000'))
   * );
   *
   * // Prefer specific networks
   * client.registerPolicy((version, reqs) =>
   *   reqs.filter(r => r.network.startsWith('eip155:'))
   * );
   * ```
   */
  registerPolicy(policy: PaymentPolicy): t402Client {
    this.policies.push(policy);
    return this;
  }

  /**
   * Register a hook to execute before payment payload creation.
   * Can abort creation by returning { abort: true, reason: string }
   *
   * @param hook - The hook function to register
   * @returns The t402Client instance for chaining
   */
  onBeforePaymentCreation(hook: BeforePaymentCreationHook): t402Client {
    this.beforePaymentCreationHooks.push(hook);
    return this;
  }

  /**
   * Register a hook to execute after successful payment payload creation.
   *
   * @param hook - The hook function to register
   * @returns The t402Client instance for chaining
   */
  onAfterPaymentCreation(hook: AfterPaymentCreationHook): t402Client {
    this.afterPaymentCreationHooks.push(hook);
    return this;
  }

  /**
   * Register a hook to execute when payment payload creation fails.
   * Can recover from failure by returning { recovered: true, payload: PaymentPayload }
   *
   * @param hook - The hook function to register
   * @returns The t402Client instance for chaining
   */
  onPaymentCreationFailure(hook: OnPaymentCreationFailureHook): t402Client {
    this.onPaymentCreationFailureHooks.push(hook);
    return this;
  }

  /**
   * Creates a payment payload based on a PaymentRequired response.
   *
   * Automatically extracts t402Version, resource, and extensions from the PaymentRequired
   * response and constructs a complete PaymentPayload with the accepted requirements.
   *
   * @param paymentRequired - The PaymentRequired response from the server
   * @returns Promise resolving to the complete payment payload
   */
  async createPaymentPayload(
    paymentRequired: PaymentRequired,
  ): Promise<PaymentPayload> {
    const clientSchemesByNetwork = this.registeredClientSchemes.get(paymentRequired.t402Version);
    if (!clientSchemesByNetwork) {
      throw new Error(`No client registered for t402 version: ${paymentRequired.t402Version}`);
    }

    const requirements = this.selectPaymentRequirements(paymentRequired.t402Version, paymentRequired.accepts);

    const context: PaymentCreationContext = {
      paymentRequired,
      selectedRequirements: requirements,
    };

    // Execute beforePaymentCreation hooks
    for (const hook of this.beforePaymentCreationHooks) {
      const result = await hook(context);
      if (result && "abort" in result && result.abort) {
        throw new Error(`Payment creation aborted: ${result.reason}`);
      }
    }

    try {
      const schemeNetworkClient = findByNetworkAndScheme(clientSchemesByNetwork, requirements.scheme, requirements.network);
      if (!schemeNetworkClient) {
        throw new Error(`No client registered for scheme: ${requirements.scheme} and network: ${requirements.network}`);
      }

      const partialPayload = await schemeNetworkClient.createPaymentPayload(paymentRequired.t402Version, requirements);

      let paymentPayload: PaymentPayload;
      if (partialPayload.t402Version == 1) {
        paymentPayload = partialPayload as PaymentPayload;
      } else {
        paymentPayload = {
          ...partialPayload,
          extensions: paymentRequired.extensions,
          resource: paymentRequired.resource,
          accepted: requirements,
        };
      }

      // Execute afterPaymentCreation hooks
      const createdContext: PaymentCreatedContext = {
        ...context,
        paymentPayload,
      };

      for (const hook of this.afterPaymentCreationHooks) {
        await hook(createdContext);
      }

      return paymentPayload;
    } catch (error) {
      const failureContext: PaymentCreationFailureContext = {
        ...context,
        error: error as Error,
      };

      // Execute onPaymentCreationFailure hooks
      for (const hook of this.onPaymentCreationFailureHooks) {
        const result = await hook(failureContext);
        if (result && "recovered" in result && result.recovered) {
          return result.payload;
        }
      }

      throw error;
    }
  }



  /**
   * Selects appropriate payment requirements based on registered clients and policies.
   *
   * Selection process:
   * 1. Filter by registered schemes (network + scheme support)
   * 2. Apply all registered policies in order
   * 3. Use selector to choose final requirement
   *
   * @param t402Version - The t402 protocol version
   * @param paymentRequirements - Array of available payment requirements
   * @returns The selected payment requirements
   */
  private selectPaymentRequirements(t402Version: number, paymentRequirements: PaymentRequirements[]): PaymentRequirements {
    const clientSchemesByNetwork = this.registeredClientSchemes.get(t402Version);
    if (!clientSchemesByNetwork) {
      throw new Error(`No client registered for t402 version: ${t402Version}`);
    }

    // Step 1: Filter by registered schemes
    const supportedPaymentRequirements = paymentRequirements.filter(requirement => {
      let clientSchemes = findSchemesByNetwork(clientSchemesByNetwork, requirement.network);
      if (!clientSchemes) {
        return false;
      }

      return clientSchemes.has(requirement.scheme);
    })

    if (supportedPaymentRequirements.length === 0) {
      throw new Error(`No network/scheme registered for t402 version: ${t402Version} which comply with the payment requirements. ${JSON.stringify({
        t402Version,
        paymentRequirements,
        t402Versions: Array.from(this.registeredClientSchemes.keys()),
        networks: Array.from(clientSchemesByNetwork.keys()),
        schemes: Array.from(clientSchemesByNetwork.values()).map(schemes => Array.from(schemes.keys())).flat(),
      })}`);
    }

    // Step 2: Apply all policies in order
    let filteredRequirements = supportedPaymentRequirements;
    for (const policy of this.policies) {
      filteredRequirements = policy(t402Version, filteredRequirements);

      if (filteredRequirements.length === 0) {
        throw new Error(`All payment requirements were filtered out by policies for t402 version: ${t402Version}`);
      }
    }

    // Step 3: Use selector to choose final requirement
    return this.paymentRequirementsSelector(t402Version, filteredRequirements);
  }

  /**
   * Internal method to register a scheme client.
   *
   * @param t402Version - The t402 protocol version
   * @param network - The network to register the client for
   * @param client - The scheme network client to register
   * @returns The t402Client instance for chaining
   */
  private _registerScheme(t402Version: number, network: Network, client: SchemeNetworkClient): t402Client {
    if (!this.registeredClientSchemes.has(t402Version)) {
      this.registeredClientSchemes.set(t402Version, new Map());
    }
    const clientSchemesByNetwork = this.registeredClientSchemes.get(t402Version)!;
    if (!clientSchemesByNetwork.has(network)) {
      clientSchemesByNetwork.set(network, new Map());
    }

    const clientByScheme = clientSchemesByNetwork.get(network)!;
    if (!clientByScheme.has(client.scheme)) {
      clientByScheme.set(client.scheme, client);
    }

    return this;
  }
}
