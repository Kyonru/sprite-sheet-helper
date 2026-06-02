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

3. Atlas Quality Pipeline
   Roadmap already points here, and it directly affects production usefulness.

Big improvements:

Bin-packing instead of fixed grid.
Padding / extrude / bleed controls.
Max atlas size.
Multi-atlas pages.
1x/2x/4x scale export.
Standardized metadata across exporters.
This would make the tool feel much more “ship a game with this” instead of “generate a quick sheet”.

4. Import / Round-Trip Workflow
   The roadmap’s “Import anything -> Transform -> Export everywhere” is the strongest product direction.

I’d prioritize:

Import existing spritesheet + JSON.
Import GIF/WebP and slice into frames.
Import TexturePacker/Aseprite/Libresprite JSON.
Re-export to every existing engine format.
Show an import mapping/review step before committing frames.
This could become a killer feature.

5. Effects Panel
   Effects are documented heavily, but the UI could become more visual and guided.

Possible redesign:

Stack-based effect list with drag reorder.
Presets like “Pixel Art”, “Toon”, “Depth Debug”, “Game Boy”.
Before/after preview.
Warnings when effects may hurt normal-map capture or reproducibility.
Better grouping: color, stylization, lighting, debug, post-process. 6. Documentation
Docs exist and have search, which is great, but they could become more task-oriented.

I’d improve:

“I want to…” guides: export to Phaser, make top-down sprites, use normal maps, run CLI in CI.
Troubleshooting pages.
Visual examples per exporter.
Workflow diagrams.
CLI recipes.
Versioned “what changed” docs. 7. Scene / Editor Layout
The floating preview is a start. The whole editor could become more workbench-like.

Ideas:

Saveable workspace layouts.
Dockable panels.
Focus modes: Capture, Edit, Export, Pose, Effects.
Drag-and-drop model import.
Better selected-object inspector.
Scene health/status bar. 8. CLI / Automation
You just added strict reproducibility tests, so the CLI is becoming serious pipeline infrastructure.

Next improvements:

--config sprite-sheet-helper.config.json
--dry-run
--report json
deterministic seed/settings report
export manifest with hashes
CI artifact summary
better error categories and exit codes.
My strongest pick for next major polish: Export Workbench + Sequence Manager. Those are the surfaces users hit after every capture, and improving them would make the whole app feel calmer, clearer, and more production-ready.
