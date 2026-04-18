# Sprite Sheet Helper Roadmap

## Vision

A universal spritesheet pipeline:

> Import anything → Transform → Export everywhere

---

## v0.3 — Adoption Engine (High Priority)

### Goals

- Make the tool usable in real workflows
- Enable migration between engines/tools

### Features

#### Import Pipeline

- Import Aseprite (.ase / .aseprite)
- Import TexturePacker / Libresprite JSON
- Import existing spritesheets (.png + JSON)
- Import GIF/WebP and auto-slice frames

#### Export Improvements

- Improve engine-native exporters (Unity, Defold, Bevy, MonoGame, LibGDX)
- Export to aseprite (.ase / .aseprite)
- Standardize output formats

#### CLI / API Mode

- CLI for batch processing
- Allow integration into CI/CD pipelines

---

## v0.4 — Production Readiness

### Goals

- Make the tool viable for shipped games
- Optimize runtime performance and memory

### Features

#### Atlas Intelligence

- Bin-packing algorithm (replace fixed grid)
- Multi-atlas support (multiple texture pages)
- Max atlas size constraints (1024, 2048, etc.)

#### Rendering Safety

- Padding / bleeding control between frames

#### Resolution Support

- Scale export (1x, 2x, 4x)

---

## v0.5 — UX & Animation Improvements

### Goals

- Improve usability and preview accuracy

### Features

#### Animation System

- Per-animation FPS override instead of one global setting
- Loop vs one-shot flag per animation, passed through to exportersLoop vs one-shot flags
- Improved preview playback (play, pause, scrub)

#### Preview Improvements

- Better preview window usage
- Free/resizable preview panels

---

## v0.6 — Differentiators

### Goals

- Add features that make the tool stand out

### Features

#### Conversion Pipeline

- Re-export between formats (Aseprite → Unity → Bevy, etc.)

#### Frame Utilities

- Flip / rotate frames (non-destructive)

##### Visual Variants

- Color palette swapping

---

## v0.7 — Stable Release

### Goals

- Stable, documented, production-ready tool

### Features

#### Documentation

- Full documentation website
- Tutorials and guides

#### Tooling

- Update checker
- Improved performance
- Export history tracking

#### Platform

- Desktop polish (native menubar, UX improvements)

---

## Backlog (Low Priority / High Complexity)

### Not Core (Avoid Early)

#### Advanced Editing

- Sprite pixel editing (out of scope)

#### Shader System

- Shader graph / shader control

#### Timeline System

- Full animation timeline
- Keyframe editing for all properties
- Onion skinning in the preview
- Flux programmed useFrame animations

#### 3D / Advanced Animation

- Mixamo / armature animation
- Camera-based animation workflows

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
