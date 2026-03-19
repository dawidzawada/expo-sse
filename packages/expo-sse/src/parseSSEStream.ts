import { SSEBufferOverflowError } from './errors';
import { parseSSEBuffer } from './parseSSEBuffer';
import type { ParseSSEStreamOptions } from './types';

const DEFAULT_MAX_BUFFER_SIZE = 524288; // 512KB

/**
 * Reads a `ReadableStream<Uint8Array>` and parses it into SSE events.
 *
 * Decodes chunks with `TextDecoder({ stream: true })` to handle UTF-8 sequences
 * split across chunk boundaries. Feeds decoded text to {@link parseSSEBuffer} in a
 * loop, carrying over incomplete lines between chunks via `remaining`. Tracks
 * `lastEventId` across the entire stream.
 *
 * @param stream - The byte stream to read (typically `response.body`).
 * @param options - Callbacks for events and retry, plus an optional buffer size limit.
 * @throws {@link SSEBufferOverflowError} if the accumulated buffer exceeds `maxBufferSize` (default 512KB).
 */
export async function parseSSEStream(
  stream: ReadableStream<Uint8Array>,
  options: ParseSSEStreamOptions
): Promise<void> {
  const {
    onMessage,
    onRetry,
    maxBufferSize = DEFAULT_MAX_BUFFER_SIZE,
  } = options;
  const decoder = new TextDecoder('utf-8');
  const reader = stream.getReader();
  let buffer = '';
  let lastEventId: string | undefined;

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });

      if (buffer.length > maxBufferSize) {
        throw new SSEBufferOverflowError(buffer.length, maxBufferSize);
      }

      const result = parseSSEBuffer(buffer, lastEventId);

      for (const event of result.events) {
        onMessage(event);
      }

      if (result.retry !== undefined && onRetry) {
        onRetry(result.retry);
      }

      if (result.lastEventId !== undefined) {
        lastEventId = result.lastEventId;
      }

      buffer = result.remaining;
    }
  } finally {
    reader.releaseLock();
  }
}
