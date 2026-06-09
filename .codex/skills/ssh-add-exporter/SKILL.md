---
name: ssh-add-exporter
description: Guide Sprite Sheet Helper exporter, CLI format, workflow preset, atlas layout, normal-map export, and headless capture changes. Use when Codex works on src/utils/exports, cli/options.ts, cli/data.ts, workflow presets, export modal UI, exporter tests, CLI/e2e export behavior, or maintaining this skill after export architecture changes.
---

# SSH Add Exporter

## Workflow

Read `references/export-cli-map.md` before changing exporters, CLI flags, workflow presets, atlas options, normal-map behavior, or export tests.

Keep the app and CLI surfaces in sync:

- Update app format types and exporter registry together.
- Update CLI-local format/workflow lists because the CLI intentionally avoids importing from `src`.
- Preserve deterministic file names and metadata; tests often compare exact output names.
- Treat normal atlases, atlas manifests, page names, padding, bleed, scaling, and multi-page support as shared export contracts.

## Self-Maintenance

When repo exploration shows this skill's files, invariants, commands, or reference map are stale, update this skill in the same change. Keep `SKILL.md` concise and move project maps or checklists into `references/export-cli-map.md`.

Update `agents/openai.yaml` only when the display name, short description, or default prompt no longer matches the skill. Validate skill edits with the TODO scan, `git diff --check`, and `quick_validate.py` when PyYAML is available.

## Implementation Notes

Prefer small pure helpers for output metadata and atlas planning. Keep engine-specific exporters thin wrappers around shared atlas helpers unless that engine needs a different file shape.

When adding an export format, check the export modal, CLI parser/help, docs, and integration tests in the same change. Use targeted unit tests for file contents and e2e tests only when browser capture or CLI wiring changes.
