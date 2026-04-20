---
title: Animations
---

# Animations

If your 3D model contains embedded animation clips, you can play, trim, and configure them before exporting.

## Loading Animations

Animations are loaded automatically when you import a model that contains them. Supported formats with animation:

- `.glb` / `.gltf` — Full animation support.
- `.fbx` — Animation support (quality depends on the exporter).
- `.obj` — No animation support.

## Per-Clip Settings

Select an animation clip to configure it:

| Setting          | Description                                             |
| ---------------- | ------------------------------------------------------- |
| Speed            | Multiplier on playback speed (0.5 = half, 2.0 = double) |
| Loop Mode        | Loop Once, Loop Repeat, or Ping Pong                    |
| Trim Start / End | Cut frames from the beginning or end of the clip        |
| Duration         | Total duration of the clip in seconds                   |

## Exporting Animations

When you export, all frames from the selected animation are captured in sequence. The export panel shows the total frame count based on your FPS setting and animation duration.

For multi-animation exports (e.g. idle + walk + run in one sprite sheet), use **Workflows** to automatically batch all clips across multiple camera angles. See the [Workflows](workflows) doc.

## Tips

- Keep animation clips short and named clearly in your 3D tool — names carry through to the exported metadata.
- Use **Ping Pong** loop mode for symmetrical animations (breathing, hovering) to halve the frame count.
- **Trim** the first and last frame if your 3D tool adds a hold frame at the loop boundaries.
