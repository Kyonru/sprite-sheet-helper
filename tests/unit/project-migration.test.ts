import { describe, expect, it } from "vitest";
import { migrateSnapshot } from "@/store/next/project/migration";

describe("project migrations", () => {
  it("adds empty material, downgrade, authored model, and animation snapshots when migrating v1 projects", () => {
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

    expect(migrated.version).toBe(7);
    expect("materials" in migrated).toBe(true);
    expect(migrated.materials).toEqual({
      materials: {},
      assignments: {},
      textures: {},
      selectedMaterialId: undefined,
      selectedAssignmentId: undefined,
    });
    expect(migrated.modelDowngrades).toEqual({
      entries: {},
      selectedPresetId: "ps1-character",
    });
    expect(migrated.authoredModels).toEqual({
      recipes: {},
      selectedRecipeId: undefined,
    });
    expect(migrated.models).toEqual({
      models: {},
      hiddenAnimations: {},
      animationRenames: {},
    });
    expect(migrated.spritePostprocess).toEqual({
      enabled: false,
      effects: [],
      selectedRow: 0,
      selectedFrame: 0,
      compareBeforeAfter: false,
    });
  });
});
