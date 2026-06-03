---
title: Pose Studio
---

Pose Studio turns a photo, video, or camera input into editable pose or motion clips for the selected model.

## Recommended Flow

1. Load and select a rigged character.
2. Open **Pose > Open Pose Studio** or use **Create Pose / Motion Clip** from the animation panel.
3. Capture from Photo, Video, or Camera.
4. Check pose quality and bone mapping before editing.
5. Use FK or IK tools to repair posture.
6. Save the clip with a descriptive name.

## Editing Tips

- Use IK for large posture changes such as moving hands, feet, torso, or head.
- Use FK rotate or move for precise single-bone cleanup.
- Use undo/redo per gesture instead of trying to reset every slider manually.
- Compare the current pose against the captured source when checking edits.

## Mapping Checks

Good mapping should cover torso, head, both arms, and both legs. If a limb behaves strangely, check for duplicate mapped bones, missing end bones, or foot targets mapped to toe/finger bones instead of a stable foot bone.
