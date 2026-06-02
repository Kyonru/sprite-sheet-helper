---
title: Exporting
---

The Export Workbench on the right side of the screen is the main place for capture and export. It shows what has been captured, normal-map coverage, atlas estimates, validation warnings, and recent export attempts before opening the export preflight modal.

## Basic Export Steps

1. Open the Export Workbench on the right.
2. Set your frame size, frame timing, and capture options.
3. Capture frames with **Record**, **Frame**, or **Row**.
4. Click **Prepare Export**.
5. Pick a format card, review validation messages, choose atlas settings, then click **Export**.

## Export Formats

### General Purpose

- **Sprite Sheet** — One or more PNG atlas pages plus JSON metadata with frame positions, sizes, page indexes, and animation names.
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

In the workbench you can control:

- **Frame width / height** — Output size of each frame in pixels.
- **FPS** — Frames per second used when exporting animated formats (GIF, engine integrations).
- **Capture normal maps** — Captures a matching camera-space normal frame when recording or adding frames. Turn this on before capturing if you want real normal data.
- **Background** — Transparent or solid color background.

## Atlas Settings

Atlas settings are chosen in the preflight modal and remembered as last-used settings.

- **Rows / compatible** — Preserves the existing animation row order and frame order. With default atlas settings this matches the old single-page layout.
- **Packed / production** — Uses deterministic packing without frame rotation to reduce wasted space. Metadata still preserves the original animation and frame order.
- **Padding** — Adds empty pixels around each frame slot.
- **Bleed** — Duplicates edge pixels into the padding area to reduce texture sampling seams.
- **Scale** — Scales atlas frame dimensions for export.
- **Max atlas** — Sets the maximum page width and height used by validation and page splitting.
- **Allow multi-page** — Allows the generic Sprite Sheet exporter to write `spritesheet.png`, `spritesheet_2.png`, and so on.

Multi-page output is fully supported by the generic Sprite Sheet format. Engine exporters currently block multi-page atlases because their generated helper code expects one texture page. Increase the max atlas size, disable multi-page, or export generic Sprite Sheet when a validation warning reports that an engine format cannot safely export the plan.

## Normal Map Exports

When **Capture normal maps** is enabled, atlas-style exports include matching normal pages alongside the color pages. Single-page output uses `spritesheet_normal.png`; multi-page generic output uses `spritesheet_normal.png`, `spritesheet_normal_2.png`, and so on.

Normal maps are captured at frame creation time. Existing color-only frames do not gain real normal data just by turning the option on later; they export as transparent placeholder normal frames until you recapture or add them again with normal capture enabled.

The preflight modal reports normal-map coverage as Ready, Partial, or Missing. Partial and missing normal coverage does not block export because placeholder pages can still preserve the atlas layout.

## Export History

The workbench stores recent successful exports in browser local storage. History records the format, filename/download intent, frame count, animation count, page count, normal status, atlas settings, and warnings. It does not modify project files and browser exports do not record a real filesystem path.

## Tips

- Use `.glb` models for best animation compatibility.
- Export at power-of-two frame sizes (64, 128, 256, 512) for best GPU texture performance.
- Use Packed layout for production atlases with uneven sequence lengths.
- The **Sprite Sheet** format is the most universal — all game engines can load a PNG + JSON atlas.
