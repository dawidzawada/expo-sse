# Contributing

Contributions are welcome! Please read the [Code of Conduct](./CODE_OF_CONDUCT.md) before contributing.

## Monorepo structure

```
expo-sse/
├── packages/
│   └── expo-sse/          # Library package (published to npm)
├── apps/
│   ├── example/           # Expo example app
│   └── server/            # Mock SSE server for testing
├── jest.config.js         # Jest configuration
├── turbo.json             # Turborepo configuration
└── package.json           # Root workspace configuration
```

## Prerequisites

- [Bun](https://bun.sh/) >= 1.0.0
- [Node.js](https://nodejs.org/) >= 18

## Getting started

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

## Available scripts

| Command                | Description                  |
| ---------------------- | ---------------------------- |
| `bun run dev`          | Start development mode       |
| `bun run build`        | Build all packages           |
| `bun run test`         | Run tests                    |
| `bun run test:ci`      | Run tests with coverage      |
| `bun run lint`         | Lint all packages            |
| `bun run format`       | Format code with Prettier    |
| `bun run format:check` | Check code formatting        |
| `bun run typecheck`    | Run TypeScript type checking |
| `bun run clean`        | Clean all build artifacts    |
| `bun run release`      | Release the library          |

## Commit convention

This project follows [Conventional Commits](https://www.conventionalcommits.org/). Commit messages are linted using commitlint.

```
feat: add new feature
fix: resolve bug
docs: update documentation
chore: maintenance task
test: add or update tests
refactor: code refactor
```

## Release

Publishing is handled by [release-it](https://github.com/release-it/release-it):

```bash
bun run release
```

This bumps the version, creates a git tag, publishes to npm, and creates a GitHub release.

## Pull requests

- Keep PRs small and focused on one change.
- Make sure linting and tests pass (`bun run lint && bun run test`).
- For changes to the API or architecture, open an issue first to discuss.
- Follow the commit convention above.
