---
name: ssh-build-app-ui
description: Guide Sprite Sheet Helper React/Tauri editor UI, shadcn/Radix controls, Tailwind layout, lucide icons, Three/R3F scene controls, and web/Tauri file behavior. Use when Codex builds or changes app panels, modals, toolbars, viewport UI, scene components, platform-specific web/tauri modules, or maintaining this skill after UI architecture changes.
---

# SSH Build App UI

## Workflow

Read `references/ui-scene-map.md` before changing editor panels, modals, top menus, viewport tools, shared scene state, Three/R3F components, or web/Tauri file abstractions.

Match the existing product feel:

- Build dense editor surfaces, not landing pages.
- Use existing `src/components/ui` primitives, Radix patterns, lucide icons, and Tailwind utilities.
- Keep controls discoverable with labels or accessible names; use icon buttons for familiar tool actions.
- Respect web/Tauri split modules and the `WebTauriSwapPlugin` naming convention.

## Self-Maintenance

When repo exploration shows this skill's files, invariants, commands, or reference map are stale, update this skill in the same change. Keep `SKILL.md` concise and move project maps or checklists into `references/ui-scene-map.md`.

Update `agents/openai.yaml` only when the display name, short description, or default prompt no longer matches the skill. Validate skill edits with the TODO scan, `git diff --check`, and `quick_validate.py` when PyYAML is available.

## Implementation Notes

For scene work, keep long-lived render state in shared context or stores rather than ad hoc component locals. For UI work, preserve responsive sizing and avoid text overflow in toolbars, panels, cards, and dialogs.

Verify with typecheck and lint for most UI changes. Use a local dev server plus browser inspection for visual, canvas, drag/drop, or viewport interaction changes.
