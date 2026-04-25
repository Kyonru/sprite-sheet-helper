# Changelog

All notable changes to Sprite Sheet Helper are documented here.
Format follows [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).

---

## [0.3.0] — Unreleased

### Headline: Camera Animation Capture

Record animation clips from your webcam or a photo directly in the app — no 3D animation software needed. All pose detection runs in the browser via MediaPipe; nothing is uploaded.

### Added

#### Camera Animation Capture

- **Live webcam recording** — pose detection at up to 30 FPS with real-time 3D model preview and skeleton overlay
- **Photo upload mode** — capture a single static pose from any image file
- **Root motion** — optional hip height tracking for jumps, crouches, and vertical movement
- **Bone remapping panel** — map captured bones to any rig naming convention; auto-detect by pattern

#### Pose Review Step

- **Timeline scrubber** — step through every captured frame before saving; model updates live
- **Trim & delete** — trim from start, trim from end, or delete individual frames
- **Global Corrections panel** (non-destructive until save):
  - X / Y / Z rotation sliders to fix tilt, turn direction, and lateral lean
  - Mirror L↔R — swap left and right limbs and reflect their rotations
  - Flip 180° shortcut for clips captured from behind
- **Bone Adjustments panel** — per-bone X / Y / Z euler sliders per frame; "Apply to all frames" to propagate a correction across the whole clip
- Corrections are baked into frame data only on save; preview always reflects the corrected pose

#### CLI & Workflows

- **CLI mode** — headless batch processing via `npm run cli` or after global install: `sprite-sheet-helper <input> [options]`
- **Workflow presets** — automated multi-angle, multi-animation capture in a single command:
  - `topdown-8dir` — 8-directional top-down (N, NE, E, SE, S, SW, W, NW)
  - `topdown-4dir` — 4-directional top-down (N, E, S, W)
  - `isometric` — isometric 45° (SE, NE, NW, SW)
  - `platformer` — side-view (Right, Left)
- CLI options: `--format`, `--frames`, `--fps`, `--width`, `--height`, `--output`, `--port`, `--workflow`, `--cameraDistance`
- CI/CD integration support

#### Export Formats

- Added engine-native exporters: **Bevy**, **Godot**, **Unity**, **Phaser 3**, **pygame**, **raylib**, **LÖVE 2D** (lua + anim8), **Turbo**
- Format aliases: `bevy-rust` → `bevy`, `love2d` → `love2d-lua`

#### Documentation

- In-app documentation modal with full-text search (Fuse.js)
- New page: **Camera Animation Capture** — full workflow guide
- Updated **Animations** page with camera capture cross-reference
- Per-doc icons in sidebar, logical page ordering, and working in-doc navigation links

### Changed

- **About modal** — redesigned with gradient hero banner, creator profile links, and sponsor button
- **Docs modal** — improved sidebar (active left-border indicator, per-doc icons, page count), compact search bar with clear button, document title header above prose content
- Docs sidebar order now follows logical reading order (Getting Started → Tutorial → … → CLI)

### Fixed

- Forward tilt in captured poses caused by Z-axis depth from MediaPipe world landmarks — landmarks are now projected onto the XY plane for frontal captures

---

## [0.2.0]

- Desktop app via Tauri (macOS `.dmg`, Windows `.msi`/`.exe`, Linux `.AppImage`/`.deb`)
- Post-processing effects (Pixelation, Bloom, Outline, Glitch, DoF, ASCII, Dither, Palette, SSAO, and more)
- Lighting controls — Ambient, Directional, Point, Spot with intensity and color
- Transform controls — reposition, rotate, scale objects in the scene
- Camera presets — Top-Down, Isometric (45°/225°), ¾ RPG, Dimetric, Side-Scroller
- Project files (`.sshProj`) — save/load full scene state with undo history
- Animated GIF export
- FBX format support

---

## [0.1.0]

- Initial release
- GLB/GLTF/OBJ model loading
- Sprite sheet export (PNG + JSON metadata)
- ZIP export (raw frame PNGs)
- Basic animation playback with trim, speed, and loop settings
- Per-frame capture synced to animation timeline
