---
title: Reproducible Workflows
---

Auto-capture workflows should produce repeatable atlas output when the model, camera, effects, and export settings are fixed.

## Stable Setup

1. Use a fixed workflow preset and frame count.
2. Keep frame width, height, FPS, camera distance, and atlas settings fixed.
3. Avoid animated or random-looking effects while generating golden outputs.
4. Export with normal maps enabled when the test expects `spritesheet_normal.png`.

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
