import { SSEBufferOverflowError } from '../errors';
import { parseSSEStream } from '../parseSSEStream';
import type { SSEMessage } from '../types';
import { createStream } from './helpers';

describe('parseSSEStream', () => {
  it('handles multi-byte UTF-8 split across chunks', async () => {
    const emoji = '😀';
    const bytes = new TextEncoder().encode(emoji);
    const chunk1 = bytes.slice(0, 2);
    const chunk2 = new Uint8Array([
      ...bytes.slice(2),
      ...new TextEncoder().encode('\n\n'),
    ]);

    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(new TextEncoder().encode('data: '));
        controller.enqueue(chunk1);
        controller.enqueue(chunk2);
        controller.close();
      },
    });

    const messages: SSEMessage[] = [];
    await parseSSEStream(stream, { onMessage: (msg) => messages.push(msg) });

    expect(messages).toHaveLength(1);
    expect(messages[0].data).toBe('😀');
  });

  it('persists lastEventId across chunks', async () => {
    const stream = createStream(['id: 7\ndata: a\n\n', 'data: b\n\n']);
    const messages: SSEMessage[] = [];

    await parseSSEStream(stream, { onMessage: (msg) => messages.push(msg) });

    expect(messages).toHaveLength(2);
    expect(messages[0].lastEventId).toBe('7');
    expect(messages[1].lastEventId).toBe('7');
  });

  it('throws SSEBufferOverflowError when buffer exceeds maxBufferSize', async () => {
    const stream = createStream(['data: ' + 'x'.repeat(20) + '\n\n']);

    const error = await parseSSEStream(stream, {
      onMessage: () => {},
      maxBufferSize: 10,
    }).catch((e: unknown) => e);

    expect(error).toBeInstanceOf(SSEBufferOverflowError);
    const overflow = error as SSEBufferOverflowError;
    expect(overflow.bufferSize).toBeGreaterThan(10);
    expect(overflow.maxBufferSize).toBe(10);
  });

  it('calls onRetry when retry field is received', async () => {
    const stream = createStream(['retry: 3000\ndata: x\n\n']);
    const onRetry = jest.fn();

    await parseSSEStream(stream, { onMessage: () => {}, onRetry });

    expect(onRetry).toHaveBeenCalledWith(3000);
  });

  it('stops reading when signal is aborted', async () => {
    const controller = new AbortController();
    const encoder = new TextEncoder();
    let pullCount = 0;

    const stream = new ReadableStream<Uint8Array>({
      pull(c) {
        pullCount++;
        if (pullCount === 1) {
          c.enqueue(encoder.encode('data: first\n\n'));
        } else {
          c.enqueue(encoder.encode('data: second\n\n'));
        }
      },
    });

    const messages: SSEMessage[] = [];
    const promise = parseSSEStream(stream, {
      onMessage: (msg) => {
        messages.push(msg);
        controller.abort();
      },
      signal: controller.signal,
    });

    await promise;
    expect(messages).toHaveLength(1);
    expect(messages[0].data).toBe('first');
  });

  it('discards incomplete event at end of stream', async () => {
    const stream = createStream(['data: hello\n']);
    const messages: SSEMessage[] = [];

    await parseSSEStream(stream, { onMessage: (msg) => messages.push(msg) });

    expect(messages).toHaveLength(0);
  });
});
