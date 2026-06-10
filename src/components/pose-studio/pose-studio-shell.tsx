import {
  useCallback,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
} from "react";
import type { NormalizedLandmark } from "@mediapipe/tasks-vision";
import {
  AlertCircle,
  Bone,
  Camera,
  CheckCircle2,
  Clipboard,
  ClipboardPaste,
  Crosshair,
  Eye,
  EyeOff,
  FlipHorizontal,
  Gauge,
  Image as ImageIcon,
  Loader2,
  Move3D,
  Play,
  Redo2,
  Rotate3D,
  RotateCcw,
  Save,
  Scissors,
  Settings2,
  ShieldCheck,
  Sparkles,
  Square,
  Trash2,
  Undo2,
  Video,
  type LucideIcon,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { ACCEPTED_MODEL_FILE_TYPES } from "@/constants/file";
import { useMediaPipe } from "@/hooks/next/use-mediapipe";
import { useModelsStore } from "@/store/next/models";
import { useEntitiesStore } from "@/store/next/entities";
import { importFile } from "@/utils/assets";
import { isWeb } from "@/utils/platform";
import { parseModel } from "@/utils/model";
import type { ModelComponent } from "@/types/ecs";
import { PoseSmoother } from "@/utils/animation-smoothing";
import type { PoseBoneData } from "@/utils/mediapipe-to-bones";
import {
  BODY_PART_LABELS,
  MIXAMO_DEFAULT_REMAP,
  autoDetectRemap,
  type BoneRemap,
} from "@/utils/bone-remap";
import {
  buildAnimationClip,
  getPoseClipDuration,
  type PoseFrame,
} from "@/utils/pose-to-animation";
import {
  analyzeBoneMapping,
  scorePoseLandmarks,
  selectBestPoseCandidate,
  type BoneMappingAnalysis,
  type PoseCalibration,
  type PoseQualityResult,
} from "@/utils/pose-retargeting";
import {
  DEFAULT_POSE_CORRECTION,
  POSE_BONE_GROUPS,
  POSE_BONE_LABELS,
  applyPoseBoneOverrideToAllFrames,
  applyPoseCorrection,
  buildFinalPose,
  buildFinalPoseFrames,
  copyPoseFrameOverrides,
  deletePoseFrame,
  getPoseBoneEuler,
  getPoseBonePosition,
  pastePoseFrameOverrides,
  quaternionToEulerDeg,
  resetPoseBoneOverride,
  resetPoseFrameOverrides,
  setPoseBoneOverride,
  trimPoseFramesAfter,
  trimPoseFramesBefore,
  vectorToPositionOverride,
  type PoseBoneOverride,
  type PoseEditDraft,
  type PoseFrameOverrides,
} from "@/utils/pose-edit";
import {
  type IkAvailability,
  type IkDebugSnapshot,
  type IkEditableTargetKey,
  type IkEffectorKey,
  type IkPoleTargetKey,
  type IkSolveResult,
} from "@/utils/pose-ik";
import { ModelPreview } from "@/components/camera-animation-capture/model-preview";
import { SkeletonOverlay } from "@/components/camera-animation-capture/skeleton-overlay";
import { BoneRemapPanel } from "@/components/camera-animation-capture/bone-remap-panel";
import {
  countEditedBones,
  createPoseStudioUiState,
  getEditModeForTool,
  getPoseDraftSummary,
  getTransformModeForTool,
  isGlobalPoseStudioTool,
  isPoseStudioGizmoEnabled,
  markerTone,
  poseStudioUiReducer,
  shiftQualityMarkersAfterDelete,
  trimQualityMarkersAfter,
  trimQualityMarkersBefore,
  type PoseFrameQualityMarker,
  type PoseStudioTool,
} from "./workspace";

const VIDEO_W = 480;
const VIDEO_H = 360;

type InputMode = "photo" | "video" | "camera";

const IK_TARGET_LABELS: Record<IkEffectorKey, string> = {
  leftElbow: "L Elbow",
  leftHand: "L Hand",
  rightElbow: "R Elbow",
  rightHand: "R Hand",
  leftFoot: "L Foot",
  rightFoot: "R Foot",
  hips: "Hips",
  torso: "Torso",
  head: "Head",
};

const IK_TARGET_ORDER: IkEffectorKey[] = [
  "leftHand",
  "leftElbow",
  "rightHand",
  "rightElbow",
  "leftFoot",
  "rightFoot",
  "hips",
  "torso",
  "head",
];

const IK_POLE_TO_EFFECTOR: Record<IkPoleTargetKey, IkEffectorKey> = {
  leftArmPole: "leftHand",
  rightArmPole: "rightHand",
  leftLegPole: "leftFoot",
  rightLegPole: "rightFoot",
};

type PoseStudioPoseState = {
  draft: PoseEditDraft;
  qualityMarkers: PoseFrameQualityMarker[];
};

type HistoryEntry = {
  label: string;
  state: PoseStudioPoseState;
};

type HistoryState = {
  past: HistoryEntry[];
  future: HistoryEntry[];
};

function emptyPoseState(): PoseStudioPoseState {
  return {
    draft: {
      frames: [],
      correction: { ...DEFAULT_POSE_CORRECTION },
      overrides: {},
    },
    qualityMarkers: [],
  };
}

function clonePoseData(pose: PoseBoneData): PoseBoneData {
  return {
    hips: {
      boneName: pose.hips.boneName,
      position: pose.hips.position.clone(),
      quaternion: pose.hips.quaternion.clone(),
    },
    bones: pose.bones.map((bone) => ({
      boneKey: bone.boneKey,
      boneName: bone.boneName,
      position: bone.position?.clone(),
      quaternion: bone.quaternion.clone(),
    })),
  };
}

function waitForPreviewFrame() {
  return new Promise<void>((resolve) => {
    requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
  });
}

function makeQualityMarker(
  frameIndex: number,
  quality: PoseQualityResult,
): PoseFrameQualityMarker {
  return {
    frameIndex,
    score: quality.score,
    label: quality.label,
    warnings: quality.warnings,
  };
}

function ikTargetToEffector(
  target: IkEditableTargetKey | null,
): IkEffectorKey | null {
  if (!target) return null;
  return target in IK_POLE_TO_EFFECTOR
    ? IK_POLE_TO_EFFECTOR[target as IkPoleTargetKey]
    : (target as IkEffectorKey);
}

function ikAvailabilityKey(status: IkAvailability) {
  return [
    status.available.join(","),
    Object.entries(status.missing)
      .map(([key, missing]) => `${key}:${missing?.join("/") ?? ""}`)
      .sort()
      .join(","),
  ].join("|");
}

function debugNumber(value: number) {
  return Number.isFinite(value) ? Number(value.toFixed(5)) : value;
}

function debugVectorLike(vector: { x: number; y: number; z: number }) {
  return {
    x: debugNumber(vector.x),
    y: debugNumber(vector.y),
    z: debugNumber(vector.z),
    finite:
      Number.isFinite(vector.x) &&
      Number.isFinite(vector.y) &&
      Number.isFinite(vector.z),
  };
}

function debugQuaternionLike(quaternion: {
  x: number;
  y: number;
  z: number;
  w: number;
}) {
  return {
    x: debugNumber(quaternion.x),
    y: debugNumber(quaternion.y),
    z: debugNumber(quaternion.z),
    w: debugNumber(quaternion.w),
    finite:
      Number.isFinite(quaternion.x) &&
      Number.isFinite(quaternion.y) &&
      Number.isFinite(quaternion.z) &&
      Number.isFinite(quaternion.w),
  };
}

function summarisePoseData(pose: PoseBoneData | null | undefined) {
  if (!pose) return null;
  return {
    hips: {
      boneName: pose.hips.boneName,
      position: debugVectorLike(pose.hips.position),
      quaternion: debugQuaternionLike(pose.hips.quaternion),
    },
    boneCount: pose.bones.length,
    bones: pose.bones.map((bone) => ({
      boneKey: bone.boneKey,
      boneName: bone.boneName,
      position: bone.position ? debugVectorLike(bone.position) : null,
      quaternion: debugQuaternionLike(bone.quaternion),
    })),
  };
}

function serialiseIkSolveResult(result: IkSolveResult | null) {
  if (!result) return null;
  return {
    affectedBoneKeys: result.affectedBoneKeys,
    targetDistances: Object.fromEntries(
      Object.entries(result.targetDistances).map(([key, value]) => [
        key,
        value === undefined ? null : debugNumber(value),
      ]),
    ),
    clampedTargets: Object.fromEntries(
      Object.entries(result.clampedTargets).map(([key, vector]) => [
        key,
        vector ? debugVectorLike(vector) : null,
      ]),
    ),
    reached: result.reached,
    warnings: result.warnings,
  };
}

function ToneBadge({
  ok,
  label,
  value,
}: {
  ok: boolean;
  label: string;
  value: string;
}) {
  const Icon = ok ? CheckCircle2 : AlertCircle;
  return (
    <span
      className={cn(
        "inline-flex h-7 items-center gap-1 rounded-md border px-2 text-xs",
        ok
          ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-700"
          : "border-amber-500/30 bg-amber-500/10 text-amber-700",
      )}
    >
      <Icon size={12} />
      <span className="font-medium">{label}</span>
      <span>{value}</span>
    </span>
  );
}

function QualityBadge({ quality }: { quality: PoseQualityResult }) {
  const tone =
    quality.label === "Good"
      ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-700"
      : quality.label === "Usable"
        ? "border-sky-500/30 bg-sky-500/10 text-sky-700"
        : "border-amber-500/30 bg-amber-500/10 text-amber-700";
  return (
    <span
      className={cn(
        "inline-flex h-7 items-center gap-1 rounded-md border px-2 text-xs",
        tone,
      )}
      title={quality.warnings.join("\n") || "Pose quality is stable"}
    >
      <Gauge size={12} />
      {quality.label} {Math.round(quality.score * 100)}%
    </span>
  );
}

function PanelHeader({
  icon: Icon,
  title,
  detail,
}: {
  icon: LucideIcon;
  title: string;
  detail?: string;
}) {
  return (
    <div className="flex min-h-10 items-center gap-2 border-b px-3">
      <Icon size={15} />
      <span className="text-sm font-medium">{title}</span>
      {detail && (
        <span className="ml-auto truncate text-xs text-muted-foreground">
          {detail}
        </span>
      )}
    </div>
  );
}

function SourceModeButton({
  active,
  icon: Icon,
  label,
  detail,
  onClick,
}: {
  active: boolean;
  icon: LucideIcon;
  label: string;
  detail: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex min-h-16 items-center gap-3 rounded-md border px-3 text-left transition-colors",
        active
          ? "border-primary/50 bg-primary/10 text-primary"
          : "border-border hover:bg-muted",
      )}
    >
      <Icon className="h-5 w-5 shrink-0" />
      <span className="min-w-0">
        <span className="block text-sm font-medium">{label}</span>
        <span className="block truncate text-xs text-muted-foreground">
          {detail}
        </span>
      </span>
    </button>
  );
}

function ToolButton({
  active,
  icon: Icon,
  label,
  onClick,
}: {
  active: boolean;
  icon: LucideIcon;
  label: string;
  onClick: () => void;
}) {
  return (
    <Button
      type="button"
      size="sm"
      variant={active ? "secondary" : "outline"}
      className="h-8 gap-1.5 px-2 text-xs"
      onClick={onClick}
      title={label}
    >
      <Icon size={14} />
      <span className="max-xl:hidden">{label}</span>
    </Button>
  );
}

interface AxisSliderProps {
  label: string;
  value: number;
  min?: number;
  max?: number;
  step?: number;
  onEditStart?: () => void;
  onEditEnd?: () => void;
  onChange: (value: number) => void;
}

function AxisSlider({
  label,
  value,
  min = -180,
  max = 180,
  step = 1,
  onEditStart,
  onEditEnd,
  onChange,
}: AxisSliderProps) {
  return (
    <label className="grid grid-cols-[1.25rem_1fr_3.25rem] items-center gap-2 text-xs">
      <span className="text-right text-muted-foreground">{label}</span>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onFocus={onEditStart}
        onBlur={onEditEnd}
        onPointerDown={onEditStart}
        onPointerUp={onEditEnd}
        onPointerCancel={onEditEnd}
        onChange={(event) => onChange(Number(event.target.value))}
        className="accent-primary"
      />
      <input
        type="number"
        min={min}
        max={max}
        step={step}
        value={value}
        onFocus={onEditStart}
        onBlur={onEditEnd}
        onKeyDown={(event) => {
          if (event.key === "Enter") onEditEnd?.();
        }}
        onChange={(event) => onChange(Number(event.target.value))}
        className="h-7 rounded border bg-background px-1 text-right tabular-nums"
      />
    </label>
  );
}

interface PoseSourcePanelProps {
  inputMode: InputMode;
  setInputMode: (mode: InputMode) => void;
  videoRef: React.RefObject<HTMLVideoElement | null>;
  imageRef: React.RefObject<HTMLImageElement | null>;
  photoUrl: string | null;
  videoUrl: string | null;
  screenLandmarks: NormalizedLandmark[] | null;
  isReady: boolean;
  error: string | null;
  fps: number;
  recording: boolean;
  elapsed: number;
  sourceSkeleton: boolean;
  onPhotoSelect: () => void;
  onVideoSelect: () => void;
  onClearPhoto: () => void;
  onClearVideo: () => void;
  onCapturePhoto: () => void;
  onStartRecording: () => void;
  onStopRecording: () => void;
  detectingBestPhoto: boolean;
  canRecord: boolean;
}

function PoseSourcePanel({
  inputMode,
  setInputMode,
  videoRef,
  imageRef,
  photoUrl,
  videoUrl,
  screenLandmarks,
  isReady,
  error,
  fps,
  recording,
  elapsed,
  sourceSkeleton,
  onPhotoSelect,
  onVideoSelect,
  onClearPhoto,
  onClearVideo,
  onCapturePhoto,
  onStartRecording,
  onStopRecording,
  detectingBestPhoto,
  canRecord,
}: PoseSourcePanelProps) {
  const isVideoMode = inputMode === "camera" || inputMode === "video";
  const [sourceSize, setSourceSize] = useState({
    width: VIDEO_W,
    height: VIDEO_H,
  });

  const updateImageSize = () => {
    const image = imageRef.current;
    if (!image) return;
    setSourceSize({
      width: image.naturalWidth || image.width || VIDEO_W,
      height: image.naturalHeight || image.height || VIDEO_H,
    });
  };

  const updateVideoSize = () => {
    const video = videoRef.current;
    if (!video) return;
    setSourceSize({
      width: video.videoWidth || VIDEO_W,
      height: video.videoHeight || VIDEO_H,
    });
  };

  return (
    <aside className="flex min-h-0 flex-col border-r bg-background">
      <PanelHeader icon={Camera} title="Capture" detail={inputMode} />
      <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-auto p-3">
        <div className="grid gap-2">
          {isWeb() && (
            <SourceModeButton
              active={inputMode === "camera"}
              icon={Camera}
              label="Camera"
              detail="Live motion"
              onClick={() => setInputMode("camera")}
            />
          )}
          <SourceModeButton
            active={inputMode === "photo"}
            icon={ImageIcon}
            label="Photo"
            detail="Single pose"
            onClick={() => setInputMode("photo")}
          />
          <SourceModeButton
            active={inputMode === "video"}
            icon={Video}
            label="Video"
            detail="Motion file"
            onClick={() => setInputMode("video")}
          />
        </div>

        <div className="overflow-hidden rounded-md border bg-black">
          <div className="relative aspect-[4/3] w-full">
            {isVideoMode ? (
              <video
                ref={videoRef}
                onLoadedMetadata={updateVideoSize}
                className={cn("h-full w-full", {
                  "object-cover": inputMode === "camera",
                  "object-contain": inputMode === "video",
                })}
                style={
                  inputMode === "camera"
                    ? { transform: "scaleX(-1)" }
                    : undefined
                }
                muted
                playsInline
              />
            ) : photoUrl ? (
              <img
                ref={imageRef}
                src={photoUrl}
                alt="Uploaded pose"
                onLoad={updateImageSize}
                className="h-full w-full object-contain"
              />
            ) : (
              <div className="flex h-full items-center justify-center px-4 text-center text-sm text-muted-foreground">
                No photo selected
              </div>
            )}

            {sourceSkeleton && (
              <SkeletonOverlay
                landmarks={screenLandmarks}
                width={VIDEO_W}
                height={VIDEO_H}
                mirror={inputMode === "camera"}
                fit={inputMode === "camera" ? "cover" : "contain"}
                sourceWidth={sourceSize.width}
                sourceHeight={sourceSize.height}
              />
            )}

            <div className="absolute left-2 top-2 flex flex-wrap gap-1">
              {!isReady && !error && (
                <span className="flex items-center gap-1 rounded bg-black/70 px-2 py-1 text-xs text-white">
                  <Loader2 size={12} className="animate-spin" />
                  Loading
                </span>
              )}
              {isReady && inputMode === "camera" && (
                <span className="rounded bg-black/70 px-2 py-1 text-xs text-white">
                  {fps} FPS
                </span>
              )}
              {recording && (
                <span className="rounded bg-red-600 px-2 py-1 text-xs text-white">
                  REC {elapsed.toFixed(1)}s
                </span>
              )}
            </div>

            {error && (
              <div className="absolute inset-0 flex items-center justify-center bg-black/75 p-4 text-center text-sm text-red-300">
                {error}
              </div>
            )}
          </div>
        </div>

        {inputMode === "photo" && (
          <div className="grid grid-cols-[1fr_auto] gap-2">
            <Button variant="outline" onClick={onPhotoSelect}>
              {photoUrl ? "Change Photo" : "Upload Photo"}
            </Button>
            <Button variant="outline" onClick={onClearPhoto} disabled={!photoUrl}>
              Clear
            </Button>
          </div>
        )}

        {inputMode === "video" && (
          <div className="grid grid-cols-[1fr_auto] gap-2">
            <Button variant="outline" onClick={onVideoSelect}>
              {videoUrl ? "Change Video" : "Upload Video"}
            </Button>
            <Button variant="outline" onClick={onClearVideo} disabled={!videoUrl}>
              Clear
            </Button>
          </div>
        )}

        {inputMode === "photo" ? (
          <Button
            onClick={onCapturePhoto}
            disabled={!isReady || !!error || !photoUrl || detectingBestPhoto}
            className="gap-2"
          >
            {detectingBestPhoto ? (
              <Loader2 size={14} className="animate-spin" />
            ) : (
              <Sparkles size={14} />
            )}
            {detectingBestPhoto ? "Finding Best" : "Capture Pose"}
          </Button>
        ) : recording ? (
          <Button variant="destructive" onClick={onStopRecording} className="gap-2">
            <Square size={14} />
            Stop
          </Button>
        ) : (
          <Button onClick={onStartRecording} disabled={!canRecord} className="gap-2">
            <Play size={14} />
            Record
          </Button>
        )}
      </div>
    </aside>
  );
}

interface PoseToolPaletteProps {
  tool: PoseStudioTool;
  onSetTool: (tool: PoseStudioTool) => void;
}

function PoseToolPalette({ tool, onSetTool }: PoseToolPaletteProps) {
  return (
    <div className="absolute left-3 top-3 z-10 flex flex-wrap gap-1 rounded-md border bg-background/90 p-1 shadow-sm backdrop-blur">
      <ToolButton
        active={tool === "select"}
        icon={Eye}
        label="Select"
        onClick={() => onSetTool("select")}
      />
      <ToolButton
        active={tool === "fk-rotate"}
        icon={Rotate3D}
        label="FK Rotate"
        onClick={() => onSetTool("fk-rotate")}
      />
      <ToolButton
        active={tool === "fk-move"}
        icon={Move3D}
        label="FK Move"
        onClick={() => onSetTool("fk-move")}
      />
      <ToolButton
        active={tool === "ik"}
        icon={Bone}
        label="IK"
        onClick={() => onSetTool("ik")}
      />
      <ToolButton
        active={tool === "global-rotate"}
        icon={RotateCcw}
        label="Global Rotate"
        onClick={() => onSetTool("global-rotate")}
      />
      <ToolButton
        active={tool === "global-move"}
        icon={Move3D}
        label="Global Move"
        onClick={() => onSetTool("global-move")}
      />
    </div>
  );
}

interface PoseViewportPanelProps {
  modelUuid: string;
  hasFrames: boolean;
  landmarksRef: React.RefObject<NormalizedLandmark[] | null>;
  poseDataRef: React.RefObject<PoseBoneData | null>;
  staticPoseRef: React.RefObject<PoseBoneData | null>;
  remap: BoneRemap;
  rootMotion: boolean;
  calibrationRef: React.RefObject<PoseCalibration | null>;
  calibrationRequestId: number;
  onCalibrationReady: () => void;
  tool: PoseStudioTool;
  selectedBoneKey: string | null;
  selectedIkTargetKey: IkEditableTargetKey | null;
  frameOverrides: PoseFrameOverrides;
  editedBoneKeys: string[];
  showModelSkeleton: boolean;
  onSetTool: (tool: PoseStudioTool) => void;
  onSelectBone: (boneKey: string) => void;
  onSelectIkTarget: (targetKey: IkEditableTargetKey) => void;
  onBoneEulerChange: (boneKey: string, euler: PoseBoneOverride) => void;
  onBonePositionChange: (
    boneKey: string,
    position: NonNullable<PoseBoneOverride["position"]>,
  ) => void;
  onIkSolveChange: (
    overrides: PoseFrameOverrides,
    result: IkSolveResult,
  ) => void;
  onIkStatusChange: (status: IkAvailability) => void;
  ikDebugRef: React.MutableRefObject<IkDebugSnapshot | null>;
  onGizmoEditStart: () => void;
  onGizmoEditEnd: () => void;
  beforePose: boolean;
}

function PoseViewportPanel({
  modelUuid,
  hasFrames,
  landmarksRef,
  poseDataRef,
  staticPoseRef,
  remap,
  rootMotion,
  calibrationRef,
  calibrationRequestId,
  onCalibrationReady,
  tool,
  selectedBoneKey,
  selectedIkTargetKey,
  frameOverrides,
  editedBoneKeys,
  showModelSkeleton,
  onSetTool,
  onSelectBone,
  onSelectIkTarget,
  onBoneEulerChange,
  onBonePositionChange,
  onIkSolveChange,
  onIkStatusChange,
  ikDebugRef,
  onGizmoEditStart,
  onGizmoEditEnd,
  beforePose,
}: PoseViewportPanelProps) {
  return (
    <main className="relative min-h-0 overflow-hidden bg-muted">
      <PoseToolPalette tool={tool} onSetTool={onSetTool} />
      <div className="absolute right-3 top-3 z-10 rounded-md border bg-background/90 px-2 py-1 text-xs text-muted-foreground shadow-sm backdrop-blur">
        {hasFrames
          ? beforePose
            ? "Before"
            : "Current"
          : "Live preview"}
      </div>
      <ModelPreview
        modelUuid={modelUuid}
        landmarksRef={landmarksRef}
        poseDataRef={hasFrames ? undefined : poseDataRef}
        staticPoseRef={hasFrames ? staticPoseRef : undefined}
        remap={remap}
        rootMotion={rootMotion}
        calibrationRef={calibrationRef}
        calibrationRequestId={calibrationRequestId}
        onCalibrationReady={onCalibrationReady}
        editMode={getEditModeForTool(tool)}
        transformMode={getTransformModeForTool(tool)}
        selectedBoneKey={selectedBoneKey}
        selectedIkTargetKey={selectedIkTargetKey}
        frameOverrides={frameOverrides}
        onSelectBone={onSelectBone}
        onSelectIkTarget={onSelectIkTarget}
        onBoneEulerChange={onBoneEulerChange}
        onBonePositionChange={onBonePositionChange}
        onIkSolveChange={onIkSolveChange}
        onIkStatusChange={onIkStatusChange}
        ikDebugRef={ikDebugRef}
        onGizmoEditStart={onGizmoEditStart}
        onGizmoEditEnd={onGizmoEditEnd}
        showSkeleton={showModelSkeleton}
        showHandles={hasFrames}
        gizmoEnabled={isPoseStudioGizmoEnabled(tool)}
        editedBoneKeys={editedBoneKeys}
      />
    </main>
  );
}

interface PoseTimelineProps {
  frames: PoseFrame[];
  currentIndex: number;
  qualityMarkers: PoseFrameQualityMarker[];
  playing: boolean;
  onSetIndex: (index: number) => void;
  onTogglePlay: () => void;
  onTrimStart: () => void;
  onDeleteFrame: () => void;
  onTrimEnd: () => void;
  onClear: () => void;
}

function PoseTimeline({
  frames,
  currentIndex,
  qualityMarkers,
  playing,
  onSetIndex,
  onTogglePlay,
  onTrimStart,
  onDeleteFrame,
  onTrimEnd,
  onClear,
}: PoseTimelineProps) {
  const markerByFrame = useMemo(
    () => new Map(qualityMarkers.map((marker) => [marker.frameIndex, marker])),
    [qualityMarkers],
  );
  const duration = getPoseClipDuration(frames);
  return (
    <footer className="border-t bg-background">
      <div className="flex items-center gap-2 px-3 py-2">
        <Button
          size="icon"
          variant="outline"
          onClick={onTogglePlay}
          disabled={frames.length <= 1}
          title={playing ? "Stop" : "Play"}
        >
          {playing ? <Square size={14} /> : <Play size={14} />}
        </Button>
        <span className="w-36 text-xs text-muted-foreground">
          {frames.length === 0
            ? "No frames"
            : `Frame ${currentIndex + 1} / ${frames.length}`}
        </span>
        <input
          type="range"
          className="min-w-0 flex-1 accent-primary"
          min={0}
          max={Math.max(0, frames.length - 1)}
          step={1}
          value={Math.min(currentIndex, Math.max(0, frames.length - 1))}
          disabled={frames.length === 0}
          onChange={(event) => onSetIndex(Number(event.target.value))}
        />
        <span className="w-20 text-right text-xs tabular-nums text-muted-foreground">
          {duration.toFixed(2)}s
        </span>
        <Button
          size="sm"
          variant="outline"
          onClick={onTrimStart}
          disabled={frames.length === 0 || currentIndex === 0}
        >
          <Scissors size={14} />
          Start
        </Button>
        <Button
          size="sm"
          variant="outline"
          onClick={onTrimEnd}
          disabled={frames.length === 0 || currentIndex === frames.length - 1}
        >
          <Scissors size={14} />
          End
        </Button>
        <Button
          size="sm"
          variant="destructive"
          onClick={onDeleteFrame}
          disabled={frames.length === 0}
        >
          <Trash2 size={14} />
          Frame
        </Button>
        <Button
          size="sm"
          variant="ghost"
          onClick={onClear}
          disabled={frames.length === 0}
        >
          Clear
        </Button>
      </div>
      <div className="flex gap-1 overflow-x-auto border-t px-3 py-2">
        {frames.length === 0 ? (
          <span className="text-xs text-muted-foreground">
            Captured frames will appear here.
          </span>
        ) : (
          frames.map((frame, index) => {
            const marker = markerByFrame.get(index);
            const tone = markerTone(marker?.label);
            return (
              <button
                key={`${frame.time}-${index}`}
                type="button"
                onClick={() => onSetIndex(index)}
                title={
                  marker
                    ? `${marker.label} ${Math.round(marker.score * 100)}%`
                    : "No quality marker"
                }
                className={cn(
                  "flex h-9 min-w-12 flex-col items-center justify-center rounded border px-2 text-[10px] tabular-nums",
                  currentIndex === index
                    ? "border-primary bg-primary/10 text-primary"
                    : "border-border hover:bg-muted",
                  tone === "good" &&
                    currentIndex !== index &&
                    "border-emerald-500/30",
                  tone === "usable" &&
                    currentIndex !== index &&
                    "border-sky-500/30",
                  tone === "poor" &&
                    currentIndex !== index &&
                    "border-amber-500/30",
                )}
              >
                <span>{index + 1}</span>
                <span className="text-muted-foreground">
                  {frame.time.toFixed(1)}
                </span>
              </button>
            );
          })
        )}
      </div>
    </footer>
  );
}

interface PoseSavePanelProps {
  clipName: string;
  frames: PoseFrame[];
  draft: PoseEditDraft;
  mappingAnalysis: BoneMappingAnalysis;
  qualityMarkers: PoseFrameQualityMarker[];
  saving: boolean;
  onClipNameChange: (value: string) => void;
  onSave: () => void;
  forceInPlace: boolean;
  onForceInPlaceChange: (value: boolean) => void;
}

function PoseSavePanel({
  clipName,
  frames,
  draft,
  mappingAnalysis,
  qualityMarkers,
  saving,
  onClipNameChange,
  onSave,
  forceInPlace,
  onForceInPlaceChange,
}: PoseSavePanelProps) {
  const summary = getPoseDraftSummary(draft);
  const bestMarker = qualityMarkers.reduce<PoseFrameQualityMarker | null>(
    (best, marker) => (!best || marker.score > best.score ? marker : best),
    null,
  );
  return (
    <div className="flex flex-col gap-3 p-3">
      <div className="grid gap-1.5">
        <Label htmlFor="pose-studio-clip-name">Clip name</Label>
        <Input
          id="pose-studio-clip-name"
          value={clipName}
          onChange={(event) => onClipNameChange(event.target.value)}
        />
      </div>
      <div className="grid grid-cols-2 gap-2 text-xs">
        <div className="rounded-md border px-2 py-2">
          <span className="block text-muted-foreground">Frames</span>
          <span className="text-lg font-semibold">{summary.frameCount}</span>
        </div>
        <div className="rounded-md border px-2 py-2">
          <span className="block text-muted-foreground">Duration</span>
          <span className="text-lg font-semibold">
            {getPoseClipDuration(frames).toFixed(2)}s
          </span>
        </div>
        <div className="rounded-md border px-2 py-2">
          <span className="block text-muted-foreground">Edited</span>
          <span className="text-lg font-semibold">
            {summary.editedFrameCount}
          </span>
        </div>
        <div className="rounded-md border px-2 py-2">
          <span className="block text-muted-foreground">Mapping</span>
          <span className="text-lg font-semibold">
            {mappingAnalysis.mapped}/{mappingAnalysis.total}
          </span>
        </div>
      </div>
      {bestMarker && (
        <div className="rounded-md border px-3 py-2 text-xs">
          <span className="text-muted-foreground">Best pose</span>
          <div className="mt-1 font-medium">
            {bestMarker.label} {Math.round(bestMarker.score * 100)}%
          </div>
        </div>
      )}
      {mappingAnalysis.issues.length > 0 && (
        <div className="rounded-md border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-800">
          {mappingAnalysis.issues[0]}
        </div>
      )}
      <label className="flex items-center justify-between rounded-md border px-3 py-2 text-xs">
        <span>Force imported animations in place</span>
        <Switch
          checked={forceInPlace}
          onCheckedChange={onForceInPlaceChange}
          disabled={saving}
        />
      </label>
      <Button onClick={onSave} disabled={saving || frames.length === 0}>
        <Save size={14} />
        {saving ? "Saving" : "Save to Model"}
      </Button>
    </div>
  );
}

interface PoseInspectorProps {
  tab: string;
  setTab: (tab: "assist" | "mapping" | "edit" | "save") => void;
  modelUuid: string;
  remap: BoneRemap;
  setRemap: (remap: BoneRemap) => void;
  availableBones: string[];
  boneLoadError: string | null;
  mappingAnalysis: BoneMappingAnalysis;
  poseQuality: PoseQualityResult;
  poseDetected: boolean;
  rootMotion: boolean;
  setRootMotion: (value: boolean) => void;
  calibrated: boolean;
  onCalibrate: () => void;
  bestQuality: PoseQualityResult | null;
  onUseBestFrame: () => void;
  rejectedFrameCount: number;
  sourceSkeleton: boolean;
  modelSkeleton: boolean;
  beforePose: boolean;
  onToggleSourceSkeleton: () => void;
  onToggleModelSkeleton: () => void;
  onToggleBeforePose: () => void;
  tool: PoseStudioTool;
  setTool: (tool: PoseStudioTool) => void;
  currentFrame: PoseFrame | undefined;
  currentIndex: number;
  draft: PoseEditDraft;
  frameOverrides: PoseFrameOverrides;
  mappedBoneKeys: Set<string>;
  selectedBoneKey: string | null;
  selectedBoneEuler: PoseBoneOverride;
  selectedBonePosition: NonNullable<PoseBoneOverride["position"]>;
  selectedIkTarget: IkEditableTargetKey | null;
  ikStatus: IkAvailability;
  copiedPose: PoseFrameOverrides | null;
  ikDebugCopyStatus: string | null;
  onSelectBone: (boneKey: string) => void;
  onSelectIkTarget: (targetKey: IkEditableTargetKey) => void;
  onBoneAxisChange: (
    boneKey: string,
    axis: "x" | "y" | "z",
    value: number,
  ) => void;
  onBonePositionAxisChange: (
    boneKey: string,
    axis: "x" | "y" | "z",
    value: number,
  ) => void;
  onResetBone: (boneKey: string) => void;
  onApplyBoneToAll: (boneKey: string) => void;
  onApplyIkPoseToAll: () => void;
  onMirrorCurrent: () => void;
  onMirrorAll: () => void;
  onFlip180: () => void;
  onCopyPose: () => void;
  onPastePose: () => void;
  onResetCurrent: () => void;
  onResetAll: () => void;
  onCopyIkDebugBefore: () => void;
  onCopyIkDebugAfter: () => void;
  onEditStart: (label?: string) => void;
  onEditEnd: () => void;
  clipName: string;
  saving: boolean;
  qualityMarkers: PoseFrameQualityMarker[];
  onClipNameChange: (value: string) => void;
  onSave: () => void;
  forceInPlace: boolean;
  onForceInPlaceChange: (value: boolean) => void;
}

function PoseInspector({
  tab,
  setTab,
  modelUuid,
  remap,
  setRemap,
  availableBones,
  boneLoadError,
  mappingAnalysis,
  poseQuality,
  poseDetected,
  rootMotion,
  setRootMotion,
  calibrated,
  onCalibrate,
  bestQuality,
  onUseBestFrame,
  rejectedFrameCount,
  sourceSkeleton,
  modelSkeleton,
  beforePose,
  onToggleSourceSkeleton,
  onToggleModelSkeleton,
  onToggleBeforePose,
  tool,
  setTool,
  currentFrame,
  currentIndex,
  draft,
  frameOverrides,
  mappedBoneKeys,
  selectedBoneKey,
  selectedBoneEuler,
  selectedBonePosition,
  selectedIkTarget,
  ikStatus,
  copiedPose,
  ikDebugCopyStatus,
  onSelectBone,
  onSelectIkTarget,
  onBoneAxisChange,
  onBonePositionAxisChange,
  onResetBone,
  onApplyBoneToAll,
  onApplyIkPoseToAll,
  onMirrorCurrent,
  onMirrorAll,
  onFlip180,
  onCopyPose,
  onPastePose,
  onResetCurrent,
  onResetAll,
  onCopyIkDebugBefore,
  onCopyIkDebugAfter,
  onEditStart,
  onEditEnd,
  clipName,
  saving,
  qualityMarkers,
  onClipNameChange,
  onSave,
  forceInPlace,
  onForceInPlaceChange,
}: PoseInspectorProps) {
  const selectedEffector = ikTargetToEffector(selectedIkTarget);
  const missingIkLabels = Object.entries(ikStatus.missing)
    .filter(([, missing]) => (missing?.length ?? 0) > 0)
    .map(([key]) => IK_TARGET_LABELS[key as IkEffectorKey] ?? key);
  const hasSelectedOverride =
    !!selectedBoneKey && Boolean(frameOverrides[selectedBoneKey]);
  const hasAnyOverride = Object.keys(frameOverrides).length > 0;
  const selectedLabel =
    selectedBoneKey &&
    (POSE_BONE_LABELS[selectedBoneKey as keyof BoneRemap] ?? selectedBoneKey);

  return (
    <aside className="flex min-h-0 flex-col border-l bg-background">
      <PanelHeader icon={Settings2} title="Inspector" detail={tab} />
      <div className="grid grid-cols-4 gap-1 border-b p-2">
        {(["assist", "mapping", "edit", "save"] as const).map((item) => (
          <Button
            key={item}
            type="button"
            size="sm"
            variant={tab === item ? "secondary" : "ghost"}
            className="h-8 px-1 text-xs capitalize"
            onClick={() => setTab(item)}
          >
            {item}
          </Button>
        ))}
      </div>
      <div className="min-h-0 flex-1 overflow-auto">
        {tab === "assist" && (
          <div className="flex flex-col gap-3 p-3">
            <QualityBadge quality={poseQuality} />
            {poseQuality.warnings.length > 0 && (
              <div className="rounded-md border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-800">
                {poseQuality.warnings[0]}
              </div>
            )}
            <div className="grid grid-cols-2 gap-2">
              <Button
                variant="outline"
                onClick={onCalibrate}
                disabled={!poseDetected}
              >
                <Crosshair size={14} />
                Calibrate
              </Button>
              <Button
                variant="outline"
                onClick={onUseBestFrame}
                disabled={!bestQuality}
              >
                <Sparkles size={14} />
                Best Frame
              </Button>
            </div>
            <div className="rounded-md border px-3 py-2 text-xs">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Best pose</span>
                <span>
                  {bestQuality
                    ? `${bestQuality.label} ${Math.round(
                        bestQuality.score * 100,
                      )}%`
                    : "None"}
                </span>
              </div>
              <div className="mt-1 flex justify-between">
                <span className="text-muted-foreground">Skipped</span>
                <span>{rejectedFrameCount}</span>
              </div>
              <div className="mt-1 flex justify-between">
                <span className="text-muted-foreground">Calibration</span>
                <span>{calibrated ? "Ready" : "Not set"}</span>
              </div>
            </div>
            <label className="flex items-center justify-between rounded-md border px-3 py-2 text-sm">
              Root motion
              <Switch
                checked={rootMotion}
                onCheckedChange={(checked) => setRootMotion(Boolean(checked))}
              />
            </label>
            <label className="flex items-center justify-between rounded-md border px-3 py-2 text-sm">
              Source skeleton
              <Switch
                checked={sourceSkeleton}
                onCheckedChange={onToggleSourceSkeleton}
              />
            </label>
            <label className="flex items-center justify-between rounded-md border px-3 py-2 text-sm">
              Model skeleton
              <Switch
                checked={modelSkeleton}
                onCheckedChange={onToggleModelSkeleton}
              />
            </label>
            <label className="flex items-center justify-between rounded-md border px-3 py-2 text-sm">
              Before pose
              <Switch checked={beforePose} onCheckedChange={onToggleBeforePose} />
            </label>
            {mappingAnalysis.issues.length > 0 && (
              <div className="rounded-md border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-800">
                {mappingAnalysis.issues.slice(0, 3).join(" - ")}
              </div>
            )}
          </div>
        )}

        {tab === "mapping" && (
          <div className="p-3">
            <BoneRemapPanel
              modelUuid={modelUuid}
              remap={remap}
              onChange={setRemap}
              availableBones={availableBones}
            />
            {boneLoadError && (
              <p className="mt-2 text-xs text-destructive">{boneLoadError}</p>
            )}
          </div>
        )}

        {tab === "edit" && (
          <div className="flex flex-col gap-3 p-3">
            <div className="grid grid-cols-2 gap-2">
              <ToolButton
                active={tool === "select"}
                icon={Eye}
                label="Select"
                onClick={() => setTool("select")}
              />
              <ToolButton
                active={tool === "ik"}
                icon={Bone}
                label="IK"
                onClick={() => setTool("ik")}
              />
              <ToolButton
                active={tool === "fk-rotate"}
                icon={Rotate3D}
                label="FK Rotate"
                onClick={() => setTool("fk-rotate")}
              />
              <ToolButton
                active={tool === "fk-move"}
                icon={Move3D}
                label="FK Move"
                onClick={() => setTool("fk-move")}
              />
              <ToolButton
                active={tool === "global-rotate"}
                icon={RotateCcw}
                label="Global Rotate"
                onClick={() => setTool("global-rotate")}
              />
              <ToolButton
                active={tool === "global-move"}
                icon={Move3D}
                label="Global Move"
                onClick={() => setTool("global-move")}
              />
            </div>

            {isGlobalPoseStudioTool(tool) ? (
              <section className="rounded-md border">
                <div className="border-b px-3 py-2 text-sm font-medium">
                  Global Correction
                </div>
                <div className="flex flex-col gap-2 p-3">
                  {tool === "global-rotate" ? (
                    <>
                      <AxisSlider
                        label="X"
                        value={draft.correction.rotX}
                        onEditStart={() => onEditStart("Global rotate")}
                        onEditEnd={onEditEnd}
                        onChange={(value) =>
                          onBoneAxisChange("__global__", "x", value)
                        }
                      />
                      <AxisSlider
                        label="Y"
                        value={draft.correction.rotY}
                        onEditStart={() => onEditStart("Global rotate")}
                        onEditEnd={onEditEnd}
                        onChange={(value) =>
                          onBoneAxisChange("__global__", "y", value)
                        }
                      />
                      <AxisSlider
                        label="Z"
                        value={draft.correction.rotZ}
                        onEditStart={() => onEditStart("Global rotate")}
                        onEditEnd={onEditEnd}
                        onChange={(value) =>
                          onBoneAxisChange("__global__", "z", value)
                        }
                      />
                    </>
                  ) : (
                    <>
                      <AxisSlider
                        label="X"
                        min={-100}
                        max={100}
                        step={0.1}
                        value={draft.correction.moveX ?? 0}
                        onEditStart={() => onEditStart("Global move")}
                        onEditEnd={onEditEnd}
                        onChange={(value) =>
                          onBonePositionAxisChange("__global__", "x", value)
                        }
                      />
                      <AxisSlider
                        label="Y"
                        min={-100}
                        max={100}
                        step={0.1}
                        value={draft.correction.moveY ?? 0}
                        onEditStart={() => onEditStart("Global move")}
                        onEditEnd={onEditEnd}
                        onChange={(value) =>
                          onBonePositionAxisChange("__global__", "y", value)
                        }
                      />
                      <AxisSlider
                        label="Z"
                        min={-100}
                        max={100}
                        step={0.1}
                        value={draft.correction.moveZ ?? 0}
                        onEditStart={() => onEditStart("Global move")}
                        onEditEnd={onEditEnd}
                        onChange={(value) =>
                          onBonePositionAxisChange("__global__", "z", value)
                        }
                      />
                    </>
                  )}
                </div>
              </section>
            ) : tool === "ik" ? (
              <section className="rounded-md border">
                <div className="border-b px-3 py-2 text-sm font-medium">
                  IK Targets
                </div>
                <div className="flex flex-col gap-2 p-3">
                  <div className="grid grid-cols-3 gap-1">
                    {IK_TARGET_ORDER.filter((target) =>
                      ikStatus.available.includes(target),
                    ).map((target) => (
                      <Button
                        key={target}
                        size="sm"
                        variant={
                          selectedEffector === target ? "secondary" : "outline"
                        }
                        className="h-8 px-1 text-xs"
                        onClick={() => onSelectIkTarget(target)}
                      >
                        {IK_TARGET_LABELS[target]}
                      </Button>
                    ))}
                  </div>
                  <div className="rounded-md border px-2 py-1 text-xs text-muted-foreground">
                    {ikStatus.available.length} ready
                    {missingIkLabels.length > 0 && (
                      <span className="block text-amber-500">
                        Missing: {missingIkLabels.join(", ")}
                      </span>
                    )}
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={onApplyIkPoseToAll}
                    disabled={!hasAnyOverride || draft.frames.length <= 1}
                  >
                    Apply IK to all frames
                  </Button>
                  <div className="grid grid-cols-2 gap-2">
                    <Button size="sm" variant="outline" onClick={onCopyIkDebugBefore}>
                      <Clipboard size={14} />
                      Before
                    </Button>
                    <Button size="sm" variant="outline" onClick={onCopyIkDebugAfter}>
                      <ClipboardPaste size={14} />
                      After
                    </Button>
                  </div>
                  {ikDebugCopyStatus && (
                    <p className="text-xs text-muted-foreground">
                      {ikDebugCopyStatus}
                    </p>
                  )}
                </div>
              </section>
            ) : (
              <>
                <section className="rounded-md border">
                  <div className="border-b px-3 py-2 text-sm font-medium">
                    Bones
                  </div>
                  <div className="max-h-52 overflow-y-auto p-2">
                    {POSE_BONE_GROUPS.map((group) => (
                      <div key={group.label} className="mb-2 last:mb-0">
                        <p className="px-1 pb-1 text-xs font-medium uppercase text-muted-foreground">
                          {group.label}
                        </p>
                        <div className="grid grid-cols-2 gap-1">
                          {group.keys
                            .filter((key) => mappedBoneKeys.has(key))
                            .map((key) => (
                              <Button
                                key={key}
                                size="sm"
                                variant={
                                  selectedBoneKey === key
                                    ? "secondary"
                                    : "ghost"
                                }
                                className="h-8 justify-start gap-1 px-2 text-xs"
                                onClick={() => onSelectBone(key)}
                              >
                                <span className="truncate">
                                  {POSE_BONE_LABELS[key] ?? key}
                                </span>
                                {frameOverrides[key] && (
                                  <span className="ml-auto text-primary">
                                    *
                                  </span>
                                )}
                              </Button>
                            ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </section>

                <section className="rounded-md border">
                  <div className="border-b px-3 py-2 text-sm font-medium">
                    {selectedLabel ?? "Selected Bone"}
                  </div>
                  <div className="flex flex-col gap-2 p-3">
                    {selectedBoneKey ? (
                      tool === "fk-move" ? (
                        <>
                          <AxisSlider
                            label="X"
                            min={-100}
                            max={100}
                            step={0.1}
                            value={selectedBonePosition.x}
                            onEditStart={() => onEditStart("Move bone")}
                            onEditEnd={onEditEnd}
                            onChange={(value) =>
                              onBonePositionAxisChange(
                                selectedBoneKey,
                                "x",
                                value,
                              )
                            }
                          />
                          <AxisSlider
                            label="Y"
                            min={-100}
                            max={100}
                            step={0.1}
                            value={selectedBonePosition.y}
                            onEditStart={() => onEditStart("Move bone")}
                            onEditEnd={onEditEnd}
                            onChange={(value) =>
                              onBonePositionAxisChange(
                                selectedBoneKey,
                                "y",
                                value,
                              )
                            }
                          />
                          <AxisSlider
                            label="Z"
                            min={-100}
                            max={100}
                            step={0.1}
                            value={selectedBonePosition.z}
                            onEditStart={() => onEditStart("Move bone")}
                            onEditEnd={onEditEnd}
                            onChange={(value) =>
                              onBonePositionAxisChange(
                                selectedBoneKey,
                                "z",
                                value,
                              )
                            }
                          />
                        </>
                      ) : (
                        <>
                          <AxisSlider
                            label="X"
                            value={selectedBoneEuler.x}
                            onEditStart={() => onEditStart("Rotate bone")}
                            onEditEnd={onEditEnd}
                            onChange={(value) =>
                              onBoneAxisChange(selectedBoneKey, "x", value)
                            }
                          />
                          <AxisSlider
                            label="Y"
                            value={selectedBoneEuler.y}
                            onEditStart={() => onEditStart("Rotate bone")}
                            onEditEnd={onEditEnd}
                            onChange={(value) =>
                              onBoneAxisChange(selectedBoneKey, "y", value)
                            }
                          />
                          <AxisSlider
                            label="Z"
                            value={selectedBoneEuler.z}
                            onEditStart={() => onEditStart("Rotate bone")}
                            onEditEnd={onEditEnd}
                            onChange={(value) =>
                              onBoneAxisChange(selectedBoneKey, "z", value)
                            }
                          />
                        </>
                      )
                    ) : (
                      <p className="text-sm text-muted-foreground">
                        No mapped bones.
                      </p>
                    )}
                    {selectedBoneKey && (
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => onResetBone(selectedBoneKey)}
                          disabled={!hasSelectedOverride}
                        >
                          Reset
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="ml-auto"
                          onClick={() => onApplyBoneToAll(selectedBoneKey)}
                          disabled={
                            !hasSelectedOverride || draft.frames.length <= 1
                          }
                        >
                          Apply all
                        </Button>
                      </div>
                    )}
                  </div>
                </section>
              </>
            )}

            <section className="rounded-md border">
              <div className="border-b px-3 py-2 text-sm font-medium">
                Pose Actions
              </div>
              <div className="grid grid-cols-2 gap-2 p-3">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={onMirrorCurrent}
                  disabled={!currentFrame}
                >
                  <FlipHorizontal size={14} />
                  Mirror
                </Button>
                <Button
                  size="sm"
                  variant={draft.correction.mirror ? "secondary" : "outline"}
                  onClick={onMirrorAll}
                >
                  <FlipHorizontal size={14} />
                  Mirror all
                </Button>
                <Button size="sm" variant="outline" onClick={onCopyPose}>
                  <Clipboard size={14} />
                  Copy
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={onPastePose}
                  disabled={!copiedPose}
                >
                  <ClipboardPaste size={14} />
                  Paste
                </Button>
                <Button size="sm" variant="outline" onClick={onFlip180}>
                  <RotateCcw size={14} />
                  180
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={onResetCurrent}
                  disabled={!currentFrame}
                >
                  Reset
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  className="col-span-2"
                  onClick={onResetAll}
                  disabled={draft.frames.length === 0}
                >
                  Reset all edits
                </Button>
              </div>
            </section>

            <div className="rounded-md border px-3 py-2 text-xs text-muted-foreground">
              Frame {draft.frames.length ? currentIndex + 1 : 0} edited bones:{" "}
              {countEditedBones(draft, currentIndex)}
            </div>
          </div>
        )}

        {tab === "save" && (
          <PoseSavePanel
            clipName={clipName}
            frames={draft.frames}
            draft={draft}
            mappingAnalysis={mappingAnalysis}
            qualityMarkers={qualityMarkers}
            saving={saving}
            onClipNameChange={onClipNameChange}
            onSave={onSave}
            forceInPlace={forceInPlace}
            onForceInPlaceChange={onForceInPlaceChange}
          />
        )}
      </div>
    </aside>
  );
}

interface PoseStudioShellProps {
  modelUuid: string;
  onClose: () => void;
}

export function PoseStudioShell({ modelUuid, onClose }: PoseStudioShellProps) {
  const model = useModelsStore((state) => state.models[modelUuid]);
  const entity = useEntitiesStore((state) => state.entities[modelUuid]);
  const entities = useEntitiesStore((state) => state.entities);
  const models = useModelsStore((state) => state.models);
  const allClips = useModelsStore((state) => state.clips);
  const clips = useModelsStore((state) => state.clips[modelUuid] ?? []);
  const addClip = useModelsStore((state) => state.addClip);
  const setAnimation = useModelsStore((state) => state.setAnimation);
  const importAnimationsFromSource = useModelsStore(
    (state) => state.importAnimationsFromSource,
  );
  const setVisibility = useEntitiesStore((state) => state.setVisibility);
  const isModelVisible = entity?.visible !== false;
  const modelReady = model?.loadState === "loaded";
  const defaultClipName = `Pose Clip ${clips.length + 1}`;
  const candidateSourceModels = useMemo(() => {
    const entries = Object.entries(models)
      .filter(
        ([uuid, modelState]) =>
          uuid !== modelUuid &&
          modelState.source === "file" &&
          modelState.loadState === "loaded" &&
          allClips[uuid]?.length,
      )
      .map(([uuid]) => ({
        uuid,
        label: entities[uuid]?.name ?? models[uuid]?.fileName ?? uuid,
      }));

    entries.sort((left, right) => left.label.localeCompare(right.label));
    return entries;
  }, [entities, modelUuid, models, allClips]);
  const [importSourceUuid, setImportSourceUuid] = useState(
    candidateSourceModels.at(0)?.uuid,
  );
  const [importForceInPlace, setImportForceInPlace] = useState(false);

  useEffect(() => {
    setImportSourceUuid((current) => {
      if (current && candidateSourceModels.some((entry) => entry.uuid === current)) {
        return current;
      }

      return candidateSourceModels.at(0)?.uuid;
    });
  }, [candidateSourceModels]);

  const videoRef = useRef<HTMLVideoElement>(null);
  const imageRef = useRef<HTMLImageElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const startTimeRef = useRef(0);
  const smootherRef = useRef(new PoseSmoother(0.4));
  const recordingFramesRef = useRef<PoseFrame[]>([]);
  const recordingMarkersRef = useRef<PoseFrameQualityMarker[]>([]);
  const bestFrameRef = useRef<{
    frame: PoseFrame;
    quality: PoseQualityResult;
  } | null>(null);
  const calibrationRef = useRef<PoseCalibration | null>(null);
  const autoDetectedRef = useRef(false);
  const worldLandmarksRef = useRef<NormalizedLandmark[] | null>(null);
  const poseDataRef = useRef<PoseBoneData | null>(null);
  const staticPoseRef = useRef<PoseBoneData | null>(null);
  const ikDebugRef = useRef<IkDebugSnapshot | null>(null);
  const ikDebugBeforeRef = useRef<unknown | null>(null);
  const lastIkSolveResultRef = useRef<IkSolveResult | null>(null);
  const historyTransactionRef = useRef<{
    state: PoseStudioPoseState;
    label: string;
  } | null>(null);

  const [ui, dispatchUi] = useReducer(
    poseStudioUiReducer,
    defaultClipName,
    createPoseStudioUiState,
  );
  const [poseState, setPoseState] = useState<PoseStudioPoseState>(() =>
    emptyPoseState(),
  );
  const [history, setHistory] = useState<HistoryState>({
    past: [],
    future: [],
  });
  const [inputMode, setInputMode] = useState<InputMode>("photo");
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [boneRemap, setBoneRemap] = useState<BoneRemap>({
    ...MIXAMO_DEFAULT_REMAP,
  });
  const [availableBones, setAvailableBones] = useState<string[]>([]);
  const [boneLoadError, setBoneLoadError] = useState<string | null>(null);
  const [rootMotion, setRootMotion] = useState(false);
  const [recording, setRecording] = useState(false);
  const [recordingFrameCount, setRecordingFrameCount] = useState(0);
  const [rejectedFrameCount, setRejectedFrameCount] = useState(0);
  const [elapsed, setElapsed] = useState(0);
  const [camError, setCamError] = useState<string | null>(null);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [calibrationRequestId, setCalibrationRequestId] = useState(0);
  const [calibrated, setCalibrated] = useState(false);
  const [bestQuality, setBestQuality] = useState<PoseQualityResult | null>(
    null,
  );
  const [detectingBestPhoto, setDetectingBestPhoto] = useState(false);
  const [ikStatus, setIkStatus] = useState<IkAvailability>({
    available: [],
    missing: {},
  });
  const [lastIkAffectedKeys, setLastIkAffectedKeys] = useState<string[]>([]);
  const [copiedPose, setCopiedPose] = useState<PoseFrameOverrides | null>(null);
  const [ikDebugCopyStatus, setIkDebugCopyStatus] = useState<string | null>(
    null,
  );
  const [saving, setSaving] = useState(false);

  const draft = poseState.draft;
  const qualityMarkers = poseState.qualityMarkers;
  const clampedIndex = Math.min(
    currentIndex,
    Math.max(0, draft.frames.length - 1),
  );
  const currentFrame = draft.frames[clampedIndex];
  const frameOverrides = useMemo(
    () => draft.overrides[clampedIndex] ?? {},
    [draft.overrides, clampedIndex],
  );
  const currentBones = useMemo(
    () => currentFrame?.data.bones ?? [],
    [currentFrame],
  );
  const mappedBoneKeys = useMemo(() => {
    const keys = new Set<string>(currentBones.map((bone) => bone.boneKey));
    if (currentFrame?.data.hips.boneName) keys.add("hips");
    return keys;
  }, [currentBones, currentFrame]);
  const selectedBoneKey =
    ui.selectedBone && mappedBoneKeys.has(ui.selectedBone)
      ? ui.selectedBone
      : currentFrame?.data.hips.boneName
        ? "hips"
        : currentBones[0]?.boneKey ?? null;
  const selectedIkTarget = ui.selectedIkTarget as IkEditableTargetKey | null;
  const selectedBoneEuler = selectedBoneKey
    ? getPoseBoneEuler(currentFrame, draft.correction, frameOverrides, selectedBoneKey)
    : { x: 0, y: 0, z: 0 };
  const selectedBonePosition = selectedBoneKey
    ? getPoseBonePosition(
        currentFrame,
        draft.correction,
        frameOverrides,
        selectedBoneKey,
      )
    : { x: 0, y: 0, z: 0 };

  const {
    screenLandmarks,
    worldLandmarks,
    fps,
    isReady,
    error: mpError,
    detectImageCandidates,
    applyDetectedCandidate,
  } = useMediaPipe(
    inputMode === "camera" || inputMode === "video" ? videoRef : undefined,
    inputMode === "photo" ? imageRef : undefined,
  );

  useEffect(() => {
    worldLandmarksRef.current = worldLandmarks;
  }, [worldLandmarks]);

  const mappingAnalysis = useMemo(
    () => analyzeBoneMapping(boneRemap, availableBones),
    [availableBones, boneRemap],
  );
  const poseQuality = useMemo(
    () =>
      scorePoseLandmarks({
        worldLandmarks,
        screenLandmarks,
        remap: boneRemap,
        availableBones,
      }),
    [availableBones, boneRemap, screenLandmarks, worldLandmarks],
  );
  const poseDetected = Boolean(screenLandmarks && worldLandmarks);
  const mappedBoneCount = mappingAnalysis.mapped;
  const expectedBoneCount = Object.keys(BODY_PART_LABELS).length;

  useEffect(() => {
    if (clampedIndex !== currentIndex) setCurrentIndex(clampedIndex);
  }, [clampedIndex, currentIndex]);

  useEffect(() => {
    if (
      !ui.selectedBone &&
      (currentFrame?.data.hips.boneName || currentBones[0])
    ) {
      dispatchUi({
        type: "selectBone",
        boneKey: currentFrame?.data.hips.boneName ? "hips" : currentBones[0].boneKey,
      });
    }
  }, [currentBones, currentFrame, ui.selectedBone]);

  useEffect(() => {
    if (ui.tool !== "ik" || ikStatus.available.length === 0) return;
    const selectedEffector = ikTargetToEffector(selectedIkTarget);
    if (!selectedEffector || !ikStatus.available.includes(selectedEffector)) {
      dispatchUi({ type: "selectIkTarget", targetKey: ikStatus.available[0] });
    }
  }, [ikStatus.available, selectedIkTarget, ui.tool]);

  useEffect(() => {
    const frame = draft.frames[clampedIndex];
    if (!frame) {
      staticPoseRef.current = null;
      return;
    }
    staticPoseRef.current = ui.overlays.beforePose
      ? frame.data
      : buildFinalPose(frame, draft.correction, frameOverrides);
  }, [draft, clampedIndex, frameOverrides, ui.overlays.beforePose]);

  const stopCamera = useCallback(() => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
  }, []);

  const toggleModelVisibility = useCallback(() => {
    setVisibility(modelUuid, !isModelVisible);
  }, [isModelVisible, modelUuid, setVisibility]);

  const handleImportFromLoadedModel = useCallback(async () => {
    if (!modelReady) {
      toast.error("Model must be loaded before importing animations.");
      return;
    }

    if (!importSourceUuid) {
      toast.error("Select a source model first.");
      return;
    }

    try {
      const { importedNames } = await importAnimationsFromSource(modelUuid, {
        sourceModelUuid: importSourceUuid,
        forceInPlace: importForceInPlace,
      });

      if (importedNames.length === 0) {
        toast.info("No animations found in source model.");
        return;
      }

      toast.success(
        `Imported ${importedNames.length} animation(s): ${importedNames.join(", ")}`,
      );
    } catch (error) {
      toast.error("Failed to import animations from model", {
        description: (error as Error).message,
      });
    }
  }, [
    importSourceUuid,
    importAnimationsFromSource,
    modelReady,
    modelUuid,
    importForceInPlace,
  ]);

  const handleImportFromFile = useCallback(() => {
    if (!modelReady) {
      toast.error("Model must be loaded before importing animations.");
      return;
    }

    importFile(ACCEPTED_MODEL_FILE_TYPES, async (file) => {
      try {
        const { importedNames } = await importAnimationsFromSource(modelUuid, {
          sourceFile: file,
          forceInPlace: importForceInPlace,
        });

        if (importedNames.length === 0) {
          toast.info("No animations found in source file.");
          return;
        }

        toast.success(
          `Imported ${importedNames.length} animation(s) from file: ${importedNames.join(", ")}`,
        );
      } catch (error) {
        toast.error("Failed to import animations from file", {
          description: (error as Error).message,
        });
      }
    });
  }, [importAnimationsFromSource, modelReady, modelUuid, importForceInPlace]);

  useEffect(() => {
    autoDetectedRef.current = false;
    setAvailableBones([]);
    setBoneLoadError(null);
    calibrationRef.current = null;
    setCalibrated(false);

    if (!model?.file) return;
    const format = model.file.name
      .split(".")
      .pop()
      ?.toLowerCase() as ModelComponent["format"];
    if (!format) return;

    let cancelled = false;
    parseModel(model.file, format)
      .then((parsed) => {
        if (cancelled) return;
        const names: string[] = [];
        parsed.object.traverse((child) => {
          if (child.name) names.push(child.name);
        });
        const sorted = [...new Set(names)].sort();
        setAvailableBones(sorted);
        if (!autoDetectedRef.current && sorted.length > 0) {
          setBoneRemap(autoDetectRemap(sorted));
          autoDetectedRef.current = true;
        }
      })
      .catch((error) => {
        if (!cancelled) setBoneLoadError((error as Error).message);
      });

    return () => {
      cancelled = true;
    };
  }, [model?.file]);

  useEffect(() => {
    calibrationRef.current = null;
    setCalibrated(false);
  }, [boneRemap]);

  useEffect(() => {
    if (inputMode !== "camera") {
      stopCamera();
      return;
    }

    const videoElement = videoRef.current;
    navigator.mediaDevices
      .getUserMedia({
        video: { width: VIDEO_W, height: VIDEO_H, facingMode: "user" },
      })
      .then((stream) => {
        streamRef.current = stream;
        if (videoElement) {
          videoElement.srcObject = stream;
          videoElement.play();
        }
      })
      .catch((error) => setCamError((error as Error).message));

    return () => {
      stopCamera();
    };
  }, [inputMode, stopCamera]);

  useEffect(() => {
    const el = videoRef.current;
    if (!el) return;
    if (inputMode !== "video") {
      el.src = "";
      return;
    }
    if (!videoUrl) return;
    el.srcObject = null;
    el.src = videoUrl;
    el.loop = true;
    el.play();
  }, [inputMode, videoUrl]);

  useEffect(() => {
    if (inputMode === "photo") setRecording(false);
  }, [inputMode]);

  useEffect(() => {
    if (!photoFile) {
      setPhotoUrl(null);
      return;
    }
    const url = URL.createObjectURL(photoFile);
    setPhotoUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [photoFile]);

  useEffect(() => {
    if (!videoFile) {
      setVideoUrl(null);
      return;
    }
    const url = URL.createObjectURL(videoFile);
    setVideoUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [videoFile]);

  useEffect(() => {
    if (!playing || draft.frames.length <= 1) return;
    const id = window.setInterval(() => {
      setCurrentIndex((index) => (index + 1) % draft.frames.length);
    }, 120);
    return () => window.clearInterval(id);
  }, [draft.frames.length, playing]);

  const pushHistory = useCallback((entry: HistoryEntry) => {
    setHistory((state) => ({
      past: [...state.past, entry].slice(-80),
      future: [],
    }));
  }, []);

  const commitPoseState = useCallback(
    (
      updater: (current: PoseStudioPoseState) => PoseStudioPoseState,
      label: string,
    ) => {
      setPoseState((current) => {
        const next = updater(current);
        if (next !== current && !historyTransactionRef.current) {
          pushHistory({ label, state: current });
        }
        return next;
      });
    },
    [pushHistory],
  );

  const beginHistoryTransaction = useCallback(
    (label = "Edit pose") => {
      setPoseState((current) => {
        if (!historyTransactionRef.current) {
          historyTransactionRef.current = { label, state: current };
        }
        return current;
      });
    },
    [],
  );

  const endHistoryTransaction = useCallback(() => {
    setPoseState((current) => {
      const previous = historyTransactionRef.current;
      historyTransactionRef.current = null;
      if (previous && previous.state !== current) {
        pushHistory(previous);
      }
      return current;
    });
  }, [pushHistory]);

  const undo = useCallback(() => {
    historyTransactionRef.current = null;
    setHistory((state) => {
      const previous = state.past.at(-1);
      if (!previous) return state;
      setPoseState(previous.state);
      setCurrentIndex((index) =>
        Math.min(index, Math.max(0, previous.state.draft.frames.length - 1)),
      );
      return {
        past: state.past.slice(0, -1),
        future: [{ label: previous.label, state: poseState }, ...state.future].slice(
          0,
          80,
        ),
      };
    });
  }, [poseState]);

  const redo = useCallback(() => {
    historyTransactionRef.current = null;
    setHistory((state) => {
      const next = state.future[0];
      if (!next) return state;
      setPoseState(next.state);
      setCurrentIndex((index) =>
        Math.min(index, Math.max(0, next.state.draft.frames.length - 1)),
      );
      return {
        past: [...state.past, { label: next.label, state: poseState }].slice(-80),
        future: state.future.slice(1),
      };
    });
  }, [poseState]);

  const buildSmoothedFrame = useCallback((time: number): PoseFrame | null => {
    const pose = poseDataRef.current;
    if (!pose) return null;

    const smoothed: PoseBoneData = {
      hips: {
        boneName: pose.hips.boneName,
        position: smootherRef.current.smoothVec("hips.pos", pose.hips.position),
        quaternion: smootherRef.current.smoothQuat(
          "hips.quat",
          pose.hips.quaternion,
        ),
      },
      bones: pose.bones.map((bone) => ({
        boneKey: bone.boneKey,
        boneName: bone.boneName,
        position: bone.position
          ? smootherRef.current.smoothVec(`${bone.boneName}.pos`, bone.position)
          : undefined,
        quaternion: smootherRef.current.smoothQuat(
          bone.boneName,
          bone.quaternion,
        ),
      })),
    };

    return { time, data: smoothed };
  }, []);

  const rememberBestFrame = useCallback(
    (frame: PoseFrame, quality: PoseQualityResult) => {
      if (quality.label === "Poor") return;
      const currentBest = bestFrameRef.current;
      if (!currentBest || quality.score > currentBest.quality.score) {
        bestFrameRef.current = {
          frame: {
            time: 0,
            data: clonePoseData(frame.data),
          },
          quality,
        };
        setBestQuality(quality);
      }
    },
    [],
  );

  useEffect(() => {
    if (
      !recording ||
      (inputMode !== "camera" && inputMode !== "video") ||
      !worldLandmarks ||
      !poseDataRef.current
    ) {
      return;
    }

    const time = (performance.now() - startTimeRef.current) / 1000;
    const frame = buildSmoothedFrame(time);
    if (!frame) return;

    if (poseQuality.label === "Poor") {
      setRejectedFrameCount((count) => count + 1);
      return;
    }

    const frameIndex = recordingFramesRef.current.length;
    recordingFramesRef.current.push(frame);
    recordingMarkersRef.current.push(makeQualityMarker(frameIndex, poseQuality));
    rememberBestFrame(frame, poseQuality);
    setRecordingFrameCount(recordingFramesRef.current.length);
    setElapsed(time);
  }, [
    buildSmoothedFrame,
    inputMode,
    poseQuality,
    recording,
    rememberBestFrame,
    worldLandmarks,
  ]);

  const replaceCapturedFrames = useCallback(
    (
      frames: PoseFrame[],
      markers: PoseFrameQualityMarker[],
      label: string,
    ) => {
      commitPoseState(
        () => ({
          draft: {
            frames,
            correction: { ...DEFAULT_POSE_CORRECTION },
            overrides: {},
          },
          qualityMarkers: markers,
        }),
        label,
      );
      setCurrentIndex(0);
      dispatchUi({ type: "setOverlay", key: "beforePose", value: false });
    },
    [commitPoseState],
  );

  const handleStartRecording = useCallback(() => {
    recordingFramesRef.current = [];
    recordingMarkersRef.current = [];
    bestFrameRef.current = null;
    smootherRef.current.reset();
    startTimeRef.current = performance.now();
    setRecordingFrameCount(0);
    setRejectedFrameCount(0);
    setBestQuality(null);
    setElapsed(0);
    setRecording(true);
  }, []);

  const handleStopRecording = useCallback(() => {
    setRecording(false);
    if (recordingFramesRef.current.length === 0) return;
    replaceCapturedFrames(
      [...recordingFramesRef.current],
      [...recordingMarkersRef.current],
      "Record motion",
    );
  }, [replaceCapturedFrames]);

  const handleClearCapture = useCallback(() => {
    recordingFramesRef.current = [];
    recordingMarkersRef.current = [];
    bestFrameRef.current = null;
    smootherRef.current.reset();
    setRecordingFrameCount(0);
    setRejectedFrameCount(0);
    setBestQuality(null);
    setElapsed(0);
    setRecording(false);
    commitPoseState(() => emptyPoseState(), "Clear capture");
  }, [commitPoseState]);

  const handlePhotoSelect = useCallback(() => {
    importFile(["png", "jpg", "jpeg", "webp", "gif"], (file) => {
      setPhotoFile(file);
      handleClearCapture();
    });
  }, [handleClearCapture]);

  const handleVideoSelect = useCallback(() => {
    importFile(["mp4", "webm"], (file) => {
      setVideoFile(file);
      handleClearCapture();
    });
  }, [handleClearCapture]);

  const handleCapturePhoto = useCallback(async () => {
    if (!photoUrl || !imageRef.current) return;
    setDetectingBestPhoto(true);

    try {
      let selectedQuality = poseQuality;
      const candidates = await detectImageCandidates(imageRef.current);
      const best = selectBestPoseCandidate(candidates, {
        remap: boneRemap,
        availableBones,
      });

      if (best?.candidate) {
        applyDetectedCandidate(best.candidate);
        if (best.candidate.worldLandmarks) {
          worldLandmarksRef.current = best.candidate.worldLandmarks;
        }
        selectedQuality = best.quality;
        await waitForPreviewFrame();
      }

      if (!worldLandmarksRef.current || !poseDataRef.current) return;
      smootherRef.current.reset();
      const frame = buildSmoothedFrame(0);
      if (!frame) return;

      rememberBestFrame(frame, selectedQuality);
      replaceCapturedFrames(
        [frame],
        [makeQualityMarker(0, selectedQuality)],
        "Capture photo pose",
      );

      if (selectedQuality.label === "Poor") {
        toast.warning("Captured pose quality is poor", {
          description:
            selectedQuality.warnings[0] ??
            "Try a full-body frame with visible limb joints.",
        });
      }
    } finally {
      setDetectingBestPhoto(false);
    }
  }, [
    applyDetectedCandidate,
    availableBones,
    boneRemap,
    buildSmoothedFrame,
    detectImageCandidates,
    photoUrl,
    poseQuality,
    rememberBestFrame,
    replaceCapturedFrames,
  ]);

  const handleUseBestFrame = useCallback(() => {
    const best = bestFrameRef.current;
    if (!best) return;
    replaceCapturedFrames(
      [
        {
          time: 0,
          data: clonePoseData(best.frame.data),
        },
      ],
      [makeQualityMarker(0, best.quality)],
      "Use best frame",
    );
    setRecording(false);
    setRecordingFrameCount(1);
    setRejectedFrameCount(0);
    setElapsed(0);
    toast.success("Using best detected pose", {
      description: `${best.quality.label} ${Math.round(
        best.quality.score * 100,
      )}%`,
    });
  }, [replaceCapturedFrames]);

  const handleCalibrateRestPose = useCallback(() => {
    if (!worldLandmarksRef.current || !poseDataRef.current) {
      toast.warning("No pose is ready to calibrate");
      return;
    }
    setCalibrationRequestId((value) => value + 1);
  }, []);

  const handleCalibrationReady = useCallback(() => {
    setCalibrated(true);
    toast.success("Rest pose calibrated for this session");
  }, []);

  const setBoneEuler = useCallback(
    (boneKey: string, euler: PoseBoneOverride) => {
      commitPoseState(
        (current) => ({
          ...current,
          draft: {
            ...current.draft,
            overrides: setPoseBoneOverride(
              current.draft.overrides,
              clampedIndex,
              boneKey,
              {
                ...euler,
                position:
                  current.draft.overrides[clampedIndex]?.[boneKey]?.position,
              },
            ),
          },
        }),
        "Rotate bone",
      );
    },
    [clampedIndex, commitPoseState],
  );

  const setBonePosition = useCallback(
    (
      boneKey: string,
      position: NonNullable<PoseBoneOverride["position"]>,
    ) => {
      commitPoseState(
        (current) => {
          const rotation = getPoseBoneEuler(
            current.draft.frames[clampedIndex],
            current.draft.correction,
            current.draft.overrides[clampedIndex] ?? {},
            boneKey,
          );
          return {
            ...current,
            draft: {
              ...current.draft,
              overrides: setPoseBoneOverride(
                current.draft.overrides,
                clampedIndex,
                boneKey,
                { ...rotation, position },
              ),
            },
          };
        },
        "Move bone",
      );
    },
    [clampedIndex, commitPoseState],
  );

  const updateCorrection = useCallback(
    (update: Partial<PoseEditDraft["correction"]>, label: string) => {
      commitPoseState(
        (current) => ({
          ...current,
          draft: {
            ...current.draft,
            correction: { ...current.draft.correction, ...update },
          },
        }),
        label,
      );
    },
    [commitPoseState],
  );

  const handleBoneAxisChange = useCallback(
    (boneKey: string, axis: "x" | "y" | "z", value: number) => {
      if (boneKey === "__global__") {
        const key =
          axis === "x" ? "rotX" : axis === "y" ? "rotY" : "rotZ";
        updateCorrection({ [key]: value }, "Global rotate");
        return;
      }
      const current = getPoseBoneEuler(
        currentFrame,
        draft.correction,
        frameOverrides,
        boneKey,
      );
      setBoneEuler(boneKey, { ...current, [axis]: value });
    },
    [currentFrame, draft.correction, frameOverrides, setBoneEuler, updateCorrection],
  );

  const handleBonePositionAxisChange = useCallback(
    (boneKey: string, axis: "x" | "y" | "z", value: number) => {
      if (boneKey === "__global__") {
        const key =
          axis === "x" ? "moveX" : axis === "y" ? "moveY" : "moveZ";
        updateCorrection({ [key]: value }, "Global move");
        return;
      }
      const current = getPoseBonePosition(
        currentFrame,
        draft.correction,
        frameOverrides,
        boneKey,
      );
      setBonePosition(boneKey, { ...current, [axis]: value });
    },
    [
      currentFrame,
      draft.correction,
      frameOverrides,
      setBonePosition,
      updateCorrection,
    ],
  );

  const resetBone = useCallback(
    (boneKey: string) => {
      commitPoseState(
        (current) => ({
          ...current,
          draft: {
            ...current.draft,
            overrides: resetPoseBoneOverride(
              current.draft.overrides,
              clampedIndex,
              boneKey,
            ),
          },
        }),
        "Reset bone",
      );
    },
    [clampedIndex, commitPoseState],
  );

  const applyBoneToAllFrames = useCallback(
    (boneKey: string) => {
      commitPoseState(
        (current) => ({
          ...current,
          draft: {
            ...current.draft,
            overrides: applyPoseBoneOverrideToAllFrames(
              current.draft.overrides,
              current.draft.frames,
              clampedIndex,
              boneKey,
            ),
          },
        }),
        "Apply bone to all frames",
      );
    },
    [clampedIndex, commitPoseState],
  );

  const applyIkOverrides = useCallback(
    (overrides: PoseFrameOverrides, result: IkSolveResult) => {
      lastIkSolveResultRef.current = result;
      setLastIkAffectedKeys(result.affectedBoneKeys);
      commitPoseState(
        (current) => ({
          ...current,
          draft: {
            ...current.draft,
            overrides: {
              ...current.draft.overrides,
              [clampedIndex]: overrides,
            },
          },
        }),
        "Move IK target",
      );
    },
    [clampedIndex, commitPoseState],
  );

  const applyIkPoseToAllFrames = useCallback(() => {
    commitPoseState(
      (current) => {
        const source = current.draft.overrides[clampedIndex] ?? {};
        const keys =
          lastIkAffectedKeys.length > 0
            ? lastIkAffectedKeys
            : Object.keys(source);
        if (keys.length === 0) return current;
        const next = { ...current.draft.overrides };
        current.draft.frames.forEach((_, index) => {
          const frameOverrides = { ...(next[index] ?? {}) };
          keys.forEach((key) => {
            if (source[key]) frameOverrides[key] = source[key];
          });
          next[index] = frameOverrides;
        });
        return {
          ...current,
          draft: { ...current.draft, overrides: next },
        };
      },
      "Apply IK to all frames",
    );
  }, [clampedIndex, commitPoseState, lastIkAffectedKeys]);

  const mirrorCurrentPose = useCallback(() => {
    if (!currentFrame) return;
    commitPoseState(
      (current) => {
        const finalPose = buildFinalPose(
          current.draft.frames[clampedIndex],
          current.draft.correction,
          current.draft.overrides[clampedIndex] ?? {},
        );
        const mirrored = applyPoseCorrection(finalPose, {
          ...DEFAULT_POSE_CORRECTION,
          mirror: true,
        });
        const overrides: PoseFrameOverrides = {};
        const hipsOverride = quaternionToEulerDeg(mirrored.hips.quaternion);
        hipsOverride.position = vectorToPositionOverride(mirrored.hips.position);
        overrides.hips = hipsOverride;
        mirrored.bones.forEach((bone) => {
          const override = quaternionToEulerDeg(bone.quaternion);
          if (bone.position) {
            override.position = vectorToPositionOverride(bone.position);
          }
          overrides[bone.boneKey] = override;
        });
        return {
          ...current,
          draft: {
            ...current.draft,
            overrides: { ...current.draft.overrides, [clampedIndex]: overrides },
          },
        };
      },
      "Mirror current pose",
    );
  }, [clampedIndex, commitPoseState, currentFrame]);

  const resetCurrentPose = useCallback(() => {
    commitPoseState(
      (current) => ({
        ...current,
        draft: {
          ...current.draft,
          overrides: resetPoseFrameOverrides(
            current.draft.overrides,
            clampedIndex,
          ),
        },
      }),
      "Reset current pose",
    );
  }, [clampedIndex, commitPoseState]);

  const clearAllEdits = useCallback(() => {
    commitPoseState(
      (current) => ({
        ...current,
        draft: {
          ...current.draft,
          correction: { ...DEFAULT_POSE_CORRECTION },
          overrides: {},
        },
      }),
      "Reset all edits",
    );
  }, [commitPoseState]);

  const copyCurrentPose = useCallback(() => {
    setCopiedPose(copyPoseFrameOverrides(draft.overrides, clampedIndex));
  }, [clampedIndex, draft.overrides]);

  const pasteCurrentPose = useCallback(() => {
    if (!copiedPose) return;
    commitPoseState(
      (current) => ({
        ...current,
        draft: {
          ...current.draft,
          overrides: pastePoseFrameOverrides(
            current.draft.overrides,
            clampedIndex,
            copiedPose,
          ),
        },
      }),
      "Paste pose",
    );
  }, [clampedIndex, commitPoseState, copiedPose]);

  const handleDeleteFrame = useCallback(() => {
    if (!currentFrame) return;
    commitPoseState(
      (current) => ({
        draft: deletePoseFrame(current.draft, clampedIndex),
        qualityMarkers: shiftQualityMarkersAfterDelete(
          current.qualityMarkers,
          clampedIndex,
        ),
      }),
      "Delete frame",
    );
    setCurrentIndex((index) =>
      Math.max(0, Math.min(index, draft.frames.length - 2)),
    );
  }, [clampedIndex, commitPoseState, currentFrame, draft.frames.length]);

  const handleTrimBefore = useCallback(() => {
    commitPoseState(
      (current) => ({
        draft: trimPoseFramesBefore(current.draft, clampedIndex),
        qualityMarkers: trimQualityMarkersBefore(
          current.qualityMarkers,
          clampedIndex,
        ),
      }),
      "Trim start",
    );
    setCurrentIndex(0);
  }, [clampedIndex, commitPoseState]);

  const handleTrimAfter = useCallback(() => {
    commitPoseState(
      (current) => ({
        draft: trimPoseFramesAfter(current.draft, clampedIndex),
        qualityMarkers: trimQualityMarkersAfter(
          current.qualityMarkers,
          clampedIndex,
        ),
      }),
      "Trim end",
    );
  }, [clampedIndex, commitPoseState]);

  const handleIkStatusChange = useCallback((status: IkAvailability) => {
    setIkStatus((current) =>
      ikAvailabilityKey(current) === ikAvailabilityKey(status)
        ? current
        : status,
    );
  }, []);

  const buildIkDebugPayload = useCallback(
    (label: "before" | "after") => ({
      kind: "pose-studio-ik-copy",
      version: 2,
      label,
      capturedAt: new Date().toISOString(),
      browser: {
        userAgent:
          typeof navigator === "undefined" ? "unknown" : navigator.userAgent,
      },
      ui: {
        modelUuid,
        tool: ui.tool,
        selectedBoneKey,
        selectedIkTarget,
        selectedIkEffector: ikTargetToEffector(selectedIkTarget),
        frameIndex: clampedIndex,
        frameCount: draft.frames.length,
        ikStatus,
        lastIkAffectedKeys,
        historyPastCount: history.past.length,
        historyFutureCount: history.future.length,
        historyTransactionActive: Boolean(historyTransactionRef.current),
      },
      draft: {
        correction: draft.correction,
        currentFrameOverrides: frameOverrides,
        overrideFrameIndexes: Object.keys(draft.overrides),
        allOverrides: draft.overrides,
      },
      currentFrame: currentFrame
        ? {
            time: currentFrame.time,
            sourcePose: summarisePoseData(currentFrame.data),
            rebuiltFinalPose: summarisePoseData(
              buildFinalPose(currentFrame, draft.correction, frameOverrides),
            ),
            staticPreviewPose: summarisePoseData(staticPoseRef.current),
          }
        : null,
      lastSolveResult: serialiseIkSolveResult(lastIkSolveResultRef.current),
      liveIk: ikDebugRef.current,
    }),
    [
      clampedIndex,
      currentFrame,
      draft,
      frameOverrides,
      history.future.length,
      history.past.length,
      ikStatus,
      lastIkAffectedKeys,
      modelUuid,
      selectedBoneKey,
      selectedIkTarget,
      ui.tool,
    ],
  );

  const copyDebugText = useCallback(async (payload: unknown, status: string) => {
    const text = JSON.stringify(payload, null, 2);
    if (!navigator.clipboard?.writeText) {
      setIkDebugCopyStatus("Clipboard unavailable");
      return;
    }
    try {
      await navigator.clipboard.writeText(text);
      setIkDebugCopyStatus(status);
    } catch (error) {
      setIkDebugCopyStatus(
        error instanceof Error ? error.message : "Copy failed",
      );
    }
  }, []);

  const copyIkDebugBefore = useCallback(async () => {
    const payload = buildIkDebugPayload("before");
    ikDebugBeforeRef.current = payload;
    await copyDebugText(payload, "Copied IK before");
  }, [buildIkDebugPayload, copyDebugText]);

  const copyIkDebugAfter = useCallback(async () => {
    const payload = {
      kind: "pose-studio-ik-before-after",
      version: 2,
      capturedAt: new Date().toISOString(),
      before: ikDebugBeforeRef.current,
      after: buildIkDebugPayload("after"),
    };
    await copyDebugText(payload, "Copied IK before/after");
  }, [buildIkDebugPayload, copyDebugText]);

  const handleSave = useCallback(async () => {
    const frames = buildFinalPoseFrames(draft);
    if (frames.length === 0) return;
    if (!modelReady) {
      toast.error("Model must be loaded before saving animations.");
      return;
    }

    const trimmed = ui.clipName.trim() || defaultClipName;
    setSaving(true);
    try {
      const clip = buildAnimationClip(frames, trimmed);
      addClip(modelUuid, clip);
      setAnimation(modelUuid, trimmed);
      toast.success(
        `Saved "${trimmed}" (${frames.length} frames, ${getPoseClipDuration(
          frames,
        ).toFixed(2)}s)`,
      );
      onClose();
    } catch (error) {
      toast.error((error as Error).message);
    } finally {
      setSaving(false);
    }
  }, [
    addClip,
    defaultClipName,
    draft,
    modelUuid,
    onClose,
    modelReady,
    setAnimation,
    ui.clipName,
  ]);

  const inputError =
    inputMode === "photo" && !photoUrl
      ? "Upload a photo to capture a pose."
      : inputMode === "video" && !videoUrl
        ? "Upload a video to record frames."
        : null;
  const error =
    inputMode === "camera" ? (camError ?? mpError) : (inputError ?? mpError);
  const canRecord =
    isReady && !error && inputMode !== "photo" && (inputMode !== "video" || !!videoUrl);
  const displayFrameCount =
    recording && recordingFrameCount > 0
      ? recordingFrameCount
      : draft.frames.length;
  const summary = getPoseDraftSummary(draft);
  const modelName = model?.fileName ?? model?.file?.name ?? "Selected model";
  const editedBoneKeys = Object.keys(frameOverrides);

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden bg-background">
      <header className="flex min-h-14 items-center gap-2 border-b px-4">
        <div className="min-w-0">
          <div className="truncate text-sm font-semibold">Pose Studio</div>
          <div className="truncate text-xs text-muted-foreground">
            {modelName}
          </div>
        </div>
        <Input
          className="ml-3 h-8 w-52"
          value={ui.clipName}
          onChange={(event) =>
            dispatchUi({ type: "setClipName", clipName: event.target.value })
          }
        />
        <div className="hidden min-w-0 flex-1 flex-wrap items-center gap-2 xl:flex">
          <ToneBadge
            ok={modelReady}
            label="Model"
            value={modelReady ? "ready" : "loading"}
          />
          <ToneBadge
            ok={poseDetected}
            label="Pose"
            value={poseDetected ? "detected" : "waiting"}
          />
          <ToneBadge
            ok={mappedBoneCount > 0}
            label="Mapping"
            value={`${mappedBoneCount}/${expectedBoneCount}`}
          />
          <QualityBadge quality={poseQuality} />
          <span className="inline-flex h-7 items-center rounded-md border px-2 text-xs text-muted-foreground">
            Frames {displayFrameCount}
          </span>
          <span className="inline-flex h-7 items-center gap-1 rounded-md border px-2 text-xs text-muted-foreground">
            <ShieldCheck size={12} />
            Local detection
          </span>
        </div>
        <div className="ml-auto flex items-center gap-1">
          <Button
            size="icon"
            variant="ghost"
            onClick={toggleModelVisibility}
            title={isModelVisible ? "Hide model" : "Show model"}
            aria-label={isModelVisible ? "Hide model" : "Show model"}
          >
            {isModelVisible ? <EyeOff size={15} /> : <Eye size={15} />}
          </Button>
          <Label
            htmlFor="import-force-in-place"
            className="flex cursor-pointer items-center gap-2 px-1 text-xs text-muted-foreground"
          >
            <span>Force in place</span>
            <Switch
              id="import-force-in-place"
              checked={importForceInPlace}
              onCheckedChange={setImportForceInPlace}
              disabled={!modelReady}
            />
          </Label>
          <Select
            value={importSourceUuid ?? ""}
            onValueChange={(value) => setImportSourceUuid(value)}
            disabled={candidateSourceModels.length === 0 || !modelReady}
          >
            <SelectTrigger className="w-44" disabled={candidateSourceModels.length === 0 || !modelReady}>
              <SelectValue placeholder="Import from model" />
            </SelectTrigger>
            <SelectContent>
              {candidateSourceModels.map((entry) => (
                <SelectItem key={entry.uuid} value={entry.uuid}>
                  {entry.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button
            size="sm"
            variant="outline"
            onClick={handleImportFromLoadedModel}
            disabled={candidateSourceModels.length === 0 || !modelReady || !importSourceUuid}
          >
            Import Anim
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={handleImportFromFile}
            disabled={!modelReady}
          >
            Import File
          </Button>
          <Button
            size="icon"
            variant="ghost"
            onClick={undo}
            disabled={history.past.length === 0}
            title={history.past.at(-1)?.label ?? "Undo"}
          >
            <Undo2 size={15} />
          </Button>
          <Button
            size="icon"
            variant="ghost"
            onClick={redo}
            disabled={history.future.length === 0}
            title={history.future[0]?.label ?? "Redo"}
          >
            <Redo2 size={15} />
          </Button>
          <Button
            onClick={handleSave}
            disabled={saving || draft.frames.length === 0}
            className="gap-2"
          >
            <Save size={14} />
            Save
          </Button>
        </div>
      </header>

      <div className="grid min-h-0 flex-1 grid-cols-[300px_minmax(360px,1fr)_360px] max-xl:grid-cols-[280px_minmax(320px,1fr)_330px] max-lg:grid-cols-1">
        <PoseSourcePanel
          inputMode={inputMode}
          setInputMode={setInputMode}
          videoRef={videoRef}
          imageRef={imageRef}
          photoUrl={photoUrl}
          videoUrl={videoUrl}
          screenLandmarks={screenLandmarks}
          isReady={isReady}
          error={error}
          fps={fps}
          recording={recording}
          elapsed={elapsed}
          sourceSkeleton={ui.overlays.sourceSkeleton}
          onPhotoSelect={handlePhotoSelect}
          onVideoSelect={handleVideoSelect}
          onClearPhoto={() => setPhotoFile(null)}
          onClearVideo={() => setVideoFile(null)}
          onCapturePhoto={handleCapturePhoto}
          onStartRecording={handleStartRecording}
          onStopRecording={handleStopRecording}
          detectingBestPhoto={detectingBestPhoto}
          canRecord={canRecord}
        />
        <PoseViewportPanel
          modelUuid={modelUuid}
          hasFrames={draft.frames.length > 0}
          landmarksRef={worldLandmarksRef}
          poseDataRef={poseDataRef}
          staticPoseRef={staticPoseRef}
          remap={boneRemap}
          rootMotion={rootMotion}
          calibrationRef={calibrationRef}
          calibrationRequestId={calibrationRequestId}
          onCalibrationReady={handleCalibrationReady}
          tool={ui.tool}
          selectedBoneKey={selectedBoneKey}
          selectedIkTargetKey={selectedIkTarget}
          frameOverrides={frameOverrides}
          editedBoneKeys={editedBoneKeys}
          showModelSkeleton={ui.overlays.modelSkeleton}
          beforePose={ui.overlays.beforePose}
          onSetTool={(tool) => dispatchUi({ type: "setTool", tool })}
          onSelectBone={(boneKey) =>
            dispatchUi({ type: "selectBone", boneKey })
          }
          onSelectIkTarget={(targetKey) =>
            dispatchUi({ type: "selectIkTarget", targetKey })
          }
          onBoneEulerChange={setBoneEuler}
          onBonePositionChange={setBonePosition}
          onIkSolveChange={applyIkOverrides}
          onIkStatusChange={handleIkStatusChange}
          ikDebugRef={ikDebugRef}
          onGizmoEditStart={() => beginHistoryTransaction("Gizmo edit")}
          onGizmoEditEnd={endHistoryTransaction}
        />
        <PoseInspector
          tab={ui.inspectorTab}
          setTab={(tab) => dispatchUi({ type: "setInspectorTab", tab })}
          modelUuid={modelUuid}
          remap={boneRemap}
          setRemap={setBoneRemap}
          availableBones={availableBones}
          boneLoadError={boneLoadError}
          mappingAnalysis={mappingAnalysis}
          poseQuality={poseQuality}
          poseDetected={poseDetected}
          rootMotion={rootMotion}
          setRootMotion={setRootMotion}
          calibrated={calibrated}
          onCalibrate={handleCalibrateRestPose}
          bestQuality={bestQuality}
          onUseBestFrame={handleUseBestFrame}
          rejectedFrameCount={rejectedFrameCount}
          sourceSkeleton={ui.overlays.sourceSkeleton}
          modelSkeleton={ui.overlays.modelSkeleton}
          beforePose={ui.overlays.beforePose}
          onToggleSourceSkeleton={() =>
            dispatchUi({ type: "toggleOverlay", key: "sourceSkeleton" })
          }
          onToggleModelSkeleton={() =>
            dispatchUi({ type: "toggleOverlay", key: "modelSkeleton" })
          }
          onToggleBeforePose={() =>
            dispatchUi({ type: "toggleOverlay", key: "beforePose" })
          }
          tool={ui.tool}
          setTool={(tool) => dispatchUi({ type: "setTool", tool })}
          currentFrame={currentFrame}
          currentIndex={clampedIndex}
          draft={draft}
          frameOverrides={frameOverrides}
          mappedBoneKeys={mappedBoneKeys}
          selectedBoneKey={selectedBoneKey}
          selectedBoneEuler={selectedBoneEuler}
          selectedBonePosition={selectedBonePosition}
          selectedIkTarget={selectedIkTarget}
          ikStatus={ikStatus}
          copiedPose={copiedPose}
          ikDebugCopyStatus={ikDebugCopyStatus}
          onSelectBone={(boneKey) =>
            dispatchUi({ type: "selectBone", boneKey })
          }
          onSelectIkTarget={(targetKey) =>
            dispatchUi({ type: "selectIkTarget", targetKey })
          }
          onBoneAxisChange={handleBoneAxisChange}
          onBonePositionAxisChange={handleBonePositionAxisChange}
          onResetBone={resetBone}
          onApplyBoneToAll={applyBoneToAllFrames}
          onApplyIkPoseToAll={applyIkPoseToAllFrames}
          onMirrorCurrent={mirrorCurrentPose}
          onMirrorAll={() =>
            updateCorrection(
              { mirror: !draft.correction.mirror },
              "Mirror all",
            )
          }
          onFlip180={() => {
            const next = ((draft.correction.rotY + 180 + 180) % 360) - 180;
            updateCorrection({ rotY: next }, "Flip 180");
          }}
          onCopyPose={copyCurrentPose}
          onPastePose={pasteCurrentPose}
          onResetCurrent={resetCurrentPose}
          onResetAll={clearAllEdits}
          onCopyIkDebugBefore={copyIkDebugBefore}
          onCopyIkDebugAfter={copyIkDebugAfter}
          onEditStart={beginHistoryTransaction}
          onEditEnd={endHistoryTransaction}
          clipName={ui.clipName}
          saving={saving}
          qualityMarkers={qualityMarkers}
          forceInPlace={importForceInPlace}
          onForceInPlaceChange={setImportForceInPlace}
          onClipNameChange={(clipName) =>
            dispatchUi({ type: "setClipName", clipName })
          }
          onSave={handleSave}
        />
      </div>

      <PoseTimeline
        frames={draft.frames}
        currentIndex={clampedIndex}
        qualityMarkers={qualityMarkers}
        playing={playing}
        onSetIndex={setCurrentIndex}
        onTogglePlay={() => setPlaying((value) => !value)}
        onTrimStart={handleTrimBefore}
        onDeleteFrame={handleDeleteFrame}
        onTrimEnd={handleTrimAfter}
        onClear={handleClearCapture}
      />

      <div className="sr-only" aria-live="polite">
        {summary.frameCount} frames, {summary.editedFrameCount} edited frames
      </div>
    </div>
  );
}
