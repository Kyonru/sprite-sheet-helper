# Contributing to Sprite Sheet Helper

Thanks for your interest in contributing! Bug fixes, performance improvements, docs, and new features are all appreciated.

## Getting Started

### Prerequisites

- [Node.js](https://nodejs.org/) 22+ (LTS recommended)
- For the desktop app: [Rust toolchain](https://www.rust-lang.org/tools/install) and the [Tauri platform dependencies](https://tauri.app/start/prerequisites/)

### Setup

```bash
git clone https://github.com/Kyonru/sprite-sheet-helper.git
cd sprite-sheet-helper
npm install
```

### Running locally

| Command             | What it runs                                  |
| ------------------- | --------------------------------------------- |
| `npm run dev`       | Web app (Vite dev server, PWA features off)   |
| `npm run tauri dev` | Desktop app with hot reload                   |
| `npm run cli:local` | Build and run the CLI                         |
| `npm run docs:serve`| Documentation site                            |

## Project Layout

- `src/` — React app (web + desktop share this code)
- `src/store/next/` — zustand stores; project snapshots are versioned, see `src/store/next/project/migration.ts`
- `src/lib/cli-bridge.ts` + `tsconfig.cli.json` — headless CLI (Puppeteer)
- `src-tauri/` — Tauri desktop shell
- `packages/` — npm workspaces
- `src/docs/` — in-app documentation (also published to the docs site)
- `tests/` — `unit/`, `integration/`, `e2e/`

### Platform-specific code (`.web.ts` / `.tauri.ts`)

The app is web-first. When a feature needs a different native implementation, create a pair of files:

| File               | Used when                                         |
| ------------------ | ------------------------------------------------- |
| `feature.web.ts`   | Default — runs in the browser / web build         |
| `feature.tauri.ts` | Native override — runs in the Tauri desktop build |

Always import the `.web.ts` version — a Vite plugin (`WebTauriSwapPlugin`) swaps in the `.tauri.ts` counterpart for desktop builds. Never import `.tauri.*` files directly.

## Checks and Tests

Run these before opening a PR (CI runs all of them):

```bash
npm run typecheck
npm run lint
npm run test:unit
npm run test:integration
npm run build          # also runs on pre-push via husky
```

Slower suites, run when your change touches rendering or exports:

```bash
npm run test:e2e            # CLI + browser end-to-end (Puppeteer)
npm run test:e2e:goldens    # workflow reproducibility goldens
npm run test:coverage       # unit + integration with coverage report
```

If an intentional rendering change breaks the goldens, regenerate them with `npm run test:e2e:update-goldens` and explain the change in your PR.

## Pull Requests

1. Fork the repo and create a branch: `git checkout -b feature/your-feature-name`
2. Make your changes with clear, scoped commits (`feat: ...`, `fix: ...`)
3. Add or update tests for behavior changes
4. Update `CHANGELOG.md` under an Unreleased/upcoming section when the change is user-facing
5. Push and open a Pull Request against `main`

Please keep PRs focused — small, reviewable changes land faster.

## License

By contributing, you agree that your contributions will be licensed under the [MIT License](LICENSE).
