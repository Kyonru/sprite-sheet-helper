import type { PoseQualityLabel } from "@/utils/pose-retargeting";
import type { PoseEditDraft } from "@/utils/pose-edit";

export type PoseStudioTool =
  | "select"
  | "fk-rotate"
  | "fk-move"
  | "ik"
  | "global-rotate"
  | "global-move";

export type PoseStudioInspectorTab = "assist" | "mapping" | "edit" | "review";

export type PoseStudioOverlayKey =
  | "sourceSkeleton"
  | "modelSkeleton"
  | "beforePose";

export interface PoseFrameQualityMarker {
  frameIndex: number;
  score: number;
  label: PoseQualityLabel;
  warnings: string[];
}

export interface PoseStudioUiState {
  tool: PoseStudioTool;
  inspectorTab: PoseStudioInspectorTab;
  selectedBone: string | null;
  selectedIkTarget: string | null;
  clipName: string;
  overlays: Record<PoseStudioOverlayKey, boolean>;
}

export type PoseStudioUiAction =
  | { type: "setTool"; tool: PoseStudioTool }
  | { type: "setInspectorTab"; tab: PoseStudioInspectorTab }
  | { type: "selectBone"; boneKey: string | null }
  | { type: "selectIkTarget"; targetKey: string | null }
  | { type: "setClipName"; clipName: string }
  | { type: "toggleOverlay"; key: PoseStudioOverlayKey }
  | { type: "setOverlay"; key: PoseStudioOverlayKey; value: boolean };

export function createPoseStudioUiState(
  clipName = "Pose Clip 1",
): PoseStudioUiState {
  return {
    tool: "select",
    inspectorTab: "assist",
    selectedBone: null,
    selectedIkTarget: "leftHand",
    clipName,
    overlays: {
      sourceSkeleton: true,
      modelSkeleton: true,
      beforePose: false,
    },
  };
}

export function poseStudioUiReducer(
  state: PoseStudioUiState,
  action: PoseStudioUiAction,
): PoseStudioUiState {
  switch (action.type) {
    case "setTool":
      return {
        ...state,
        tool: action.tool,
        inspectorTab: action.tool === "select" ? state.inspectorTab : "edit",
      };
    case "setInspectorTab":
      return { ...state, inspectorTab: action.tab };
    case "selectBone":
      return {
        ...state,
        selectedBone: action.boneKey,
        inspectorTab: action.boneKey ? "edit" : state.inspectorTab,
      };
    case "selectIkTarget":
      return {
        ...state,
        selectedIkTarget: action.targetKey,
        tool: action.targetKey ? "ik" : state.tool,
        inspectorTab: action.targetKey ? "edit" : state.inspectorTab,
      };
    case "setClipName":
      return { ...state, clipName: action.clipName };
    case "toggleOverlay":
      return {
        ...state,
        overlays: {
          ...state.overlays,
          [action.key]: !state.overlays[action.key],
        },
      };
    case "setOverlay":
      return {
        ...state,
        overlays: { ...state.overlays, [action.key]: action.value },
      };
    default:
      return state;
  }
}

/**
 * The two questions a tool actually answers.
 *
 * The palette offered six flat buttons — Select, FK Rotate, FK Move, IK, Global
 * Rotate, Global Move — which is one list for two independent choices, named
 * after the rigging technique rather than the thing being moved. Splitting them
 * gives four targets and a gizmo, so "rotate one bone" and "rotate the whole
 * pose" stop looking like unrelated modes. The underlying tool union is
 * unchanged: everything downstream still reads a single `PoseStudioTool`.
 */
export type PoseEditTarget = "select" | "bone" | "ik" | "pose";
export type PoseGizmo = "rotate" | "move";

export function getPoseEditTarget(tool: PoseStudioTool): PoseEditTarget {
  switch (tool) {
    case "fk-rotate":
    case "fk-move":
      return "bone";
    case "ik":
      return "ik";
    case "global-rotate":
    case "global-move":
      return "pose";
    default:
      return "select";
  }
}

export function getPoseGizmo(tool: PoseStudioTool): PoseGizmo {
  return tool === "fk-move" || tool === "global-move" ? "move" : "rotate";
}

/** IK has no gizmo choice — dragging the effector is the whole interaction. */
export function composePoseTool(
  target: PoseEditTarget,
  gizmo: PoseGizmo,
): PoseStudioTool {
  switch (target) {
    case "bone":
      return gizmo === "move" ? "fk-move" : "fk-rotate";
    case "pose":
      return gizmo === "move" ? "global-move" : "global-rotate";
    case "ik":
      return "ik";
    default:
      return "select";
  }
}

export function poseGizmoApplies(target: PoseEditTarget): boolean {
  return target === "bone" || target === "pose";
}

export function getEditModeForTool(tool: PoseStudioTool) {
  return tool === "ik" ? "ik" : "fk";
}

export function getTransformModeForTool(tool: PoseStudioTool) {
  return tool === "fk-move" ? "translate" : "rotate";
}

export function isPoseStudioGizmoEnabled(tool: PoseStudioTool) {
  return tool === "fk-rotate" || tool === "fk-move" || tool === "ik";
}

export function isGlobalPoseStudioTool(tool: PoseStudioTool) {
  return tool === "global-rotate" || tool === "global-move";
}

export function countEditedFrames(draft: PoseEditDraft) {
  return Object.values(draft.overrides).filter(
    (frameOverrides) => Object.keys(frameOverrides).length > 0,
  ).length;
}

export function countEditedBones(draft: PoseEditDraft, frameIndex: number) {
  return Object.keys(draft.overrides[frameIndex] ?? {}).length;
}

export function getPoseDraftDuration(draft: PoseEditDraft) {
  if (draft.frames.length === 0) return 0;
  return draft.frames[draft.frames.length - 1].time;
}

export function getPoseDraftSummary(draft: PoseEditDraft) {
  return {
    frameCount: draft.frames.length,
    duration: getPoseDraftDuration(draft),
    editedFrameCount: countEditedFrames(draft),
  };
}

export function shiftQualityMarkersAfterDelete(
  markers: PoseFrameQualityMarker[],
  deletedFrameIndex: number,
) {
  return markers
    .filter((marker) => marker.frameIndex !== deletedFrameIndex)
    .map((marker) => ({
      ...marker,
      frameIndex:
        marker.frameIndex > deletedFrameIndex
          ? marker.frameIndex - 1
          : marker.frameIndex,
    }));
}

export function trimQualityMarkersBefore(
  markers: PoseFrameQualityMarker[],
  firstFrameIndex: number,
) {
  return markers
    .filter((marker) => marker.frameIndex >= firstFrameIndex)
    .map((marker) => ({
      ...marker,
      frameIndex: marker.frameIndex - firstFrameIndex,
    }));
}

export function trimQualityMarkersAfter(
  markers: PoseFrameQualityMarker[],
  lastFrameIndex: number,
) {
  return markers.filter((marker) => marker.frameIndex <= lastFrameIndex);
}

export function markerTone(label: PoseQualityLabel | undefined) {
  if (label === "Good") return "good";
  if (label === "Usable") return "usable";
  return "poor";
}
