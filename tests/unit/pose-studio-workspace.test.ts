import { describe, expect, it } from "vitest";
import type { PoseEditDraft } from "@/utils/pose-edit";
import {
  countEditedBones,
  countEditedFrames,
  createPoseStudioUiState,
  getEditModeForTool,
  getPoseDraftSummary,
  getTransformModeForTool,
  isGlobalPoseStudioTool,
  isPoseStudioGizmoEnabled,
  poseStudioUiReducer,
  shiftQualityMarkersAfterDelete,
  trimQualityMarkersAfter,
  trimQualityMarkersBefore,
  type PoseFrameQualityMarker,
} from "@/components/pose-studio/workspace";

const marker = (
  frameIndex: number,
  label: PoseFrameQualityMarker["label"] = "Good",
): PoseFrameQualityMarker => ({
  frameIndex,
  label,
  score: label === "Good" ? 0.95 : label === "Usable" ? 0.65 : 0.25,
  warnings: label === "Poor" ? ["Low quality"] : [],
});

const draft = (): PoseEditDraft => ({
  frames: [
    // Only time is read by these helpers.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    { time: 0, data: {} as any },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    { time: 0.25, data: {} as any },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    { time: 0.5, data: {} as any },
  ],
  correction: {
    rotX: 0,
    rotY: 0,
    rotZ: 0,
    moveX: 0,
    moveY: 0,
    moveZ: 0,
    mirror: false,
  },
  overrides: {
    0: { hips: { x: 1, y: 2, z: 3 } },
    2: {
      leftArm: { x: 4, y: 5, z: 6 },
      rightArm: { x: 7, y: 8, z: 9 },
    },
  },
});

describe("pose studio workspace helpers", () => {
  it("creates a stable default UI state", () => {
    const state = createPoseStudioUiState("Walk Pose");

    expect(state.clipName).toBe("Walk Pose");
    expect(state.tool).toBe("select");
    expect(state.inspectorTab).toBe("assist");
    expect(state.selectedIkTarget).toBe("leftHand");
    expect(state.overlays).toEqual({
      sourceSkeleton: true,
      modelSkeleton: true,
      beforePose: false,
    });
  });

  it("moves the inspector to edit when a tool or target is selected", () => {
    const initial = createPoseStudioUiState();
    const withTool = poseStudioUiReducer(initial, {
      type: "setTool",
      tool: "ik",
    });
    const withBone = poseStudioUiReducer(initial, {
      type: "selectBone",
      boneKey: "leftArm",
    });
    const withTarget = poseStudioUiReducer(initial, {
      type: "selectIkTarget",
      targetKey: "head",
    });

    expect(withTool.inspectorTab).toBe("edit");
    expect(withBone.inspectorTab).toBe("edit");
    expect(withTarget.tool).toBe("ik");
    expect(withTarget.inspectorTab).toBe("edit");
  });

  it("toggles overlays independently", () => {
    const initial = createPoseStudioUiState();
    const withoutSource = poseStudioUiReducer(initial, {
      type: "toggleOverlay",
      key: "sourceSkeleton",
    });
    const withBefore = poseStudioUiReducer(withoutSource, {
      type: "setOverlay",
      key: "beforePose",
      value: true,
    });

    expect(withoutSource.overlays.sourceSkeleton).toBe(false);
    expect(withoutSource.overlays.modelSkeleton).toBe(true);
    expect(withBefore.overlays.beforePose).toBe(true);
  });

  it("maps tools to edit and transform behavior", () => {
    expect(getEditModeForTool("ik")).toBe("ik");
    expect(getEditModeForTool("fk-rotate")).toBe("fk");
    expect(getTransformModeForTool("fk-move")).toBe("translate");
    expect(getTransformModeForTool("select")).toBe("rotate");
    expect(isPoseStudioGizmoEnabled("select")).toBe(false);
    expect(isPoseStudioGizmoEnabled("ik")).toBe(true);
    expect(isGlobalPoseStudioTool("global-move")).toBe(true);
  });

  it("summarises save readiness", () => {
    const summary = getPoseDraftSummary(draft());

    expect(summary).toEqual({
      frameCount: 3,
      duration: 0.5,
      editedFrameCount: 2,
    });
    expect(countEditedFrames(draft())).toBe(2);
    expect(countEditedBones(draft(), 2)).toBe(2);
  });

  it("shifts quality markers when deleting and trimming timeline frames", () => {
    const markers = [marker(0), marker(1, "Usable"), marker(2, "Poor")];

    expect(shiftQualityMarkersAfterDelete(markers, 1)).toEqual([
      marker(0),
      { ...marker(2, "Poor"), frameIndex: 1 },
    ]);
    expect(trimQualityMarkersBefore(markers, 1)).toEqual([
      { ...marker(1, "Usable"), frameIndex: 0 },
      { ...marker(2, "Poor"), frameIndex: 1 },
    ]);
    expect(trimQualityMarkersAfter(markers, 1)).toEqual([
      marker(0),
      marker(1, "Usable"),
    ]);
  });
});
