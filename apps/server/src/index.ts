import { randomUUID } from 'node:crypto';
import { createServer, IncomingMessage, ServerResponse } from 'node:http';

let id = 0;

const quotes = [
  'The best way to predict the future is to invent it.',
  'Talk is cheap. Show me the code.',
  'First, solve the problem. Then, write the code.',
  'Simplicity is the soul of efficiency.',
  'Any fool can write code that a computer can understand.',
  'Code is like humor. When you have to explain it, it is bad.',
  'Make it work, make it right, make it fast.',
  'The only way to go fast is to go well.',
];

const TOKEN_TTL_MS = 60_000;
const tokens = new Map<string, number>();

function createToken(): string {
  const token = randomUUID();
  tokens.set(token, Date.now() + TOKEN_TTL_MS);
  return token;
}

function isTokenValid(token: string | undefined): boolean {
  if (!token) return false;
  const expiresAt = tokens.get(token);
  if (expiresAt === undefined) return false;
  if (Date.now() > expiresAt) {
    tokens.delete(token);
    return false;
  }
  return true;
}

function extractBearerToken(req: IncomingMessage): string | undefined {
  const auth = req.headers['authorization'];
  if (!auth?.startsWith('Bearer ')) return undefined;
  return auth.slice(7);
}

function setCorsHeaders(res: ServerResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
}

function handleSSE(req: IncomingMessage, res: ServerResponse) {
  const token = extractBearerToken(req);
  if (!isTokenValid(token)) {
    setCorsHeaders(res);
    res.writeHead(401, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Unauthorized' }));
    return;
  }

  console.log('Client connected');

  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
    'Access-Control-Allow-Origin': '*',
  });

  res.write('retry: 3000\n\n');

  const expiresAt = tokens.get(token ?? '');
  const remainingMs = (expiresAt ?? 0) - Date.now();

  const send = () => {
    const quote = quotes[id % quotes.length];
    id++;
    const payload = JSON.stringify({
      id,
      text: quote,
      ts: new Date().toISOString(),
    });
    res.write(`id: ${id}\nevent: quote\ndata: ${payload}\n\n`);
    console.log(`Sent event #${id}`);
  };

  send();
  const interval = setInterval(send, 20_000);

  const expiry = setTimeout(() => {
    console.log('Token expired, closing stream');
    clearInterval(interval);
    res.end();
  }, remainingMs);

  req.on('close', () => {
    clearInterval(interval);
    clearTimeout(expiry);
    console.log('Client disconnected');
  });
}

function handleAuth(_req: IncomingMessage, res: ServerResponse) {
  setCorsHeaders(res);
  const token = createToken();
  console.log(`Auth: issued token ${token.slice(0, 8)}...`);
  res.writeHead(200, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ token }));
}

function handleRefresh(_req: IncomingMessage, res: ServerResponse) {
  setCorsHeaders(res);
  const token = createToken();
  console.log(`Refresh: issued token ${token.slice(0, 8)}...`);
  res.writeHead(200, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ token }));
}

const server = createServer((req, res) => {
  if (req.method === 'OPTIONS') {
    setCorsHeaders(res);
    res.writeHead(204);
    res.end();
    return;
  }

  if (req.url === '/auth' && req.method === 'POST') {
    handleAuth(req, res);
    return;
  }

  if (req.url === '/refresh' && req.method === 'POST') {
    handleRefresh(req, res);
    return;
  }

  if (req.url === '/events') {
    handleSSE(req, res);
    return;
  }

  res.writeHead(404);
  res.end();
});

const port = Number(process.env.PORT) || 3001;
server.listen(port, () => {
  console.log(`SSE server running on http://localhost:${port}`);
  console.log(`  POST /auth    - get a token (60s TTL)`);
  console.log(`  POST /refresh - refresh token (60s TTL)`);
  console.log(`  GET  /events  - SSE stream (requires Bearer token)`);
});
