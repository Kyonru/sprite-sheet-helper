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
