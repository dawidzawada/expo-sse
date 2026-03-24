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
