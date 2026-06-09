# Pose Studio Map

## Core Surfaces

- Pose Studio shell and workspace helpers: `src/components/pose-studio/index.tsx`, `src/components/pose-studio/pose-studio-shell.tsx`, `src/components/pose-studio/workspace.ts`.
- Camera capture flow: `src/components/camera-animation-capture/*`.
- Pose utilities: `src/utils/pose-edit.ts`, `src/utils/pose-retargeting.ts`, `src/utils/pose-to-animation.ts`, `src/utils/pose-ik.ts`, `src/utils/mediapipe-to-bones.ts`, `src/utils/bone-remap.ts`.
- Capture hooks: `src/hooks/next/use-mediapipe.ts`, `src/hooks/next/use-create-authored-model.ts`.
- Authored model state: `src/store/next/authored-models.ts`, `src/types/authored-models.ts`, `src/utils/authored-models.ts`.
- Tests: pose-related files in `tests/unit` and `tests/integration/authored-models.test.ts`.

## Pipeline

- Capture produces raw pose frames from live video or photo input.
- Review step handles trimming, deletion, correction, mirroring, and per-bone overrides.
- Pose Studio UI state lives in reducer-style helpers where possible.
- Saved clips should flow through authored models and `buildAnimationClip` style utilities so exporters see normal animation clips.

## Editing Rules

- Keep frame index transformations synchronized across frames, overrides, quality markers, and selected frame state.
- Use quaternions or existing pose helpers for rotation math; avoid ad hoc Euler conversions unless the surrounding code already uses them.
- IK changes should gracefully fall back when a chain or mapped bone is unavailable.
- Keep session-only preview state out of project snapshots unless the feature explicitly requires persistence.
- UI should expose FK, IK, global correction, overlays, mapping, edit, and save state without hiding existing capture review flows.

## Test Targets

- Unit: `tests/unit/pose-edit.test.ts`, `tests/unit/pose-retargeting.test.ts`, `tests/unit/pose-ik.test.ts`, `tests/unit/pose-to-animation.test.ts`, `tests/unit/bone-remap.test.ts`, `tests/unit/pose-studio-workspace.test.ts`.
- Integration: `tests/integration/authored-models.test.ts`.
- Useful commands: `npm run test:unit`, `npm run test:integration`, `npm run typecheck`.

## Maintenance Triggers

Update this map when capture steps, Pose Studio components, pose utility names, authored model save paths, quality marker behavior, or pose test files change. Remove stale paths promptly; future agents should be able to trust every path listed here.
