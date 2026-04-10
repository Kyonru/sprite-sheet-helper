import { type ProjectSnapshotVersion, CURRENT_VERSION } from "@/types/project";

type RawSnapshot = Record<string, unknown> & { version: number };

// Add a migration function here for each version bump
const migrations: Record<number, (old: RawSnapshot) => RawSnapshot> = {
  // Example: migrating from v1 to v2
  // 2: (old) => ({ ...old, version: 2, newField: "default" }),
};

export function migrateSnapshot(raw: RawSnapshot): ProjectSnapshotVersion {
  let current = raw;
  const target = CURRENT_VERSION;

  for (let v = current.version; v < target; v++) {
    const migrate = migrations[v + 1];
    if (!migrate) throw new Error(`No migration found from v${v} to v${v + 1}`);
    current = migrate(current);
  }

  return current as unknown as ProjectSnapshotVersion;
}
