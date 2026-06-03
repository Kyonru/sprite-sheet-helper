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

| Option           | Type   | Default     | Description                               |
| ---------------- | ------ | ----------- | ----------------------------------------- |
| --format         | string | spritesheet | Export format (see formats below)         |
| --frames         | number | 8           | Number of frames to capture               |
| --fps            | number | 10          | Frames per second for animated exports    |
| --width          | number | 64          | Frame width in pixels                     |
| --height         | number | 64          | Frame height in pixels                    |
| --output         | string | ./out       | Output directory (created if missing)     |
| --port           | number | 4174        | Local preview server port                 |
| --workflow       | string | —           | Workflow preset ID (see workflows below)  |
| --cameraDistance | number | 5           | Camera distance from model origin         |
| --cameraAngle    | number | —           | Camera elevation override in degrees      |
| --phi            | number | —           | Compatibility alias for `--cameraAngle`   |
| --directionRotationOffset | number | — | Rotate all workflow directions in degrees |
| --target         | string | —           | Camera target as `x,y,z`                  |
| --directionOverride | string | —       | Per-direction override, e.g. `N:phi=45,theta=0,distance=3,target=0,0.8,0` |
| --normalMap      | string | false       | Capture and export a matching normal atlas |
| --atlasLayout    | string | rows        | `rows` or deterministic `packed` layout   |
| --atlasPadding   | number | 0           | Empty pixels around each frame slot       |
| --atlasBleed     | number | 0           | Edge-pixel extrusion around each frame    |
| --atlasScale     | number | 1           | Scale atlas frame dimensions (`1`, `2`, `4`, or custom) |
| --maxAtlasSize   | number | 2048        | Maximum atlas page width and height       |
| --multiPage      | string | false       | Allow generic spritesheet page splitting  |
| --config         | string | —           | Run jobs from a JSON config file          |
| --job            | string | —           | Run a single job from a config file       |
| --dryRun         | flag   | false       | Print resolved jobs without running       |
| --json           | flag   | false       | Emit a machine-readable summary           |
| --quiet          | flag   | false       | Suppress progress logs                    |
| --debug          | flag   | false       | Show browser console output               |
| --headful        | flag   | false       | Launch Chromium with a visible window     |
| --timeout        | number | —           | Per-job timeout in milliseconds           |
| --exportTimeout  | number | 60000       | Export download timeout                   |
| --workflowTimeout | number | —          | Workflow completion timeout               |

Discovery commands:

```bash
sprite-sheet-helper --help
sprite-sheet-helper --list-formats
sprite-sheet-helper --list-workflows
sprite-sheet-helper --version
```

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

Use `--normalMap true` before capture to include real camera-space normal data in atlas-style exports. Frames captured without normal maps export as transparent placeholders in `spritesheet_normal.png`.

## Atlas Options

The CLI uses the same atlas engine as the Export Workbench.

```bash
sprite-sheet-helper character.glb \
  --format spritesheet \
  --atlasLayout packed \
  --atlasPadding 2 \
  --atlasBleed 1 \
  --maxAtlasSize 1024
```

`--atlasLayout rows` preserves the compatible row layout unless padding, extrusion, scale, or max-size choices require a different page plan. `--atlasLayout packed` uses stable deterministic packing without frame rotation. The `--atlasBleed` flag is the CLI compatibility name for edge extrusion.

Multi-page output is currently supported by the generic `spritesheet` format:

```bash
sprite-sheet-helper character.glb \
  --format spritesheet \
  --multiPage true \
  --maxAtlasSize 512
```

Multi-page generic output writes `spritesheet.png`, `spritesheet_2.png`, and matching `spritesheet_normal.png`, `spritesheet_normal_2.png` files when normal maps are enabled. The JSON includes `meta.pages` and `quad.page` for page-aware loading. Engine exporters block multi-page plans until their generated code supports multiple texture pages.

## JSON Output And Dry Runs

Use `--json` when the CLI is part of a build pipeline:

```bash
sprite-sheet-helper character.glb --workflow topdown-4dir --json
```

The command prints one JSON summary containing status, jobs, written files, warnings, and elapsed time. Browser console logs are hidden unless `--debug` is enabled.

Use `--dryRun` to inspect normalized settings without launching the preview server:

```bash
sprite-sheet-helper character.glb --workflow isometric --cameraAngle 40 --dryRun
```

## Batch Configs

JSON configs let you store repeatable jobs without adding a new dependency or file format.

```json
{
  "defaults": {
    "format": "spritesheet",
    "frames": 4,
    "width": 64,
    "height": 64
  },
  "jobs": [
    {
      "id": "hero-topdown",
      "input": "assets/hero.glb",
      "output": "dist/hero",
      "workflow": "topdown-4dir"
    }
  ]
}
```

Run every job, or filter to one:

```bash
sprite-sheet-helper --config sprites.json
sprite-sheet-helper --config sprites.json --job hero-topdown
```

Config paths are resolved relative to the config file. Command-line flags override job values, job values override config defaults, and config defaults override built-in defaults.

## Workflows

Passing `--workflow` switches the CLI into multi-angle mode. It automatically iterates over every animation embedded in the model and every camera direction in the preset, producing a fully labeled sprite atlas in a single command — no manual camera rotation required.

```bash
sprite-sheet-helper character.glb --workflow topdown-8dir
```

The CLI waits for the workflow completion event before exporting. If the workflow reports an error, is cancelled, or times out, the command exits with an error instead of exporting a partial atlas.

### Workflow Camera Controls

The CLI can use the same camera options as the workflow preview dialog:

```bash
sprite-sheet-helper character.glb \
  --workflow isometric \
  --cameraDistance 3 \
  --cameraAngle 40 \
  --directionRotationOffset 15 \
  --target 0,0.8,0
```

Use `--directionOverride` for a single direction:

```bash
sprite-sheet-helper character.glb \
  --workflow topdown-4dir \
  --directionOverride "N:phi=45,theta=0,distance=3,target=0,0.8,0"
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
