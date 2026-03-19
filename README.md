# Expo SSE

SSE (Server-Sent Events) client for Expo apps, built on `expo/fetch` streaming.

## Requirements

- Expo SDK 54+

## Installation

```bash
npm install @dawidzawada/expo-sse
# or
yarn add @dawidzawada/expo-sse
# or
bun add @dawidzawada/expo-sse
```

## Architecture

Three layers, each usable independently:

```
parseSSEBuffer  →  parseSSEStream  →  fetchSSE
  (pure fn)        (stream reader)    (full client)
```

1. **`parseSSEBuffer`** — Pure function. Parses a string buffer into SSE events per the WHATWG spec.
2. **`parseSSEStream`** — Reads a `ReadableStream<Uint8Array>`, decodes chunks, and feeds them to `parseSSEBuffer`.
3. **`fetchSSE`** — Top-level API. Connects via `expo/fetch`, parses the stream, and auto-reconnects with exponential backoff + jitter.

## API

### `fetchSSE(url, options)`

Connects to an SSE endpoint and auto-reconnects on failure.

```ts
import { fetchSSE } from '@dawidzawada/expo-sse';

const controller = new AbortController();

await fetchSSE('https://api.example.com/events', {
  signal: controller.signal,
  headers: { Authorization: 'Bearer token' },
  onMessage: (msg) => console.log(msg.event, msg.data),
  onError: (error) => console.error(error),
  onClose: () => console.log('stream closed'),
});
```

#### `FetchSSEOptions`

| Field           | Type                                                             | Description                                                                                             |
| --------------- | ---------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| `headers`       | `HeadersInit \| () => HeadersInit \| () => Promise<HeadersInit>` | Request headers. Async functions are re-evaluated on each reconnect attempt (useful for token refresh). |
| `signal`        | `AbortSignal`                                                    | Abort signal to stop the connection.                                                                    |
| `onOpen`        | `(response: Response) => void \| Promise<void>`                  | Called when the connection opens. Errors here are fatal (no reconnect).                                 |
| `onMessage`     | `(message: SSEMessage) => void`                                  | **Required.** Called for each SSE event.                                                                |
| `onError`       | `(error: Error) => number \| void \| Promise<number \| void>`    | Called on errors. Return a delay in ms (`0` for immediate reconnect) or throw to stop.                  |
| `onClose`       | `() => void`                                                     | Called when the stream closes normally.                                                                 |
| `onAbort`       | `() => void`                                                     | Called when the connection is aborted via the signal.                                                   |
| `maxBufferSize` | `number`                                                         | Max buffer size in bytes. Defaults to 512KB.                                                            |

### `parseSSEStream(stream, options)`

Reads a `ReadableStream<Uint8Array>` and parses it into SSE events.

```ts
import { parseSSEStream } from '@dawidzawada/expo-sse';

await parseSSEStream(response.body, {
  onMessage: (msg) => console.log(msg),
  onRetry: (ms) => console.log('server requested retry:', ms),
  maxBufferSize: 1024 * 1024, // 1MB
});
```

#### `ParseSSEStreamOptions`

| Field           | Type                            | Description                                                                               |
| --------------- | ------------------------------- | ----------------------------------------------------------------------------------------- |
| `onMessage`     | `(message: SSEMessage) => void` | **Required.** Called for each parsed event.                                               |
| `onRetry`       | `(retryMs: number) => void`     | Called when a `retry:` field is received.                                                 |
| `maxBufferSize` | `number`                        | Max buffer size in bytes. Defaults to 512KB. Throws `SSEBufferOverflowError` if exceeded. |

### `parseSSEBuffer(buffer, lastEventId?)`

Pure function that parses a string buffer into SSE events. Handles LF (`\n`), CRLF (`\r\n`), and CR (`\r`) line endings simultaneously.

```ts
import { parseSSEBuffer } from '@dawidzawada/expo-sse';

const result = parseSSEBuffer('event: greeting\ndata: hello\n\n');
// result.events = [{ event: 'greeting', data: 'hello', lastEventId: '' }]
```

#### `SSEParseResult`

| Field         | Type                  | Description                                                      |
| ------------- | --------------------- | ---------------------------------------------------------------- |
| `events`      | `SSEMessage[]`        | Parsed events.                                                   |
| `remaining`   | `string`              | Unconsumed text (incomplete lines to prepend to the next chunk). |
| `retry`       | `number \| undefined` | Last `retry:` value seen, if any.                                |
| `lastEventId` | `string \| undefined` | Last `id:` value seen, if any.                                   |

### `SSEMessage`

```ts
interface SSEMessage {
  event: string; // Event type (defaults to "message")
  data: string; // Event data
  lastEventId: string; // Last event ID
}
```

### Error classes

#### `SSEHttpError`

Thrown when the server responds with a non-2xx status code.

| Property   | Type       | Description               |
| ---------- | ---------- | ------------------------- |
| `status`   | `number`   | HTTP status code.         |
| `response` | `Response` | The full response object. |

#### `SSEBufferOverflowError`

Thrown when the internal buffer exceeds `maxBufferSize`.

| Property        | Type     | Description                   |
| --------------- | -------- | ----------------------------- |
| `bufferSize`    | `number` | Current buffer size in bytes. |
| `maxBufferSize` | `number` | Configured limit in bytes.    |

## Example: Connecting and disconnecting

Use an `AbortController` to disconnect. The `onAbort` callback is called when the connection is stopped via the signal.

```ts
import { fetchSSE } from '@dawidzawada/expo-sse';

const controller = new AbortController();

fetchSSE('https://api.example.com/events', {
  signal: controller.signal,
  onMessage: (msg) => console.log(msg.event, msg.data),
  onClose: () => console.log('stream closed by server'),
  onAbort: () => console.log('disconnected by client'),
});

// Later: disconnect
controller.abort();
```

## Example: Token refresh

Async `headers` are re-evaluated on each reconnect, making token refresh straightforward:

```ts
import { fetchSSE, SSEHttpError } from '@dawidzawada/expo-sse';

const getToken = async () => {};
const refreshToken = async () => {};

await fetchSSE('https://api.example.com/events', {
  signal: controller.signal,
  headers: async () => ({
    Authorization: `Bearer ${getToken()}`,
  }),
  onMessage: (msg) => {
    console.log(msg.event, msg.data);
  },
  onError: async (error) => {
    if (error instanceof SSEHttpError && error.status === 401) {
      await refreshToken();
      return 0; // reconnect immediately with new token
    }
  },
});
```

## Contributing

See [CONTRIBUTING.md](./CONTRIBUTING.md).

## License

MIT
