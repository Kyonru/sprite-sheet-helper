# Materials and Effects Map

## Core Surfaces

- Material types and constants: `src/types/materials.ts`, `src/constants/materials.ts`.
- Material store and runtime: `src/store/next/materials.ts`, `src/utils/material-runtime.ts`, `src/utils/material-textures.ts`.
- Material UI: `src/components/materials/material-workbench.tsx`, `src/components/panels/top/materials.tsx`, `src/components/panels/main/selected/explorer/material.tsx`.
- Model downgrade visuals: `src/types/model-downgrade.ts`, `src/constants/model-downgrade.ts`, `src/store/next/model-downgrades.ts`, `src/utils/model-downgrade.ts`, `src/utils/model-downgrade-runtime.ts`.
- Effect types and defaults: `src/types/effects.ts`, `src/constants/effects.ts`, `src/store/next/effects/index.ts`.
- Effect UI and runtime: `src/components/panels/top/effects.tsx`, `src/components/panels/main/explorer/effects.tsx`, `src/components/panels/main/selected/effects.tsx`, `src/utils/effects.ts`.
- Shader editors: `src/components/editor/glsl/*`, `src/components/editor/lua/*`, `src/components/custom-shader-modal.tsx`.

## Material Rules

- Persist `materials`, `assignments`, `textures`, and selected IDs.
- Keep `inventories` runtime-only; they come from inspecting loaded model meshes.
- Texture binaries are saved through filesystem helpers and bundled under `materials/` in project zips.
- Generated retro textures should preserve source references and generation options.
- Material runtime should tolerate missing texture files and unavailable mesh paths.

## Effect Rules

- Adding an effect usually touches the `EffectType` union, effect component type, defaults, store helpers, UI controls, runtime application, and tests.
- Keep effect defaults deterministic and serializable.
- Store colors as strings and numeric vector-like values in plain arrays when persisted.
- Validate or safely fallback custom shader text so one bad shader does not crash unrelated rendering.
- Be mindful of effect order when adding post-processing passes.

## Test Targets

- Unit: `tests/unit/materials-store.test.ts`, `tests/unit/material-textures.test.ts`, `tests/unit/material-runtime.test.ts`, `tests/unit/model-downgrade.test.ts`, `tests/unit/effects-store.test.ts`, `tests/unit/effects-utils.test.ts`.
- Integration: `tests/integration/materials-project.test.ts`, `tests/integration/model-downgrade-export.test.ts`.
- Useful commands: `npm run test:unit`, `npm run test:integration`, `npm run typecheck`.

## Maintenance Triggers

Update this map when material/effect types, constants, stores, runtime helpers, shader editors, model downgrade files, or related tests move or change responsibilities. Remove stale paths promptly; future agents should be able to trust every path listed here.
