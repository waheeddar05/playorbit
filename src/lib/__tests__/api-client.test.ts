import { describe, it, expect, vi, beforeEach } from 'vitest';
import { api, ApiError } from '../api-client';

// Mock global fetch
const mockFetch = vi.fn();
global.fetch = mockFetch;

beforeEach(() => {
  mockFetch.mockClear();
});

function jsonResponse(data: unknown, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: () => Promise.resolve(data),
  };
}

describe('api.get', () => {
  it('sends GET request and returns parsed JSON', async () => {
    mockFetch.mockResolvedValueOnce(jsonResponse({ slots: [] }));

    const result = await api.get<{ slots: unknown[] }>('/api/slots');
    expect(result).toEqual({ slots: [] });
    expect(mockFetch).toHaveBeenCalledWith('/api/slots', expect.objectContaining({ method: 'GET' }));
  });

  it('throws ApiError on non-OK response', async () => {
    mockFetch.mockResolvedValueOnce(jsonResponse({ error: 'Not Found' }, 404));

    try {
      await api.get('/api/missing');
      expect.unreachable();
    } catch (e) {
      expect(e).toBeInstanceOf(ApiError);
      expect((e as ApiError).message).toBe('Not Found');
      expect((e as ApiError).status).toBe(404);
    }
  });

  it('throws ApiError on timeout', async () => {
    mockFetch.mockImplementationOnce(() => new Promise((_, reject) => {
      const error = new DOMException('The operation was aborted', 'AbortError');
      setTimeout(() => reject(error), 10);
    }));

    await expect(api.get('/api/slow', { timeout: 5 })).rejects.toThrow('Request timed out');
  });
});

describe('api.post', () => {
  it('sends POST request with JSON body', async () => {
    mockFetch.mockResolvedValueOnce(jsonResponse({ success: true }));

    const result = await api.post('/api/book', { slotId: '123' });
    expect(result).toEqual({ success: true });

    const call = mockFetch.mock.calls[0];
    expect(call[1].method).toBe('POST');
    expect(call[1].body).toBe(JSON.stringify({ slotId: '123' }));
    expect(call[1].headers['Content-Type']).toBe('application/json');
  });

  it('parses error message from response', async () => {
    mockFetch.mockResolvedValueOnce(jsonResponse({ error: 'Slot already booked' }, 409));

    try {
      await api.post('/api/book', {});
      expect.unreachable();
    } catch (e) {
      expect(e).toBeInstanceOf(ApiError);
      expect((e as ApiError).message).toBe('Slot already booked');
      expect((e as ApiError).status).toBe(409);
    }
  });
});

describe('api.delete', () => {
  it('sends DELETE request', async () => {
    mockFetch.mockResolvedValueOnce(jsonResponse({ deleted: true }));

    const result = await api.delete('/api/bookings/123');
    expect(result).toEqual({ deleted: true });
    expect(mockFetch.mock.calls[0][1].method).toBe('DELETE');
  });
});
