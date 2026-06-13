---
title: Camera & Presets
---

The Camera tab gives you quick access to preset viewing angles commonly used in 2D game art, plus manual controls for fine-tuning.

## Camera Presets

Choose a preset that matches your game's perspective:

| Preset            | Elevation | Use Case                                   |
| ----------------- | --------- | ------------------------------------------ |
| Top-Down          | 90°       | Overhead view (dungeon crawlers, strategy) |
| Isometric         | 45°       | Classic isometric (RPGs, RTS)              |
| Isometric Reverse | 225°      | Opposite isometric angle                   |
| ¾ RPG             | 55°       | Action RPGs, Zelda-style                   |
| Dimetric          | 35°       | Dimetric projection                        |
| Side-Scroller     | 0°        | Platformers, fighting games                |
| Shooter           | Various   | First-person / shooter perspectives        |

## Camera Distance

Use the **Distance** slider in the Camera tab to zoom in or out. A larger distance shows more of the model; a smaller distance fills the frame.

## Perspective vs Orthographic

The main camera can render in either **Perspective** or **Orthographic** mode.

- **Perspective** keeps natural depth foreshortening. Objects farther from the camera appear smaller.
- **Orthographic** removes perspective distortion. This is useful for isometric, tactical, pixel-art, and engine-facing sprite work where consistent scale matters.

You can switch camera type from the camera/settings controls and from workflow setup. The active camera type is used consistently by the editor viewport, workflow preview, workflow capture, and exported frames.

Orthographic uses zoom-like framing instead of perspective field-of-view. If a scene looks too close or too far after switching modes, adjust the orthographic zoom or use a fit/framing action for the selected model.

## Manual Orbit

In the 3D viewport you can manually orbit the camera:

- **Left-click + drag** — Orbit around the model.
- **Scroll wheel** — Zoom in/out.
- **Right-click + drag** — Pan the camera.

> After manually orbiting, re-applying a preset will snap the camera back to that preset angle.

## Multi-Angle Workflows

If you need to export the same model from multiple directions (e.g. 8-directional walk cycles), use **Workflows** instead of manually rotating the camera. See the [Workflows](workflows) doc for details.

Workflow camera settings include the same perspective/orthographic choice as the main viewport. This lets you preview and capture a whole directional set with the projection style you intend to ship.
