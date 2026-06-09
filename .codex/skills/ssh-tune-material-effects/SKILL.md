---
name: ssh-tune-material-effects
description: Guide Sprite Sheet Helper materials, texture assets, retro texture generation, model downgrade visuals, post-processing effects, custom shaders, GLSL/Lua editors, and render-quality controls. Use when Codex works on material stores/types/constants, effects stores/constants/components, material runtime, shader editors, effect tests, or maintaining this skill after visual pipeline changes.
---

# SSH Tune Material Effects

## Workflow

Read `references/materials-effects-map.md` before changing materials, texture assets, material presets, generated retro textures, model downgrade visuals, post-processing effects, shader editors, or render-quality tests.

Keep visual state coherent:

- Material assets and assignments are persisted; inventories are runtime model inspection data.
- Texture files live outside JSON and must be saved, bundled, and restored through the project file path.
- Effects need matching type unions, defaults, store behavior, UI controls, and runtime application.
- Custom shaders should fail clearly and avoid breaking the rest of the effect chain.

## Self-Maintenance

When repo exploration shows this skill's files, invariants, commands, or reference map are stale, update this skill in the same change. Keep `SKILL.md` concise and move project maps or checklists into `references/materials-effects-map.md`.

Update `agents/openai.yaml` only when the display name, short description, or default prompt no longer matches the skill. Validate skill edits with the TODO scan, `git diff --check`, and `quick_validate.py` when PyYAML is available.

## Implementation Notes

Prefer shared conversion helpers for runtime Three.js material/effect creation. Keep UI controls bounded to valid ranges and defaults from constants.

Use unit tests for store snapshots, generated textures, effect defaults, exporter-visible metadata, and shader/editor helpers. Use visual inspection when changing renderer output or post-processing order.
