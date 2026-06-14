import type { ProjectSnapshot } from "@/types/project";
import type { ProjectSnapshotVersion } from "@/types/project";
import { CURRENT_VERSION } from "@/types/project";

export type RawSnapshot = Record<string, unknown> & { version: number };

// Add a migration function here for each version bump
const migrations: Record<number, (old: RawSnapshot) => RawSnapshot> = {
  2: (old) => ({
    ...old,
    version: 2,
    materials: old.materials ?? {
      materials: {},
      assignments: {},
      textures: {},
      selectedMaterialId: undefined,
      selectedAssignmentId: undefined,
    },
  }),
  3: (old) => ({
    ...old,
    version: 3,
    modelDowngrades: old.modelDowngrades ?? {
      entries: {},
      selectedPresetId: "ps1-character",
    },
  }),
  4: (old) => ({
    ...old,
    version: 4,
    authoredModels: old.authoredModels ?? {
      recipes: {},
      selectedRecipeId: undefined,
    },
    models:
      typeof old.models === "object" && old.models !== null
        ? {
            ...old.models,
            models: Object.fromEntries(
              Object.entries(
                ((old.models as { models?: Record<string, unknown> }).models ??
                  {}) as Record<string, Record<string, unknown>>,
              ).map(([uuid, model]) => [
                uuid,
                {
                  source: "file",
                  ...model,
                },
              ]),
            ),
          }
        : old.models,
  }),
  5: (old) => ({
    ...old,
    version: 5,
    models:
      typeof old.models === "object" && old.models !== null
        ? {
            ...old.models,
            hiddenAnimations:
              (old.models as { hiddenAnimations?: Record<string, string[]> })
                .hiddenAnimations ?? {},
          }
        : old.models,
  }),
  6: (old) => ({
    ...old,
    version: 6,
    spritePostprocess: old.spritePostprocess ?? {
      enabled: false,
      effects: [],
      selectedRow: 0,
      selectedFrame: 0,
      compareBeforeAfter: false,
    },
  }),
  7: (old) => ({
    ...old,
    version: 7,
    models:
      typeof old.models === "object" && old.models !== null
        ? {
            ...old.models,
            animationRenames:
              (
                old.models as {
                  animationRenames?: Record<string, Record<string, string>>;
                }
              ).animationRenames ?? {},
          }
        : old.models,
  }),
  8: (old) => ({
    ...old,
    version: 8,
    models:
      typeof old.models === "object" && old.models !== null
        ? {
            ...old.models,
            importedClips:
              (
                old.models as {
                  importedClips?: Record<string, Record<string, unknown>>;
                }
              ).importedClips ?? {},
          }
        : old.models,
  }),
};

export function migrateSnapshot(
  raw: ProjectSnapshotVersion | RawSnapshot,
): ProjectSnapshot {
  let current = raw as RawSnapshot;
  const target = CURRENT_VERSION;

  for (let v = current.version; v < target; v++) {
    const migrate = migrations[v + 1];
    if (!migrate) throw new Error(`No migration found from v${v} to v${v + 1}`);
    current = migrate(current);
  }

  return current as unknown as ProjectSnapshot;
}
