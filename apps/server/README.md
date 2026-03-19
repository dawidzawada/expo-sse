# Mock Server

Node HTTP server for testing the example app. Issues UUID tokens with a 60s TTL and streams SSE quotes every 20s.

## Running

```bash
cd apps/server && bun run dev
```

Runs on `http://localhost:3001` by default (override with `PORT` env var).

## Endpoints

| Method | Path       | Description                                  |
| ------ | ---------- | -------------------------------------------- |
| POST   | `/auth`    | Returns a new token (60s TTL)                |
| POST   | `/refresh` | Returns a refreshed token (60s TTL)          |
| GET    | `/events`  | SSE stream (requires `Authorization: Bearer` header) |
