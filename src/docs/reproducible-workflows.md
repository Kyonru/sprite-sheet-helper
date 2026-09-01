---
title: Reproducible Workflows
---

Auto-capture workflows produce repeatable atlas output when the model, camera, effects, and export settings are fixed.

Capture seeks animation time rather than following the clock: frame *n* is the pose at `n × interval`, sought explicitly and rendered once the view has settled. The result does not depend on how fast the machine renders, so the same run produces the same pixels on a laptop and in CI. It also means the frame rate written into the manifest is the rate the frames were actually taken at.

## Stable Setup

1. Use a fixed workflow preset and frame count.
2. Keep frame width, height, FPS, camera distance, and atlas settings fixed.
3. Avoid animated or random-looking effects while generating golden outputs.
4. Export with normal maps enabled when the test expects `spritesheet_normal.png`.

## Frame Count And Clip Length

A capture window longer than the clip repeats poses that are already in the sheet; a shorter one drops the end of the motion. **Match clip length** in the workflow panel, or `--frames auto` on the CLI, takes the count from the clip itself. Export validation warns about any sequence whose frames repeat, so an overrun is visible before it is packed.

## Effects To Treat Carefully

These effects can change frame output over time:

- Glitch
- Noise
- Smear / Motion Blur
- Scanline with motion
- Shockwave

For deterministic workflow tests, prefer static effects such as Pixelation, Palette, Color Depth, Gamma Correction, Outline, or Grid.

## Golden Suitcase

Workflow golden references live under `tests/suitcase/workflows`. Run the update command only when an atlas change is intentional, then inspect the PNGs and normalized JSON before committing.
