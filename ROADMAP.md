# Sprite Sheet Helper Roadmap

## Vision

A universal spritesheet pipeline:

> Import anything → Transform → Export everywhere

---

## ✅ Shipped in v0.3.0

- CLI for batch processing with CI/CD integration
- Workflow presets (topdown-8dir/4dir, isometric, platformer)
- Engine-native exporters (Bevy, Godot, Unity, Phaser, pygame, raylib, LÖVE 2D, Turbo)
- Camera animation capture (live webcam + photo, in-browser MediaPipe)
- Pose review step with trim, global corrections, and per-bone adjustments
- In-app documentation with full-text search

---

## v0.4 — Import & Interoperability

> Accept spritesheets and animated assets as input, not just 3D models. Enable round-tripping between engines and tools.

### Import Pipeline

- Import Aseprite (`.ase` / `.aseprite`)
- Import TexturePacker / Libresprite JSON
- Import existing spritesheets (`.png` + JSON) and re-export to other formats
- Import animated GIF / WebP and auto-slice into frames

### Export Improvements

- Improve engine-native exporters (Unity, Defold, Bevy, MonoGame, LibGDX)
- Export to Aseprite (`.ase` / `.aseprite`)
- Standardize metadata output formats across all exporters

---

## v0.5 — Atlas & Rendering Quality

> Make exported atlases production-ready for shipped games.

### Atlas Intelligence

- Bin-packing layout algorithm (replaces fixed grid — cuts wasted space)
- Multi-atlas support (multiple texture pages for large projects)
- Max atlas size constraint setting (1024, 2048, 4096)

### Rendering Safety

- Padding / bleeding control between frames
- Scale export (1×, 2×, 4×) for different screen densities

---

## v0.6 — Animation & UX

> Improve animation workflow and preview accuracy.

### Animation System

- Per-animation FPS override instead of one global setting
- Loop vs one-shot flag per animation, passed through to exporters
- Onion skinning in the preview
- Keyframe animation for scene properties (lights, camera, transforms)

### Preview & Editor

- Free / resizable preview panels
- Drag-and-drop model loading
- Improved scrubbing and playback controls

---

## v0.7 — Differentiators

> Add features that make the tool stand out.

### Conversion Pipeline

- Re-export between formats (Aseprite → Unity → Bevy, etc.)

### Frame Utilities

- Flip / rotate frames non-destructively

### Visual Variants

- Color palette swapping for character variants and skins

### Shader System

- Granular shader control / shader graph

---

## Path to v1.0 — Production Readiness

> Operational hardening required before calling the tool stable. Tracks work across all platforms (web PWA, desktop, CLI/Docker).

### Reliability & Data Durability

- ✅ Storage quota monitoring: warn when browser storage is almost full, surface quota errors on model/texture saves and crash-recovery writes
- Missing-model handling on project load: blocking dialog listing missing files, with the option to remove orphaned entities (today: toast + silently empty geometry)
- Move GIF encoding to a Web Worker with progress UI (single-threaded today; freezes the UI on large exports)
- Model import progress indicator and size-aware timeout (today: hardcoded 30s silent timeout)

### Observability

- Opt-in, privacy-respecting error reporting (PII-scrubbed) for web + desktop; CLI stays offline
- Update checker

### Security & CI

- ✅ Dependabot (npm, GitHub Actions, cargo) and `npm audit` in CI — graduate the audit step from non-blocking to blocking
- ✅ Coverage reporting in CI
- UI component tests (React Testing Library) for the main panels and export workbench
- Accessibility pass: axe-core check in CI, keyboard support for timeline scrubbing

### Performance

- Code-split heavy surfaces with `React.lazy` (Export Workbench, Material Workbench, Pose Studio, Asset Toybox) — the main bundle is a single ~3.7 MB chunk today
- Bundle-size budget check in CI

### Legal & Community

- ✅ LICENSE (MIT) and CONTRIBUTING.md
- Privacy statement in docs: models and projects never leave the device

### Docs

- ✅ Storage durability guidance in the Projects doc, recovery troubleshooting entries

---

## v0.8 — Stable Release

> Stable, documented, production-ready tool.

- Full documentation website
- Update checker
- Export history tracking
- Desktop polish (native menubar, UX improvements)
- Performance optimizations

---

## Backlog (Low Priority / High Complexity)

### Advanced Editing

- Sprite pixel editing (out of scope for now)

### Timeline System

- Full animation timeline with keyframe editing for all properties
- Flux programmed `useFrame` animations

---

## Guiding Principles

- Do not reinvent engine features
- Export native formats whenever possible
- Keep the core simple and focused
- Prioritize interoperability over complexity

---

## Long-Term Direction

Become:

> "The FFmpeg of spritesheets"

- Scriptable
- Reliable
- Engine-agnostic
- Widely adopted in pipelines
