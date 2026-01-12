import { HTTPAdapter } from "@t402/core/server";
import type { FastifyRequest } from "fastify";

/**
 * Fastify adapter implementation
 */
export class FastifyAdapter implements HTTPAdapter {
  /**
   * Creates a new FastifyAdapter instance.
   *
   * @param request - The Fastify request object
   */
  constructor(private request: FastifyRequest) {}

  /**
   * Gets a header value from the request.
   *
   * @param name - The header name
   * @returns The header value or undefined
   */
  getHeader(name: string): string | undefined {
    const value = this.request.headers[name.toLowerCase()];
    return Array.isArray(value) ? value[0] : value;
  }

  /**
   * Gets the HTTP method of the request.
   *
   * @returns The HTTP method
   */
  getMethod(): string {
    return this.request.method;
  }

  /**
   * Gets the path of the request (without query string).
   *
   * @returns The request path
   */
  getPath(): string {
    // Split URL to remove query string
    const url = this.request.url;
    const queryIndex = url.indexOf("?");
    return queryIndex === -1 ? url : url.substring(0, queryIndex);
  }

  /**
   * Gets the full URL of the request.
   *
   * @returns The full request URL
   */
  getUrl(): string {
    return `${this.request.protocol}://${this.request.hostname}${this.request.url}`;
  }

  /**
   * Gets the Accept header from the request.
   *
   * @returns The Accept header value or empty string
   */
  getAcceptHeader(): string {
    return this.getHeader("accept") || "";
  }

  /**
   * Gets the User-Agent header from the request.
   *
   * @returns The User-Agent header value or empty string
   */
  getUserAgent(): string {
    return this.getHeader("user-agent") || "";
  }

  /**
   * Gets all query parameters from the request URL.
   *
   * @returns Record of query parameter key-value pairs
   */
  getQueryParams(): Record<string, string | string[]> {
    const query = this.request.query as Record<string, string | string[]> | undefined;
    if (!query) return {};

    const result: Record<string, string | string[]> = {};
    for (const [key, value] of Object.entries(query)) {
      result[key] = value;
    }
    return result;
  }

  /**
   * Gets a specific query parameter by name.
   *
   * @param name - The query parameter name
   * @returns The query parameter value(s) or undefined
   */
  getQueryParam(name: string): string | string[] | undefined {
    const query = this.request.query as Record<string, string | string[]> | undefined;
    if (!query) return undefined;
    return query[name];
  }

  /**
   * Gets the parsed request body.
   * Fastify parses the body automatically.
   *
   * @returns The parsed request body
   */
  async getBody(): Promise<unknown> {
    try {
      return this.request.body;
    } catch {
      return undefined;
    }
  }
}
