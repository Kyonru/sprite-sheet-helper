---
title: CLI & Headless Mode
---

Sprite Sheet Helper ships with a headless CLI that runs the full exporter without opening the UI. It starts a local preview server, drives the app with a headless browser, and writes the output files to disk — making it easy to drop sprite generation into an existing asset pipeline or build script.

## How It Works

The CLI and the UI share the same export engine. When you run the CLI it:

1. Builds and serves the app locally via Vite.
2. Launches a headless Chromium browser with Puppeteer.
3. Loads your model and applies your settings.
4. Captures frames and triggers the selected export format.
5. Writes the output files to the directory you specify.

Everything the UI can export, the CLI can export — same formats, same quality.

## Building the CLI

```bash
npm run build:cli
```

This compiles the CLI sources and produces the binary at `dist/cli/index.js`. After building, the binary is available as:

```bash
npx sprite-sheet-helper <input> [options]
```

Or during development:

```bash
npm run cli -- <input> [options]
```

## Basic Usage

```bash
# Export a spritesheet with defaults (64×64, 8 frames)
sprite-sheet-helper character.glb

# Custom size and frame count
sprite-sheet-helper character.glb --width 128 --height 128 --frames 16

# Choose export format and output directory
sprite-sheet-helper character.glb --format godot --output ./assets/sprites
```

## Options

| Option           | Type   | Default     | Description                              |
| ---------------- | ------ | ----------- | ---------------------------------------- |
| --format         | string | spritesheet | Export format (see formats below)        |
| --frames         | number | 8           | Number of frames to capture              |
| --fps            | number | 10          | Frames per second for animated exports   |
| --width          | number | 64          | Frame width in pixels                    |
| --height         | number | 64          | Frame height in pixels                   |
| --output         | string | ./out       | Output directory (created if missing)    |
| --port           | number | 4174        | Local preview server port                |
| --workflow       | string | —           | Workflow preset ID (see workflows below) |
| --cameraDistance | number | 5           | Camera distance from model origin        |
| --phi            | number | —           | Camera elevation angle in degrees        |

## Export Formats

| Format       | Output Files           | Description                                |
| ------------ | ---------------------- | ------------------------------------------ |
| spritesheet  | spritesheet.png, .json | PNG atlas + JSON metadata (most universal) |
| zip          | sprites.zip            | Individual frame PNGs in a ZIP             |
| gif          | spritesheet.gif        | Animated GIF                               |
| unity        | SpriteSheetAnimator.cs | C# animator class                          |
| godot        | .gd, .tres             | GDScript + resource file                   |
| bevy         | .rs, Cargo.toml        | Rust structs for the Bevy engine           |
| phaser       | atlas.json, .png       | Phaser 3 atlas format                      |
| pygame       | spritesheet.py         | Python module                              |
| raylib       | .h                     | C header file                              |
| love2d-lua   | .png, .lua, main.lua   | LÖVE 2D framework module                   |
| love2d-anim8 | .png, .lua, main.lua   | LÖVE 2D with the anim8 library             |
| turbo        | spritesheet.json       | Turbo engine format                        |

**Format aliases:** `bevy-rust` → `bevy`, `love2d` → `love2d-lua`, `anim8` → `love2d-anim8`

## Workflows

Passing `--workflow` switches the CLI into multi-angle mode. It automatically iterates over every animation embedded in the model and every camera direction in the preset, producing a fully labeled sprite atlas in a single command — no manual camera rotation required.

```bash
sprite-sheet-helper character.glb --workflow topdown-8dir
```

### Available Workflow Presets

| ID                 | Directions                 | Elevation | Use Case                            |
| ------------------ | -------------------------- | --------- | ----------------------------------- |
| topdown-8dir       | N, NE, E, SE, S, SW, W, NW | top-down  | Top-down with 8 movement dirs       |
| topdown-4dir       | N, E, S, W                 | top-down  | Top-down with 4 movement dirs       |
| topdown-1dir       | Forward                    | top-down  | Top-down, game rotates sprite       |
| isometric          | SE, NE, NW, SW             | 45°       | Classic isometric (4 corners)       |
| isometric-1dir     | SE                         | 45°       | Isometric, game rotates sprite      |
| platformer         | Right, Left                | horizon   | Side-scrolling platformer           |
| platformer-1dir    | Right                      | horizon   | Platformer, game mirrors sprite     |
| front-back-2dir    | Front, Back                | horizon   | Classic top-down RPG                |
| front-facing       | Front                      | horizon   | Character faces camera (Doom-style) |
| three-quarter-4dir | N, E, S, W                 | 45°       | ¾ view RPG (Diablo-style, 4 dir)    |
| three-quarter-8dir | N, NE, E, SE, S, SW, W, NW | 45°       | ¾ view RPG (Diablo-style, 8 dir)    |
| profile-1dir       | Right                      | horizon   | Pure side profile                   |
| diagonal-4dir      | NE, SE, SW, NW             | top-down  | Diagonals only                      |

### Workflow Output

Each animation clip in the model is combined with each direction label. A model with `idle` and `walk` clips run through `topdown-4dir` produces:

```text
out/
  spritesheet.png      ← full atlas
  spritesheet.json     ← metadata with all sequences
```

The JSON `animations` array contains one entry per direction per clip:

```json
{
  "animations": [
    { "name": "idle_N", "fps": 10, "frames": 8, "frameWidth": 64, "frameHeight": 64, "quads": [...] },
    { "name": "idle_E", ... },
    { "name": "idle_S", ... },
    { "name": "idle_W", ... },
    { "name": "walk_N", ... },
    { "name": "walk_E", ... },
    { "name": "walk_S", ... },
    { "name": "walk_W", ... }
  ]
}
```

## Pipeline Integration

Because the CLI is a standard Node.js binary it fits into any build tool or script that can run shell commands.

### npm / package.json script

```json
{
  "scripts": {
    "sprites": "sprite-sheet-helper assets/character.glb --workflow topdown-4dir --format godot --output src/assets/sprites"
  }
}
```

### Makefile

```makefile
sprites:
 sprite-sheet-helper assets/character.glb \
   --workflow isometric \
   --format unity \
   --width 128 --height 128 \
   --output Assets/Sprites/Character
```

### CI/CD (GitHub Actions)

```yaml
- name: Generate sprite sheets
  run: |
    npm run build:cli
    sprite-sheet-helper assets/character.glb \
      --workflow topdown-8dir \
      --format spritesheet \
      --output dist/sprites
```

### Batch processing multiple models

```bash
for model in assets/models/*.glb; do
  name=$(basename "$model" .glb)
  sprite-sheet-helper "$model" \
    --workflow topdown-4dir \
    --output "dist/sprites/$name"
done
```

## Supported Model Formats

- `.glb` — Recommended. Self-contained, full animation support.
- `.gltf` — Requires co-located `.bin` and texture files.
- `.fbx` — Supported; animation quality depends on the exporter.
- `.obj` — Static geometry only, no animations.

## Tips

- Use `.glb` files in pipelines — they are fully self-contained and won't break if files are moved.
- Name your animation clips clearly in your 3D tool (e.g. `idle`, `walk`, `attack`) — those names become the sequence identifiers in the exported metadata.
- If the preview server port `4174` conflicts with another process, set `--port` to any free port.
- Combine `--workflow` with `--format godot` (or any engine format) to go from raw `.glb` to ready-to-use game engine assets in one command.
