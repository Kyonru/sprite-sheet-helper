---
name: ssh-update-docs-ci
description: Guide Sprite Sheet Helper documentation, Zensical site, in-app docs search, README, Docker, Railway, GitHub Action, and CI guidance. Use when Codex updates src/docs, docs symlinks, docs build/check scripts, docker files, action metadata, CLI documentation, release automation, or maintaining this skill after docs/CI changes.
---

# SSH Update Docs CI

## Workflow

Read `references/docs-ci-map.md` before changing docs, README CLI tables, Zensical site files, docs symlinks, Docker packaging, Railway config, GitHub Action metadata, or CI guidance.

Keep docs single-sourced:

- Edit product docs in `src/docs`.
- Keep `docs/*.md` as symlinks back to matching `src/docs` pages, except `docs/index.md`.
- Reflect CLI option changes in README and docs when user-facing flags or defaults change.
- Keep Docker and action examples aligned with the real CLI command surface.

## Self-Maintenance

When repo exploration shows this skill's files, invariants, commands, or reference map are stale, update this skill in the same change. Keep `SKILL.md` concise and move project maps or checklists into `references/docs-ci-map.md`.

Update `agents/openai.yaml` only when the display name, short description, or default prompt no longer matches the skill. Validate skill edits with the TODO scan, `git diff --check`, and `quick_validate.py` when PyYAML is available.

## Implementation Notes

Prefer concise task-focused docs with commands that can be copied as-is. Mention platform caveats only where they affect a workflow.

Run `npm run docs:check` for documentation structure changes. Use targeted build or CLI checks when docs describe changed executable behavior.
