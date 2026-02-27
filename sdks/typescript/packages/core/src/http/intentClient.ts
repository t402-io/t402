import { T402PaymentError } from "../errors";

const DEFAULT_FACILITATOR_URL = "https://facilitator.t402.io";

// ============================================================================
// Intent Types
// ============================================================================

export type IntentStatus =
  | "pending"
  | "routed"
  | "executing"
  | "completed"
  | "failed"
  | "cancelled"
  | "expired";

export type IntentPriority = "low" | "normal" | "high" | "urgent";

export type RouteStepType = "transfer" | "swap" | "bridge" | "approve" | "wrap" | "unwrap";

export interface RouteStep {
  order: number;
  type: RouteStepType;
  network: string;
  protocol?: string;
  fromAsset: string;
  toAsset: string;
  fromAmount: string;
  toAmount: string;
  gasEstimate?: string;
  data?: string;
}

export interface Route {
  id: string;
  sourceNetwork: string;
  targetNetwork: string;
  sourceAsset: string;
  targetAsset: string;
  inputAmount: string;
  outputAmount: string;
  estimatedGas: string;
  estimatedTime: number;
  slippage: number;
  score: number;
  steps: RouteStep[];
  requiresBridge: boolean;
  bridgeProtocol?: string;
  validUntil: string;
}

export interface Intent {
  id: string;
  payer: string;
  payee: string;
  amount: string;
  asset: string;
  sourceNetworks?: string[];
  targetNetwork?: string;
  maxSlippage: number;
  maxGasCost?: string;
  priority: IntentPriority;
  status: IntentStatus;
  selectedRoute?: Route;
  availableRoutes?: Route[];
  createdAt: string;
  expiresAt: string;
  executedAt?: string;
  txHashes?: string[];
  errorMessage?: string;
  metadata?: Record<string, string>;
}

// Request types

export interface CreateIntentRequest {
  payer: string;
  payee: string;
  amount: string;
  asset: string;
  sourceNetworks?: string[];
  targetNetwork?: string;
  maxSlippage?: number;
  maxGasCost?: string;
  priority?: IntentPriority;
  expiresIn?: number;
  metadata?: Record<string, string>;
}

export interface SelectRouteRequest {
  routeId: string;
}

export interface ExecuteIntentRequest {
  signature: string;
  routeId?: string;
}

export interface CancelIntentRequest {
  reason?: string;
}

export interface ListIntentsParams {
  payer?: string;
  payee?: string;
  status?: IntentStatus[];
  limit?: number;
  offset?: number;
}

// Response types

export interface CreateIntentResponse {
  intent: Intent;
  availableRoutes: Route[];
  recommendedRoute?: Route;
}

export interface SelectRouteResponse {
  intent: Intent;
  selectedRoute: Route;
}

export interface ExecuteIntentResponse {
  intent: Intent;
  txHashes: string[];
  status: string;
  message?: string;
}

export interface GetIntentResponse {
  intent: Intent;
}

export interface ListIntentsResponse {
  intents: Intent[];
  total: number;
  limit: number;
  offset: number;
  hasMore: boolean;
}

export interface CancelIntentResponse {
  status: string;
  message: string;
}

export interface RefreshRoutesResponse {
  intent: Intent;
  availableRoutes: Route[];
  recommendedRoute?: Route;
}

export type IntentStats = Record<string, number>;

// ============================================================================
// Intent Client Config
// ============================================================================

export interface IntentClientConfig {
  url?: string;
  apiKey?: string;
}

// ============================================================================
// Intent Client
// ============================================================================

/**
 * HTTP client for the t402 facilitator intent API.
 * Provides methods for creating and managing cross-chain payment intents.
 */
export class IntentClient {
  readonly url: string;
  private readonly apiKey?: string;

  /**
   * Create a new IntentClient instance.
   *
   * @param config - Optional client configuration for URL and API key
   */
  constructor(config?: IntentClientConfig) {
    this.url = config?.url || DEFAULT_FACILITATOR_URL;
    this.apiKey = config?.apiKey;
  }

  /**
   * Create a new payment intent and get available routes.
   *
   * @param params - The intent creation parameters
   * @returns The created intent with available and recommended routes
   */
  async createIntent(params: CreateIntentRequest): Promise<CreateIntentResponse> {
    return this.post<CreateIntentResponse>("/v1/intent", params);
  }

  /**
   * Get intent details by ID.
   *
   * @param id - The unique intent identifier
   * @returns The intent details
   */
  async getIntent(id: string): Promise<GetIntentResponse> {
    return this.get<GetIntentResponse>(`/v1/intent/${encodeURIComponent(id)}`);
  }

  /**
   * Select a route for an intent.
   *
   * @param id - The unique intent identifier
   * @param params - The route selection parameters
   * @returns The intent with the selected route
   */
  async selectRoute(id: string, params: SelectRouteRequest): Promise<SelectRouteResponse> {
    return this.post<SelectRouteResponse>(`/v1/intent/${encodeURIComponent(id)}/route`, params);
  }

  /**
   * Execute an intent with a signed authorization.
   *
   * @param id - The unique intent identifier
   * @param params - The execution parameters including signature
   * @returns The execution result with transaction hashes
   */
  async executeIntent(id: string, params: ExecuteIntentRequest): Promise<ExecuteIntentResponse> {
    return this.post<ExecuteIntentResponse>(`/v1/intent/${encodeURIComponent(id)}/execute`, params);
  }

  /**
   * Cancel a pending intent.
   *
   * @param id - The unique intent identifier
   * @param params - Optional cancellation parameters with reason
   * @returns The cancellation status and message
   */
  async cancelIntent(id: string, params?: CancelIntentRequest): Promise<CancelIntentResponse> {
    return this.post<CancelIntentResponse>(
      `/v1/intent/${encodeURIComponent(id)}/cancel`,
      params ?? {},
    );
  }

  /**
   * Refresh available routes for an intent.
   *
   * @param id - The unique intent identifier
   * @returns The intent with refreshed available and recommended routes
   */
  async refreshRoutes(id: string): Promise<RefreshRoutesResponse> {
    return this.post<RefreshRoutesResponse>(`/v1/intent/${encodeURIComponent(id)}/refresh`, {});
  }

  /**
   * List intents with optional filters.
   *
   * @param filters - Optional filter parameters for payer, payee, status, and pagination
   * @returns Paginated list of intents matching the filters
   */
  async listIntents(filters?: ListIntentsParams): Promise<ListIntentsResponse> {
    const params = new URLSearchParams();
    if (filters?.payer) params.set("payer", filters.payer);
    if (filters?.payee) params.set("payee", filters.payee);
    if (filters?.status) {
      for (const s of filters.status) params.append("status", s);
    }
    if (filters?.limit !== undefined) params.set("limit", String(filters.limit));
    if (filters?.offset !== undefined) params.set("offset", String(filters.offset));
    const query = params.toString();
    return this.get<ListIntentsResponse>(`/v1/intent${query ? `?${query}` : ""}`);
  }

  /**
   * Get intent statistics (counts by status).
   *
   * @returns A record of status names to their counts
   */
  async getIntentStats(): Promise<IntentStats> {
    return this.get<IntentStats>("/v1/intent/stats");
  }

  // ============================================================================
  // Internal HTTP helpers
  // ============================================================================

  /**
   * Build HTTP headers for API requests, including authorization if configured.
   *
   * @returns A headers record with content type and optional auth bearer token
   */
  private buildHeaders(): Record<string, string> {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };
    if (this.apiKey) {
      headers["Authorization"] = `Bearer ${this.apiKey}`;
    }
    return headers;
  }

  /**
   * Send a POST request to the facilitator API.
   *
   * @param path - The API endpoint path
   * @param body - The JSON request body
   * @returns The parsed JSON response
   */
  private async post<T>(path: string, body: unknown): Promise<T> {
    const response = await fetch(`${this.url}${path}`, {
      method: "POST",
      headers: this.buildHeaders(),
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => response.statusText);
      throw new T402PaymentError(`Intent API ${path} failed (${response.status}): ${errorText}`, {
        phase: "unknown",
        code: response.status,
        retryable: response.status >= 500 || response.status === 429,
      });
    }

    return (await response.json()) as T;
  }

  /**
   * Send a GET request to the facilitator API.
   *
   * @param path - The API endpoint path
   * @returns The parsed JSON response
   */
  private async get<T>(path: string): Promise<T> {
    const response = await fetch(`${this.url}${path}`, {
      method: "GET",
      headers: this.buildHeaders(),
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => response.statusText);
      throw new T402PaymentError(`Intent API ${path} failed (${response.status}): ${errorText}`, {
        phase: "unknown",
        code: response.status,
        retryable: response.status >= 500 || response.status === 429,
      });
    }

    return (await response.json()) as T;
  }
}
