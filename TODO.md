# Things to fix or improve

## Features

### Sprite Sheet mode

- Being able to modify sprite pixels
- Being able to import aseprite file (.ase)
- Being able to import sprite sheets from other formats (.png, .gif, .zip)
- Shader support for sprite mode
- Padding/bleeding control between frames (prevents texture bleeding at runtime)
- Scale export (1x, 2x, 4x) for different screen densities
- Flip / rotate frames non-destructively
- Color palette swapping — great for character variants/skins

### Shader graph

- Have granular control over how shaders are applied

### Timeline

- Add timeline
- Add timeline controls
- Add timeline preview
- Add timeline export
- Add animation keyframes for all properties

### Animation

- Improve Preview animations directly in the tool before exporting, with playback controls (play, pause, scrub)
- Per-animation FPS override instead of one global setting
- Loop vs one-shot flag per animation, passed through to exporters
- Onion skinning in the preview
- Flux programmed useFrame animations
- Camera mixamo.com armature animation using vision camera
- Import existing spritesheets + JSON (TexturePacker, Aseprite, Libresprite) and re-export to other formats — huge if devs are switching engines
- Import animated GIF/WebP and auto-slice into frames
- Import Aseprite files directly (.ase/.aseprite are common)

### Atlas intelligence

- Bin-packing algorithm for the atlas layout instead of a fixed grid — cuts wasted space dramatically
- Multiple atlas pages when frames don't fit in one texture (needed for large projects)
- Max atlas size constraint setting (1024×1024, 2048×2048, etc.)

### Models

- Drag and drop models

### Desktop

- Top menu should be hidden on desktop, use native menubar instead

## Bugs

- Fix carousel when items < 6

## Improvements

- Performance
- Export images changes history
- Free preview windows (instead of fixed at the button since it doesn't use all the space anyway).
- Tutorial
- Documentation pages
- Check for updates
- CLI or API mode so it can be piped into a build system
