# Export and CLI Map

## Core Surfaces

- App export types: `src/types/file.ts`.
- Exporter registry: `src/utils/exports/index.ts`.
- Exporters: `src/utils/exports/*.ts`.
- Shared atlas code: `src/utils/atlas.ts`, `src/utils/atlas-renderer.ts`, `src/utils/export-validation.ts`.
- Export UI: `src/components/export-workbench.tsx` and `src/components/export-workbench/sequence-preview.tsx`.
- Workflow presets: `src/constants/workflows.ts`.
- CLI parser and data: `cli/options.ts`, `cli/data.ts`, `cli/types.ts`, `cli/workflows.ts`, `cli/export.ts`, `cli/output.ts`.
- Docs: `README.md`, `src/docs/exporting.md`, `src/docs/cli.md`, `src/docs/workflows.md`, `src/docs/normal-maps.md`.

## Invariants

- `ExportFormats` in `src/types/file.ts`, `EXPORT_FORMATS` in `cli/data.ts`, and `exporters` in `src/utils/exports/index.ts` must agree.
- Exporter `id` must be exactly one `ExportFormat`.
- CLI aliases live in `cli/options.ts`; avoid adding aliases only in docs.
- CLI workflow lists are duplicated in `cli/data.ts` by design.
- `atlasBleed` maps to atlas `extrude`.
- Generic spritesheet can support multi-page output; engine exporters should reject multi-page unless the target engine support is implemented.
- Normal maps require `includeNormalMap` plus per-row `normalImages`; JSON metadata should mention normal atlases only when requested.
- Workflow camera angles are degrees. `phi` is elevation in `src/constants/workflows.ts` and CLI overrides.

## Test Targets

- Unit: `tests/unit/spritesheet-json.test.ts`, `tests/unit/atlas.test.ts`, `tests/unit/export-validation.test.ts`, `tests/unit/cli-options.test.ts`.
- Integration: `tests/integration/exporters.test.ts`, `tests/integration/output.test.ts`, `tests/integration/cli-export.test.ts`, `tests/integration/cli-workflows.test.ts`.
- E2E: `tests/e2e/cli.test.ts`, `tests/e2e/workflow-goldens.test.ts`, `tests/e2e/workflow-reproducibility.test.ts`.
- Useful commands: `npm run test:unit`, `npm run test:integration`, `npm run test:e2e:goldens`, `npm run build:cli`.

## Maintenance Triggers

Update this map when export formats, CLI flags, workflow IDs, atlas options, file names, normal-map behavior, docs locations, or export test locations change. Remove stale paths promptly; future agents should be able to trust every path listed here.
