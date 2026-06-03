---
title: Troubleshooting
---

Use this page when an export, capture, pose, or effects setup does not behave as expected.

## Export Is Blocked

- Check the Export Preflight validation messages.
- Increase max atlas size if a page is too large.
- Disable multi-page output for engine exporters, or use the generic Sprite Sheet exporter.
- Capture at least one frame before preparing an export.

## Normal Atlas Is Empty

Turn on **Capture normal maps** before recording frames. If frames were captured before the toggle was enabled, recapture them or accept transparent placeholders.

## Effects Look Different During Export

Exports use the enabled effect stack in order. If output is unexpected, check stack order and use each effect's enable switch to compare the viewport with and without that effect.

## Workflow Output Changed

- Confirm workflow preset, frames, FPS, size, camera distance, and atlas settings.
- Disable temporal effects such as Glitch, Noise, Smear, animated Scanline, or Shockwave.
- Compare `spritesheet.png`, `spritesheet_normal.png`, and normalized `spritesheet.json`.

## Pose Looks Broken

Open Pose Studio mapping checks and verify torso, head, arm, and leg chains. If a hand or foot target moves oddly, remap the endpoint to a stable hand or foot bone instead of a finger or toe helper.
