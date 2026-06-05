---
title: CI, Docker, and GitHub Actions
---

# CI, Docker, and GitHub Actions

Sprite Sheet Helper can run in automation through the headless CLI, the Docker image, or the GitHub Action. These paths use the same export engine as the app.

## Docker

Use the GHCR image when you want CI or local automation without installing Node, Chromium, or app dependencies:

```bash
docker run --rm \
  -v "$PWD:/work" \
  ghcr.io/kyonru/sprite-sheet-helper:v0 \
  /work/assets/hero.glb \
  --workflow topdown-4dir \
  --format spritesheet \
  --output /work/dist/sprites
```

For batch pipelines, keep a JSON config in your project:

```bash
docker run --rm \
  -v "$PWD:/work" \
  ghcr.io/kyonru/sprite-sheet-helper:v0 \
  --config /work/sprites.config.json \
  --writeSummary /work/dist/sprites-summary.json
```

## GitHub Action

Use the Docker-based action when you want a small workflow step:

```yaml
- name: Generate sprites
  uses: Kyonru/sprite-sheet-helper/action@v0
  with:
    input: assets/hero.glb
    output: dist/sprites
    workflow: topdown-4dir
    format: spritesheet
```

For asset pipelines, prefer a checked-in config file and upload the generated output:

```yaml
- name: Generate sprite batch
  id: sprites
  uses: Kyonru/sprite-sheet-helper/action@v0
  with:
    config: sprites.config.json
    fail-on-warnings: "true"

- name: Upload sprites
  uses: actions/upload-artifact@v6
  with:
    name: sprites
    path: dist/sprites/
```

The action outputs `status`, `summary-json`, `files`, `warnings`, and `elapsed-ms`.

## GitHub Pages Docs

The documentation site is built with Zensical from the root `docs` directory. Pages in `docs` mirror the app documentation from `src/docs` with symlinks.

```bash
python -m pip install -r requirements.txt
npm run docs:check
```

The docs workflow builds on pull requests and publishes `site/` to GitHub Pages from `main`.

## Testing Workflows Locally With act

Users can use [`act`](https://github.com/nektos/act) for local smoke-testing. It reads workflows from `.github/workflows` and runs jobs through Docker, which makes it a good fit for the Docker-based Sprite Sheet Helper action.

Recommended commands:

```bash
act -j build-docs
act -j docker-smoke
```

On Apple Silicon, add an explicit architecture if the runner image or Docker action needs `amd64`:

```bash
act --container-architecture linux/amd64 -j docker-smoke
```

`act` is useful for fast local feedback, but it is not a complete replacement for GitHub-hosted Actions. Verify GHCR publishing, GitHub Pages deployment, token permissions, and release tagging on GitHub Actions itself.
