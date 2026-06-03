import { type ProjectSnapshot_v3, CURRENT_VERSION } from "@/types/project";

type RawSnapshot = Record<string, unknown> & { version: number };

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
};

export function migrateSnapshot(raw: RawSnapshot): ProjectSnapshot_v3 {
  let current = raw;
  const target = CURRENT_VERSION;

  for (let v = current.version; v < target; v++) {
    const migrate = migrations[v + 1];
    if (!migrate) throw new Error(`No migration found from v${v} to v${v + 1}`);
    current = migrate(current);
  }

  return current as unknown as ProjectSnapshot_v3;
}
