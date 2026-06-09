# UI and Scene Map

## Core Surfaces

- App shell: `src/App.tsx`, `src/layout.tsx`, `src/main.tsx`, `src/App.css`, `src/index.css`.
- UI primitives: `src/components/ui/*`.
- Top menus and panels: `src/components/panels/top/*`, `src/components/panels/main/*`, `src/components/panels/scene/*`.
- Export and modal surfaces: `src/components/export-workbench.tsx`, `src/components/export-modal.tsx`, `src/components/*modal*.tsx`.
- Scene components and shared state: `src/components/entity.tsx`, `src/components/object/*`, `src/context/shared-scene.tsx`, `src/context/next/entity-context.tsx`.
- Platform split files: `*.web.ts`, `*.tauri.ts`, `vite-plugins/web-tauri-swap.ts`, `src/utils/app.web.ts`, `src/utils/app.tauri.ts`.

## UI Conventions

- Use existing shadcn/Radix primitives and lucide icons.
- Keep editor surfaces compact, scannable, and suitable for repeated work.
- Prefer icon buttons for common tool actions and clear text buttons for commands.
- Keep cards for repeated items, modals, and genuinely framed tools; avoid nesting cards.
- Give fixed-format controls stable dimensions so labels, icons, and hover states do not shift layout.
- Preserve keyboard accessibility and accessible labels for icon-only controls.

## Scene Conventions

- Use React Three Fiber and Drei patterns already present in the app.
- Keep scene-wide state in stores or shared scene context.
- Avoid creating competing render loops or unmanaged Three.js objects.
- Verify object disposal and cleanup when adding loaded assets, effects, or controls.

## Platform Rules

- Web/Tauri variants should share call sites and differ only behind `.web` and `.tauri` modules.
- Keep file dialogs, saving, app title, filesystem, and reload behavior behind existing abstractions.
- Check `vite.config.ts` before adding new build-time platform branching.

## Test Targets

- Use `npm run typecheck` and `npm run lint` for most UI changes.
- Use `npm run test:unit` for reducer, utility, and store-backed UI behavior.
- Use browser inspection or screenshot checks for viewport, canvas, drag/drop, and responsive layout changes.

## Maintenance Triggers

Update this map when app shell files, UI primitives, panel locations, scene contexts, platform split modules, or visual verification practices change. Remove stale paths promptly; future agents should be able to trust every path listed here.
