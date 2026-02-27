import { T402PaymentError } from "../errors";

const DEFAULT_FACILITATOR_URL = "https://facilitator.t402.io";

// ============================================================================
// Streaming Types
// ============================================================================

export type StreamStatus =
  | "pending"
  | "active"
  | "paused"
  | "closing"
  | "closed"
  | "cancelled"
  | "expired";

export interface StreamMetadata {
  resourceId?: string;
  description?: string;
  tags?: string[];
  extra?: Record<string, string>;
}

export interface Stream {
  id: string;
  network: string;
  scheme: string;
  payer: string;
  payee: string;
  asset: string;
  maxAmount: string;
  currentAmount: string;
  settledAmount: string;
  ratePerSecond: string;
  status: StreamStatus;
  createdAt: string;
  activatedAt?: string;
  lastUpdatedAt: string;
  expiresAt?: string;
  closedAt?: string;
  depositTxHash: string;
  settlementTxHash: string;
  metadata: StreamMetadata;
}

export interface StreamUpdate {
  id: string;
  streamId: string;
  amount: string;
  signature: string;
  timestamp: string;
  sequenceNum: number;
  resourceUnits: number;
}

export interface StreamStats {
  totalUpdates: number;
  averageRate: string;
  duration: number;
  resourcesUsed: number;
  efficiencyScore: number;
}

// Request types

export interface OpenStreamRequest {
  network: string;
  scheme: string;
  payer: string;
  payee: string;
  asset: string;
  maxAmount: string;
  ratePerSecond?: string;
  expiresAt?: string;
  signature: string;
  metadata?: StreamMetadata;
}

export interface UpdateStreamRequest {
  streamId: string;
  amount: string;
  signature: string;
  resourceUnits?: number;
}

export interface CloseStreamRequest {
  streamId: string;
  finalAmount: string;
  payerSignature: string;
  payeeSignature?: string;
  reason?: string;
}

export interface ListStreamsParams {
  network?: string;
  payer?: string;
  payee?: string;
  status?: StreamStatus[];
  limit?: number;
  offset?: number;
  orderBy?: string;
  orderDesc?: boolean;
}

// Response types

export interface OpenStreamResponse {
  stream: Stream;
  depositAmount?: string;
  depositTo?: string;
}

export interface UpdateStreamResponse {
  stream: Stream;
  update: StreamUpdate;
  remaining: string;
  canContinue: boolean;
}

export interface CloseStreamResponse {
  stream: Stream;
  settledAmount: string;
  txHash: string;
  refundAmount: string;
}

export interface GetStreamResponse {
  stream: Stream;
  updates?: StreamUpdate[];
  stats?: StreamStats;
}

export interface ListStreamsResponse {
  streams: Stream[];
  total: number;
  limit: number;
  offset: number;
  hasMore: boolean;
}

export interface PauseResumeResponse {
  status: string;
  message: string;
}

// ============================================================================
// Streaming Client Config
// ============================================================================

export interface StreamingClientConfig {
  url?: string;
  apiKey?: string;
  requesterAddress?: string;
}

// ============================================================================
// Streaming Client
// ============================================================================

/**
 * HTTP client for the t402 facilitator streaming API.
 * Provides methods for managing payment streams.
 */
export class StreamingClient {
  readonly url: string;
  private readonly apiKey?: string;
  private readonly requesterAddress?: string;

  /**
   * Create a new StreamingClient instance.
   *
   * @param config - Client configuration options
   */
  constructor(config?: StreamingClientConfig) {
    this.url = config?.url || DEFAULT_FACILITATOR_URL;
    this.apiKey = config?.apiKey;
    this.requesterAddress = config?.requesterAddress;
  }

  /**
   * Open a new payment stream.
   *
   * @param params - Stream opening parameters
   * @returns The opened stream and deposit details
   */
  async openStream(params: OpenStreamRequest): Promise<OpenStreamResponse> {
    return this.post<OpenStreamResponse>("/v1/stream/open", params);
  }

  /**
   * Update a stream with a new cumulative amount.
   *
   * @param params - Stream update parameters
   * @returns The updated stream state and remaining balance
   */
  async updateStream(params: UpdateStreamRequest): Promise<UpdateStreamResponse> {
    return this.post<UpdateStreamResponse>("/v1/stream/update", params);
  }

  /**
   * Close a stream and settle the final amount.
   *
   * @param params - Stream closing parameters
   * @returns The closed stream with settlement details
   */
  async closeStream(params: CloseStreamRequest): Promise<CloseStreamResponse> {
    return this.post<CloseStreamResponse>("/v1/stream/close", params);
  }

  /**
   * Get stream details by ID.
   *
   * @param id - The stream identifier
   * @param options - Optional query parameters
   * @param options.includeUpdates - Whether to include stream updates
   * @param options.includeStats - Whether to include stream statistics
   * @returns The stream details with optional updates and stats
   */
  async getStream(
    id: string,
    options?: { includeUpdates?: boolean; includeStats?: boolean },
  ): Promise<GetStreamResponse> {
    const params = new URLSearchParams();
    if (options?.includeUpdates) params.set("include_updates", "true");
    if (options?.includeStats) params.set("include_stats", "true");
    const query = params.toString();
    const path = `/v1/stream/${encodeURIComponent(id)}${query ? `?${query}` : ""}`;
    return this.get<GetStreamResponse>(path);
  }

  /**
   * Pause an active stream.
   *
   * @param id - The stream identifier
   * @returns The pause status and message
   */
  async pauseStream(id: string): Promise<PauseResumeResponse> {
    return this.post<PauseResumeResponse>(`/v1/stream/${encodeURIComponent(id)}/pause`, {});
  }

  /**
   * Resume a paused stream.
   *
   * @param id - The stream identifier
   * @returns The resume status and message
   */
  async resumeStream(id: string): Promise<PauseResumeResponse> {
    return this.post<PauseResumeResponse>(`/v1/stream/${encodeURIComponent(id)}/resume`, {});
  }

  /**
   * List streams with optional filters.
   *
   * @param filters - Optional filtering and pagination parameters
   * @returns A paginated list of streams
   */
  async listStreams(filters?: ListStreamsParams): Promise<ListStreamsResponse> {
    const params = new URLSearchParams();
    if (filters?.network) params.set("network", filters.network);
    if (filters?.payer) params.set("payer", filters.payer);
    if (filters?.payee) params.set("payee", filters.payee);
    if (filters?.status) {
      for (const s of filters.status) params.append("status", s);
    }
    if (filters?.limit !== undefined) params.set("limit", String(filters.limit));
    if (filters?.offset !== undefined) params.set("offset", String(filters.offset));
    if (filters?.orderBy) params.set("orderBy", filters.orderBy);
    if (filters?.orderDesc) params.set("orderDesc", "true");
    const query = params.toString();
    return this.get<ListStreamsResponse>(`/v1/stream${query ? `?${query}` : ""}`);
  }

  // ============================================================================
  // Internal HTTP helpers
  // ============================================================================

  /**
   * Build HTTP headers for API requests.
   *
   * @returns A headers object with auth and content-type
   */
  private buildHeaders(): Record<string, string> {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };
    if (this.apiKey) {
      headers["Authorization"] = `Bearer ${this.apiKey}`;
    }
    if (this.requesterAddress) {
      headers["X-Requester-Address"] = this.requesterAddress;
    }
    return headers;
  }

  /**
   * Send a POST request to the streaming API.
   *
   * @param path - The API endpoint path
   * @param body - The request body to send as JSON
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
      throw new T402PaymentError(
        `Streaming API ${path} failed (${response.status}): ${errorText}`,
        {
          phase: "unknown",
          code: response.status,
          retryable: response.status >= 500 || response.status === 429,
        },
      );
    }

    return (await response.json()) as T;
  }

  /**
   * Send a GET request to the streaming API.
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
      throw new T402PaymentError(
        `Streaming API ${path} failed (${response.status}): ${errorText}`,
        {
          phase: "unknown",
          code: response.status,
          retryable: response.status >= 500 || response.status === 429,
        },
      );
    }

    return (await response.json()) as T;
  }
}
