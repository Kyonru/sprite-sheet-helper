---
name: ssh-change-project-state
description: Guide Sprite Sheet Helper Zustand store, project snapshot, sshProj migration, undo/redo history, and serializable state changes. Use when Codex works on src/store/next, src/types/project.ts, history actions, hydrate/getSnapshot/reset, OPFS-backed assets, project migration tests, or maintaining this skill after state architecture changes.
---

# SSH Change Project State

## Workflow

Read `references/state-migrations-map.md` before changing stores, persisted project data, snapshot hydration, migrations, history actions, or OPFS-backed asset state.

Keep serializable state explicit:

- Each persisted store needs a stable `getSnapshot`, `hydrate`, and `reset` story.
- Runtime-only values such as `File`, object URLs, model load state, inventories, and generated previews should not leak into `.sshProj` snapshots unless the product intentionally persists them.
- Any saved snapshot shape change must update `src/types/project.ts`, `CURRENT_VERSION`, `src/store/next/project/migration.ts`, and migration tests.
- Preserve undo/redo semantics when a UI action mutates state.

## Self-Maintenance

When repo exploration shows this skill's files, invariants, commands, or reference map are stale, update this skill in the same change. Keep `SKILL.md` concise and move project maps or checklists into `references/state-migrations-map.md`.

Update `agents/openai.yaml` only when the display name, short description, or default prompt no longer matches the skill. Validate skill edits with the TODO scan, `git diff --check`, and `quick_validate.py` when PyYAML is available.

## Implementation Notes

Follow the existing Zustand store style in `src/store/next`. Keep migrations additive and tolerant of missing fields from older projects.

For asset-backed state, update both project zip bundling and snapshot hydration paths. Verify with unit tests first; use integration tests when saved projects, OPFS files, or exporters consume the new state.
