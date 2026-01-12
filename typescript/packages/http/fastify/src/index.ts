import {
  HTTPRequestContext,
  PaywallConfig,
  PaywallProvider,
  t402HTTPResourceServer,
  t402ResourceServer,
  RoutesConfig,
  FacilitatorClient,
} from "@t402/core/server";
import { SchemeNetworkServer, Network } from "@t402/core/types";
import type { FastifyRequest, FastifyReply, preHandlerHookHandler, onSendHookHandler } from "fastify";
import { FastifyAdapter } from "./adapter.js";

// Extend FastifyReply to include addHook which exists at runtime but not in types
interface FastifyReplyWithHooks extends FastifyReply {
  addHook(name: "onSend", hook: onSendHookHandler): void;
}

/**
 * Check if any routes in the configuration declare bazaar extensions
 *
 * @param routes - Route configuration
 * @returns True if any route has extensions.bazaar defined
 */
function checkIfBazaarNeeded(routes: RoutesConfig): boolean {
  // Handle single route config
  if ("accepts" in routes) {
    return !!(routes.extensions && "bazaar" in routes.extensions);
  }

  // Handle multiple routes
  return Object.values(routes).some(routeConfig => {
    return !!(routeConfig.extensions && "bazaar" in routeConfig.extensions);
  });
}

/**
 * Configuration for registering a payment scheme with a specific network
 */
export interface SchemeRegistration {
  /**
   * The network identifier (e.g., 'eip155:84532', 'solana:mainnet')
   */
  network: Network;

  /**
   * The scheme server implementation for this network
   */
  server: SchemeNetworkServer;
}

/**
 * Fastify payment middleware for t402 protocol (direct server instance).
 *
 * Use this when you want to pass a pre-configured t402ResourceServer instance.
 * This provides more flexibility for testing, custom configuration, and reusing
 * server instances across multiple middlewares.
 *
 * @param routes - Route configurations for protected endpoints
 * @param server - Pre-configured t402ResourceServer instance
 * @param paywallConfig - Optional configuration for the built-in paywall UI
 * @param paywall - Optional custom paywall provider (overrides default)
 * @param syncFacilitatorOnStart - Whether to sync with the facilitator on startup (defaults to true)
 * @returns Fastify preHandler hook
 *
 * @example
 * ```typescript
 * import { paymentMiddleware } from "@t402/fastify";
 * import { t402ResourceServer } from "@t402/core/server";
 * import { registerExactEvmScheme } from "@t402/evm/exact/server";
 *
 * const server = new t402ResourceServer(myFacilitatorClient);
 * registerExactEvmScheme(server, {});
 *
 * app.addHook('preHandler', paymentMiddleware(routes, server, paywallConfig));
 * ```
 */
export function paymentMiddleware(
  routes: RoutesConfig,
  server: t402ResourceServer,
  paywallConfig?: PaywallConfig,
  paywall?: PaywallProvider,
  syncFacilitatorOnStart: boolean = true,
): preHandlerHookHandler {
  // Create the t402 HTTP server instance with the resource server
  const httpServer = new t402HTTPResourceServer(server, routes);

  // Register custom paywall provider if provided
  if (paywall) {
    httpServer.registerPaywallProvider(paywall);
  }

  // Store initialization promise (not the result)
  // httpServer.initialize() fetches facilitator support and validates routes
  let initPromise: Promise<void> | null = syncFacilitatorOnStart ? httpServer.initialize() : null;

  // Dynamically register bazaar extension if routes declare it
  let bazaarPromise: Promise<void> | null = null;
  if (checkIfBazaarNeeded(routes)) {
    bazaarPromise = import("@t402/extensions/bazaar")
      .then(({ bazaarResourceServerExtension }) => {
        server.registerExtension(bazaarResourceServerExtension);
      })
      .catch(err => {
        console.error("Failed to load bazaar extension:", err);
      });
  }

  return async (request: FastifyRequest, reply: FastifyReply) => {
    // Create adapter and context
    const adapter = new FastifyAdapter(request);
    const path = adapter.getPath();

    const context: HTTPRequestContext = {
      adapter,
      path,
      method: request.method,
      paymentHeader: adapter.getHeader("payment-signature") || adapter.getHeader("x-payment"),
    };

    // Check if route requires payment before initializing facilitator
    if (!httpServer.requiresPayment(context)) {
      return; // Continue to route handler
    }

    // Only initialize when processing a protected route
    if (initPromise) {
      await initPromise;
      initPromise = null; // Clear after first await
    }

    // Await bazaar extension loading if needed
    if (bazaarPromise) {
      await bazaarPromise;
      bazaarPromise = null;
    }

    // Process payment requirement check
    const result = await httpServer.processHTTPRequest(context, paywallConfig);

    // Handle the different result types
    switch (result.type) {
      case "no-payment-required":
        // No payment needed, proceed directly to the route handler
        return;

      case "payment-error": {
        // Payment required but not provided or invalid
        const { response } = result;
        Object.entries(response.headers).forEach(([key, value]) => {
          reply.header(key, value);
        });
        if (response.isHtml) {
          return reply.code(response.status).type("text/html").send(response.body);
        } else {
          return reply.code(response.status).send(response.body || {});
        }
      }

      case "payment-verified": {
        // Payment is valid, need to handle settlement after route handler
        const { paymentPayload, paymentRequirements } = result;

        // Use onSend hook to handle settlement after route handler completes
        // Cast to extended interface since addHook exists at runtime
        const replyWithHooks = reply as unknown as FastifyReplyWithHooks;
        replyWithHooks.addHook("onSend", async (_request: FastifyRequest, reply: FastifyReply, payload: unknown) => {
          // If the response from the protected route is >= 400, do not settle payment
          if (reply.statusCode >= 400) {
            return payload;
          }

          try {
            const settleResult = await httpServer.processSettlement(
              paymentPayload,
              paymentRequirements,
            );

            if (!settleResult.success) {
              // Settlement failed - return error response
              reply.code(402);
              return JSON.stringify({
                error: "Settlement failed",
                details: settleResult.errorReason,
              });
            }

            // Settlement succeeded - add headers to response
            Object.entries(settleResult.headers).forEach(([key, value]) => {
              reply.header(key, value);
            });

            return payload;
          } catch (error) {
            console.error(error);
            // If settlement fails, return an error response
            reply.code(402);
            return JSON.stringify({
              error: "Settlement failed",
              details: error instanceof Error ? error.message : "Unknown error",
            });
          }
        });

        // Continue to route handler
        return;
      }
    }
  };
}

/**
 * Fastify payment middleware for t402 protocol (configuration-based).
 *
 * Use this when you want to quickly set up middleware with simple configuration.
 * This function creates and configures the t402ResourceServer internally.
 *
 * @param routes - Route configurations for protected endpoints
 * @param facilitatorClients - Optional facilitator client(s) for payment processing
 * @param schemes - Optional array of scheme registrations for server-side payment processing
 * @param paywallConfig - Optional configuration for the built-in paywall UI
 * @param paywall - Optional custom paywall provider (overrides default)
 * @param syncFacilitatorOnStart - Whether to sync with the facilitator on startup (defaults to true)
 * @returns Fastify preHandler hook
 *
 * @example
 * ```typescript
 * import { paymentMiddlewareFromConfig } from "@t402/fastify";
 *
 * app.addHook('preHandler', paymentMiddlewareFromConfig(
 *   routes,
 *   myFacilitatorClient,
 *   [{ network: "eip155:8453", server: evmSchemeServer }],
 *   paywallConfig
 * ));
 * ```
 */
export function paymentMiddlewareFromConfig(
  routes: RoutesConfig,
  facilitatorClients?: FacilitatorClient | FacilitatorClient[],
  schemes?: SchemeRegistration[],
  paywallConfig?: PaywallConfig,
  paywall?: PaywallProvider,
  syncFacilitatorOnStart: boolean = true,
): preHandlerHookHandler {
  const ResourceServer = new t402ResourceServer(facilitatorClients);

  if (schemes) {
    schemes.forEach(({ network, server: schemeServer }) => {
      ResourceServer.register(network, schemeServer);
    });
  }

  // Use the direct paymentMiddleware with the configured server
  // Note: paymentMiddleware handles dynamic bazaar registration
  return paymentMiddleware(routes, ResourceServer, paywallConfig, paywall, syncFacilitatorOnStart);
}

export { t402ResourceServer, t402HTTPResourceServer } from "@t402/core/server";

export type {
  PaymentRequired,
  PaymentRequirements,
  PaymentPayload,
  Network,
  SchemeNetworkServer,
} from "@t402/core/types";

export type { PaywallProvider, PaywallConfig } from "@t402/core/server";

export { RouteConfigurationError } from "@t402/core/server";

export type { RouteValidationError } from "@t402/core/server";

export { FastifyAdapter } from "./adapter.js";
