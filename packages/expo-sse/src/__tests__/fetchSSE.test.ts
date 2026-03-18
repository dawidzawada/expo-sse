import { fetch as expoFetch } from 'expo/fetch';
import { SSEHttpError } from '../errors';
import { fetchSSE } from '../fetchSSE';
import { parseSSEStream } from '../parseSSEStream';
import type { SSEMessage } from '../types';
import { mockResponse, msg, pendingFetch } from './helpers';

jest.mock('../parseSSEStream');

const TEST_URL = 'http://test';
const mockFetch = expoFetch as jest.MockedFunction<typeof expoFetch>;
const mockParseSSEStream = parseSSEStream as jest.MockedFunction<
  typeof parseSSEStream
>;

function setupStream(events: SSEMessage[], options?: { retry?: number }) {
  mockParseSSEStream.mockImplementationOnce(async (_stream, opts) => {
    for (const event of events) {
      opts.onMessage(event);
    }
    if (options?.retry !== undefined) {
      opts.onRetry?.(options.retry);
    }
  });
}

beforeEach(() => {
  jest.useFakeTimers();
  jest.spyOn(Math, 'random').mockReturnValue(0);
  mockFetch.mockReset();
  mockParseSSEStream.mockReset();
});

afterEach(() => {
  jest.restoreAllMocks();
  jest.useRealTimers();
});

describe('fetchSSE', () => {
  it('resolves when signal is aborted', async () => {
    const controller = new AbortController();
    setupStream([msg('hello')]);
    mockFetch.mockResolvedValueOnce(mockResponse());
    mockFetch.mockImplementation(pendingFetch);

    const promise = fetchSSE(TEST_URL, {
      signal: controller.signal,
      onMessage: () => {},
    });

    await jest.advanceTimersByTimeAsync(0);
    controller.abort();
    await jest.advanceTimersByTimeAsync(0);

    await expect(promise).resolves.toBeUndefined();
  });

  it('calls onOpen with response', async () => {
    const controller = new AbortController();
    const onOpen = jest.fn();
    const response = mockResponse();
    setupStream([msg('x')]);
    mockFetch.mockResolvedValueOnce(response);
    mockFetch.mockImplementation(pendingFetch);

    const promise = fetchSSE(TEST_URL, {
      signal: controller.signal,
      onOpen,
      onMessage: () => {},
    });

    await jest.advanceTimersByTimeAsync(0);
    controller.abort();
    await jest.advanceTimersByTimeAsync(0);

    await promise;
    expect(onOpen).toHaveBeenCalledWith(response);
  });

  it('calls onMessage for each event', async () => {
    const controller = new AbortController();
    const onMessage = jest.fn();
    setupStream([msg('a'), msg('b')]);
    mockFetch.mockResolvedValueOnce(mockResponse());
    mockFetch.mockImplementation(pendingFetch);

    const promise = fetchSSE(TEST_URL, {
      signal: controller.signal,
      onMessage,
    });

    await jest.advanceTimersByTimeAsync(0);
    controller.abort();
    await jest.advanceTimersByTimeAsync(0);

    await promise;
    expect(onMessage).toHaveBeenCalledTimes(2);
    expect(onMessage).toHaveBeenCalledWith(
      expect.objectContaining({ data: 'a' })
    );
    expect(onMessage).toHaveBeenCalledWith(
      expect.objectContaining({ data: 'b' })
    );
  });

  it('calls onClose when server closes stream', async () => {
    const controller = new AbortController();
    const onClose = jest.fn();
    setupStream([msg('x')]);
    mockFetch.mockResolvedValueOnce(mockResponse());
    mockFetch.mockImplementation(pendingFetch);

    const promise = fetchSSE(TEST_URL, {
      signal: controller.signal,
      onMessage: () => {},
      onClose,
    });

    await jest.advanceTimersByTimeAsync(0);
    controller.abort();
    await jest.advanceTimersByTimeAsync(0);

    await promise;
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('rejects with SSEHttpError on non-2xx response', async () => {
    const response = mockResponse(500);
    mockFetch.mockResolvedValueOnce(response);

    const error = await fetchSSE(TEST_URL, {
      onMessage: () => {},
      onError: (e) => {
        throw e;
      },
    }).catch((e: unknown) => e);

    expect(error).toBeInstanceOf(SSEHttpError);
    const httpError = error as SSEHttpError;
    expect(httpError.status).toBe(500);
    expect(httpError.response).toBe(response);
  });

  it('reconnects with default backoff when onError returns undefined', async () => {
    const controller = new AbortController();
    mockFetch.mockResolvedValueOnce(mockResponse(500));
    setupStream([msg('ok')]);
    mockFetch.mockResolvedValueOnce(mockResponse());
    mockFetch.mockImplementation(pendingFetch);

    const promise = fetchSSE(TEST_URL, {
      signal: controller.signal,
      onMessage: () => {},
      onError: () => {},
    });

    await jest.advanceTimersByTimeAsync(0);
    expect(mockFetch).toHaveBeenCalledTimes(1);

    await jest.advanceTimersByTimeAsync(3000);
    expect(mockFetch).toHaveBeenCalledTimes(2);

    controller.abort();
    await jest.advanceTimersByTimeAsync(0);
    await promise;
  });

  it('reconnects immediately when onError returns 0', async () => {
    const controller = new AbortController();
    mockFetch.mockResolvedValueOnce(mockResponse(500));
    setupStream([msg('ok')]);
    mockFetch.mockResolvedValueOnce(mockResponse());
    mockFetch.mockImplementation(pendingFetch);

    const promise = fetchSSE(TEST_URL, {
      signal: controller.signal,
      onMessage: () => {},
      onError: () => 0,
    });

    await jest.advanceTimersByTimeAsync(0);
    expect(mockFetch).toHaveBeenCalledTimes(2);

    controller.abort();
    await jest.advanceTimersByTimeAsync(0);
    await promise;
  });

  it('reconnects after custom delay when onError returns ms', async () => {
    const controller = new AbortController();
    mockFetch.mockResolvedValueOnce(mockResponse(500));
    setupStream([msg('ok')]);
    mockFetch.mockResolvedValueOnce(mockResponse());
    mockFetch.mockImplementation(pendingFetch);

    const promise = fetchSSE(TEST_URL, {
      signal: controller.signal,
      onMessage: () => {},
      onError: () => 5000,
    });

    await jest.advanceTimersByTimeAsync(0);
    expect(mockFetch).toHaveBeenCalledTimes(1);

    await jest.advanceTimersByTimeAsync(4999);
    expect(mockFetch).toHaveBeenCalledTimes(1);

    await jest.advanceTimersByTimeAsync(1);
    expect(mockFetch).toHaveBeenCalledTimes(2);

    controller.abort();
    await jest.advanceTimersByTimeAsync(0);
    await promise;
  });

  it('rejects permanently when onError throws', async () => {
    mockFetch.mockResolvedValueOnce(mockResponse(500));

    const fatal = new Error('fatal');
    const error = await fetchSSE(TEST_URL, {
      onMessage: () => {},
      onError: () => {
        throw fatal;
      },
    }).catch((e: unknown) => e);

    expect(error).toBe(fatal);
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });

  it('sends Last-Event-ID header on reconnect', async () => {
    const controller = new AbortController();
    setupStream([msg('a', { lastEventId: '42' })]);
    mockFetch.mockResolvedValueOnce(mockResponse());
    mockFetch.mockImplementation(pendingFetch);

    const promise = fetchSSE(TEST_URL, {
      signal: controller.signal,
      onMessage: () => {},
    });

    await jest.advanceTimersByTimeAsync(0);
    await jest.advanceTimersByTimeAsync(6000);

    expect(mockFetch).toHaveBeenCalledTimes(2);
    const secondCall = mockFetch.mock.calls[1];
    const headers = secondCall[1]?.headers as Headers;
    expect(headers.get('Last-Event-ID')).toBe('42');

    controller.abort();
    await jest.advanceTimersByTimeAsync(0);
    await promise;
  });

  it('updates reconnect delay from server retry field', async () => {
    const controller = new AbortController();
    setupStream([msg('a')], { retry: 5000 });
    mockFetch.mockResolvedValueOnce(mockResponse());
    mockFetch.mockImplementation(pendingFetch);

    const promise = fetchSSE(TEST_URL, {
      signal: controller.signal,
      onMessage: () => {},
    });

    await jest.advanceTimersByTimeAsync(0);
    expect(mockFetch).toHaveBeenCalledTimes(1);

    await jest.advanceTimersByTimeAsync(9999);
    expect(mockFetch).toHaveBeenCalledTimes(1);

    await jest.advanceTimersByTimeAsync(1);
    expect(mockFetch).toHaveBeenCalledTimes(2);

    controller.abort();
    await jest.advanceTimersByTimeAsync(0);
    await promise;
  });

  it('passes static headers object', async () => {
    const controller = new AbortController();
    setupStream([msg('x')]);
    mockFetch.mockResolvedValueOnce(mockResponse());
    mockFetch.mockImplementation(pendingFetch);

    const promise = fetchSSE(TEST_URL, {
      signal: controller.signal,
      headers: { Authorization: 'Bearer x' },
      onMessage: () => {},
    });

    await jest.advanceTimersByTimeAsync(0);

    const headers = mockFetch.mock.calls[0][1]?.headers as Headers;
    expect(headers.get('Authorization')).toBe('Bearer x');

    controller.abort();
    await jest.advanceTimersByTimeAsync(0);
    await promise;
  });

  it('calls sync headers function on each attempt', async () => {
    const controller = new AbortController();
    const headersFn = jest.fn().mockReturnValue({ 'X-Token': 'abc' });
    setupStream([msg('x')]);
    mockFetch.mockResolvedValueOnce(mockResponse());
    mockFetch.mockImplementation(pendingFetch);

    const promise = fetchSSE(TEST_URL, {
      signal: controller.signal,
      headers: headersFn,
      onMessage: () => {},
    });

    await jest.advanceTimersByTimeAsync(0);
    expect(headersFn).toHaveBeenCalledTimes(1);

    await jest.advanceTimersByTimeAsync(6000);
    expect(headersFn).toHaveBeenCalledTimes(2);

    controller.abort();
    await jest.advanceTimersByTimeAsync(0);
    await promise;
  });

  it('calls async headers function on each attempt', async () => {
    const controller = new AbortController();
    const headersFn = jest.fn().mockResolvedValue({ 'X-Token': 'async-token' });
    setupStream([msg('x')]);
    mockFetch.mockResolvedValueOnce(mockResponse());
    mockFetch.mockImplementation(pendingFetch);

    const promise = fetchSSE(TEST_URL, {
      signal: controller.signal,
      headers: headersFn,
      onMessage: () => {},
    });

    await jest.advanceTimersByTimeAsync(0);
    expect(headersFn).toHaveBeenCalledTimes(1);

    const headers = mockFetch.mock.calls[0][1]?.headers as Headers;
    expect(headers.get('X-Token')).toBe('async-token');

    await jest.advanceTimersByTimeAsync(6000);
    expect(headersFn).toHaveBeenCalledTimes(2);

    controller.abort();
    await jest.advanceTimersByTimeAsync(0);
    await promise;
  });

  it('cycles through multiple reconnections correctly', async () => {
    const controller = new AbortController();
    const onOpen = jest.fn();
    const onClose = jest.fn();

    setupStream([msg('a')]);
    mockFetch.mockResolvedValueOnce(mockResponse());
    setupStream([msg('b')]);
    mockFetch.mockResolvedValueOnce(mockResponse());
    mockFetch.mockImplementation(pendingFetch);

    const promise = fetchSSE(TEST_URL, {
      signal: controller.signal,
      onOpen,
      onClose,
      onMessage: () => {},
    });

    await jest.advanceTimersByTimeAsync(0);
    expect(onOpen).toHaveBeenCalledTimes(1);
    expect(onClose).toHaveBeenCalledTimes(1);

    await jest.advanceTimersByTimeAsync(6000);
    expect(onOpen).toHaveBeenCalledTimes(2);
    expect(onClose).toHaveBeenCalledTimes(2);

    controller.abort();
    await jest.advanceTimersByTimeAsync(0);
    await promise;
  });
});
