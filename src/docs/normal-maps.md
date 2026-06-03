---
title: Normal Map Export
---

Normal maps are optional camera-space captures that pair with the color spritesheet atlas.

## Capture Rules

- Turn on **Capture normal maps** before recording or adding frames.
- Existing color-only frames do not gain real normals after the toggle is enabled.
- Missing normals export as transparent placeholders so atlas layout stays aligned.

## Export Output

Atlas-style exporters include `spritesheet_normal.png` when normal maps are requested. Multi-page generic spritesheets use `spritesheet_normal.png`, `spritesheet_normal_2.png`, and so on.

`spritesheet.json` keeps the same quads for color and normal images. `spritesheet.manifest.json` lists matching color and normal page references.

## Effects Behavior

Post-processing affects the color capture path only. Normal maps bypass effects, lights, and stylized rendering so the normal atlas stays useful for engine lighting.

## Common Warnings

- **Ready** means every color frame has a matching normal frame.
- **Partial** means some frames will use transparent placeholders.
- **Missing** means the normal atlas will be transparent unless you recapture with normal capture enabled.
