# @dawidzawada/expo-sse

Server-Sent Events (SSE) client for Expo/React Native.

## Installation

```bash
npm install @dawidzawada/expo-sse
# or
yarn add @dawidzawada/expo-sse
# or
bun add @dawidzawada/expo-sse
```

## Usage

```typescript
import { SSEClient } from '@dawidzawada/expo-sse';

const client = new SSEClient({
  url: 'https://api.example.com/events',
  headers: {
    Authorization: 'Bearer your-token',
  },
});

// Listen for messages
const unsubscribe = client.onMessage((message) => {
  console.log('Received:', message.data);
  console.log('Event:', message.event);
  console.log('ID:', message.id);
});

// Listen for errors
client.onError((error) => {
  console.error('SSE Error:', error);
});

// Connect
client.connect();

// Disconnect when done
client.disconnect();

// Unsubscribe from messages
unsubscribe();
```

## API

### `SSEClient`

#### Constructor

```typescript
new SSEClient(config: SSEConfig)
```

#### `SSEConfig`

| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `url` | `string` | Yes | The SSE endpoint URL |
| `headers` | `Record<string, string>` | No | Custom headers |
| `withCredentials` | `boolean` | No | Include credentials |

#### Methods

- `connect(): void` — Establish SSE connection
- `disconnect(): void` — Close SSE connection
- `onMessage(handler): () => void` — Register message handler, returns unsubscribe function
- `onError(handler): () => void` — Register error handler, returns unsubscribe function

### `SSEMessage`

| Property | Type | Description |
|----------|------|-------------|
| `id` | `string?` | Message ID |
| `event` | `string?` | Event type |
| `data` | `string` | Message data |

## License

MIT
