---
title: Post-Processing Effects
---

The Effects tab lets you add real-time post-processing to the viewport. Effects are applied at export time, so what you see in the preview is what you get in your sprite sheet.

## Adding Effects

1. Open the **Effects** tab from the menu bar.
2. Click an effect to add it to the stack.
3. Adjust its parameters in the panel that appears.
4. Toggle effects on/off with the checkbox next to each one.

Effects are applied in order from top to bottom. Drag to reorder them.

### Blend Function

Most effects expose a **Blend Function** parameter that controls how the effect composites over the scene. Common values:

| Value    | Description                              |
| -------- | ---------------------------------------- |
| NORMAL   | Replaces the scene with the effect       |
| ADD      | Adds the effect on top (brightens)       |
| MULTIPLY | Multiplies — darkens the scene           |
| SCREEN   | Screen blend — brightens highlights      |
| OVERLAY  | High-contrast mix of multiply and screen |
| SKIP     | Disables blending (effect is invisible)  |

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
| Tilt Shift          | Miniature/tilt-shift blur using a lens-based algorithm   |
| Tilt Shift 2        | Tilt-shift blur using a directional sample-based pass    |
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

### Motion

| Effect              | Description                                            |
| ------------------- | ------------------------------------------------------ |
| Smear / Motion Blur | Blends each frame with a decaying trail of past frames |

### Advanced

| Effect        | Description                         |
| ------------- | ----------------------------------- |
| Outline       | Draws outlines around objects       |
| Custom Shader | Write your own GLSL fragment shader |

## Effect Parameters

### Pixelation

Simulates a lower-resolution image by grouping neighboring pixels into larger blocks, creating a retro, blocky appearance often seen in old-school games or censored visuals.

| Parameter   | Description                                          |
| ----------- | ---------------------------------------------------- |
| Granularity | Pixel block size in screen pixels. Higher = blockier |

### ASCII

Converts the image into a grid of characters by mapping pixel brightness (or color) to a set of ASCII symbols, producing a stylized, text-based rendering of the scene.

| Parameter      | Description                                         |
| -------------- | --------------------------------------------------- |
| Characters     | String of characters used to represent pixel values |
| Invert         | Invert the brightness mapping                       |
| Font           | Font family for the ASCII characters                |
| Font Size      | Size of the font in pixels                          |
| Cell Size      | Size of each character cell                         |
| Color          | Color of the characters                             |
| Blend Function | How the effect composites over the scene            |

### Dither

Applies a patterned noise to simulate additional shades using a limited color palette, creating a classic retro rendering similar to old displays and early game graphics.

| Parameter       | Description                        |
| --------------- | ---------------------------------- |
| Dither Strength | Intensity of the dithering pattern |
| Dither Scale    | Scale of the dithering pattern     |

### Sepia

Applies a warm brown tint to the image, mimicking the look of aged photographs and giving the scene a nostalgic, vintage feel.

| Parameter      | Description                              |
| -------------- | ---------------------------------------- |
| Intensity      | Strength of the sepia tint (0–1)         |
| Blend Function | How the effect composites over the scene |

### Color Depth

Reduces the number of available colors by limiting bits per channel, producing a posterized, banded look reminiscent of older hardware and low-color displays.

| Parameter      | Description                                      |
| -------------- | ------------------------------------------------ |
| Bits           | Number of bits per channel. Lower = fewer colors |
| Blend Function | How the effect composites over the scene         |

### Palette

Remaps all colors in the image to the closest match from a predefined palette, creating a cohesive, stylized look often used to emulate specific hardware or artistic color schemes.

| Parameter | Description                   |
| --------- | ----------------------------- |
| Palette   | Index of the built-in palette |

### Bloom

Adds a soft glow that spreads from bright areas by blurring and re-blending high-luminance pixels, enhancing highlights and creating a more cinematic or dreamy look.

| Parameter           | Description                                      |
| ------------------- | ------------------------------------------------ |
| Blend Function      | How the bloom composites over the scene          |
| Luminance Threshold | Minimum brightness for pixels to glow (0–1)      |
| Luminance Smoothing | Softness of the threshold edge (0–1)             |
| Intensity           | Overall bloom strength                           |
| Mipmap Blur         | Use mipmap chain for a smoother, wider bloom     |
| Levels              | Number of blur passes. More = softer, wider glow |
| Radius              | Spread radius of the bloom                       |

### Brightness / Contrast

Adjusts overall exposure and tonal range, making the image brighter or darker while expanding or compressing the difference between light and dark areas.

| Parameter      | Description                              |
| -------------- | ---------------------------------------- |
| Brightness     | Additive brightness offset (-1 to 1)     |
| Contrast       | Contrast multiplier (-1 to 1)            |
| Blend Function | How the effect composites over the scene |

### Hue / Saturation

Shifts overall color tones and intensity, allowing full hue rotation and control over how vivid or muted the image appears.

| Parameter      | Description                              |
| -------------- | ---------------------------------------- |
| Hue            | Hue rotation in degrees (-180 to 180)    |
| Saturation     | Saturation offset (-1 to 1)              |
| Blend Function | How the effect composites over the scene |

### Color Average

Flattens the image by blending colors toward a shared average, reducing visual complexity and creating a washed, unified look.

| Parameter      | Description                              |
| -------------- | ---------------------------------------- |
| Blend Function | How the effect composites over the scene |

### Vignette

Darkens or tints the image toward the edges to naturally draw focus toward the center, simulating lens falloff or cinematic framing.

| Parameter | Description                                        |
| --------- | -------------------------------------------------- |
| Offset    | Distance from center where darkening begins (0–1)  |
| Darkness  | Strength of the dark edges (0–1)                   |
| Technique | `DEFAULT` (smooth) or `ESKIL` (procedural falloff) |

### Gamma Correction

Adjusts midtone brightness using a nonlinear curve, correcting how luminance is perceived on different displays and controlling overall image “weight.”

| Parameter      | Description                                     |
| -------------- | ----------------------------------------------- |
| Gamma          | Gamma exponent. Values < 1 brighten; > 1 darken |
| Blend Function | How the effect composites over the scene        |

### Tonemap

Converts HDR values into displayable colors, controlling exposure, contrast, and highlight rolloff to produce a visually balanced final image.

| Parameter         | Description                                          |
| ----------------- | ---------------------------------------------------- |
| Blend Function    | How the effect composites over the scene             |
| Mode              | Tone mapping algorithm (REINHARD, CINEON, ACES, …)   |
| Adaptive          | Adapt exposure based on average scene luminance      |
| White Point       | Reference white luminance for the tone curve         |
| Min Luminance     | Minimum exposure luminance clamp                     |
| Max Luminance     | Maximum luminance before clipping                    |
| Average Luminance | Manual average luminance (used when Adaptive is off) |
| Middle Grey       | Target middle grey value for exposure                |
| Adaptation Rate   | Speed of adaptive exposure adjustment                |
| Resolution        | Resolution of the luminance measurement buffer       |

### Depth of Field

Simulates a camera lens blur by focusing on a specific depth plane while blurring objects closer or farther away, adding realistic depth and cinematic focus control.

| Parameter            | Description                                          |
| -------------------- | ---------------------------------------------------- |
| Blend Function       | How the effect composites over the scene             |
| Focus Distance       | Normalized distance to the focal plane (0–1)         |
| Focus Range          | Normalized depth range that stays in focus           |
| World Focus Distance | Focus distance in world units (overrides normalized) |
| World Focus Range    | Focus range in world units                           |
| Bokeh Scale          | Size of out-of-focus bokeh circles                   |
| Resolution Scale     | Internal render resolution relative to viewport      |
| Resolution X/Y       | Explicit internal resolution in pixels (0 = auto)    |

### Tilt Shift

Applies a band of sharp focus with blurred areas above and below, mimicking miniature photography or selective plane-of-focus effects.

| Parameter        | Description                                             |
| ---------------- | ------------------------------------------------------- |
| Blend Function   | How the effect composites over the scene                |
| Offset           | Position of the in-focus band along the tilt axis (0–1) |
| Rotation         | Angle of the tilt axis in radians                       |
| Focus Area       | Width of the sharp in-focus band (0–1)                  |
| Feather          | Softness of the focus band edges (0–1)                  |
| Kernel Size      | Blur kernel size. Larger = softer but slower            |
| Resolution Scale | Internal render resolution relative to viewport         |
| Resolution X/Y   | Explicit internal resolution in pixels (0 = auto)       |

### Tilt Shift 2

A more flexible directional tilt-shift implementation that defines focus using a line segment and customizable blur behavior.

| Parameter      | Description                                                  |
| -------------- | ------------------------------------------------------------ |
| Blend Function | How the effect composites over the scene                     |
| Blur           | Blur strength                                                |
| Taper          | How quickly the blur tapers off toward the center            |
| Start          | Start point of the in-focus strip `[x, y]` in UV space (0–1) |
| End            | End point of the in-focus strip `[x, y]` in UV space (0–1)   |
| Samples        | Number of samples per pixel. More = smoother but slower      |
| Direction      | Blur direction vector `[x, y]`                               |

### Bokeh

Renders out-of-focus highlights as soft, lens-shaped light artifacts, simulating real camera aperture behavior.

| Parameter      | Description                                   |
| -------------- | --------------------------------------------- |
| Blend Function | How the effect composites over the scene      |
| Focus          | Depth at which the lens focuses (0–1)         |
| DoF            | Depth-of-field range around the focus         |
| Aperture       | Simulated aperture size — affects blur amount |
| Max Blur       | Maximum blur radius in pixels                 |

### SSAO

Enhances depth perception by darkening areas where geometry is close together, simulating soft ambient occlusion in crevices and contact points.

| Parameter                 | Description                                               |
| ------------------------- | --------------------------------------------------------- |
| Blend Function            | How the effect composites over the scene                  |
| Depth-Aware Upsampling    | Improve edge quality when rendering at reduced resolution |
| Samples                   | Number of occlusion samples per pixel                     |
| Rings                     | Number of sample rings                                    |
| World Distance Threshold  | Max world-space distance that can occlude a point         |
| World Distance Falloff    | Falloff over the distance threshold                       |
| World Proximity Threshold | Min world-space distance before occlusion starts          |
| World Proximity Falloff   | Falloff over the proximity threshold                      |
| Min Radius Scale          | Minimum sample radius scale                               |
| Luminance Influence       | How much surface brightness reduces occlusion (0–1)       |
| Radius                    | Occlusion sample hemisphere radius                        |
| Intensity                 | Strength of the darkening effect                          |
| Bias                      | Depth bias to reduce self-occlusion artifacts             |
| Fade                      | Fade distance for the occlusion effect                    |
| Color                     | Tint color for occluded areas                             |
| Resolution Scale          | Internal render resolution relative to viewport           |
| Resolution X/Y            | Explicit internal resolution in pixels (0 = auto)         |

### Depth Visualization

Debug visualization that maps scene depth to grayscale, useful for inspecting depth buffers and focus behavior.

| Parameter      | Description                                          |
| -------------- | ---------------------------------------------------- |
| Inverted       | Invert the depth gradient (near = dark, far = light) |
| Blend Function | How the effect composites over the scene             |

### SMAA

High-quality anti-aliasing technique that reduces jagged edges using edge detection and pattern blending.

| Parameter           | Description                                               |
| ------------------- | --------------------------------------------------------- |
| Blend Function      | How the effect composites over the scene                  |
| Preset              | Quality preset: LOW, MEDIUM, HIGH, ULTRA                  |
| Edge Detection Mode | DEPTH (fast), LUMA (balanced), or COLOR (highest quality) |
| Predication Mode    | Use depth or color data to sharpen edge detection         |

### FXAA

Fast post-process anti-aliasing that smooths jagged edges with minimal performance cost.

| Parameter      | Description                              |
| -------------- | ---------------------------------------- |
| Blend Function | How the effect composites over the scene |

### Glitch

Creates digital distortion artifacts such as tearing, displacement, and randomized signal corruption.

| Parameter                   | Description                                                |
| --------------------------- | ---------------------------------------------------------- |
| Mode                        | SPORADIC (random) or CONSTANT (always active)              |
| Delay                       | Min/max time between glitch events `[min, max]` in seconds |
| Duration                    | Min/max duration of each glitch event `[min, max]`         |
| Strength                    | Min/max glitch displacement `[min, max]`                   |
| Chromatic Aberration Offset | Pixel offset added to chromatic aberration during glitch   |
| DT Size                     | Size of the noise texture used to drive the effect         |
| Columns                     | Number of horizontal glitch columns                        |
| Ratio                       | Ratio of columns that are displaced at once (0–1)          |

### Chromatic Aberration

Simulates lens distortion by offsetting color channels, producing RGB fringing especially noticeable toward image edges.

| Parameter         | Description                                    |
| ----------------- | ---------------------------------------------- |
| Radial Modulation | Increase aberration toward screen edges        |
| Modulation Offset | Inner radius where radial modulation begins    |
| Offset            | RGB channel offset vector `[x, y]` in UV space |
| Blend Function    | How the effect composites over the scene       |

### Noise

Adds film grain or sensor noise to break visual uniformity and create a more organic or analog feel.

| Parameter      | Description                                       |
| -------------- | ------------------------------------------------- |
| Premultiply    | Multiply noise by the scene color before blending |
| Blend Function | How the effect composites over the scene          |

### Shockwave

Creates a radial distortion ripple emanating from a point, simulating explosions or impact waves in the scene.

| Parameter      | Description                                            |
| -------------- | ------------------------------------------------------ |
| Blend Function | How the effect composites over the scene               |
| Speed          | Propagation speed of the ripple in units per second    |
| Position       | World-space origin of the shockwave `[x, y, z]`        |
| Max Radius     | Radius at which the wave disappears                    |
| Amplitude      | Peak distortion strength                               |
| Wavelength     | Spatial frequency of the wave (distance between peaks) |

### Scanline

Overlays horizontal lines to mimic CRT displays or retro screen rendering.

| Parameter      | Description                              |
| -------------- | ---------------------------------------- |
| Blend Function | How the effect composites over the scene |
| Density        | Lines per screen height                  |
| Scroll Speed   | Vertical scroll speed of the scanlines   |

### Dot Screen

Converts the image into a halftone pattern of dots, commonly used for print-style or retro comic aesthetics.

| Parameter      | Description                              |
| -------------- | ---------------------------------------- |
| Blend Function | How the effect composites over the scene |
| Angle          | Rotation angle of the dot grid           |
| Scale          | Size of the dots                         |

### Grid

Draws a uniform grid overlay across the scene, useful for debugging, alignment, or stylized UI effects.

| Parameter      | Description                              |
| -------------- | ---------------------------------------- |
| Blend Function | How the effect composites over the scene |
| Scale          | Spacing between grid lines               |
| Line Width     | Thickness of grid lines                  |

### Smear / Motion Blur

The **Smear** effect blends each rendered frame with a decaying afterimage of previous frames, producing a motion-blur smear trail. The trail builds up while the animation plays and clears when playback stops.

| Parameter | Description                                                   |
| --------- | ------------------------------------------------------------- |
| Damp      | Fraction of the previous frame retained per step (0–1)        |
| Tint      | Color tint applied to the trail                               |
| Legacy    | Alternate blend — only trails pixels above a brightness level |

> **Note:** Because Smear accumulates frames over time, it works best with looping animations. For still renders or single-frame exports the trail will not be visible.

### Outline

Draws stylized edges around objects by detecting depth and geometry boundaries, enhancing shape readability and enabling effects like toon shading or technical highlighting.

| Parameter          | Description                                              |
| ------------------ | -------------------------------------------------------- |
| Blend Function     | How the effect composites over the scene                 |
| Edge Strength      | Thickness and intensity of the outline                   |
| Pulse Speed        | Speed of a pulsing animation on the outline (0 = static) |
| Visible Edge Color | Color of outlines on visible edges                       |
| Hidden Edge Color  | Color of outlines on edges occluded by other objects     |
| Kernel Size        | Blur applied to the outline for anti-aliasing            |
| Blur               | Enable additional blur on the outline                    |
| X-Ray              | Show hidden edges through occluding geometry             |
| Multisampling      | MSAA sample count for edge quality                       |
| Resolution Scale   | Internal render resolution relative to viewport          |
| Resolution X/Y     | Explicit internal resolution in pixels (0 = auto)        |

### Custom Shader

Write a GLSL fragment shader applied as a full-screen post-process pass.

| Parameter       | Description                          |
| --------------- | ------------------------------------ |
| Fragment Shader | GLSL source code for the effect pass |

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

- **Use SMAA for export, FXAA only for previews.** FXAA is faster but can soften fine details; SMAA preserves shape clarity for final output.

- **Stack effects from “physical” to “stylized.”** Start with SSAO / Depth / Lighting effects, then apply color grading (Tonemap, Gamma), and finish with stylistic effects (Pixelation, ASCII, Glitch).

- **SSAO is most effective in tight geometry.** It shines in corners, joints, and overlapping meshes — reduce intensity if the scene already has strong directional lighting.

- **Pixelation works best when paired with Palette or Color Depth.** Without limiting colors, pixelation alone can look like a low-res image rather than a deliberate style.

- **Bloom + Tonemap should be tuned together.** If highlights look blown out, reduce bloom threshold or adjust tonemap white point instead of lowering bloom blindly.

- **Tilt Shift and Depth of Field should not compete.** Use one as the primary focus model — combining them often creates confusing or over-blurred depth separation.

- **Glitch and Chromatic Aberration are most effective in short bursts.** Keep intensity low for ambient use and reserve stronger settings for key moments or transitions.

## Recommended Stacks

### Retro Pixel Art

A classic low-resolution game look with limited color depth and crisp shapes.

- Pixelation (high Granularity)
- Color Depth (low Bits)
- Palette (optional, fixed palette)
- SMAA (optional, light smoothing)
- Vignette (subtle, optional)

**Use when:** you want Game Boy / SNES / indie pixel-art style renders.

---

### CRT Monitor

Simulates an old display with scanlines, slight noise, and chromatic imperfections.

- Scanline
- Chromatic Aberration (low)
- Noise
- Gamma Correction (slightly adjusted)
- Vignette (medium)
- Optional: Bloom (very subtle)

**Use when:** retro UI, cyberpunk scenes, emulator-style output.

---

### Cinematic Shot

A clean, film-like render with depth, lighting control, and subtle post-processing.

- Depth of Field
- SSAO
- Bloom (moderate threshold)
- Tonemap (ACES or Cineon)
- Vignette (soft)
- Gamma Correction (fine-tuned)

**Use when:** character renders, storytelling shots, trailers.

---

### Stylized Illustration

Flattened, artistic look with controlled color and shape emphasis.

- Color Depth
- Palette or Color Average
- Outline
- Dither (optional)
- Brightness / Contrast
- Hue / Saturation

**Use when:** illustration-style renders, concept art, UI visuals.

---

### Glitch / Cyber Breakdown

Digital corruption style for transitions or dramatic moments.

- Glitch
- Chromatic Aberration (high, animated if possible)
- Noise
- Scanline (optional)
- Shockwave (event-based)

**Use when:** UI transitions, damage effects, sci-fi corruption.

---

### Miniature / Tilt Focus

Makes scenes look like scale models or dioramas.

- Tilt Shift (or Tilt Shift 2)
- Depth of Field (low intensity or disabled)
- Vignette (light)
- SSAO (subtle)
- Bloom (very subtle)

**Use when:** world dioramas, playful or “toy-like” renders.

---

### Debug / Technical View

For inspection, layout, or development visualization.

- Depth Visualization
- Grid
- SSAO (optional, low)
- Outline (debug mode)
- FXAA (optional for clarity)

**Use when:** debugging scenes, aligning objects, verifying depth.
