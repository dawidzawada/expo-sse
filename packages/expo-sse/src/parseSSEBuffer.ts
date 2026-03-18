import type { SSEParseResult } from './types';

const LF = '\n';
const CR = '\r';

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
    // Find end of line
    let lineEnd = -1;
    let nextLineStart = -1;

    if (i === len) {
      // End of buffer — only process if there's content since last line start
      if (lineStart === len) break;
      // Check if we have an unterminated line (no trailing newline)
      // This stays in remaining — don't process it
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
        // CR at end of buffer — ambiguous, keep in remaining
        break;
      }
    } else {
      i++;
      continue;
    }

    const line = buffer.slice(lineStart, lineEnd);
    lineStart = nextLineStart;
    i = nextLineStart;

    // Blank line — dispatch event if we have data
    if (line === '') {
      if (hasData) {
        events.push({
          event: eventType || 'message',
          data: dataLines.join(LF),
          lastEventId: currentEventId,
        });
      }
      // Reset per-event state
      eventType = '';
      dataLines = [];
      hasData = false;
      lastConsumedPos = nextLineStart;
      continue;
    }

    // Comment line
    if (line[0] === ':') {
      continue;
    }

    // Parse field
    const colonIdx = line.indexOf(':');
    let field: string;
    let value: string;

    if (colonIdx === -1) {
      field = line;
      value = '';
    } else {
      field = line.slice(0, colonIdx);
      // Strip single leading space after colon if present
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
        // Ignore if value contains U+0000
        if (!value.includes('\0')) {
          currentEventId = value;
        }
        break;
      case 'retry': {
        // Only accept if all characters are ASCII digits
        if (/^\d+$/.test(value)) {
          retry = parseInt(value, 10);
        }
        break;
      }
      // Unknown fields are ignored per spec
    }
  }

  return {
    events,
    remaining: buffer.slice(lastConsumedPos),
    retry,
    lastEventId: currentEventId || undefined,
  };
}
