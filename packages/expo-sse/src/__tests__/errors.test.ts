import { SSETransportError } from '../errors';

// `expo/fetch` surfaces transport failures as `fetch failed: <native message>`.
// On Android the connect path embeds the JVM class name via `Throwable.toString()`,
// and the classifier keys on those documented exception classes:
//   java.net.*      — https://developer.android.com/reference/java/net/package-summary
//   javax.net.ssl.* — https://developer.android.com/reference/javax/net/ssl/package-summary
// The exact message *text* is not a documented contract (it originates across libcore,
// OkHttp, Okio and Conscrypt), so the strings below are real-world samples with dummy
// host/ip — what matters for classification is the class name they carry.
function fetchError(nativeMessage: string): Error {
  return new Error(`fetch failed: ${nativeMessage}`);
}

describe('SSETransportError.from — Android classification', () => {
  it('classifies UnknownHostException as dns', () => {
    const error = SSETransportError.from(
      fetchError(
        'java.net.UnknownHostException: Unable to resolve host "api.example.com": No address associated with hostname'
      )
    );

    expect(error).toBeInstanceOf(SSETransportError);
    expect(error?.type).toBe('fetch_failed');
    expect(error?.kind).toBe('dns');
  });

  it('classifies ConnectException as connect', () => {
    const error = SSETransportError.from(
      fetchError(
        'java.net.ConnectException: Failed to connect to api.example.com/10.0.0.1:443'
      )
    );

    expect(error?.kind).toBe('connect');
  });

  it('classifies SocketTimeoutException (connect) as timeout', () => {
    const error = SSETransportError.from(
      fetchError('java.net.SocketTimeoutException: connect timed out')
    );

    expect(error?.kind).toBe('timeout');
  });

  it('classifies SocketTimeoutException (read) as timeout', () => {
    const error = SSETransportError.from(
      fetchError('java.net.SocketTimeoutException: timeout')
    );

    expect(error?.kind).toBe('timeout');
  });

  it('classifies SSLHandshakeException as tls', () => {
    const error = SSETransportError.from(
      fetchError(
        'javax.net.ssl.SSLHandshakeException: java.security.cert.CertPathValidatorException: Trust anchor for certification path not found.'
      )
    );

    expect(error?.kind).toBe('tls');
  });

  it('falls back to unknown for an unrecognized transport failure', () => {
    const error = SSETransportError.from(
      fetchError('java.io.IOException: unexpected end of stream on api.example.com')
    );

    expect(error).toBeInstanceOf(SSETransportError);
    expect(error?.kind).toBe('unknown');
  });

  it('preserves the original error as cause', () => {
    const original = fetchError(
      'java.net.UnknownHostException: Unable to resolve host "api.example.com": No address associated with hostname'
    );

    expect(SSETransportError.from(original)?.cause).toBe(original);
  });

  it('returns null for aborted or canceled requests', () => {
    expect(
      SSETransportError.from(fetchError('The operation was aborted.'))
    ).toBeNull();
    expect(
      SSETransportError.from(fetchError('Fetch request has been canceled'))
    ).toBeNull();
  });

  it('returns null for non-transport errors so they pass through unchanged', () => {
    expect(SSETransportError.from(new Error('HTTP 500'))).toBeNull();
    expect(SSETransportError.from(new Error('boom from onMessage'))).toBeNull();
  });
});
