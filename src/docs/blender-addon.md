---
title: Blender Add-on
---

# Blender Add-on

The Blender add-on turns Actions into directional sprite sheets without
exporting the model from Blender first. It uses the scene's materials, lights,
world, and render engine, then restores the camera, animation, visibility, and
render settings after capture.

## Demo

The reproducible demo creates an animated hover bot in Blender and captures
one Action as:

- four isometric directions: SE, NE, NW, and SW;
- eight frames per direction at 128×128;
- 32 transparent PNG frames in deterministic order;
- one 1024×512 atlas PNG; and
- JSON containing animation, direction, FPS, and frame rectangles.

Generate the scene and its real add-on output locally:

```bash
blender --background --factory-startup --python blender_addon/demo/create_demo.py
```

The script is available at
[`blender_addon/demo/create_demo.py`](https://github.com/Kyonru/sprite-sheet-helper/blob/main/blender_addon/demo/create_demo.py).

## Install

Build both installable packages from the repository:

```bash
python3 blender_addon/package_addon.py
```

For Blender 4.2 or newer, install the resulting `*-extension.zip` from
**Edit → Preferences → Get Extensions → Install from Disk**. A legacy add-on
ZIP is generated alongside it for the older installation flow.

## Capture an Action

1. Open the **3D View**, press `N`, and select the **Sprite Sheet** tab.
2. Choose an armature or collection target.
3. Select a directional workflow and camera projection.
4. Click **Find Actions**, then enable the Actions to capture.
5. Choose FPS sampling or an exact frame count.
6. Set the frame size, framing margin, output folder, and filename prefix.
7. Click **Render Sprite Sheet**.

The output folder receives the atlas PNG, compatible JSON metadata, and the
individual rendered frames. Other renderable scene geometry is isolated from
the selected target during capture, while scene lighting remains available.

## Current Scope

The first add-on release supports dependable color capture and row-based
atlases. Packed atlases, normal-map capture, post-processing, and
engine-specific exporters remain planned follow-up work. Continue using the
desktop app or CLI when those features are required.
