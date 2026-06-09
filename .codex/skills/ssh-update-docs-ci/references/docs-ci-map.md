# Docs and CI Map

## Core Surfaces

- In-app and product docs source: `src/docs/*.md`.
- Zensical site: `docs/index.md`, symlinked `docs/*.md`, `zensical.toml`.
- Symlink validator: `scripts/check-docs-symlinks.js`.
- README overview and CLI tables: `README.md`.
- Docker packaging: `docker/Dockerfile`, `docker/cli-entrypoint.sh`, `docker/action-entrypoint.sh`.
- GitHub Action: `action/action.yml`, `action/README.md`.
- Deployment config: `railway.toml`, `railpack.json`.
- Package scripts: `package.json`.

## Docs Rules

- Edit shared content in `src/docs`; keep `docs` pages as symlinks to those files.
- `docs/index.md` is the Zensical landing page and is not a symlink.
- When adding a new docs page, add the matching symlink in `docs` and ensure navigation/search can find it.
- Keep README CLI option tables aligned with `cli/options.ts`.
- Keep examples using real formats, workflow IDs, aliases, and defaults.

## CI and Packaging Rules

- Docker and action entrypoints should call the built CLI consistently.
- Keep examples volume-mounted around `/work` when documenting container use.
- Avoid documenting flags before parser support exists.
- If a command requires `npm run build:cli`, say so near the command.
- Keep release/download docs aligned with actual package outputs.

## Test Targets

- Docs structure: `npm run docs:check`.
- Docs preview/build: `npm run docs:serve`, `npm run docs:build`.
- CLI behavior behind docs: `npm run build:cli`, `npm run test:integration`, `npm run test:e2e`.
- Use `node scripts/check-docs-symlinks.js` for fast symlink-only validation.

## Maintenance Triggers

Update this map when docs source locations, Zensical config, symlink rules, package scripts, Docker files, action metadata, deployment config, or CLI documentation practices change. Remove stale paths promptly; future agents should be able to trust every path listed here.
