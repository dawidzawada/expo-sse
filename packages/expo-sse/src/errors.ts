export class SSEHttpError extends Error {
  readonly status: number;
  readonly response: Response;

  constructor(status: number, response: Response) {
    super(`HTTP ${status}`);
    this.name = 'SSEHttpError';
    this.status = status;
    this.response = response;
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
