import type { SSEMessage } from '../types';

export function createStream(chunks: string[]): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();
  let i = 0;
  return new ReadableStream({
    pull(controller) {
      if (i < chunks.length) {
        controller.enqueue(encoder.encode(chunks[i++]));
      } else {
        controller.close();
      }
    },
  });
}

export function mockResponse(status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    body: {},
  } as unknown as Response;
}

export function msg(data: string, overrides?: Partial<SSEMessage>): SSEMessage {
  return { event: 'message', data, lastEventId: '', ...overrides };
}

export function pendingFetch(_url: RequestInfo, init?: RequestInit) {
  return new Promise<Response>((_, reject) => {
    init?.signal?.addEventListener(
      'abort',
      () => reject(new DOMException('Aborted', 'AbortError')),
      { once: true }
    );
  });
}
