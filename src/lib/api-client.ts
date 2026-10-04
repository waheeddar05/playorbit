/**
 * Centralized API client with consistent error handling,
 * request deduplication, and timeout support.
 */

export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
    public details?: unknown
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

interface FetchOptions extends RequestInit {
  timeout?: number;
}

const DEFAULT_TIMEOUT = 15_000; // 15 seconds

async function fetchWithTimeout(url: string, options: FetchOptions = {}): Promise<Response> {
  const { timeout = DEFAULT_TIMEOUT, ...fetchOptions } = options;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);

  try {
    const response = await fetch(url, {
      ...fetchOptions,
      signal: controller.signal,
    });
    return response;
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') {
      throw new ApiError('Request timed out', 408);
    }
    throw error;
  } finally {
    clearTimeout(timeoutId);
  }
}

async function handleResponse<T>(response: Response): Promise<T> {
  if (!response.ok) {
    let errorMessage = `Request failed with status ${response.status}`;
    try {
      const errorData = await response.json();
      errorMessage = errorData.error || errorData.message || errorMessage;
    } catch {
      // Response body wasn't JSON
    }
    throw new ApiError(errorMessage, response.status);
  }
  return response.json();
}

// ─── Public API Methods ──────────────────────────────────

/** A failure where the request may never have reached the server, or the
 *  response never made it back: our own timeout, or fetch rejecting with a
 *  network error. Mobile data drops these routinely mid-handoff. */
function isTransientFailure(error: unknown): boolean {
  if (error instanceof ApiError) return error.status === 408;
  return error instanceof TypeError;
}

const GET_RETRY_DELAY_MS = 500;

export const api = {
  /** GETs are idempotent, so a timeout or network failure is retried once
   *  before surfacing. Server responses (4xx/5xx) are never retried. */
  get: async <T>(url: string, options?: FetchOptions): Promise<T> => {
    let response: Response;
    try {
      response = await fetchWithTimeout(url, { ...options, method: 'GET' });
    } catch (error) {
      if (!isTransientFailure(error)) throw error;
      await new Promise((resolve) => setTimeout(resolve, GET_RETRY_DELAY_MS));
      response = await fetchWithTimeout(url, { ...options, method: 'GET' });
    }
    return handleResponse<T>(response);
  },

  post: async <T>(url: string, body: unknown, options?: FetchOptions): Promise<T> => {
    const response = await fetchWithTimeout(url, {
      ...options,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...options?.headers,
      },
      body: JSON.stringify(body),
    });
    return handleResponse<T>(response);
  },

  put: async <T>(url: string, body: unknown, options?: FetchOptions): Promise<T> => {
    const response = await fetchWithTimeout(url, {
      ...options,
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        ...options?.headers,
      },
      body: JSON.stringify(body),
    });
    return handleResponse<T>(response);
  },

  delete: async <T>(url: string, options?: FetchOptions): Promise<T> => {
    const response = await fetchWithTimeout(url, { ...options, method: 'DELETE' });
    return handleResponse<T>(response);
  },
};
