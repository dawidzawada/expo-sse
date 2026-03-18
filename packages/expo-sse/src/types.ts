export interface SSEMessage {
  event: string;
  data: string;
  lastEventId: string;
}

export interface SSEParseResult {
  events: SSEMessage[];
  remaining: string;
  retry?: number;
  lastEventId?: string;
}

export interface ParseSSEStreamOptions {
  onMessage: (message: SSEMessage) => void;
  onRetry?: (retryMs: number) => void;
  maxBufferSize?: number;
}

export interface FetchSSEOptions {
  headers?: HeadersInit | (() => HeadersInit) | (() => Promise<HeadersInit>);
  signal?: AbortSignal;
  onOpen?: (response: Response) => void | Promise<void>;
  onMessage: (message: SSEMessage) => void;
  onError?: (error: Error) => number | void | Promise<number | void>;
  onClose?: () => void;
  maxBufferSize?: number;
}
