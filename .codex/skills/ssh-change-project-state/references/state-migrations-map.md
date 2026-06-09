# State and Migration Map

## Core Surfaces

- Project snapshot types and version: `src/types/project.ts`.
- Project save/load zip flow: `src/store/next/project/index.ts`.
- Snapshot migrations: `src/store/next/project/migration.ts`.
- Stores: `src/store/next/*.ts` and subfolders under `src/store/next`.
- History store and action application: `src/store/next/history/index.ts`, `src/store/next/history/utils.ts`, `src/types/history.ts`.
- Filesystem-backed assets: `src/utils/file-system/fs.web.ts`, `src/utils/file-system/fs.tauri.ts`, `src/lib/file/*.web.ts`, `src/lib/file/*.tauri.ts`.
- Project tests: `tests/unit/project-migration.test.ts`, store-specific unit tests, and project/export integration tests.

## Store Contracts

- Persisted stores expose `getSnapshot`, `hydrate`, and `reset`.
- Add new persisted stores to the `stores` map in `src/store/next/project/index.ts`.
- `snapshot()` composes store snapshots and stamps `CURRENT_VERSION`.
- `restore()` hydrates stores from migrated snapshots.
- `new()` resets all stores, history, app title, and project events.
- `buildZipBlob()` must include external binaries that JSON cannot carry.
- `applySnapshot()` must restore file-backed assets before hydration expects them.

## Migration Rules

- Bump `CURRENT_VERSION` only for persisted snapshot shape changes.
- Add `ProjectSnapshot_vN` and extend the union.
- Add a migration keyed by the new version number.
- Migrations should tolerate missing old fields and provide complete defaults.
- Update `tests/unit/project-migration.test.ts` for v1-to-current behavior and any new edge cases.

## History Rules

- Use `push`, `pushBatch`, or transactions for undoable user actions.
- Preserve merge keys for high-frequency controls such as sliders.
- Undo/redo applies `reverseAction` and `applyAction`; action payloads must contain enough state to reverse.
- Be careful around `isDirty`: history subscriptions mark changes dirty, save/load clears it.

## Test Targets

- Use focused unit tests for stores, migrations, history actions, and pure utilities.
- Use integration tests when a persisted value affects exported files or project round-tripping.
- Useful commands: `npm run test:unit`, `npm run test:integration`, `npm run typecheck`.

## Maintenance Triggers

Update this map when persisted stores are added or removed, project snapshot versions change, filesystem-backed assets move, history action formats change, or migration/test files are renamed. Remove stale paths promptly; future agents should be able to trust every path listed here.
