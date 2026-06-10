# Changelog

All notable changes to Sprite Sheet Helper are documented here.
Format follows [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).

---

## [0.5.0]

### Added

- Add model visibility
- Import animations into selected model
- Add in place option
- add more Workflow config

### Fixed

- Prevented model import crashes when loading or importing after sequence recording by strengthening model load-state handling and runtime cleanup.
- Added model render/load error boundaries with toast notifications so failed FBX/GLB loads no longer break the scene.
- Updated model import and material workflows to only expose actions/tools for fully loaded models.
- Added rollback on import failure and expanded model removal cleanup to clear related animation/mixer state.
- Added a regression E2E test covering FBX import after sequence capture without losing captured sequence rows.

## [0.4.1]

### Added

- Railway/Railpack production deployment config for hosting the web app
- Dedicated release artifact for generated output from the CI example project

### Improved

- Docker release workflow now builds from `docker/Dockerfile` so Railway does not auto-detect the CLI image
- Docker release workflow publishes GHCR image tags only from release tags, including `latest`
- Docker release workflow uses Node 24-ready Docker actions
- Docker Action now points at the newest published GHCR image
- CI example project uses `Kyonru/sprite-sheet-helper/action@main` and is validated during release smoke tests

### Fixed

- Fixed Railway build detection by forcing Railpack's Node provider instead of Python detection from docs dependencies
- Fixed release failures caused by trying to create floating GitHub Action tags blocked by repository rules

## [0.4.0]

### Added

- Standalone Zustand inspector workspace package
- Normal map capture/export, CLI flag support, coverage status, and placeholder warnings
- Export Workbench with format cards, engine logos, atlas preflight, output preview, and local export history
- Production atlas options: packed/rows layouts, padding, extrusion, scale presets, max atlas size, manifests, and generic multi-page spritesheets
- Vitest + Puppeteer test harness with workflow reproducibility and committed golden export suitcase tests
- Pose Studio workbench with capture/edit/save flow, direct FK editing, IK handles, history, calibration, and better pose retargeting feedback
- First-class material editing with reusable material assets, texture maps, retro texture variants, project persistence, and live render application
- Model downgrade tools with analysis, preview/apply/reset, low-poly/PS1-style recipes, animation reduction, and GLB export
- Asset Toybox for authored low-poly models, skeleton/primitive creation, face extrusion, mirror editing, component editing, and GLB export
- Workflow camera preview with direction selection, distance/elevation/rotation controls, target framing, and non-destructive draft settings
- Docker image and Docker-based GitHub Action distribution through GHCR
- Standalone CI example project that batch-generates sprites for every model in a `models/` folder
- Zensical documentation site, GitHub Pages publishing workflow, and local `act` smoke-test docs

### Improved

- Auto-capture workflows now have deterministic sequencing, timeout handling, cancellation, progress details, and safer CLI waiting
- CLI automation with strict option validation, JSON summaries, config-driven batch jobs, workflow camera flags, and CI-friendly failure controls
- Sequence preview/carousel restored in the export workbench with frame editing, row editing, normal status, playback, zoom, and tighter layout behavior
- Effects panel redesigned around stack ordering, grouped effect browser, presets, guidance warnings, and cleaner details editing
- Settings, export preflight, docs, and troubleshooting pages refreshed for the new export, workflow, normal-map, and effects flows
- Project snapshots now migrate newer material, downgrade, and authored-model state

### Fixed

- Fixed normal-map export reliability, missing-normal warnings, and aligned placeholder generation
- Fixed Pose Studio selection, IK movement, retargeting, history grouping, debug capture, and overlay alignment issues
- Fixed effects reorder/delete preview refresh issues
- Fixed carousel playback flicker, play state, zoom retention, and cramped strip behavior
- Fixed Docker entrypoint path, Vite preview readiness detection, and PWA precache limits for CI/release builds

## [0.3.1]

### Added

- Add option to include smear postprocessing with 2 type of implementations
- Improve tutorial and documentation
- remove camera option from tauri builds

## [0.3.0]

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
