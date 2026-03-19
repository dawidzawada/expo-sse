import type { SSEParseResult } from './types';

const LF = '\n';
const CR = '\r';

/**
 * Parses a string buffer into SSE events per the WHATWG EventSource spec.
 *
 * Handles LF, CRLF, and CR line endings simultaneously (mixed endings supported).
 * A trailing CR is kept in `remaining` because it may be the start of a CRLF pair
 * split across chunks. Incomplete lines (no trailing newline) are also returned in
 * `remaining` for the caller to prepend to the next chunk.
 *
 * @param buffer - Raw string to parse (may contain partial events).
 * @param lastEventId - Carry-over `lastEventId` from a previous parse call.
 * @returns Parsed events, unconsumed `remaining` text, and optional `retry`/`lastEventId`.
 */
export function parseSSEBuffer(
  buffer: string,
  lastEventId?: string
): SSEParseResult {
  const events: SSEParseResult['events'] = [];
  let retry: number | undefined;
  let currentEventId = lastEventId ?? '';
  let eventType = '';
  let dataLines: string[] = [];
  let hasData = false;
  let lastConsumedPos = 0;
  let lineStart = 0;

  const len = buffer.length;
  let i = 0;

  while (i <= len) {
    let lineEnd = -1;
    let nextLineStart = -1;

    if (i === len) {
      // Any content after the last line terminator is an incomplete line.
      // Leave it in `remaining` so the next chunk can complete it.
      break;
    }

    const ch = buffer[i];

    if (ch === LF) {
      lineEnd = i;
      nextLineStart = i + 1;
    } else if (ch === CR) {
      if (i + 1 < len) {
        if (buffer[i + 1] === LF) {
          lineEnd = i;
          nextLineStart = i + 2;
        } else {
          lineEnd = i;
          nextLineStart = i + 1;
        }
      } else {
        // A trailing CR could be a standalone CR line ending or the first
        // byte of a CRLF pair split across chunks. Keep it in `remaining`
        // until the next chunk arrives to disambiguate.
        break;
      }
    } else {
      i++;
      continue;
    }

    const line = buffer.slice(lineStart, lineEnd);
    lineStart = nextLineStart;
    i = nextLineStart;

    // Per SSE spec: a blank line marks the end of an event block.
    // If any `data:` fields were seen, dispatch the event, otherwise discard.
    if (line === '') {
      if (hasData) {
        events.push({
          event: eventType || 'message',
          data: dataLines.join(LF),
          lastEventId: currentEventId,
        });
      }

      eventType = '';
      dataLines = [];
      hasData = false;
      lastConsumedPos = nextLineStart;
      continue;
    }

    // Comments (ping / heartbeat)
    if (line[0] === ':') {
      continue;
    }

    const colonIdx = line.indexOf(':');
    let field: string;
    let value: string;

    if (colonIdx === -1) {
      field = line;
      value = ''; // no colon = empty string value
    } else {
      field = line.slice(0, colonIdx);
      // Per spec, strip only first space after the colon.
      // Additional spaces are part of the value.
      value =
        colonIdx + 1 < line.length && line[colonIdx + 1] === ' '
          ? line.slice(colonIdx + 2)
          : line.slice(colonIdx + 1);
    }

    switch (field) {
      case 'data':
        dataLines.push(value);
        hasData = true;
        break;
      case 'event':
        eventType = value;
        break;
      case 'id':
        // Per spec, ignore id fields containing U+0000 NULL.
        if (!value.includes('\0')) {
          currentEventId = value;
        }
        break;
      case 'retry': {
        // Per spec, retry is valid when the value is entirely ASCII digits.
        if (/^\d+$/.test(value)) {
          retry = parseInt(value, 10);
        }
        break;
      }
      // Per spec, silent ignore unrecognized field names (e.g. "foo:")
    }
  }

  return {
    events,
    remaining: buffer.slice(lastConsumedPos),
    retry,
    lastEventId: currentEventId || undefined,
  };
}
