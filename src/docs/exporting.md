---
title: Exporting
---

# Exporting

The Export panel (right side of the screen) lets you configure and export your sprite sheet in a variety of formats.

## Basic Export Steps

1. Open the Export panel on the right.
2. Set your **frame size** (width × height in pixels).
3. Choose an **export format** from the dropdown.
4. Click **Export** and choose where to save.

## Export Formats

### General Purpose

- **Sprite Sheet** — A single PNG containing all frames arranged in a grid, plus a JSON metadata file with frame positions, sizes, and animation names.
- **ZIP** — All individual frames as separate PNG files compressed into a ZIP archive.
- **GIF** — An animated GIF of the current animation sequence.

### Game Engine Integrations

- **Unity** — C# `SpriteSheetAnimator` class with frame data ready to use in a Unity project.
- **Godot** — GDScript file and a `.tres` resource file for use with Godot's `AnimatedSprite2D`.
- **Bevy** — Rust structs and a `Cargo.toml` snippet for the Bevy game engine.
- **Phaser** — Phaser 3 Atlas JSON format compatible with `scene.load.atlas()`.
- **Pygame** — Python module with frame rectangles and animation helpers.
- **Raylib** — C header file with frame definitions for use with raylib.
- **LÖVE 2D (Lua)** — Lua module for use with the LÖVE 2D framework.
- **LÖVE 2D (anim8)** — Lua module using the popular [anim8](https://github.com/kikito/anim8) library.
- **Turbo** — Format for the Turbo game engine.

## Frame Configuration

In the export panel you can control:

- **Frame width / height** — Output size of each frame in pixels.
- **FPS** — Frames per second used when exporting animated formats (GIF, engine integrations).
- **Padding** — Pixel gap between frames in the sprite sheet grid.
- **Background** — Transparent or solid color background.

## Tips

- Use `.glb` models for best animation compatibility.
- Export at power-of-two sizes (64, 128, 256, 512) for best GPU texture performance.
- The **Sprite Sheet** format is the most universal — all game engines can load a PNG + JSON atlas.
