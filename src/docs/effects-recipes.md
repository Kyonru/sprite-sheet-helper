---
title: Effects Recipes
---

The Effects Workbench is built around a stack. Effects render from top to bottom, so broad lighting and color correction usually work best before stylized finishing passes.

## Presets

- **Pixel Art** — Pixelation, reduced color depth, dither, and gamma correction.
- **Toon** — Outline plus light contrast and gamma cleanup.
- **Line Art** — EdgeOutline or Selection Outline with contrast and gamma cleanup.
- **Game Boy** — Pixelation, palette mapping, dither, and scanlines.

Use **Apply** to append a preset to your current stack. Use **Replace** when you want the preset to become the whole stack.

## Stack Order

1. Lighting and depth effects: SSAO, Bloom, Depth of Field.
2. Color shaping: Brightness / Contrast, Hue / Saturation, Tonemap, Gamma.
3. Stylization: Pixelation, Palette, Dither, Scanline, ASCII, Glitch.
4. Line and overlay effects: EdgeOutline, Selection Outline, Silhouette Outline, Grid, Custom Shader.

## Normal Map Safety

Post-processing affects color captures only. Normal maps use a clean geometry normal pass, so effects like Bloom, Pixelation, and Tonemap do not alter `spritesheet_normal.png`.

## Reproducible Captures

Avoid or freeze temporal effects when comparing workflow output:

- Glitch
- Noise
- Smear / Motion Blur
- Animated Scanline
- Shockwave

For golden workflow tests, prefer static color, lighting, outline, palette, and pixelation effects. Avoid removed or debug-only effects in production presets.
