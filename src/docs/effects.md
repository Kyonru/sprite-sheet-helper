---
title: Post-Processing Effects
---

# Post-Processing Effects

The Effects tab lets you add real-time post-processing to the viewport. Effects are applied at export time, so what you see in the preview is what you get in your sprite sheet.

## Adding Effects

1. Open the **Effects** tab from the menu bar.
2. Click an effect to add it to the stack.
3. Adjust its parameters in the panel that appears.
4. Toggle effects on/off with the checkbox next to each one.

Effects are applied in order from top to bottom. Drag to reorder them.

## Available Effects

### Visual Style

| Effect      | Description                                   |
| ----------- | --------------------------------------------- |
| Pixelation  | Reduces resolution to create a pixel art look |
| ASCII       | Renders the scene as ASCII characters         |
| Dither      | Applies a dithering pattern for a retro look  |
| Sepia       | Warm sepia tone                               |
| Color Depth | Reduces the color palette                     |
| Palette     | Remaps colors to a custom palette             |

### Light & Color

| Effect              | Description                             |
| ------------------- | --------------------------------------- |
| Bloom               | Glowing halo around bright areas        |
| Brightness/Contrast | Adjust overall brightness and contrast  |
| Hue/Saturation      | Shift hue and saturation                |
| Color Average       | Averages colors for a washed-out effect |
| Vignette            | Dark edges around the frame             |
| Gamma Correction    | Adjust gamma curve                      |
| Tonemap             | HDR tone mapping                        |

### Depth & Focus

| Effect              | Description                                              |
| ------------------- | -------------------------------------------------------- |
| Depth of Field      | Blur objects outside the focal plane                     |
| Tilt Shift          | Miniature/tilt-shift blur effect                         |
| Bokeh               | Lens bokeh blur                                          |
| SSAO                | Ambient occlusion — darkens crevices and contact shadows |
| Depth Visualization | Debug view showing depth buffer                          |

### Anti-Aliasing

| Effect | Description                              |
| ------ | ---------------------------------------- |
| SMAA   | High-quality morphological anti-aliasing |
| FXAA   | Fast approximate anti-aliasing           |

### Distortion & Noise

| Effect               | Description                                   |
| -------------------- | --------------------------------------------- |
| Glitch               | Random glitch / corruption artifacts          |
| Chromatic Aberration | RGB channel offset for a lens aberration look |
| Noise                | Film grain / noise overlay                    |
| Shockwave            | Ripple distortion emanating from a point      |
| Scanline             | Horizontal scanline overlay                   |
| Dot Screen           | Halftone dot screen overlay                   |
| Grid                 | Overlay a grid on the scene                   |

### Advanced

| Effect        | Description                         |
| ------------- | ----------------------------------- |
| Outline       | Draws outlines around objects       |
| Custom Shader | Write your own GLSL fragment shader |

## Custom Shader

The **Custom Shader** effect lets you write a GLSL fragment shader applied as a full-screen post-process pass.

```glsl
uniform sampler2D tDiffuse;
varying vec2 vUv;

void main() {
  vec4 color = texture2D(tDiffuse, vUv);
  // Invert colors example
  gl_FragColor = vec4(1.0 - color.rgb, color.a);
}
```

## Tips

- **SMAA** is recommended over **FXAA** for final exports — it produces cleaner edges.
- **SSAO** adds subtle contact shadows that give 3D models more grounding without needing extra lights.
- **Pixelation** + **Color Depth** together create a strong retro pixel art look.
- Effects have a performance cost in the preview. Disable heavy effects while setting up your scene, then re-enable before exporting.
