import { fetch as expoFetch } from 'expo/fetch';
import { SSEHttpError } from './errors';
import { parseSSEStream } from './parseSSEStream';
import type { FetchSSEOptions } from './types';

const MAX_BACKOFF_MS = 30000;
const DEFAULT_RETRY_MS = 3000;
const JITTER_MAX_MS = 1000;

function delay(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise<void>((resolve) => {
    if (signal?.aborted) {
      resolve();
      return;
    }
    const timer = setTimeout(resolve, ms);
    const onAbort = () => {
      clearTimeout(timer);
      resolve();
    };
    signal?.addEventListener('abort', onAbort, { once: true });
  });
}

/**
 * Top-level SSE client using `expo/fetch` for streaming.
 *
 * Connects to `url`, parses the SSE stream via {@link parseSSEStream}, and
 * auto-reconnects with exponential backoff + jitter (max 30s). The `headers`
 * option accepts a sync value or an async function, re-evaluated on each
 * attempt (useful for token refresh). Sends `Last-Event-ID` on reconnect.
 *
 * Reconnection behavior:
 * - Server `retry:` field overrides the base delay.
 * - `onError` can return a delay in ms (`0` for immediate) or throw to stop.
 * - Errors during `onOpen` are fatal and skip reconnection.
 *
 * @param url - The SSE endpoint URL.
 * @param options - Configuration including callbacks, headers, signal, and buffer size.
 */
export async function fetchSSE(
  url: string,
  options: FetchSSEOptions
): Promise<void> {
  const {
    headers: headersOption,
    signal,
    onOpen,
    onMessage,
    onError,
    onClose,
    onAbort,
    maxBufferSize,
  } = options;

  let lastEventId = '';
  let serverRetryMs: number | undefined;
  let attempt = 0;

  while (true) {
    if (signal?.aborted) {
      onAbort?.();
      return;
    }

    const baseInit =
      typeof headersOption === 'function'
        ? await headersOption()
        : headersOption;

    const headers = new Headers(baseInit);
    headers.set('Accept', 'text/event-stream');
    headers.set('Cache-Control', 'no-cache');

    if (lastEventId) {
      headers.set('Last-Event-ID', lastEventId);
    }

    let openCompleted = false;

    try {
      const response = await expoFetch(url, { headers, signal });

      if (!response.ok) {
        throw new SSEHttpError(response.status, response);
      }

      if (onOpen) {
        await onOpen(response);
      }
      openCompleted = true;

      let receivedMessage = false;

      if (response.body) {
        await parseSSEStream(response.body, {
          onMessage: (event) => {
            lastEventId = event.lastEventId;
            if (!receivedMessage) {
              receivedMessage = true;
              attempt = 0;
            }
            onMessage(event);
          },
          onRetry: (retryMs) => {
            serverRetryMs = retryMs;
          },
          signal,
          maxBufferSize,
        });
      }

      if (signal?.aborted) {
        onAbort?.();
        return;
      }

      onClose?.();
    } catch (error) {
      if (signal?.aborted) {
        onAbort?.();
        return;
      }

      if (!openCompleted && !(error instanceof SSEHttpError)) {
        throw error;
      }

      if (!onError) {
        throw error;
      }

      const result = await onError(error as Error);
      let delayMs: number | undefined =
        typeof result === 'number' ? result : undefined;

      if (delayMs === undefined) {
        const baseDelay = serverRetryMs ?? DEFAULT_RETRY_MS;
        delayMs =
          Math.min(baseDelay * Math.pow(2, attempt), MAX_BACKOFF_MS) +
          Math.random() * JITTER_MAX_MS;
      }

      attempt++;
      await delay(delayMs, signal);
      if (signal?.aborted) {
        onAbort?.();
        return;
      }
      continue;
    }

    attempt++;
    const baseDelay = serverRetryMs ?? DEFAULT_RETRY_MS;
    const reconnectDelay =
      Math.min(baseDelay * Math.pow(2, attempt), MAX_BACKOFF_MS) +
      Math.random() * JITTER_MAX_MS;
    await delay(reconnectDelay, signal);
    if (signal?.aborted) {
      onAbort?.();
      return;
    }
  }
}
