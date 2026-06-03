import { describe, expect, it } from "vitest";
import { migrateSnapshot } from "@/store/next/project/migration";

describe("project migrations", () => {
  it("adds an empty materials snapshot when migrating v1 projects", () => {
    const migrated = migrateSnapshot({
      version: 1,
      savedAt: 1,
      name: "Old Project",
      entities: { entities: {}, children: {} },
      settings: {},
      images: {},
      lights: {},
      transforms: {},
      targets: {},
      models: {},
      cameras: {},
      history: {},
      effects: {},
    });

    expect(migrated.version).toBe(2);
    expect("materials" in migrated).toBe(true);
    expect(migrated.materials).toEqual({
      materials: {},
      assignments: {},
      textures: {},
      selectedMaterialId: undefined,
      selectedAssignmentId: undefined,
    });
  });
});
