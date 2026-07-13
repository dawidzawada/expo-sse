export class SSEHttpError extends Error {
  readonly status: number;
  readonly response: unknown;

  constructor(status: number, response: unknown) {
    super(`HTTP ${status}`);
    this.name = 'SSEHttpError';
    this.status = status;
    this.response = response;
  }

  static async from(res: Response) {
    const responseJson = await res.json().catch(() => null);
    return new SSEHttpError(res.status, responseJson);
  }
}

export class SSEBufferOverflowError extends Error {
  readonly bufferSize: number;
  readonly maxBufferSize: number;

  constructor(bufferSize: number, maxBufferSize: number) {
    super(
      `SSE buffer overflow: ${bufferSize} bytes exceeds limit of ${maxBufferSize} bytes`
    );
    this.name = 'SSEBufferOverflowError';
    this.bufferSize = bufferSize;
    this.maxBufferSize = maxBufferSize;
  }
}

export type SSETransportErrorType = 'fetch_failed';

export type SSETransportErrorKind =
  | 'dns'
  | 'connect'
  | 'tls'
  | 'timeout'
  | 'unknown';

const FETCH_FAILED_PREFIX = 'fetch failed:';

const ABORT_SIGNATURE = /aborted|cancell?ed/i;

const KIND_SIGNATURES: { kind: SSETransportErrorKind; signature: RegExp }[] = [
  { kind: 'dns', signature: /UnknownHostException/ },
  { kind: 'timeout', signature: /SocketTimeoutException/ },
  {
    kind: 'tls',
    signature:
      /SSLHandshakeException|SSLPeerUnverifiedException|SSLProtocolException|SSLKeyException|SSLException|CertPathValidatorException|CertificateException/,
  },
  {
    kind: 'connect',
    signature:
      /ConnectException|NoRouteToHostException|PortUnreachableException/,
  },
];

function classifyKind(message: string): SSETransportErrorKind {
  for (const { kind, signature } of KIND_SIGNATURES) {
    if (signature.test(message)) {
      return kind;
    }
  }
  return 'unknown';
}

/**
 * Transport-layer failure surfaced by `expo/fetch` while establishing the SSE
 * connection — DNS, TCP connect, TLS, or timeout — as opposed to an HTTP
 * response ({@link SSEHttpError}).
 *
 * `type` mirrors the originating `expo/fetch` error band (`fetch failed:`) and
 * is stable across platforms. `kind` narrows the failure and is classified from
 * the native signature embedded in the message: Android carries the JVM class
 * name (e.g. `java.net.UnknownHostException`).
 * iOS surfaces only a localized `NSError` description with no stable signature,
 * so `kind` is always `'unknown'` on iOS. The original error is kept on
 * `cause`.
 */
export class SSETransportError extends Error {
  readonly type: SSETransportErrorType;
  readonly kind: SSETransportErrorKind;
  readonly cause: unknown;

  constructor(
    type: SSETransportErrorType,
    kind: SSETransportErrorKind,
    message: string,
    cause?: unknown
  ) {
    super(message);
    this.name = 'SSETransportError';
    this.type = type;
    this.kind = kind;
    this.cause = cause;
  }

  /**
   * Wraps a transport failure thrown by `expo/fetch` in an `SSETransportError`,
   * or returns `null` when the error is not a recognized transport band — an
   * aborted/canceled request, or any non-`expo/fetch` error (HTTP errors,
   * buffer overflow, mid-stream errors, consumer callback throws) — so the
   * caller can rethrow it unchanged.
   */
  static from(cause: unknown): SSETransportError | null {
    const message = cause instanceof Error ? cause.message : String(cause);
    if (!message.startsWith(FETCH_FAILED_PREFIX)) {
      return null;
    }
    if (ABORT_SIGNATURE.test(message)) {
      return null;
    }
    return new SSETransportError(
      'fetch_failed',
      classifyKind(message),
      message,
      cause
    );
  }
}
