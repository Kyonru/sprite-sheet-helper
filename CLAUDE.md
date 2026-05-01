# Sprite Sheet Helper — Claude Context

## Project Overview

Desktop + PWA tool for generating sprite sheets and exporting renders from 3D scenes. Stack: **Vite + React + TypeScript + Tauri**.

## Architecture

### Platform Duality

The app runs as a standard web app and as a native desktop app via Tauri. Platform-specific code uses file-naming convention:

- `feature.web.ts` — default, runs in browser
- `feature.tauri.ts` — native override, swapped at build time by `WebTauriSwapPlugin`

**Always import `.web.*` files — never import `.tauri.*` directly.**

### State Management

- **Zustand** for global app state
- React local state for UI-only concerns

### 3D Rendering

- **React Three Fiber (R3F)** — React wrapper over Three.js
- **@react-three/drei** — helpers (OrbitControls, useGLTF, etc.)
- **@react-three/postprocessing** — effects pipeline
- Non-reactive 3D state (per-frame updates) always uses `useRef` + `useFrame`, never `useState`

### UI

- **Radix UI** primitives + **shadcn/ui** conventions
- **Tailwind CSS v4** (with `@tailwindcss/vite` plugin)
- **lucide-react** for icons — do NOT use deprecated brand icons (`Github`, `Linkedin`); create inline SVG components instead
- `oklch()` color space used in custom gradient styles

## Key Files & Directories

```bash
src/
  components/
    camera-animation-capture/   # MediaPipe webcam capture pipeline
      index.tsx                 # Step orchestrator (disclaimer→capture→review→save)
      capture-step.tsx          # Live webcam / photo capture
      review-step.tsx           # Frame scrubber, trim, global corrections, per-bone overrides
      model-preview.tsx         # R3F canvas — live OR static pose playback
      bone-remap-panel.tsx      # Map MediaPipe bones to rig naming conventions
      save-step.tsx             # Name and save captured clip
    about-modal.tsx             # Gradient hero + creator links + sponsor button
    docs.tsx                    # In-app docs modal (Fuse.js search, ReactMarkdown)
    panels/                     # Scene control panels (lights, camera, effects, etc.)
    editor/                     # Main editor layout
    timeline/                   # Animation timeline controls
  docs/                         # Markdown source for in-app documentation
    getting-started.md
    tutorial.md
    projects.md
    animations.md
    camera-capture.md           # Camera animation capture workflow guide
    camera.md
    effects.md
    lighting.md
    exporting.md
    workflows.md
    cli.md
  utils/
    mediapipe-to-bones.ts       # Converts MediaPipe world landmarks → bone quaternions
```

## Camera Animation Capture Pipeline

1. **MediaPipe** (`@mediapipe/tasks-vision`) detects pose from webcam/photo in-browser
2. `mediapipe-to-bones.ts` converts world landmarks to bone quaternions
   - Z is zeroed out (`new THREE.Vector3(-p.x, -p.y, 0)`) to prevent forward tilt — chest is closer to camera than hips in world coords, zeroing Z projects onto XY plane for frontal captures
3. Frames stored as `PoseFrame[]` with `PoseBoneData` (hips + per-bone quaternions)
4. **Review step** applies corrections non-destructively until save:
   - Global corrections (euler rotation pre-multiply on hips, L↔R mirror)
   - Per-bone overrides (euler sliders per frame, "apply to all frames" option)
   - Mirror formula: `new Quaternion(-q.x, q.y, -q.z, q.w).normalize()`
5. On save: corrections baked into frame data, clip added to model's animation list

### Static Pose Playback

`ModelPreview` / `PosedModel` accept a `staticPoseRef?: React.RefObject<PoseBoneData | null>`. When set, `useFrame` resets all bones to rest quaternions, applies stored quaternions by bone name, calls `updateMatrixWorld`, and returns early — bypassing the live landmark path entirely.

## In-App Documentation

- Markdown files in `src/docs/` loaded via `import.meta.glob`
- Frontmatter: `---\ntitle: Page Title\n---`
- Sidebar order controlled by `DOC_ORDER` array in `src/components/docs.tsx`
- Internal doc links: use bare slug as href (e.g. `[text](camera-capture)`) — the ReactMarkdown `a` component intercepts these and calls `setSelected()` instead of navigating
- External links open in `_blank`

### Adding a New Doc Page

1. Create `src/docs/your-slug.md` with frontmatter `title:`
2. Add `"your-slug"` to `DOC_ORDER` in `docs.tsx` at the right position
3. Add an icon to `SLUG_ICONS` in `docs.tsx`

## Export Formats

`spritesheet` | `zip` | `gif` | `bevy` | `godot` | `unity` | `phaser` | `pygame` | `raylib` | `love2d-lua` | `love2d-anim8` | `turbo`

Aliases: `bevy-rust` → `bevy`, `love2d` → `love2d-lua`

## CLI

Headless batch processing via Puppeteer. Build first with `npm run build:cli`, then run `npm run cli -- <input> [options]`.

Workflow presets: `topdown-8dir`, `topdown-4dir`, `isometric`, `platformer`

## Scripts

| Command             | Description                 |
| ------------------- | --------------------------- |
| `npm run dev`       | Vite dev server (web only)  |
| `npm run tauri dev` | Desktop app with hot reload |
| `npm run build`     | Web frontend build          |
| `npm run build:cli` | CLI-enabled build           |
| `npm run typecheck` | Type-check without emit     |
| `npm run lint`      | ESLint                      |
| `npm run knip`      | Dead code detection         |

## Coding Conventions

- No comments unless the WHY is non-obvious
- No docstrings or multi-line comment blocks
- Prefer editing existing files over creating new ones
- R3F state updates: always `useRef` + `useFrame`, never `useState` for per-frame data
- Tailwind for all styling; no inline styles except complex gradients/animations
- `createPortal(…, document.body)` for modals that need to escape stacking contexts
- Modal open/close via module-level listener pattern (`_listener`) — avoids prop-drilling

## Linting Notes

- **MD001**: Heading levels must not skip (e.g. `##` → `####` is invalid, must go `##` → `###`)
- **MD024**: No duplicate heading text within the same document
