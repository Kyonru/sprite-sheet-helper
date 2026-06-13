# 🧱 Sprite Sheet Helper

> Generate sprite sheets and export renders from 3D scenes — fast and simple.

Built with **Vite + React + Tauri** for a lightweight, native desktop experience.

---

https://github.com/user-attachments/assets/cc9d06c4-2281-4131-a87c-5a95b9defe4e

## 📦 Download

Prebuilt desktop binaries are available on the [Releases page](https://github.com/Kyonru/sprite-sheet-helper/releases).

| Platform | File                  |
| -------- | --------------------- |
| macOS    | `.dmg`                |
| Windows  | `.msi` or `.exe`      |
| Linux    | `.AppImage` or `.deb` |

Download the appropriate file for your OS and run it directly — no setup required.

---

## Documentation

- [Github Pages] - <https://kyonru.github.io/sprite-sheet-helper>

## ✨ Features

### Supported model formats

| Format | Notes                                           |
| ------ | ----------------------------------------------- |
| GLB    | Recommended — fully self-contained              |
| GLTF   | External `.bin` and textures must be co-located |
| FBX    | Binary FBX recommended                          |
| OBJ    | Geometry only; `.mtl` materials not loaded      |

### Scene setup

- **Lights** — Ambient, Directional, Point, Spot with adjustable intensity and color
- **Camera** — Orbit controls with preset angles: Top-down, Isometric (45° / 225°), ¾ RPG (55°), and more
- **Transform controls** — Reposition, rotate, and scale objects in the scene
- **Post-processing effects** — Pixelation, Bloom, Outline, Glitch, Depth of Field, ASCII, Dither, Palette, SSAO, and 20+ more

### Animations

- Loads animation clips embedded in the model
- Timeline editor with play/pause, frame stepping, and per-clip trim/speed/loop settings
- Per-frame capture synced to animation playback

### Camera animation capture

Record animation clips directly from a webcam or a photo — no 3D animation software needed.

- **Live recording** — pose detection runs in-browser via MediaPipe; record at up to 30 FPS
- **Photo mode** — upload a single image to capture a static pose
- **Review step** — scrub through every captured frame before saving:
  - Trim start/end and delete individual frames
  - Global corrections: tilt (X), turn (Y), lean (Z), mirror L↔R, flip 180°
  - Per-bone overrides: X/Y/Z euler sliders per bone per frame, with "apply to all frames" option
- Captured clips are saved to the model and available for export alongside embedded animations

### Export formats

| Format         | Output                              |
| -------------- | ----------------------------------- |
| `spritesheet`  | PNG + JSON metadata                 |
| `zip`          | Raw frame PNGs in a ZIP             |
| `gif`          | Animated GIF                        |
| `bevy`         | Rust structs + `Cargo.toml` snippet |
| `godot`        | GDScript + resource file            |
| `unity`        | C# `SpriteSheetAnimator` class      |
| `phaser`       | Atlas JSON for Phaser 3             |
| `pygame`       | Python module                       |
| `raylib`       | C header                            |
| `love2d-lua`   | Lua module for LÖVE 2D              |
| `love2d-anim8` | anim8 library format                |
| `turbo`        | Turbo engine format                 |

### Project files

Save and load `.sshProj` files to preserve the full scene state — objects, lights, camera, animations, materials, spritesheet postprocess settings, and undo history included.

### Spritesheet postprocess

The Export Workbench can apply 2D effects after capture and before atlas packing:

- Outer Outline, including crisp pixel outlines
- Drop Shadow and Glow
- Color Adjust
- Before/after preview with a draggable divider

Normal-map atlases stay clean: color frames are processed, while matching normal frames are only padded when needed so atlas rects stay aligned.

---

## 🖥 CLI

The CLI drives the app headlessly: it starts a local preview server, injects the model into a Puppeteer browser, captures frames, and writes the exported files to disk. No GUI required.

### Before running

Build the app with the CLI bridge before running:

```bash
npm run build:cli
```

### Usage

```bash
npm run cli -- <input> [options]
# or after npm link / global install:
sprite-sheet-helper <input> [options]
```

### Options

| Option                      | Default       | Description                                                       |
| --------------------------- | ------------- | ----------------------------------------------------------------- |
| `--format`                  | `spritesheet` | Export format (see table above)                                   |
| `--frames`                  | `8`           | Number of frames to capture per animation sequence                |
| `--fps`                     | `10`          | Playback frame rate                                               |
| `--width`                   | `64`          | Frame width in pixels                                             |
| `--height`                  | `64`          | Frame height in pixels                                            |
| `--output`                  | `./out`       | Output directory                                                  |
| `--port`                    | `4174`        | Port for the local preview server                                 |
| `--workflow`                | —             | Workflow preset ID (see table below)                              |
| `--cameraDistance`          | `5`           | Camera distance from the model (used with `--workflow`)           |
| `--cameraAngle` / `--phi`   | —             | Workflow camera elevation override in degrees                     |
| `--directionRotationOffset` | —             | Rotate every workflow direction by this many degrees              |
| `--target`                  | —             | Camera target as `x,y,z`                                          |
| `--directionOverride`       | —             | Per-direction camera override, e.g. `N:phi=45,theta=0,distance=3` |
| `--normalMap`               | `false`       | Capture and export a matching normal atlas                        |
| `--skipStepLabel`           | —             | Skip one workflow row label (repeatable).                           |
| `--skipStepLabels`          | —             | Comma-separated workflow row labels to skip.                        |
| `--forceAnimationsInPlace`  | `false`       | Force workflow animation playback to stay at the same root location. |
| `--captureNormalMaps`       | `false`       | Override normal-map capture for workflow runs.                        |
| `--atlasLayout`             | `rows`        | Atlas layout: `rows` or `packed`                                  |
| `--atlasPadding`            | `0`           | Empty pixels around each frame slot                               |
| `--atlasBleed`              | `0`           | Edge-pixel extrusion into padding                                 |
| `--atlasScale`              | `1`           | Scale atlas frame dimensions                                      |
| `--maxAtlasSize`            | `2048`        | Maximum atlas page width and height                               |
| `--multiPage`               | `false`       | Allow generic spritesheet page splitting                          |
| `--config`                  | —             | Run one or more JSON-configured jobs                              |
| `--job`                     | —             | Run a single job from a config file                               |
| `--dryRun`                  | `false`       | Print resolved jobs without launching the browser                 |
| `--json`                    | `false`       | Emit a machine-readable summary                                   |
| `--writeSummary`            | —             | Write the JSON summary to a file                                  |
| `--failOnWarnings`          | `false`       | Exit with an error when warnings exist                            |
| `--quiet`                   | `false`       | Suppress progress logs                                            |
| `--debug`                   | `false`       | Show browser console output                                       |
| `--headful`                 | `false`       | Launch Chromium with a visible window                             |
| `--timeout`                 | —             | Per-job timeout in milliseconds                                   |
| `--exportTimeout`           | `60000`       | Export download timeout in milliseconds                           |
| `--workflowTimeout`         | —             | Workflow completion timeout in milliseconds                       |

Format aliases: `bevy-rust` → `bevy`, `love2d` → `love2d-lua`

Quick discovery commands:

```bash
sprite-sheet-helper --help
sprite-sheet-helper --list-formats
sprite-sheet-helper --list-workflows
```

### Examples

```bash
# 8-frame spritesheet at 64×64 (defaults)
sprite-sheet-helper character.glb

# LÖVE 2D export, 16 frames at 128×128
sprite-sheet-helper character.glb --format love2d --frames 16 --width 128 --height 128

# Animated GIF
sprite-sheet-helper character.fbx --format gif --frames 12 --fps 12 --output ./exports

# Packed generic atlas with page splitting
sprite-sheet-helper character.glb --format spritesheet --atlasLayout packed --multiPage true --maxAtlasSize 1024

# Workflow camera override with JSON output
sprite-sheet-helper character.glb --workflow topdown-4dir --cameraAngle 45 --target 0,0.8,0 --json
```

### Batch config

```json
{
  "defaults": { "format": "spritesheet", "frames": 4 },
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

Run all jobs, one job, or inspect the resolved settings:

```bash
sprite-sheet-helper --config sprites.json
sprite-sheet-helper --config sprites.json --job hero-topdown
sprite-sheet-helper --config sprites.json --dryRun
```

### Docker

Use the GHCR image when you want local or CI automation without installing Node or Chromium:

```bash
docker run --rm \
  -v "$PWD:/work" \
  ghcr.io/kyonru/sprite-sheet-helper:v0 \
  /work/assets/hero.glb \
  --workflow topdown-4dir \
  --format godot \
  --output /work/dist/sprites
```

For batch pipelines:

```bash
docker run --rm \
  -v "$PWD:/work" \
  ghcr.io/kyonru/sprite-sheet-helper:v0 \
  --config /work/sprites.json \
  --writeSummary /work/dist/sprites-summary.json
```

### GitHub Action

```yaml
- name: Generate sprites
  uses: Kyonru/sprite-sheet-helper/action@main
  with:
    input: assets/hero.glb
    output: dist/sprites
    workflow: topdown-4dir
    format: godot
```

The action also supports config-driven batches:

```yaml
- name: Generate sprite batch
  uses: Kyonru/sprite-sheet-helper/action@main
  with:
    config: sprites.json
    fail-on-warnings: "true"
```

On release tags like `v0.4.0`, CI publishes Docker image tags `v0.4.0`, `v0.4`, `v0`, and `latest`. Branch builds do not update published image tags.

### CI example project

See [`example/`](example/) for a standalone GitHub repository template that discovers every model in a `models/` folder, runs the Docker Action on push to `main`, and uploads generated sprite artifacts.

### Example output — `--format love2d`

```text
out/
  spritesheet.png
  spritesheet.json
  spritesheet.lua
  main.lua
```

---

## 🔄 Workflows (CLI)

Workflows automate multi-angle sprite sheet generation. Instead of capturing a single sequence, a workflow iterates over every animation embedded in the model and every camera direction defined by the preset — producing one labeled sequence per combination.

Each row in the output is named `{animationName}_{direction}`, for example `walk_N`, `idle_SE`, `run_Left`.

### Workflow presets

| ID             | Label                  | Directions                 | Camera elevation   |
| -------------- | ---------------------- | -------------------------- | ------------------ |
| `topdown-8dir` | Top Down 8-directional | N, NE, E, SE, S, SW, W, NW | ~overhead (phi=1°) |
| `topdown-4dir` | Top Down 4-directional | N, E, S, W                 | ~overhead (phi=1°) |
| `isometric`    | Isometric              | SE, NE, NW, SW             | 45° elevation      |
| `platformer`   | Platformer / Side View | Right, Left                | Horizon (phi=90°)  |

### Workflow usage

```bash
sprite-sheet-helper character.glb --workflow <id> [options]
```

### Workflow-specific options

| Option                      | Default       | Description                                             |
| --------------------------- | ------------- | ------------------------------------------------------- |
| `--workflow`                | —             | Workflow preset ID (required for workflow mode)         |
| `--frames`                  | `8`           | Frames captured per animation × direction combination   |
| `--fps`                     | `10`          | Playback frame rate for each capture                    |
| `--width`                   | `64`          | Frame width in pixels                                   |
| `--height`                  | `64`          | Frame height in pixels                                  |
| `--cameraDistance`          | `5`           | Distance of the camera from the model origin            |
| `--cameraAngle` / `--phi`   | preset        | Camera elevation override in degrees                    |
| `--directionRotationOffset` | `0`           | Rotate preset directions                                |
| `--target`                  | `0,0,0`       | Camera target as `x,y,z`                                |
| `--skipStepLabels`          | —             | Comma-separated workflow step labels to skip.             |
| `--forceAnimationsInPlace`  | `false`       | Keep animations in place while rendering workflow steps.  |
| `--captureNormalMaps`       | `false`       | Override normal-map capture for the workflow.             |
| `--format`                  | `spritesheet` | Export format applied to the full multi-sequence output |
| `--output`                  | `./out`       | Output directory                                        |

### Workflow examples

```bash
# Top-down 8-directional sheet — all animations, all 8 angles
sprite-sheet-helper character.glb --workflow topdown-8dir

# Isometric at 128×128, exported as a Godot resource
sprite-sheet-helper character.glb --workflow isometric --width 128 --height 128 --format godot

# Platformer workflow with closer camera and more frames
sprite-sheet-helper character.glb --workflow platformer --cameraDistance 3 --frames 16 --fps 12

# Top-down 4-dir, exported as a Bevy plugin
sprite-sheet-helper character.glb --workflow topdown-4dir --format bevy --output ./bevy-assets

# Reframe and rotate a workflow before capture
sprite-sheet-helper character.glb --workflow isometric --cameraAngle 40 --directionRotationOffset 15 --target 0,0.8,0
```

### Example output — `topdown-4dir` with a model that has `idle` and `walk` clips

```text
out/
  spritesheet.png       ← atlas image with all 8 sequences (2 anims × 4 dirs)
  spritesheet.json      ← metadata: frame size, quads, animation names
```

The JSON metadata labels each animation strip:

```json
{
  "animations": [
    { "name": "idle_N", "fps": 10, "frameWidth": 64, "frameHeight": 64, "quads": [...] },
    { "name": "idle_E", "fps": 10, ... },
    { "name": "idle_S", "fps": 10, ... },
    { "name": "idle_W", "fps": 10, ... },
    { "name": "walk_N", "fps": 10, ... },
    { "name": "walk_E", "fps": 10, ... },
    { "name": "walk_S", "fps": 10, ... },
    { "name": "walk_W", "fps": 10, ... }
  ]
}
```

---

## 🚀 Development Setup

### Prerequisites

- [Node.js](https://nodejs.org/) (LTS recommended)
- [Rust toolchain](https://www.rust-lang.org/tools/install)
- Tauri platform dependencies → [Official guide](https://tauri.app/start/prerequisites/)

### 1. Clone the Repository

```bash
git clone https://github.com/Kyonru/sprite-sheet-helper.git
cd sprite-sheet-helper
```

### 2. Install Dependencies

```bash
npm install
```

### 3. Run in Development Mode

```bash
npm run tauri dev
```

This starts Vite and launches the Tauri desktop app with hot reload.

---

## 🛠 Build

### Debug build

```bash
npm run tauri build -- --debug
```

### Production build

```bash
npm run tauri build
```

The compiled application will be output to `src-tauri/target/`.

---

## 📜 Scripts

| Command                          | Description                      |
| -------------------------------- | -------------------------------- |
| `npm install`                    | Install all dependencies         |
| `npm run tauri dev`              | Run the app in development mode  |
| `npm run tauri build`            | Build the production desktop app |
| `npm run tauri build -- --debug` | Build a debug desktop app        |
| `npm run build`                  | Build the web frontend only      |

---

## 🏗 Architecture

Sprite Sheet Helper is **pwa + web-first**. The app runs as a standard web app by default and is also packaged as a native desktop app via Tauri.

### Platform-specific Code

When a feature requires different implementations between web and native (Tauri), the following file naming convention is used:

| File               | Used when                                         |
| ------------------ | ------------------------------------------------- |
| `feature.web.ts`   | Default — runs in the browser / web build         |
| `feature.tauri.ts` | Native override — runs in the Tauri desktop build |

At build time, a Vite plugin (`WebTauriSwapPlugin`) automatically swaps `.web.*` imports for their `.tauri.*` counterpart when building for desktop. If no `.tauri.*` file exists, the `.web.*` version is used as the fallback.

**Example:**

```bash
src/components/reload-prompt/
├── prompt.web.ts     ← used in web builds (PWA service worker)
└── prompt.tauri.ts   ← used in Tauri builds (no-op or native equivalent)
```

When adding a feature that behaves differently on each platform:

1. Implement the web version in `feature.web.ts`
2. Implement the native version in `feature.tauri.ts`
3. Import using the `.web` suffix — the build system handles the rest:

```ts
import useMyFeature from "./feature.web";
```

> ℹ️ Never import `.tauri.*` files directly. Always import the `.web.*` version and let the plugin swap it at build time.

---

## 🤝 Contributing

Contributions are welcome! Here's how to get started:

```bash
# 1. Fork and clone the repo, then:
git checkout -b feature/your-feature-name

# 2. Install dependencies
npm install

# 3. Make your changes, then commit
git commit -m "feat: describe your change"

# 4. Push and open a Pull Request
git push origin feature/your-feature-name
```

Please keep commits clear and scoped. Bug fixes, performance improvements, and new features are all appreciated.

---
