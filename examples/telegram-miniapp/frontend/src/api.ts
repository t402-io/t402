const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:4021'

/**
 * Fetch a resource from the backend. Returns the response directly
 * so the caller can inspect the status (including 402).
 */
export async function fetchResource(
  path: string,
  headers?: Record<string, string>,
): Promise<Response> {
  return fetch(`${API_URL}${path}`, {
    headers: {
      'Content-Type': 'application/json',
      ...headers,
    },
  })
}

/**
 * Fetch a protected resource with a payment signature header.
 */
export async function fetchWithPayment(
  path: string,
  paymentSignature: string,
): Promise<Response> {
  return fetch(`${API_URL}${path}`, {
    headers: {
      'Content-Type': 'application/json',
      'Payment-Signature': paymentSignature,
    },
  })
}
