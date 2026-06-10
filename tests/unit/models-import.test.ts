import { beforeEach, describe, expect, it } from "vitest";
import * as THREE from "three";
import { resolveCollisionName, useModelsStore } from "@/store/next/models";

const createModel = (fileName: string) => ({
  fileName,
  filePath: `/${fileName}`,
  fileSize: 12,
  type: "application/octet-stream",
  format: "fbx",
  source: "file" as const,
  loadState: "loaded" as const,
  errorMessage: null,
});

describe("resolveCollisionName", () => {
  it("keeps non-colliding names unchanged", () => {
    expect(resolveCollisionName("Walk", new Set(["Run", "Jump"]))).toBe("Walk");
  });

  it("adds +1 and +2 suffixes for collisions", () => {
    expect(resolveCollisionName("Walk", new Set(["Walk"]))).toBe("Walk_1");
    expect(resolveCollisionName("Walk", new Set(["Walk", "Walk_1"]))).toBe(
      "Walk_2",
    );
    expect(
      resolveCollisionName("Walk", new Set(["Walk", "Walk_1", "Walk_2"])),
    ).toBe("Walk_3");
  });
});

describe("useModelsStore importAnimationsFromSource", () => {
  beforeEach(() => {
    useModelsStore.getState().reset();
  });

  it("copies animation names with collision suffixes and metadata", async () => {
    const sourceUuid = "source-model";
    const targetUuid = "target-model";
    const sourceMixer = new THREE.AnimationMixer(new THREE.Object3D());
    const targetMixer = new THREE.AnimationMixer(new THREE.Object3D());

    const sourceClipA = new THREE.AnimationClip("Walk", 1, []);
    const sourceClipB = new THREE.AnimationClip("Walk", 1, []);
    const targetClip = new THREE.AnimationClip("Walk", 1, []);

    useModelsStore.getState().reset();
    useModelsStore.setState({
      models: {
        // @ts-expect-error invalid key
        [sourceUuid]: createModel(`${sourceUuid}.fbx`),
        // @ts-expect-error invalid key
        [targetUuid]: createModel(`${targetUuid}.fbx`),
      },
      clips: {
        [sourceUuid]: [
          { action: sourceMixer.clipAction(sourceClipA), clip: sourceClipA },
          { action: sourceMixer.clipAction(sourceClipB), clip: sourceClipB },
        ],
        [targetUuid]: [
          { action: targetMixer.clipAction(targetClip), clip: targetClip },
        ],
      },
      mixerRef: {
        [sourceUuid]: sourceMixer,
        [targetUuid]: targetMixer,
      },
      durations: {
        [sourceUuid]: {
          Walk: [0, 1],
        },
      },
      speeds: {
        [sourceUuid]: {
          Walk: 1.75,
        },
      },
      loops: {
        [sourceUuid]: {
          Walk: THREE.LoopRepeat,
        },
      },
      animations: {},
      currentTime: {},
      frameStep: {},
      freeze: {},
    });

    const { importedNames } = await useModelsStore
      .getState()
      .importAnimationsFromSource(targetUuid, { sourceModelUuid: sourceUuid });

    expect(importedNames).toEqual(["Walk_1", "Walk_2"]);

    const { clips, durations, speeds, loops } = useModelsStore.getState();
    expect(clips[targetUuid].map((clipRef) => clipRef.clip.name)).toEqual([
      "Walk",
      "Walk_1",
      "Walk_2",
    ]);
    expect(durations[targetUuid]?.["Walk_1"]).toEqual([0, 1]);
    expect(speeds[targetUuid]?.["Walk_1"]).toBe(1.75);
    expect(loops[targetUuid]?.["Walk_1"]).toBe(THREE.LoopRepeat);
  });

  it("does not mutate target state when file parse fails", async () => {
    const sourceUuid = "source-model-fail";
    const targetUuid = "target-model-stable";
    const targetMixer = new THREE.AnimationMixer(new THREE.Object3D());
    const targetClip = new THREE.AnimationClip("Idle", 1, []);

    useModelsStore.getState().reset();
    useModelsStore.setState({
      models: {
        // @ts-expect-error invalid key
        [sourceUuid]: createModel(`${sourceUuid}.fbx`),
        // @ts-expect-error invalid key
        [targetUuid]: createModel(`${targetUuid}.fbx`),
      },
      clips: {
        [targetUuid]: [
          { action: targetMixer.clipAction(targetClip), clip: targetClip },
        ],
      },
      mixerRef: {
        [targetUuid]: targetMixer,
      },
      animations: {},
      durations: {},
      speeds: {},
      loops: {},
      currentTime: {},
      frameStep: {},
      freeze: {},
    });

    const before = useModelsStore.getState();
    await expect(
      useModelsStore.getState().importAnimationsFromSource(targetUuid, {
        sourceFile: new File(["not-a-valid-model"], "invalid.txt"),
      }),
    ).rejects.toThrow("Unsupported format");

    const after = useModelsStore.getState();
    expect(after.clips[targetUuid]).toEqual(before.clips[targetUuid]);
    expect(after.durations).toEqual(before.durations);
    expect(after.speeds).toEqual(before.speeds);
    expect(after.loops).toEqual(before.loops);
  });
});
