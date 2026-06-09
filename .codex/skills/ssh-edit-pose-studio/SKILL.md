---
name: ssh-edit-pose-studio
description: Guide Sprite Sheet Helper Pose Studio, camera animation capture, MediaPipe retargeting, FK/IK pose editing, quality markers, and authored clip save changes. Use when Codex works on src/components/pose-studio, src/components/camera-animation-capture, pose utilities, bone remapping, pose IK, pose tests, or maintaining this skill after pose workflow changes.
---

# SSH Edit Pose Studio

## Workflow

Read `references/pose-studio-map.md` before changing camera capture, Pose Studio UI, pose review tools, bone remapping, retargeting, FK/IK editing, quality markers, or authored animation save paths.

Keep capture, review, edit, and save as one pipeline:

- MediaPipe/camera capture produces pose frames.
- Review and Pose Studio utilities transform drafts and quality markers.
- Saved clips should continue through the existing authored model and animation clip path unless a schema change is explicitly requested.
- Prefer pure pose utilities for math and frame transforms; keep React components focused on interaction state.

## Self-Maintenance

When repo exploration shows this skill's files, invariants, commands, or reference map are stale, update this skill in the same change. Keep `SKILL.md` concise and move project maps or checklists into `references/pose-studio-map.md`.

Update `agents/openai.yaml` only when the display name, short description, or default prompt no longer matches the skill. Validate skill edits with the TODO scan, `git diff --check`, and `quick_validate.py` when PyYAML is available.

## Implementation Notes

Be careful with frame indices and trimming. Any delete, trim, bake, or reorder operation must keep overrides and quality markers aligned.

Use unit tests for pose math, reducer behavior, marker shifting, bone mapping, IK fallback, and clip generation. Add manual or e2e checks only when browser camera, MediaPipe loading, or viewport interaction changes.
