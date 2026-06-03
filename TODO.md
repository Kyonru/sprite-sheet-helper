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

4. Import / Round-Trip Workflow
   The roadmap’s “Import anything -> Transform -> Export everywhere” is the strongest product direction.

I’d prioritize:

Import existing spritesheet + JSON.
Import GIF/WebP and slice into frames.
Import TexturePacker/Aseprite/Libresprite JSON.
Re-export to every existing engine format.
Show an import mapping/review step before committing frames.
This could become a killer feature.

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

1. Style Presets
Add presets that apply a full asset recipe:

PS1 Character
Low triangle budget, vertex snapping, affine-style texture shader, nearest texture filtering, low-res palette texture, harsh vertex lighting.

Low Poly Clean
Decimated geometry, flat normals, simplified materials, clean colors, optional baked AO.

Pixel Art 3D
Low-res texture atlas, hard edges, stepped animation FPS, orthographic render defaults.

Retro Horror
PS1 preset plus dark vertex lighting, fog, dither/post-process, low draw distance.

Each preset should expose targets like:

triangleBudget: 800
textureSize: 128
paletteColors: 32
flatShading: true
snapVertices: 0.025
animationFps: 10
2. Downgrade Existing Models
This is probably the highest-value first feature.

Pipeline:

Import FBX/GLB.
Analyze:
triangle count
material count
texture sizes
bones
animation count
User picks a preset.
Non-destructive preview generates a downgraded clone.
User can apply/export.
Operations:

mesh decimation
merge duplicate vertices
remove tiny mesh islands
triangulate faces
flat-shade normals
vertex position quantization
texture resize
palette quantization
nearest filtering
material simplification
animation keyframe reduction
stepped animation playback
3. Create Low Poly Assets In-App
Add a simple procedural/modeling layer, not Blender-level, but useful:

primitive builder: cube, plane, cylinder, cone, sphere, capsule
kitbash parts: head, torso, limbs, weapon, shield, crate, tree, rock
mirror editing for characters
color/material swatches
simple extrude/scale/move tools
auto-rig for basic humanoid proportions later
Think “toybox modeler,” not full DCC app.

Different way of building character

You start with a visible bone structure and then you can create figures on top of that, allowing creating insteresting humanoid figures using basic figures strudes and stuff, then later being able to add material and textures

4. Generate Assets
I’d keep generation deterministic first:

seeded random character generator
seeded prop generator
seeded environment object generator
template-based creatures, weapons, trees, crates, rocks
sliders for silhouette, chunkiness, asymmetry, height, armor, weapon type
AI/text-to-3D could be an optional later path, but the reliable local version should come first.

Example prompt-like UI without AI:

Low poly knight, short, wide shoulders, bronze armor, axe, PS1 texture

Internally that maps to templates, proportions, mesh parts, colors, and texture generation.

5. Texture Pipeline
For PS1/low-poly, texture handling matters as much as geometry:

bake material colors into one atlas
downscale to 32/64/128/256
palette limit: 8/16/32/64 colors
ordered dithering
nearest filtering
optional UV jitter/affine shader preview
generate simple pixel textures from masks/noise
bake vertex colors from texture for ultra-low-poly mode
6. Preview Modes
The viewport should have a style comparison mode:

Original
Downgraded
PS1 Shader
Sprite Render Preview
And metrics:

Triangles: 18,240 -> 786
Materials: 12 -> 2
Textures: 2048px -> 128px
Animations: 60fps -> 10fps stepped
7. Export Integration
After a model is created/downgraded/generated:

send to scene
send to Pose Studio
send to workflow capture
export spritesheet/normal map
export model as GLB/FBX later
This makes it part of the whole pipeline instead of a separate gimmick.

Recommended Implementation Order

Add Model Style Presets and a readonly analysis panel.
Add downgrade preview for imported models.
Add texture resize/palette/dither pipeline.
Add PS1 viewport shader/material preview.
Add procedural low-poly asset generator.
Add editable kitbash/model creation tools.
Add AI/text generation only after the deterministic pipeline feels good.
The killer feature would be: import any modern FBX/GLB, choose PS1 Character, drag a triangle/texture quality slider, then immediately capture it into sprite workflows. That fits this app beautifully.


