# expo-sse

Monorepo for `@dawidzawada/expo-sse` — a Server-Sent Events (SSE) client for Expo/React Native.

## Structure

```
expo-sse/
├── packages/
│   └── expo-sse/       # Library package
├── apps/
│   └── example/        # Expo example app
├── turbo.json          # Turborepo configuration
└── package.json        # Root workspace configuration
```

## Development

### Prerequisites

- [Bun](https://bun.sh/) >= 1.0.0
- [Node.js](https://nodejs.org/) >= 18

### Getting Started

```bash
# Install dependencies
bun install

# Build the library
bun run build

# Run tests
bun run test

# Start the example app
cd apps/example && bun run dev
```

### Available Scripts

| Command | Description |
|---------|-------------|
| `bun run dev` | Start development mode |
| `bun run build` | Build all packages |
| `bun run test` | Run tests |
| `bun run test:ci` | Run tests with coverage |
| `bun run lint` | Lint all packages |
| `bun run format` | Format code with Prettier |
| `bun run format:check` | Check code formatting |
| `bun run typecheck` | Run TypeScript type checking |
| `bun run clean` | Clean all build artifacts |
| `bun run release` | Release the library |

### Commit Convention

This project follows [Conventional Commits](https://www.conventionalcommits.org/). Commit messages are linted using commitlint.

```
feat: add new feature
fix: resolve bug
docs: update documentation
chore: maintenance task
```

## License

MIT
