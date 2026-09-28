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
  ChevronDown,
  Clock,
  Download,
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
import { PanelHeader } from "@/components/panels/panel-header";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { ACCEPTED_MODEL_FILE_TYPES } from "@/constants/file";
import {
  POSE_MODEL_TIER_LABELS,
  useMediaPipe,
  type PoseModelTier,
} from "@/hooks/next/use-mediapipe";
import { useModelsStore } from "@/store/next/models";
import { useEntitiesStore } from "@/store/next/entities";
import { importFile } from "@/utils/assets";
import { isWeb } from "@/utils/platform";
import { parseModel } from "@/utils/model";
import type { ModelComponent } from "@/types/ecs";
import { PoseSmoother } from "@/utils/animation-smoothing";
import type { PoseBoneData } from "@/utils/mediapipe-to-bones";
import { getHeldPoseBoneKeys } from "@/utils/pose-solve";
import { detectLandmarkDiscontinuities } from "@/utils/pose-metrics";
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
import { ModelPreview } from "@/components/pose-studio/model-preview";
import { SkeletonOverlay } from "@/components/pose-studio/skeleton-overlay";
import { BoneRemapPanel } from "@/components/pose-studio/bone-remap-panel";
import {
  composePoseTool,
  countEditedBones,
  createPoseStudioUiState,
  getEditModeForTool,
  getPoseEditTarget,
  getPoseGizmo,
  poseGizmoApplies,
  getPoseDraftSummary,
  getTransformModeForTool,
  isGlobalPoseStudioTool,
  isPoseStudioGizmoEnabled,
  markLandmarkJumps,
  markerTone,
  poseStudioUiReducer,
  shiftQualityMarkersAfterDelete,
  summarizePoseCaptureQuality,
  trimQualityMarkersAfter,
  trimQualityMarkersBefore,
  type PoseFrameQualityMarker,
  type PoseEditTarget,
  type PoseStudioInspectorTab,
  type PoseStudioTool,
} from "./workspace";

const VIDEO_W = 480;
const VIDEO_H = 360;

type InputMode = "photo" | "video" | "camera";

interface PoseCleanupSettings {
  landmarkSmoothing: boolean;
  poseSmoothing: boolean;
}

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
  heldBones: readonly string[] = [],
): PoseFrameQualityMarker {
  return {
    frameIndex,
    score: quality.score,
    label: quality.label,
    warnings: quality.warnings,
    heldBones: [...heldBones],
  };
}

function getHeldMappedPoseBones(
  landmarks: readonly NormalizedLandmark[] | null,
  remap: BoneRemap,
  availableBones: readonly string[],
) {
  if (!landmarks) return [];
  const available = new Set(availableBones);
  return getHeldPoseBoneKeys(landmarks).filter((key) =>
    available.has(remap[key]),
  );
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

/**
 * A state readout with three tones, not two.
 *
 * Everything that was not yet done used to be amber with a warning icon, so a
 * freshly opened studio looked like a list of problems. Waiting on the user is
 * neutral; only a real failure is amber.
 */
function ToneBadge({
  ok,
  label,
  value,
  pending = false,
}: {
  ok: boolean;
  label: string;
  value: string;
  /** Not done yet, and that is fine. */
  pending?: boolean;
}) {
  const Icon = ok ? CheckCircle2 : pending ? Clock : AlertCircle;
  return (
    <span
      className={cn(
        "inline-flex h-[19px] items-center gap-1 rounded-[5px] border px-1.5 text-[10px]",
        ok
          ? "border-ok/30 bg-ok/10 text-ok"
          : pending
            ? "border-stroke text-muted-foreground"
            : "border-warn/30 bg-warn/10 text-warn",
      )}
    >
      <Icon size={10} />
      <span className="font-semibold">{label}</span>
      <span className="font-mono tabular-nums">{value}</span>
    </span>
  );
}

/**
 * Pose quality, once there is a pose to judge.
 *
 * Before anything is detected there is no score — showing "Poor 0%" on an empty
 * studio reads as a verdict on work nobody has done yet.
 */
function QualityBadge({
  quality,
  detected,
}: {
  quality: PoseQualityResult;
  detected: boolean;
}) {
  const tone = !detected
    ? "border-stroke text-muted-foreground"
    : quality.label === "Good"
      ? "border-ok/30 bg-ok/10 text-ok"
      : quality.label === "Usable"
        ? "border-sky-500/30 bg-sky-500/10 text-sky-600 dark:text-sky-400"
        : "border-warn/30 bg-warn/10 text-warn";
  return (
    <span
      className={cn(
        "inline-flex h-[19px] items-center gap-1 rounded-[5px] border px-1.5 text-[10px]",
        tone,
      )}
      title={
        detected
          ? quality.warnings.join("\n") || "Pose quality is stable"
          : "No pose captured yet"
      }
    >
      <Gauge size={10} />
      {detected
        ? `${quality.label} ${Math.round(quality.score * 100)}%`
        : "No pose yet"}
    </span>
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
        "flex min-h-[46px] items-center gap-2.5 rounded-[5px] border px-2.5 text-left transition-colors",
        active
          ? "border-brand-line bg-brand-soft text-foreground"
          : "border-stroke text-muted-foreground hover:border-stroke-strong hover:bg-row-hover hover:text-foreground",
      )}
    >
      <Icon className="size-4 shrink-0" />
      <span className="min-w-0">
        <span className="block text-[11px] font-semibold">{label}</span>
        <span className="block truncate text-[10px] text-faint-foreground">
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
  title,
  onClick,
}: {
  active: boolean;
  icon: LucideIcon;
  label: string;
  /** What the tool does, when the label alone does not say it. */
  title?: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      title={title ?? label}
      className={cn(
        "flex h-[22px] items-center gap-1.5 rounded-md px-2 text-[11px] transition-colors",
        active
          ? "bg-brand-soft font-semibold text-foreground"
          : "text-muted-foreground hover:bg-row-hover hover:text-foreground",
      )}
    >
      <Icon size={12} />
      <span className="max-xl:hidden">{label}</span>
    </button>
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
    <label className="grid grid-cols-[1.25rem_1fr_3.25rem] items-center gap-2 text-[11px]">
      <span className="text-right font-mono text-[10px] uppercase text-faint-foreground">
        {label}
      </span>
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
  /** What to do next, when the panel is waiting on the user rather than broken. */
  prompt?: string | null;
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
  prompt,
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
      <PanelHeader
        icon={Camera}
        title="Capture"
        hint={inputMode}
        className="border-b"
      />
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

        <div className="overflow-hidden rounded-[10px] border border-stroke bg-black">
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
              <div className="flex h-full flex-col items-center justify-center gap-1 px-4 text-center">
                <span className="text-[11px] text-muted-foreground">
                  {prompt ?? "No photo selected"}
                </span>
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
                <span className="flex h-[19px] items-center gap-1 rounded-[5px] bg-black/70 px-1.5 text-[10px] font-semibold uppercase tracking-wider text-white">
                  <Loader2 size={10} className="animate-spin" />
                  Loading
                </span>
              )}
              {isReady && inputMode === "camera" && (
                <span className="flex h-[19px] items-center rounded-[5px] bg-black/70 px-1.5 font-mono text-[10px] text-white tabular-nums">
                  {fps} fps
                </span>
              )}
              {recording && (
                <span className="flex h-[19px] items-center gap-1.5 rounded-[5px] bg-destructive px-1.5 text-[10px] font-semibold uppercase tracking-wider text-white">
                  <span className="size-1.5 animate-pulse rounded-full bg-white" />
                  Rec {elapsed.toFixed(1)}s
                </span>
              )}
            </div>

            {error && (
              <div className="absolute inset-0 flex items-center justify-center bg-black/75 p-4 text-center text-[11px] leading-snug text-destructive-foreground">
                {error}
              </div>
            )}
          </div>
        </div>

        {inputMode === "photo" && (
          <div className="grid grid-cols-[1fr_auto] gap-2">
            <Button size="sm" variant="outline" onClick={onPhotoSelect}>
              {photoUrl ? "Change photo" : "Upload photo"}
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={onClearPhoto}
              disabled={!photoUrl}
            >
              Clear
            </Button>
          </div>
        )}

        {inputMode === "video" && (
          <div className="grid grid-cols-[1fr_auto] gap-2">
            <Button size="sm" variant="outline" onClick={onVideoSelect}>
              {videoUrl ? "Change video" : "Upload video"}
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={onClearVideo}
              disabled={!videoUrl}
            >
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
            {detectingBestPhoto ? "Finding best frame" : "Capture pose"}
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
  const target = getPoseEditTarget(tool);
  const gizmo = getPoseGizmo(tool);
  const showGizmo = poseGizmoApplies(target);

  const targets: {
    key: PoseEditTarget;
    icon: typeof Eye;
    label: string;
    hint: string;
  }[] = [
    { key: "select", icon: Eye, label: "Select", hint: "Click a bone to inspect it" },
    { key: "bone", icon: Bone, label: "Bone", hint: "Move the selected bone only" },
    { key: "ik", icon: Crosshair, label: "Reach", hint: "Drag a hand or foot; the limb follows" },
    { key: "pose", icon: Move3D, label: "Whole pose", hint: "Move or turn the whole figure" },
  ];

  return (
    <div className="absolute left-3 top-3 z-10 flex items-center gap-2 rounded-lg border border-stroke bg-background/90 p-1 backdrop-blur">
      {/* What you are moving… */}
      <div className="flex items-center gap-0.5">
        {targets.map((item) => (
          <ToolButton
            key={item.key}
            active={target === item.key}
            icon={item.icon}
            label={item.label}
            title={item.hint}
            onClick={() => onSetTool(composePoseTool(item.key, gizmo))}
          />
        ))}
      </div>

      {/* …and what the gizmo does to it. Two questions, asked separately,
          instead of one list of six answers named after rigging technique. */}
      {showGizmo && (
        <div className="flex items-center gap-0.5 border-s border-stroke ps-2">
          <ToolButton
            active={gizmo === "rotate"}
            icon={Rotate3D}
            label="Rotate"
            title="Rotate with the gizmo"
            onClick={() => onSetTool(composePoseTool(target, "rotate"))}
          />
          <ToolButton
            active={gizmo === "move"}
            icon={Move3D}
            label="Move"
            title="Move with the gizmo"
            onClick={() => onSetTool(composePoseTool(target, "move"))}
          />
        </div>
      )}
    </div>
  );
}

interface PoseViewportPanelProps {
  modelUuid: string;
  hasFrames: boolean;
  landmarksRef: React.RefObject<NormalizedLandmark[] | null>;
  visibilityLandmarksRef: React.RefObject<NormalizedLandmark[] | null>;
  poseDataRef: React.RefObject<PoseBoneData | null>;
  staticPoseRef: React.RefObject<PoseBoneData | null>;
  remap: BoneRemap;
  rootMotion: boolean;
  landmarkSmoothing: boolean;
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
  visibilityLandmarksRef,
  poseDataRef,
  staticPoseRef,
  remap,
  rootMotion,
  landmarkSmoothing,
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
      <div className="absolute right-3 top-3 z-10 flex h-[19px] items-center rounded-[5px] border border-stroke bg-background/90 px-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground backdrop-blur">
        {hasFrames
          ? beforePose
            ? "Before"
            : "Current"
          : "Live preview"}
      </div>
      <ModelPreview
        modelUuid={modelUuid}
        landmarksRef={landmarksRef}
        visibilityLandmarksRef={visibilityLandmarksRef}
        poseDataRef={hasFrames ? undefined : poseDataRef}
        staticPoseRef={hasFrames ? staticPoseRef : undefined}
        remap={remap}
        rootMotion={rootMotion}
        landmarkSmoothing={landmarkSmoothing}
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
          size="icon-xs"
          variant="outline"
          onClick={onTogglePlay}
          disabled={frames.length <= 1}
          title={playing ? "Stop" : "Play"}
        >
          {playing ? <Square size={12} /> : <Play size={12} />}
        </Button>
        <span className="w-28 font-mono text-[10px] text-muted-foreground tabular-nums">
          {frames.length === 0
            ? "No frames"
            : `${currentIndex + 1} / ${frames.length}`}
        </span>
        <input
          type="range"
          className="min-w-0 flex-1 accent-brand"
          min={0}
          max={Math.max(0, frames.length - 1)}
          step={1}
          value={Math.min(currentIndex, Math.max(0, frames.length - 1))}
          disabled={frames.length === 0}
          onChange={(event) => onSetIndex(Number(event.target.value))}
        />
        <span className="w-14 text-right font-mono text-[10px] text-faint-foreground tabular-nums">
          {duration.toFixed(2)}s
        </span>
        <span className="mx-1 h-4 w-px bg-stroke" />
        {/* Trims say what they remove; the delete is quiet until you hover it.
            A filled red button reads as the thing to press, and this one throws
            away the frame you are looking at. */}
        <Button
          size="xs"
          variant="outline"
          onClick={onTrimStart}
          disabled={frames.length === 0 || currentIndex === 0}
          title="Remove every frame before this one"
        >
          <Scissors size={12} />
          Trim start
        </Button>
        <Button
          size="xs"
          variant="outline"
          onClick={onTrimEnd}
          disabled={frames.length === 0 || currentIndex === frames.length - 1}
          title="Remove every frame after this one"
        >
          <Scissors size={12} />
          Trim end
        </Button>
        <Button
          size="xs"
          variant="ghost"
          onClick={onDeleteFrame}
          disabled={frames.length === 0}
          title="Delete this frame"
          className="text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
        >
          <Trash2 size={12} />
          Delete frame
        </Button>
        <Button
          size="xs"
          variant="ghost"
          onClick={onClear}
          disabled={frames.length === 0}
          title="Delete every captured frame"
          className="text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
        >
          Clear all
        </Button>
      </div>
      <div className="flex gap-1 overflow-x-auto border-t px-3 py-2">
        {frames.length === 0 ? (
          <span className="text-[10px] text-faint-foreground">
            Captured frames will appear here.
          </span>
        ) : (
          frames.map((frame, index) => {
            const marker = markerByFrame.get(index);
            const tone = markerTone(marker?.label);
            const diagnostics = marker
              ? [
                  `${marker.label} ${Math.round(marker.score * 100)}%`,
                  marker.heldBones.length > 0
                    ? `${marker.heldBones.length} held bone${marker.heldBones.length === 1 ? "" : "s"}`
                    : null,
                  marker.landmarkJump ? "Landmark jump begins here" : null,
                ]
                  .filter(Boolean)
                  .join(" · ")
              : "No quality marker";
            return (
              <button
                key={`${frame.time}-${index}`}
                type="button"
                onClick={() => onSetIndex(index)}
                title={diagnostics}
                className={cn(
                  "flex h-9 min-w-12 flex-col items-center justify-center rounded border px-2 text-[10px] tabular-nums",
                  currentIndex === index
                    ? "border-primary bg-primary/10 text-primary"
                    : "border-border hover:bg-muted",
                  tone === "good" && currentIndex !== index && "border-ok/40",
                  tone === "usable" &&
                    currentIndex !== index &&
                    "border-sky-500/30",
                  tone === "poor" && currentIndex !== index && "border-warn/40",
                  marker?.landmarkJump && "ring-1 ring-warn",
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
  forceInPlace,
  onForceInPlaceChange,
}: PoseSavePanelProps) {
  const summary = getPoseDraftSummary(draft);
  const captureQuality = summarizePoseCaptureQuality(
    qualityMarkers,
    frames.length,
  );
  const bestMarker = qualityMarkers.reduce<PoseFrameQualityMarker | null>(
    (best, marker) => (!best || marker.score > best.score ? marker : best),
    null,
  );
  return (
    <div className="flex flex-col gap-3 p-3">
      {/* Named in the header, beside the button that saves it — repeating the
          field here made two places to edit one value. */}
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-[9px] uppercase tracking-wider text-faint-foreground">
          Saving as
        </span>
        <span className="min-w-0 truncate font-mono text-[11px] text-foreground">
          {clipName}
        </span>
      </div>
      {/* What is about to be written, in the ladder's own terms: 10px label,
          11px mono value. The Save button is in the header, next to the name —
          having it here as well made two buttons for one action. */}
      <div className="grid grid-cols-2 gap-1.5">
        {[
          { label: "Frames", value: String(summary.frameCount) },
          { label: "Duration", value: `${getPoseClipDuration(frames).toFixed(2)}s` },
          { label: "Edited", value: String(summary.editedFrameCount) },
          {
            label: "Mapped",
            value: `${mappingAnalysis.mapped}/${mappingAnalysis.total}`,
          },
          {
            label: "Clip quality",
            value: qualityMarkers.length
              ? `${captureQuality.label} ${Math.round(captureQuality.averageScore * 100)}%`
              : "—",
          },
          {
            label: "Held frames",
            value: qualityMarkers.length
              ? `${captureQuality.heldFrameCount}/${frames.length}`
              : "—",
          },
        ].map((stat) => (
          <div
            key={stat.label}
            className="grid gap-0.5 rounded-[5px] border border-stroke bg-surface-sunken px-2 py-1.5"
          >
            <span className="text-[9px] uppercase tracking-wider text-faint-foreground">
              {stat.label}
            </span>
            <span className="font-mono text-[12px] text-foreground tabular-nums">
              {stat.value}
            </span>
          </div>
        ))}
      </div>
      {bestMarker && (
        <div className="flex items-baseline justify-between gap-2 rounded-[5px] border border-stroke px-2 py-1.5">
          <span className="text-[9px] uppercase tracking-wider text-faint-foreground">
            Best pose
          </span>
          <span className="font-mono text-[11px] text-foreground tabular-nums">
            {bestMarker.label} {Math.round(bestMarker.score * 100)}%
          </span>
        </div>
      )}
      {captureQuality.landmarkJumpCount > 0 && (
        <div className="flex gap-1.5 rounded-[5px] border border-warn/30 bg-warn/10 px-2 py-1.5">
          <AlertCircle size={12} className="mt-px shrink-0 text-warn" />
          <span className="text-[10px] leading-snug text-warn">
            This clip has {captureQuality.landmarkJumpCount} landmark jump
            {captureQuality.landmarkJumpCount === 1 ? "" : "s"}. Check the
            marked timeline frames for a cut or detector re-acquisition.
          </span>
        </div>
      )}
      {mappingAnalysis.issues.length > 0 && (
        <div className="flex gap-1.5 rounded-[5px] border border-warn/30 bg-warn/10 px-2 py-1.5">
          <AlertCircle size={12} className="mt-px shrink-0 text-warn" />
          <span className="text-[10px] leading-snug text-warn">
            {mappingAnalysis.issues[0]}
          </span>
        </div>
      )}
      <label className="flex items-center justify-between gap-3 rounded-[5px] border border-stroke px-2 py-1.5">
        <span className="text-[11px] text-foreground">
          Force imported animations in place
        </span>
        <Switch
          checked={forceInPlace}
          onCheckedChange={onForceInPlaceChange}
          disabled={saving}
        />
      </label>
    </div>
  );
}

interface PoseInspectorProps {
  tab: string;
  setTab: (tab: PoseStudioInspectorTab) => void;
  modelUuid: string;
  remap: BoneRemap;
  setRemap: (remap: BoneRemap) => void;
  availableBones: string[];
  boneLoadError: string | null;
  mappingAnalysis: BoneMappingAnalysis;
  poseQuality: PoseQualityResult;
  poseDetected: boolean;
  modelTier: PoseModelTier;
  detectorLoading: boolean;
  onModelTierChange: (tier: PoseModelTier) => void;
  rootMotion: boolean;
  setRootMotion: (value: boolean) => void;
  cleanup: PoseCleanupSettings;
  setCleanup: (settings: PoseCleanupSettings) => void;
  recording: boolean;
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
  modelTier,
  detectorLoading,
  onModelTierChange,
  rootMotion,
  setRootMotion,
  cleanup,
  setCleanup,
  recording,
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
  forceInPlace,
  onForceInPlaceChange,
}: PoseInspectorProps) {
  const captureQuality = summarizePoseCaptureQuality(
    qualityMarkers,
    draft.frames.length,
  );
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
      <PanelHeader
        icon={Settings2}
        title="Inspector"
        hint={tab}
        className="border-b"
      />
      <div className="grid grid-cols-4 gap-1 border-b p-2">
        {(["assist", "mapping", "edit", "review"] as const).map((item) => (
          <Button
            key={item}
            type="button"
            size="xs"
            variant={tab === item ? "secondary" : "ghost"}
            className="h-[22px] px-1 text-[11px] capitalize"
            onClick={() => setTab(item)}
          >
            {item}
          </Button>
        ))}
      </div>
      <div className="min-h-0 flex-1 overflow-auto">
        {tab === "assist" && (
          <div className="flex flex-col gap-3 p-3">
            <QualityBadge quality={poseQuality} detected={poseDetected} />
            {/* Warnings describe a pose that exists. With nothing detected the
                panel says what to do instead of what is wrong. */}
            {poseDetected ? (
              poseQuality.warnings.length > 0 && (
                <div className="rounded-[5px] border border-warn/30 bg-warn/10 px-2 py-1.5 text-[10px] leading-snug text-warn">
                  {poseQuality.warnings[0]}
                </div>
              )
            ) : (
              <p className="text-[10px] leading-snug text-muted-foreground">
                Pick a source on the left, then capture a pose. Quality and
                mapping checks appear here once one is detected.
              </p>
            )}
            {/*
              Detector accuracy, next to the score it moves.

              A still photo is detected once on a click, so the accurate model
              costs a second of work and gives visibly better landmarks on
              foreshortened limbs and side-on poses; live input has to keep up
              with the camera, so it defaults lower.
            */}
            <label className="grid gap-1">
              <span className="text-[9px] uppercase tracking-wider text-faint-foreground">
                Detector
              </span>
              <select
                value={modelTier}
                disabled={detectorLoading}
                data-testid="pose-model-tier"
                onChange={(event) =>
                  onModelTierChange(event.target.value as PoseModelTier)
                }
                className="h-6 rounded-md border border-stroke bg-surface-sunken px-1.5 text-[11px] text-foreground transition-colors hover:border-stroke-strong focus:border-brand-line focus:outline-none disabled:opacity-40"
              >
                {(
                  Object.keys(POSE_MODEL_TIER_LABELS) as PoseModelTier[]
                ).map((tier) => (
                  <option key={tier} value={tier}>
                    {POSE_MODEL_TIER_LABELS[tier]}
                    {tier === "accurate" ? " · best for photos" : ""}
                  </option>
                ))}
              </select>
              {detectorLoading && (
                <span className="text-[10px] text-faint-foreground">
                  Loading detector…
                </span>
              )}
            </label>

            <div className="grid grid-cols-2 gap-1.5">
              <Button
                size="sm"
                variant="outline"
                onClick={onCalibrate}
                disabled={!poseDetected}
                title="Use this pose as the rest pose corrections are measured from"
              >
                <Crosshair size={12} />
                Calibrate
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={onUseBestFrame}
                disabled={!bestQuality}
                title="Jump to the highest-scoring captured frame"
              >
                <Sparkles size={12} />
                Best frame
              </Button>
            </div>
            <div className="grid gap-1 rounded-[5px] border border-stroke px-2 py-1.5">
              {[
                {
                  label: "Best pose",
                  value: bestQuality
                    ? `${bestQuality.label} ${Math.round(bestQuality.score * 100)}%`
                    : "None",
                },
                { label: "Skipped", value: String(rejectedFrameCount) },
                {
                  label: "Clip quality",
                  value: qualityMarkers.length
                    ? `${captureQuality.label} ${Math.round(captureQuality.averageScore * 100)}%`
                    : "None",
                },
                {
                  label: "Held frames",
                  value: qualityMarkers.length
                    ? `${captureQuality.heldFrameCount}/${draft.frames.length}`
                    : "—",
                },
                {
                  label: "Held bones",
                  value: qualityMarkers.length
                    ? String(captureQuality.heldBoneCount)
                    : "—",
                },
                {
                  label: "Calibration",
                  value: calibrated ? "Ready" : "Not set",
                },
              ].map((row) => (
                <div
                  key={row.label}
                  className="flex items-baseline justify-between gap-2"
                >
                  <span className="text-[9px] uppercase tracking-wider text-faint-foreground">
                    {row.label}
                  </span>
                  <span className="font-mono text-[11px] text-foreground tabular-nums">
                    {row.value}
                  </span>
                </div>
              ))}
            </div>
            {captureQuality.landmarkJumpCount > 0 && (
              <div className="flex gap-1.5 rounded-[5px] border border-warn/30 bg-warn/10 px-2 py-1.5 text-[10px] leading-snug text-warn">
                <AlertCircle size={12} className="mt-px shrink-0" />
                <span>
                  This clip has {captureQuality.landmarkJumpCount} landmark jump
                  {captureQuality.landmarkJumpCount === 1 ? "" : "s"}. A cut or
                  detector re-acquisition may have snapped the pose.
                </span>
              </div>
            )}
            <section className="rounded-[10px] border border-stroke">
              <div className="border-b border-stroke px-2 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                Capture cleanup
              </div>
              <div className="grid gap-2 p-2">
                <label className="flex items-center justify-between gap-3 text-[11px] text-foreground">
                  <span className="min-w-0">
                    <span className="block">Landmark smoothing</span>
                    <span className="block text-[10px] leading-snug text-faint-foreground">
                      Stabilize detected joints before solving the rig.
                    </span>
                  </span>
                  <Switch
                    checked={cleanup.landmarkSmoothing}
                    onCheckedChange={(checked) =>
                      setCleanup({
                        ...cleanup,
                        landmarkSmoothing: Boolean(checked),
                      })
                    }
                    disabled={recording}
                    className="shrink-0"
                  />
                </label>
                <label className="flex items-center justify-between gap-3 border-t border-stroke pt-2 text-[11px] text-foreground">
                  <span className="min-w-0">
                    <span className="block">Pose smoothing</span>
                    <span className="block text-[10px] leading-snug text-faint-foreground">
                      Apply a light second pass to recorded bone tracks.
                    </span>
                  </span>
                  <Switch
                    checked={cleanup.poseSmoothing}
                    onCheckedChange={(checked) =>
                      setCleanup({
                        ...cleanup,
                        poseSmoothing: Boolean(checked),
                      })
                    }
                    disabled={recording}
                    className="shrink-0"
                  />
                </label>
              </div>
            </section>
            <label className="flex items-center justify-between gap-3 rounded-[5px] border border-stroke px-2 py-1.5 text-[11px] text-foreground">
              Root motion
              <Switch
                checked={rootMotion}
                onCheckedChange={(checked) => setRootMotion(Boolean(checked))}
              />
            </label>
            <label className="flex items-center justify-between gap-3 rounded-[5px] border border-stroke px-2 py-1.5 text-[11px] text-foreground">
              Source skeleton
              <Switch
                checked={sourceSkeleton}
                onCheckedChange={onToggleSourceSkeleton}
              />
            </label>
            <label className="flex items-center justify-between gap-3 rounded-[5px] border border-stroke px-2 py-1.5 text-[11px] text-foreground">
              Model skeleton
              <Switch
                checked={modelSkeleton}
                onCheckedChange={onToggleModelSkeleton}
              />
            </label>
            <label className="flex items-center justify-between gap-3 rounded-[5px] border border-stroke px-2 py-1.5 text-[11px] text-foreground">
              Before pose
              <Switch checked={beforePose} onCheckedChange={onToggleBeforePose} />
            </label>
            {mappingAnalysis.issues.length > 0 && (
              <div className="rounded-[5px] border border-warn/30 bg-warn/10 px-2 py-1.5 text-[10px] leading-snug text-warn">
                {mappingAnalysis.issues.slice(0, 3).join(" · ")}
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
              <p className="mt-2 text-[10px] leading-snug text-destructive">
                {boneLoadError}
              </p>
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
              <section className="rounded-[10px] border border-stroke">
                <div className="border-b border-stroke px-2 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
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
              <section className="rounded-[10px] border border-stroke">
                <div className="border-b border-stroke px-2 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                  IK Targets
                </div>
                <div className="flex flex-col gap-2 p-3">
                  <div className="grid grid-cols-3 gap-1">
                    {IK_TARGET_ORDER.filter((target) =>
                      ikStatus.available.includes(target),
                    ).map((target) => (
                      <Button
                        key={target}
                        size="xs"
                        variant={
                          selectedEffector === target ? "secondary" : "outline"
                        }
                        className="h-[22px] px-1 text-[11px]"
                        onClick={() => onSelectIkTarget(target)}
                      >
                        {IK_TARGET_LABELS[target]}
                      </Button>
                    ))}
                  </div>
                  <div className="grid gap-0.5 rounded-[5px] border border-stroke px-2 py-1.5">
                    <span className="font-mono text-[11px] text-foreground tabular-nums">
                      {ikStatus.available.length} chains ready
                    </span>
                    {missingIkLabels.length > 0 && (
                      <span className="text-[10px] leading-snug text-warn">
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
                    <p className="text-[10px] text-muted-foreground">
                      {ikDebugCopyStatus}
                    </p>
                  )}
                </div>
              </section>
            ) : (
              <>
                <section className="rounded-[10px] border border-stroke">
                  <div className="border-b border-stroke px-2 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                    Bones
                  </div>
                  <div className="max-h-52 overflow-y-auto p-2">
                    {POSE_BONE_GROUPS.map((group) => (
                      <div key={group.label} className="mb-2 last:mb-0">
                        <p className="px-1 pb-1 text-[9px] font-semibold uppercase tracking-wider text-faint-foreground">
                          {group.label}
                        </p>
                        <div className="grid grid-cols-2 gap-1">
                          {group.keys
                            .filter((key) => mappedBoneKeys.has(key))
                            .map((key) => (
                              <Button
                                key={key}
                                size="xs"
                                variant={
                                  selectedBoneKey === key
                                    ? "secondary"
                                    : "ghost"
                                }
                                className="h-[22px] justify-start gap-1 px-1.5 text-[11px]"
                                onClick={() => onSelectBone(key)}
                              >
                                <span className="truncate">
                                  {POSE_BONE_LABELS[key] ?? key}
                                </span>
                                {frameOverrides[key] && (
                                  <span
                                    title="Edited on this frame"
                                    className="ml-auto size-1 shrink-0 rounded-full bg-brand"
                                  />
                                )}
                              </Button>
                            ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </section>

                <section className="rounded-[10px] border border-stroke">
                  <div className="border-b border-stroke px-2 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
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

            <section className="rounded-[10px] border border-stroke">
              <div className="border-b border-stroke px-2 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
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

            <div className="flex items-baseline justify-between gap-2 rounded-[5px] border border-stroke px-2 py-1.5">
              <span className="text-[9px] uppercase tracking-wider text-faint-foreground">
                Edited on frame {draft.frames.length ? currentIndex + 1 : 0}
              </span>
              <span className="font-mono text-[11px] text-foreground tabular-nums">
                {countEditedBones(draft, currentIndex)}
              </span>
            </div>
          </div>
        )}

        {tab === "review" && (
          <PoseSavePanel
            clipName={clipName}
            frames={draft.frames}
            draft={draft}
            mappingAnalysis={mappingAnalysis}
            qualityMarkers={qualityMarkers}
            saving={saving}
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
  const recordingLandmarksRef = useRef<NormalizedLandmark[][]>([]);
  const bestFrameRef = useRef<{
    frame: PoseFrame;
    quality: PoseQualityResult;
    heldBones: string[];
  } | null>(null);
  const calibrationRef = useRef<PoseCalibration | null>(null);
  const autoDetectedRef = useRef(false);
  const worldLandmarksRef = useRef<NormalizedLandmark[] | null>(null);
  const screenLandmarksRef = useRef<NormalizedLandmark[] | null>(null);
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
  const [cleanup, setCleanup] = useState<PoseCleanupSettings>({
    landmarkSmoothing: true,
    poseSmoothing: true,
  });
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
    isLoading: detectorLoading,
    error: mpError,
    modelTier,
    setModelTier,
    detectImageCandidates,
    applyDetectedCandidate,
  } = useMediaPipe(
    inputMode === "camera" || inputMode === "video" ? videoRef : undefined,
    inputMode === "photo" ? imageRef : undefined,
    { smoothLiveLandmarks: cleanup.landmarkSmoothing },
  );

  useEffect(() => {
    worldLandmarksRef.current = worldLandmarks;
  }, [worldLandmarks]);

  useEffect(() => {
    screenLandmarksRef.current = screenLandmarks;
  }, [screenLandmarks]);

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

    if (!cleanup.poseSmoothing) {
      return { time, data: clonePoseData(pose) };
    }

    // Fix the timestep once for the whole pose. Every track below must be
    // filtered against the SAME interval; deriving it per call made all but
    // the first track see a near-zero dt and stall. `time` is the frame's own
    // timestamp, so smoothing no longer depends on machine speed.
    smootherRef.current.beginFrame(time);

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
  }, [cleanup.poseSmoothing]);

  const rememberBestFrame = useCallback(
    (
      frame: PoseFrame,
      quality: PoseQualityResult,
      heldBones: readonly string[] = [],
    ) => {
      if (quality.label === "Poor") return;
      const currentBest = bestFrameRef.current;
      if (!currentBest || quality.score > currentBest.quality.score) {
        bestFrameRef.current = {
          frame: {
            time: 0,
            data: clonePoseData(frame.data),
          },
          quality,
          heldBones: [...heldBones],
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
    const heldBones = getHeldMappedPoseBones(
      screenLandmarks ?? worldLandmarks,
      boneRemap,
      availableBones,
    );
    recordingFramesRef.current.push(frame);
    recordingMarkersRef.current.push(
      makeQualityMarker(frameIndex, poseQuality, heldBones),
    );
    recordingLandmarksRef.current.push(
      worldLandmarks.map((landmark) => ({ ...landmark })),
    );
    rememberBestFrame(frame, poseQuality, heldBones);
    setRecordingFrameCount(recordingFramesRef.current.length);
    setElapsed(time);
  }, [
    availableBones,
    boneRemap,
    buildSmoothedFrame,
    inputMode,
    poseQuality,
    recording,
    rememberBestFrame,
    screenLandmarks,
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
    recordingLandmarksRef.current = [];
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
    const { events } = detectLandmarkDiscontinuities(
      recordingLandmarksRef.current,
    );
    replaceCapturedFrames(
      [...recordingFramesRef.current],
      markLandmarkJumps(recordingMarkersRef.current, events),
      "Record motion",
    );
  }, [replaceCapturedFrames]);

  const handleClearCapture = useCallback(() => {
    recordingFramesRef.current = [];
    recordingMarkersRef.current = [];
    recordingLandmarksRef.current = [];
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
        if (best.candidate.screenLandmarks) {
          screenLandmarksRef.current = best.candidate.screenLandmarks;
        }
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
      const heldBones = getHeldMappedPoseBones(
        screenLandmarksRef.current ?? worldLandmarksRef.current,
        boneRemap,
        availableBones,
      );

      rememberBestFrame(frame, selectedQuality, heldBones);
      replaceCapturedFrames(
        [frame],
        [makeQualityMarker(0, selectedQuality, heldBones)],
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
      [makeQualityMarker(0, best.quality, best.heldBones)],
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

  /*
    Not having chosen a photo yet is not an error.

    This used to fold "upload something" into the same value as a camera
    permission failure and a detector crash, so opening the studio painted a red
    message across the source panel and disabled the controls before anyone had
    done anything wrong. The prompt is what to do next; the error is what went
    wrong. They are shown differently because they are different.
  */
  const inputPrompt =
    inputMode === "photo" && !photoUrl
      ? "Upload a photo to capture a pose."
      : inputMode === "video" && !videoUrl
        ? "Upload a video to record frames."
        : null;
  const error = inputMode === "camera" ? (camError ?? mpError) : mpError;
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
      {/*
        Three zones: what this is, how it is doing, what you can do to it.

        Everything used to sit in one row of twelve controls — a clip name, six
        status chips, a switch, a model picker, two import buttons, undo, redo
        and Save — so nothing led and the bar wrapped onto two lines. The
        imports are one menu now, the chips report only what is not already
        obvious, and Save is the single filled button on the screen.
      */}
      <header className="flex min-h-12 shrink-0 items-center gap-3 border-b border-stroke px-4">
        <div className="flex min-w-0 items-center gap-2">
          <span className="text-[13px] font-semibold">Pose Studio</span>
          <span className="min-w-0 truncate font-mono text-[10px] text-faint-foreground">
            {modelName}
          </span>
        </div>

        <Input
          aria-label="Clip name"
          className="h-6 w-48 border-stroke bg-surface-sunken px-2 text-[11px]"
          value={ui.clipName}
          onChange={(event) =>
            dispatchUi({ type: "setClipName", clipName: event.target.value })
          }
        />

        {/* State worth reporting: the score, what it maps onto, and how much
            has been captured. "Model ready" only says something while it is
            not, and "Pose waiting" said what the score already says. */}
        <div className="hidden min-w-0 items-center gap-1.5 lg:flex">
          {!modelReady && (
            <ToneBadge ok={false} pending label="Model" value="loading" />
          )}
          <QualityBadge quality={poseQuality} detected={poseDetected} />
          <ToneBadge
            ok={mappedBoneCount > 0}
            pending={mappedBoneCount === 0}
            label="Mapping"
            value={`${mappedBoneCount}/${expectedBoneCount}`}
          />
          <span className="inline-flex h-7 items-center rounded-md border border-stroke px-2 font-mono text-[11px] text-muted-foreground tabular-nums">
            {displayFrameCount} frame{displayFrameCount === 1 ? "" : "s"}
          </span>
          <span
            title="Pose detection runs on this device — nothing is uploaded"
            className="inline-flex h-7 items-center rounded-md border border-stroke px-2 text-muted-foreground"
          >
            <ShieldCheck size={12} />
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

          {/* Four import controls behind one word. */}
          <Popover>
            <PopoverTrigger asChild>
              <Button size="sm" variant="outline" disabled={!modelReady}>
                <Download size={14} />
                Import
                <ChevronDown size={12} />
              </Button>
            </PopoverTrigger>
            <PopoverContent align="end" className="z-9999 w-72">
              <div className="grid gap-3">
                <div className="grid gap-1.5">
                  <span className="text-[9px] uppercase tracking-wider text-faint-foreground">
                    From a loaded model
                  </span>
                  <Select
                    value={importSourceUuid ?? ""}
                    onValueChange={(value) => setImportSourceUuid(value)}
                    disabled={candidateSourceModels.length === 0 || !modelReady}
                  >
                    <SelectTrigger
                      className="h-7 text-[11px]"
                      disabled={
                        candidateSourceModels.length === 0 || !modelReady
                      }
                    >
                      <SelectValue
                        placeholder={
                          candidateSourceModels.length === 0
                            ? "No other models loaded"
                            : "Choose a model"
                        }
                      />
                    </SelectTrigger>
                    <SelectContent className="z-9999">
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
                    className="h-7 text-[11px]"
                    onClick={handleImportFromLoadedModel}
                    disabled={
                      candidateSourceModels.length === 0 ||
                      !modelReady ||
                      !importSourceUuid
                    }
                  >
                    Import its animation
                  </Button>
                </div>

                <div className="grid gap-1.5 border-t border-stroke pt-3">
                  <span className="text-[9px] uppercase tracking-wider text-faint-foreground">
                    From a file
                  </span>
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-7 text-[11px]"
                    onClick={handleImportFromFile}
                    disabled={!modelReady}
                  >
                    Choose a model or animation file
                  </Button>
                </div>

                <label className="flex items-center justify-between gap-3 border-t border-stroke pt-3">
                  <span className="min-w-0">
                    <span className="block text-[11px] text-foreground">
                      Force in place
                    </span>
                    <span className="mt-0.5 block text-[10px] leading-snug text-faint-foreground">
                      Strip root motion from the imported clip.
                    </span>
                  </span>
                  <Switch
                    id="import-force-in-place"
                    checked={importForceInPlace}
                    onCheckedChange={setImportForceInPlace}
                    disabled={!modelReady}
                    className="shrink-0"
                  />
                </label>
              </div>
            </PopoverContent>
          </Popover>

          <span className="mx-1 h-5 w-px bg-stroke" />

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
            title={
              draft.frames.length === 0
                ? "Capture a pose before saving"
                : `Save "${ui.clipName}"`
            }
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
          prompt={inputPrompt}
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
          visibilityLandmarksRef={screenLandmarksRef}
          poseDataRef={poseDataRef}
          staticPoseRef={staticPoseRef}
          remap={boneRemap}
          rootMotion={rootMotion}
          landmarkSmoothing={cleanup.landmarkSmoothing}
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
          modelTier={modelTier}
          detectorLoading={detectorLoading}
          onModelTierChange={setModelTier}
          rootMotion={rootMotion}
          setRootMotion={setRootMotion}
          cleanup={cleanup}
          setCleanup={setCleanup}
          recording={recording}
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
