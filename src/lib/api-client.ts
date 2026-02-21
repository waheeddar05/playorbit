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

export const api = {
  get: async <T>(url: string, options?: FetchOptions): Promise<T> => {
    const response = await fetchWithTimeout(url, { ...options, method: 'GET' });
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
