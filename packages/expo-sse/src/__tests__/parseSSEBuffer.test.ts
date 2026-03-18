import { parseSSEBuffer } from '../parseSSEBuffer';

const LF = '\n';
const CR = '\r';
const CRLF = '\r\n';

describe('parseSSEBuffer', () => {
  it('parses events with LF line endings', () => {
    const result = parseSSEBuffer(`data: hello${LF}${LF}`);
    expect(result.events).toHaveLength(1);
    expect(result.events[0].data).toBe('hello');
    expect(result.remaining).toBe('');
  });

  it('parses events with CRLF line endings', () => {
    const result = parseSSEBuffer(`data: hello${CRLF}${CRLF}`);
    expect(result.events).toHaveLength(1);
    expect(result.events[0].data).toBe('hello');
    expect(result.remaining).toBe('');
  });

  it('parses events with CR line endings', () => {
    const result = parseSSEBuffer(`data: hello${CR}${CR}:next${LF}`);
    expect(result.events).toHaveLength(1);
    expect(result.events[0].data).toBe('hello');
  });

  it('parses events with mixed line endings', () => {
    const result = parseSSEBuffer(`data: a${CRLF}data: b${LF}${LF}`);
    expect(result.events).toHaveLength(1);
    expect(result.events[0].data).toBe(`a${LF}b`);
    expect(result.remaining).toBe('');
  });

  it('keeps trailing CR in remaining', () => {
    const result = parseSSEBuffer(`data: hello${CR}`);
    expect(result.events).toHaveLength(0);
    expect(result.remaining).toBe(`data: hello${CR}`);
  });

  it('joins multi-line data with LF', () => {
    const result = parseSSEBuffer(`data: foo${LF}data: bar${LF}${LF}`);
    expect(result.events).toHaveLength(1);
    expect(result.events[0].data).toBe(`foo${LF}bar`);
  });

  it('ignores comment lines', () => {
    const result = parseSSEBuffer(`: comment${LF}data: hello${LF}${LF}`);
    expect(result.events).toHaveLength(1);
    expect(result.events[0].data).toBe('hello');
  });

  it('ignores unknown field names', () => {
    const result = parseSSEBuffer(`foo: bar${LF}data: hello${LF}${LF}`);
    expect(result.events).toHaveLength(1);
    expect(result.events[0].data).toBe('hello');
  });

  it('treats field with no colon as empty value', () => {
    const result = parseSSEBuffer(`data${LF}${LF}`);
    expect(result.events).toHaveLength(1);
    expect(result.events[0].data).toBe('');
  });

  it('strips only the first space after colon', () => {
    const result = parseSSEBuffer(`data:  two spaces${LF}${LF}`);
    expect(result.events).toHaveLength(1);
    expect(result.events[0].data).toBe(' two spaces');
  });

  it('sets custom event type', () => {
    const result = parseSSEBuffer(`event: ping${LF}data: x${LF}${LF}`);
    expect(result.events).toHaveLength(1);
    expect(result.events[0].event).toBe('ping');
  });

  it('defaults event type to message', () => {
    const result = parseSSEBuffer(`data: x${LF}${LF}`);
    expect(result.events).toHaveLength(1);
    expect(result.events[0].event).toBe('message');
  });

  it('updates lastEventId from id field', () => {
    const result = parseSSEBuffer(`id: 42${LF}data: x${LF}${LF}`);
    expect(result.events).toHaveLength(1);
    expect(result.events[0].lastEventId).toBe('42');
    expect(result.lastEventId).toBe('42');
  });

  it('ignores id field containing null character', () => {
    const result = parseSSEBuffer(`id: ab\0c${LF}data: x${LF}${LF}`);
    expect(result.events).toHaveLength(1);
    expect(result.events[0].lastEventId).toBe('');
    expect(result.lastEventId).toBeUndefined();
  });

  it('parses retry field with valid integer', () => {
    const result = parseSSEBuffer(`retry: 5000${LF}data: x${LF}${LF}`);
    expect(result.retry).toBe(5000);
  });

  it('ignores retry field with non-digits', () => {
    const result = parseSSEBuffer(`retry: 50ms${LF}data: x${LF}${LF}`);
    expect(result.retry).toBeUndefined();
  });

  it('does not dispatch event on blank line with empty data buffer', () => {
    const result = parseSSEBuffer(`${LF}${LF}${LF}data: x${LF}${LF}`);
    expect(result.events).toHaveLength(1);
    expect(result.events[0].data).toBe('x');
  });

  it('keeps incomplete event in remaining', () => {
    const result = parseSSEBuffer(`data: hello${LF}`);
    expect(result.events).toHaveLength(0);
    expect(result.remaining).toBe(`data: hello${LF}`);
  });

  it('strips trailing LF from data before dispatch', () => {
    const result = parseSSEBuffer(`data: a${LF}data: b${LF}${LF}`);
    expect(result.events[0].data).toBe(`a${LF}b`);
  });

  it('resets event type to message after dispatch', () => {
    const result = parseSSEBuffer(
      `event: ping${LF}data: a${LF}${LF}data: b${LF}${LF}`
    );
    expect(result.events).toHaveLength(2);
    expect(result.events[0].event).toBe('ping');
    expect(result.events[1].event).toBe('message');
  });

  it('persists lastEventId across events', () => {
    const result = parseSSEBuffer(
      `id: 5${LF}data: a${LF}${LF}data: b${LF}${LF}`
    );
    expect(result.events).toHaveLength(2);
    expect(result.events[0].lastEventId).toBe('5');
    expect(result.events[1].lastEventId).toBe('5');
  });

  it('resets lastEventId with empty id field', () => {
    const result = parseSSEBuffer(
      `id: 5${LF}data: a${LF}${LF}id:${LF}data: b${LF}${LF}`
    );
    expect(result.events).toHaveLength(2);
    expect(result.events[0].lastEventId).toBe('5');
    expect(result.events[1].lastEventId).toBe('');
  });

  it('treats field names as case-sensitive', () => {
    const result = parseSSEBuffer(`Data: x${LF}data: hello${LF}${LF}`);
    expect(result.events).toHaveLength(1);
    expect(result.events[0].data).toBe('hello');
  });

  it('empty data field contributes LF to buffer', () => {
    const result = parseSSEBuffer(`data:${LF}data: hello${LF}${LF}`);
    expect(result.events).toHaveLength(1);
    expect(result.events[0].data).toBe(`${LF}hello`);
  });
});
