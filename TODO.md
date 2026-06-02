- Add the option to also capture normal maps

## 🔧 Bugs

- Fix carousel when items < 6

---

## 🚀 High Priority

### Import & Interoperability

- Import existing spritesheets + JSON (TexturePacker, Aseprite, Libresprite) and re-export to other formats
- Import Aseprite files directly (`.ase` / `.aseprite`)
- Import animated GIF / WebP and auto-slice into frames
- Improve engine-native exporters (Unity, Defold, Bevy, MonoGame, LibGDX)

### Atlas Quality

- Bin-packing layout algorithm — cuts wasted atlas space dramatically
- Max atlas size constraint (1024, 2048, 4096)
- Padding / bleeding control between frames (prevents texture bleeding at runtime)

### Animation

- Per-animation FPS override instead of one global setting
- Loop vs one-shot flag per animation, passed through to exporters

---

## 📋 Medium Priority

### Preview & Editor

- Free / resizable preview panels (instead of fixed position)
- Drag and drop model loading
- Improved scrubbing and playback controls
- Onion skinning in the preview

### Export

- Scale export (1×, 2×, 4×) for different screen densities
- Multiple atlas pages for large projects
- Export to Aseprite (`.ase` / `.aseprite`)

### Desktop

- Native menubar (hide top menu on desktop, use OS menubar)
- Check for updates

---

## 🌟 Low Priority / Complex

### Frame Utilities

- Flip / rotate frames non-destructively
- Color palette swapping — great for character variants and skins

### Shader System

- Granular shader control / shader graph

### Animation Authoring

- Keyframe animation for scene properties (lights, camera, transforms)
- Flux programmed `useFrame` animations
- Full animation timeline with keyframe editing for all properties

### Misc

- Export history tracking
- Performance optimizations
- Sprite pixel editing (out of scope for now)
