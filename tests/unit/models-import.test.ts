import { beforeEach, describe, expect, it } from "vitest";
import * as THREE from "three";
import { resolveCollisionName, useModelsStore } from "@/store/next/models";
import { useHistoryStore } from "@/store/next/history";
import {
  clearRuntimeModel,
  getOriginalRuntimeModel,
  setOriginalRuntimeModel,
} from "@/utils/model-downgrade-runtime";

const createModel = (fileName: string) => ({
  fileName,
  filePath: `/${fileName}`,
  fileSize: 12,
  type: "application/octet-stream",
  format: "fbx" as const,
  source: "file" as const,
  loadState: "loaded" as const,
  errorMessage: null,
});

function setupCurrentAnimationClip(
  targetUuid: string,
  values: number[],
  name = "Jump",
) {
  const targetMixer = new THREE.AnimationMixer(new THREE.Object3D());
  const targetClip = new THREE.AnimationClip(name, 1, [
    new THREE.VectorKeyframeTrack("Root.position", [0, 0.5, 1], values),
  ]);

  useModelsStore.getState().reset();
  useModelsStore.setState({
    models: {
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
    animations: {
      [targetUuid]: name,
    },
    durations: {},
    speeds: {},
    loops: {},
    currentTime: {},
    frameStep: {},
    freeze: {},
  });
}

function currentPositionValues(targetUuid: string) {
  const updatedTrack = useModelsStore
    .getState()
    .clips[targetUuid]?.[0]?.clip.tracks.at(0);
  expect(updatedTrack).toBeInstanceOf(THREE.VectorKeyframeTrack);
  return Array.from((updatedTrack as THREE.VectorKeyframeTrack).values);
}

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

describe("useModelsStore hidden animations", () => {
  beforeEach(() => {
    useModelsStore.getState().reset();
    useHistoryStore.getState().reset();
  });

  it("hides the selected animation and restores hidden animations", () => {
    const modelUuid = "model-a";

    useModelsStore.getState().setAnimation(modelUuid, "Walk");

    expect(() => {
      useModelsStore.getState().setAnimationHidden(modelUuid, "Walk", true);
    }).not.toThrow();

    expect(useModelsStore.getState().hiddenAnimations[modelUuid]).toEqual([
      "Walk",
    ]);
    expect(useModelsStore.getState().animations[modelUuid]).toBe("none");

    useModelsStore.getState().restoreHiddenAnimations(modelUuid);

    expect(useModelsStore.getState().hiddenAnimations[modelUuid]).toEqual([]);
  });
});

describe("useModelsStore renameAnimation", () => {
  beforeEach(() => {
    useModelsStore.getState().reset();
    useHistoryStore.getState().reset();
  });

  function setupRenameFixture() {
    const modelUuid = "model-rename";
    const mixer = new THREE.AnimationMixer(new THREE.Object3D());
    const walkClip = new THREE.AnimationClip("Walk", 1, []);
    const runClip = new THREE.AnimationClip("Run", 2, []);

    useModelsStore.setState({
      models: {
        [modelUuid]: createModel(`${modelUuid}.fbx`),
      },
      clips: {
        [modelUuid]: [
          { action: mixer.clipAction(walkClip), clip: walkClip },
          { action: mixer.clipAction(runClip), clip: runClip },
        ],
      },
      mixerRef: {
        [modelUuid]: mixer,
      },
      animations: {
        [modelUuid]: "Walk",
      },
      durations: {
        [modelUuid]: {
          Walk: [0.2, 0.8],
        },
      },
      speeds: {
        [modelUuid]: {
          Walk: 1.5,
        },
      },
      loops: {
        [modelUuid]: {
          Walk: THREE.LoopRepeat,
        },
      },
      hiddenAnimations: {
        [modelUuid]: ["Walk"],
      },
      currentTime: {},
      frameStep: {},
      freeze: {},
    });

    return modelUuid;
  }

  it("renames a clip and moves per-animation metadata", () => {
    const modelUuid = setupRenameFixture();

    const result = useModelsStore
      .getState()
      .renameAnimation(modelUuid, "Walk", "Sprint");

    expect(result).toEqual({ name: "Sprint" });

    const state = useModelsStore.getState();
    expect(state.clips[modelUuid]?.map((entry) => entry.clip.name)).toEqual([
      "Sprint",
      "Run",
    ]);
    expect(state.animations[modelUuid]).toBe("Sprint");
    expect(state.durations[modelUuid]).toEqual({ Sprint: [0.2, 0.8] });
    expect(state.speeds[modelUuid]).toEqual({ Sprint: 1.5 });
    expect(state.loops[modelUuid]).toEqual({ Sprint: THREE.LoopRepeat });
    expect(state.hiddenAnimations[modelUuid]).toEqual(["Sprint"]);
    expect(useHistoryStore.getState().past).toHaveLength(1);
    expect(useHistoryStore.getState().past[0]?.type).toBe(
      "model/animationRename",
    );
  });

  it("rejects duplicate and reserved animation names", () => {
    const modelUuid = setupRenameFixture();

    expect(() =>
      useModelsStore.getState().renameAnimation(modelUuid, "Walk", "Run"),
    ).toThrow("Animation name already exists");

    expect(() =>
      useModelsStore.getState().renameAnimation(modelUuid, "Walk", "none"),
    ).toThrow('"none" is reserved');
  });

  it("undoes and redoes animation renames as one history step", () => {
    const modelUuid = setupRenameFixture();

    useModelsStore.getState().renameAnimation(modelUuid, "Walk", "Sprint");
    expect(useHistoryStore.getState().past).toHaveLength(1);

    useHistoryStore.getState().undo();
    let state = useModelsStore.getState();
    expect(state.clips[modelUuid]?.map((entry) => entry.clip.name)).toEqual([
      "Walk",
      "Run",
    ]);
    expect(state.animations[modelUuid]).toBe("Walk");
    expect(state.durations[modelUuid]).toEqual({ Walk: [0.2, 0.8] });
    expect(state.hiddenAnimations[modelUuid]).toEqual(["Walk"]);

    useHistoryStore.getState().redo();
    state = useModelsStore.getState();
    expect(state.clips[modelUuid]?.map((entry) => entry.clip.name)).toEqual([
      "Sprint",
      "Run",
    ]);
    expect(state.animations[modelUuid]).toBe("Sprint");
    expect(state.durations[modelUuid]).toEqual({ Sprint: [0.2, 0.8] });
    expect(state.hiddenAnimations[modelUuid]).toEqual(["Sprint"]);
  });

  it("persists and reapplies animation renames when clips reload", () => {
    const modelUuid = setupRenameFixture();

    useModelsStore.getState().renameAnimation(modelUuid, "Walk", "Sprint");

    const snapshot = useModelsStore.getState().getSnapshot();
    expect(snapshot.animationRenames).toEqual({
      [modelUuid]: {
        Walk: "Sprint",
      },
    });

    useModelsStore.getState().reset();
    useModelsStore.getState().hydrate(snapshot);

    const mixer = new THREE.AnimationMixer(new THREE.Object3D());
    const reloadedWalkClip = new THREE.AnimationClip("Walk", 1, []);
    useModelsStore.getState().setClips(modelUuid, [
      {
        action: mixer.clipAction(reloadedWalkClip),
        clip: reloadedWalkClip,
      },
    ]);

    expect(
      useModelsStore
        .getState()
        .clips[modelUuid]?.map((entry) => entry.clip.name),
    ).toEqual(["Sprint"]);
  });
});

describe("useModelsStore importAnimationsFromSource", () => {
  beforeEach(() => {
    useModelsStore.getState().reset();
    useHistoryStore.getState().reset();
  });

  it("copies animation names with collision suffixes and metadata", async () => {
    const sourceUuid = "source-model";
    const targetUuid = "target-model";
    const sourceMixer = new THREE.AnimationMixer(new THREE.Object3D());
    const targetMixer = new THREE.AnimationMixer(new THREE.Object3D());

    const sourceClipA = new THREE.AnimationClip("Walk", 1, []);
    const sourceClipB = new THREE.AnimationClip("Walk", 1, []);
    const targetClip = new THREE.AnimationClip("Walk", 1, []);
    const targetObject = new THREE.Object3D();

    useModelsStore.getState().reset();
    clearRuntimeModel(targetUuid);
    useModelsStore.setState({
      models: {
        [sourceUuid]: createModel(`${sourceUuid}.fbx`),
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
    setOriginalRuntimeModel(targetUuid, {
      object: targetObject,
      mixer: targetMixer,
      clips: [
        {
          action: targetMixer.clipAction(targetClip),
          clip: targetClip,
        },
      ],
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
    expect(Object.keys(useModelsStore.getState().importedClips[targetUuid])).toEqual(
      ["Walk_1", "Walk_2"],
    );
    expect(
      getOriginalRuntimeModel(targetUuid)?.clips.map((entry) => entry.clip.name),
    ).toEqual(["Walk", "Walk_1", "Walk_2"]);

    const snapshot = useModelsStore.getState().getSnapshot();
    useModelsStore.getState().reset();
    useModelsStore.getState().hydrate(snapshot);
    const reloadedMixer = new THREE.AnimationMixer(new THREE.Object3D());
    const reloadedTargetClip = new THREE.AnimationClip("Walk", 1, []);
    useModelsStore.getState().setClips(targetUuid, [
      {
        action: reloadedMixer.clipAction(reloadedTargetClip),
        clip: reloadedTargetClip,
      },
    ]);

    expect(
      useModelsStore.getState().clips[targetUuid].map((clipRef) => clipRef.clip.name),
    ).toEqual(["Walk", "Walk_1", "Walk_2"]);
  });

  it("replaces matching clip names when forceInPlace is enabled", async () => {
    const sourceUuid = "source-model-force";
    const targetUuid = "target-model-force";
    const sourceMixer = new THREE.AnimationMixer(new THREE.Object3D());
    const targetMixer = new THREE.AnimationMixer(new THREE.Object3D());

    const sourceClip = new THREE.AnimationClip("Walk", 2, []);
    const targetClip = new THREE.AnimationClip("Walk", 1, []);

    useModelsStore.getState().reset();
    useModelsStore.setState({
      models: {
        [sourceUuid]: createModel(`${sourceUuid}.fbx`),
        [targetUuid]: createModel(`${targetUuid}.fbx`),
      },
      clips: {
        [sourceUuid]: [
          { action: sourceMixer.clipAction(sourceClip), clip: sourceClip },
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
          Walk: [0, 2],
        },
        [targetUuid]: {
          Walk: [0, 3],
        },
      },
      speeds: {
        [sourceUuid]: {
          Walk: 1.25,
        },
        [targetUuid]: {
          Walk: 2,
        },
      },
      loops: {
        [sourceUuid]: {
          Walk: THREE.LoopOnce,
        },
        [targetUuid]: {
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
      .importAnimationsFromSource(targetUuid, {
        sourceModelUuid: sourceUuid,
        forceInPlace: true,
      });

    expect(importedNames).toEqual(["Walk"]);

    const { clips, durations, speeds, loops } = useModelsStore.getState();
    expect(clips[targetUuid].map((clipRef) => clipRef.clip.name)).toEqual([
      "Walk",
    ]);
    expect(clips[targetUuid][0]?.clip.duration).toBe(2);
    expect(durations[targetUuid]?.["Walk"]).toEqual([0, 2]);
    expect(speeds[targetUuid]?.["Walk"]).toBe(1.25);
    expect(loops[targetUuid]?.["Walk"]).toBe(THREE.LoopOnce);
    expect(Object.keys(useModelsStore.getState().importedClips[targetUuid])).toEqual(
      ["Walk"],
    );

    const snapshot = useModelsStore.getState().getSnapshot();
    useModelsStore.getState().reset();
    useModelsStore.getState().hydrate(snapshot);
    const reloadedMixer = new THREE.AnimationMixer(new THREE.Object3D());
    const reloadedTargetClip = new THREE.AnimationClip("Walk", 1, []);
    useModelsStore.getState().setClips(targetUuid, [
      {
        action: reloadedMixer.clipAction(reloadedTargetClip),
        clip: reloadedTargetClip,
      },
    ]);

    expect(useModelsStore.getState().clips[targetUuid][0]?.clip.duration).toBe(
      2,
    );
  });

  it("forces imported clip positions to remain in place", async () => {
    const sourceUuid = "source-model-position";
    const targetUuid = "target-model-position";
    const sourceMixer = new THREE.AnimationMixer(new THREE.Object3D());
    const targetMixer = new THREE.AnimationMixer(new THREE.Object3D());

    const rootTrack = new THREE.VectorKeyframeTrack(
      "Root.position",
      [0, 1],
      [5, 1, 2, 8, 4, 9],
    );
    const sourceClip = new THREE.AnimationClip("Walk", 1, [rootTrack]);

    useModelsStore.getState().reset();
    useModelsStore.setState({
      models: {
        [sourceUuid]: createModel(`${sourceUuid}.fbx`),
        [targetUuid]: createModel(`${targetUuid}.fbx`),
      },
      clips: {
        [sourceUuid]: [
          { action: sourceMixer.clipAction(sourceClip), clip: sourceClip },
        ],
        [targetUuid]: [],
      },
      mixerRef: {
        [sourceUuid]: sourceMixer,
        [targetUuid]: targetMixer,
      },
      durations: {},
      speeds: {},
      loops: {},
      animations: {},
      currentTime: {},
      frameStep: {},
      freeze: {},
    });

    await useModelsStore.getState().importAnimationsFromSource(targetUuid, {
      sourceModelUuid: sourceUuid,
      forceInPlace: true,
    });

    const importedTrack = useModelsStore
      .getState()
      .clips[targetUuid]?.[0]?.clip.tracks.at(0);
    expect(importedTrack).toBeInstanceOf(THREE.VectorKeyframeTrack);
    expect(
      Array.from((importedTrack as THREE.VectorKeyframeTrack).values),
    ).toEqual([5, 1, 2, 5, 1, 2]);
  });

  it("preserves imported clip vertical motion when forcing only horizontal axes in place", async () => {
    const sourceUuid = "source-model-horizontal";
    const targetUuid = "target-model-horizontal";
    const sourceMixer = new THREE.AnimationMixer(new THREE.Object3D());
    const targetMixer = new THREE.AnimationMixer(new THREE.Object3D());

    const rootTrack = new THREE.VectorKeyframeTrack(
      "Root.position",
      [0, 0.5, 1],
      [5, 1, 2, 8, 4, 9, 12, 7, 14],
    );
    const sourceClip = new THREE.AnimationClip("Jump", 1, [rootTrack]);

    useModelsStore.getState().reset();
    useModelsStore.setState({
      models: {
        [sourceUuid]: createModel(`${sourceUuid}.fbx`),
        [targetUuid]: createModel(`${targetUuid}.fbx`),
      },
      clips: {
        [sourceUuid]: [
          { action: sourceMixer.clipAction(sourceClip), clip: sourceClip },
        ],
        [targetUuid]: [],
      },
      mixerRef: {
        [sourceUuid]: sourceMixer,
        [targetUuid]: targetMixer,
      },
      durations: {},
      speeds: {},
      loops: {},
      animations: {},
      currentTime: {},
      frameStep: {},
      freeze: {},
    });

    await useModelsStore.getState().importAnimationsFromSource(targetUuid, {
      sourceModelUuid: sourceUuid,
      forceInPlace: true,
      inPlaceAxisMode: "horizontal",
    });

    const importedTrack = useModelsStore
      .getState()
      .clips[targetUuid]?.[0]?.clip.tracks.at(0);
    expect(importedTrack).toBeInstanceOf(THREE.VectorKeyframeTrack);
    expect(
      Array.from((importedTrack as THREE.VectorKeyframeTrack).values),
    ).toEqual([5, 1, 2, 5, 4, 2, 5, 7, 2]);
  });

  it("keeps imported clip root motion unchanged when in-place axis mode is none", async () => {
    const sourceUuid = "source-model-none";
    const targetUuid = "target-model-none";
    const sourceMixer = new THREE.AnimationMixer(new THREE.Object3D());
    const targetMixer = new THREE.AnimationMixer(new THREE.Object3D());

    const rootTrack = new THREE.VectorKeyframeTrack(
      "Root.position",
      [0, 0.5, 1],
      [5, 1, 2, 8, 4, 9, 12, 7, 14],
    );
    const sourceClip = new THREE.AnimationClip("Jump", 1, [rootTrack]);

    useModelsStore.getState().reset();
    useModelsStore.setState({
      models: {
        [sourceUuid]: createModel(`${sourceUuid}.fbx`),
        [targetUuid]: createModel(`${targetUuid}.fbx`),
      },
      clips: {
        [sourceUuid]: [
          { action: sourceMixer.clipAction(sourceClip), clip: sourceClip },
        ],
        [targetUuid]: [],
      },
      mixerRef: {
        [sourceUuid]: sourceMixer,
        [targetUuid]: targetMixer,
      },
      durations: {},
      speeds: {},
      loops: {},
      animations: {},
      currentTime: {},
      frameStep: {},
      freeze: {},
    });

    await useModelsStore.getState().importAnimationsFromSource(targetUuid, {
      sourceModelUuid: sourceUuid,
      forceInPlace: true,
      inPlaceAxisMode: "none",
    });

    const importedTrack = useModelsStore
      .getState()
      .clips[targetUuid]?.[0]?.clip.tracks.at(0);
    expect(importedTrack).toBeInstanceOf(THREE.VectorKeyframeTrack);
    expect(
      Array.from((importedTrack as THREE.VectorKeyframeTrack).values),
    ).toEqual([5, 1, 2, 8, 4, 9, 12, 7, 14]);
  });

  it("forces the selected animation to run in place", async () => {
    const targetUuid = "target-model-force-current";
    const targetMixer = new THREE.AnimationMixer(new THREE.Object3D());
    const targetClip = new THREE.AnimationClip("Run", 1, [
      new THREE.VectorKeyframeTrack(
        "Root.position",
        [0, 1],
        [7, 2, 3, 11, 5, 13],
      ),
    ]);

    useModelsStore.getState().reset();
    useModelsStore.setState({
      models: {
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
      animations: {
        [targetUuid]: "Run",
      },
      durations: {},
      speeds: {},
      loops: {},
      currentTime: {},
      frameStep: {},
      freeze: {},
    });

    const { name } = useModelsStore
      .getState()
      .forceCurrentAnimationInPlace(targetUuid);

    expect(name).toBe("Run");

    const updatedTrack = useModelsStore
      .getState()
      .clips[targetUuid]?.[0]?.clip.tracks.at(0);
    expect(updatedTrack).toBeInstanceOf(THREE.VectorKeyframeTrack);
    expect(
      Array.from((updatedTrack as THREE.VectorKeyframeTrack).values),
    ).toEqual([7, 2, 3, 7, 2, 3]);
  });

  it("preserves selected animation vertical motion when forcing only horizontal axes in place", async () => {
    const targetUuid = "target-model-force-current-horizontal";
    const targetMixer = new THREE.AnimationMixer(new THREE.Object3D());
    const targetClip = new THREE.AnimationClip("Jump", 1, [
      new THREE.VectorKeyframeTrack(
        "Root.position",
        [0, 0.5, 1],
        [7, 2, 3, 11, 5, 13, 17, 8, 23],
      ),
    ]);

    useModelsStore.getState().reset();
    useModelsStore.setState({
      models: {
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
      animations: {
        [targetUuid]: "Jump",
      },
      durations: {},
      speeds: {},
      loops: {},
      currentTime: {},
      frameStep: {},
      freeze: {},
    });

    const { name } = useModelsStore
      .getState()
      .forceCurrentAnimationInPlace(targetUuid, undefined, "horizontal");

    expect(name).toBe("Jump");

    const updatedTrack = useModelsStore
      .getState()
      .clips[targetUuid]?.[0]?.clip.tracks.at(0);
    expect(updatedTrack).toBeInstanceOf(THREE.VectorKeyframeTrack);
    expect(
      Array.from((updatedTrack as THREE.VectorKeyframeTrack).values),
    ).toEqual([7, 2, 3, 7, 5, 3, 7, 8, 3]);
  });

  it.each([
    ["x", [7, 2, 3, 7, 5, 13, 7, 8, 23]],
    ["y", [7, 2, 3, 11, 2, 13, 17, 2, 23]],
    ["z", [7, 2, 3, 11, 5, 3, 17, 8, 3]],
  ] as const)(
    "freezes only the selected %s axis for the selected animation",
    async (mode, expectedValues) => {
      const targetUuid = `target-model-force-current-${mode}`;
      setupCurrentAnimationClip(targetUuid, [7, 2, 3, 11, 5, 13, 17, 8, 23]);

      useModelsStore
        .getState()
        .forceCurrentAnimationInPlace(targetUuid, undefined, mode);

      expect(currentPositionValues(targetUuid)).toEqual(expectedValues);
    },
  );

  it("accepts UI axis labels when forcing the selected animation", async () => {
    const targetUuid = "target-model-force-current-labels";
    const targetMixer = new THREE.AnimationMixer(new THREE.Object3D());
    const targetClip = new THREE.AnimationClip("Jump", 1, [
      new THREE.VectorKeyframeTrack(
        "Root.position",
        [0, 0.5, 1],
        [7, 2, 3, 11, 5, 13, 17, 8, 23],
      ),
    ]);

    useModelsStore.getState().reset();
    useModelsStore.setState({
      models: {
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
      animations: {
        [targetUuid]: "Jump",
      },
      durations: {},
      speeds: {},
      loops: {},
      currentTime: {},
      frameStep: {},
      freeze: {},
    });

    useModelsStore
      .getState()
      .forceCurrentAnimationInPlace(targetUuid, undefined, "Horizontal XZ");

    let updatedTrack = useModelsStore
      .getState()
      .clips[targetUuid]?.[0]?.clip.tracks.at(0);
    expect(
      Array.from((updatedTrack as THREE.VectorKeyframeTrack).values),
    ).toEqual([7, 2, 3, 7, 5, 3, 7, 8, 3]);

    useModelsStore
      .getState()
      .forceCurrentAnimationInPlace(targetUuid, undefined, "None");

    updatedTrack = useModelsStore
      .getState()
      .clips[targetUuid]?.[0]?.clip.tracks.at(0);
    expect(
      Array.from((updatedTrack as THREE.VectorKeyframeTrack).values),
    ).toEqual([7, 2, 3, 11, 5, 13, 17, 8, 23]);
  });

  it("restores selected animation root motion after forcing it in place", async () => {
    const targetUuid = "target-model-force-current-none";
    const targetMixer = new THREE.AnimationMixer(new THREE.Object3D());
    const originalValues = [7, 2, 3, 11, 5, 13, 17, 8, 23];
    const targetClip = new THREE.AnimationClip("Jump", 1, [
      new THREE.VectorKeyframeTrack(
        "Root.position",
        [0, 0.5, 1],
        originalValues,
      ),
    ]);

    useModelsStore.getState().reset();
    useModelsStore.setState({
      models: {
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
      animations: {
        [targetUuid]: "Jump",
      },
      durations: {},
      speeds: {},
      loops: {},
      currentTime: {},
      frameStep: {},
      freeze: {},
    });

    useModelsStore
      .getState()
      .forceCurrentAnimationInPlace(targetUuid, undefined, "horizontal");

    useModelsStore
      .getState()
      .forceCurrentAnimationInPlace(targetUuid, undefined, "none");

    const updatedTrack = useModelsStore
      .getState()
      .clips[targetUuid]?.[0]?.clip.tracks.at(0);
    expect(updatedTrack).toBeInstanceOf(THREE.VectorKeyframeTrack);
    expect(
      Array.from((updatedTrack as THREE.VectorKeyframeTrack).values),
    ).toEqual(originalValues);
  });

  it("does not mutate target state when file parse fails", async () => {
    const sourceUuid = "source-model-fail";
    const targetUuid = "target-model-stable";
    const targetMixer = new THREE.AnimationMixer(new THREE.Object3D());
    const targetClip = new THREE.AnimationClip("Idle", 1, []);

    useModelsStore.getState().reset();
    useModelsStore.setState({
      models: {
        [sourceUuid]: createModel(`${sourceUuid}.fbx`),
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
