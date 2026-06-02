import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { importFile } from "@/utils/assets";
import { useMediaPipe } from "@/hooks/next/use-mediapipe";
import type { PoseBoneData } from "@/utils/mediapipe-to-bones";
import { PoseSmoother } from "@/utils/animation-smoothing";
import type { PoseFrame } from "@/utils/pose-to-animation";
import {
  BODY_PART_LABELS,
  MIXAMO_DEFAULT_REMAP,
  autoDetectRemap,
  type BoneRemap,
} from "@/utils/bone-remap";
import { SkeletonOverlay } from "./skeleton-overlay";
import { ModelPreview } from "./model-preview";
import { BoneRemapPanel } from "./bone-remap-panel";
import {
  AlertCircle,
  Camera,
  CheckCircle2,
  Crosshair,
  Gauge,
  Image,
  Loader2,
  Settings2,
  ShieldCheck,
  Sparkles,
  Video,
  type LucideIcon,
} from "lucide-react";
import { toast } from "sonner";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { isWeb } from "@/utils/platform";
import { cn } from "@/lib/utils";
import { useModelsStore } from "@/store/next/models";
import { parseModel } from "@/utils/model";
import type { ModelComponent } from "@/types/ecs";
import {
  analyzeBoneMapping,
  scorePoseLandmarks,
  selectBestPoseCandidate,
  type PoseCalibration,
  type PoseQualityResult,
} from "@/utils/pose-retargeting";

const VIDEO_W = 480;
const VIDEO_H = 360;

type InputMode = "camera" | "photo" | "video";

type InputModeOptionProps = {
  active: boolean;
  title: string;
  detail: string;
  icon: LucideIcon;
  onClick: () => void;
};

function InputModeOption({
  active,
  title,
  detail,
  icon: Icon,
  onClick,
}: InputModeOptionProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex min-w-40 flex-1 items-center gap-3 rounded-md border px-3 py-2 text-left transition-colors",
        active
          ? "border-primary/50 bg-primary/10 text-primary"
          : "border-border hover:bg-muted",
      )}
    >
      <Icon className="h-5 w-5 shrink-0" />
      <span className="min-w-0">
        <span className="block text-sm font-medium">{title}</span>
        <span className="block truncate text-xs text-muted-foreground">
          {detail}
        </span>
      </span>
    </button>
  );
}

function StatusPill({
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
        "inline-flex items-center gap-1 rounded-md border px-2 py-1 text-xs",
        ok
          ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-700"
          : "border-amber-500/30 bg-amber-500/10 text-amber-700",
      )}
    >
      <Icon size={12} />
      {label}: {value}
    </span>
  );
}

function QualityPill({ quality }: { quality: PoseQualityResult }) {
  const tone =
    quality.label === "Good"
      ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-700"
      : quality.label === "Usable"
        ? "border-sky-500/30 bg-sky-500/10 text-sky-700"
        : "border-amber-500/30 bg-amber-500/10 text-amber-700";

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-md border px-2 py-1 text-xs",
        tone,
      )}
      title={quality.warnings.join("\n") || "Pose landmarks look stable"}
    >
      <Gauge size={12} />
      Quality: {quality.label} {Math.round(quality.score * 100)}%
    </span>
  );
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

interface Props {
  modelUuid: string;
  onFramesReady: (frames: PoseFrame[], remap: BoneRemap) => void;
  onCancel: () => void;
}

export function CaptureStep({ modelUuid, onFramesReady, onCancel }: Props) {
  const model = useModelsStore((state) => state.models[modelUuid]);
  const videoRef = useRef<HTMLVideoElement>(null);
  const imageRef = useRef<HTMLImageElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const startTimeRef = useRef<number>(0);
  const smootherRef = useRef(new PoseSmoother(0.4));
  const framesRef = useRef<PoseFrame[]>([]);
  const bestFrameRef = useRef<{
    frame: PoseFrame;
    quality: PoseQualityResult;
  } | null>(null);
  const calibrationRef = useRef<PoseCalibration | null>(null);
  const autoDetectedRef = useRef(false);

  const worldLandmarksRef = useRef<
    import("@mediapipe/tasks-vision").NormalizedLandmark[] | null
  >(null);
  const poseDataRef = useRef<PoseBoneData | null>(null);

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
  const [frameCount, setFrameCount] = useState(0);
  const [rejectedFrameCount, setRejectedFrameCount] = useState(0);
  const [elapsed, setElapsed] = useState(0);
  const [camError, setCamError] = useState<string | null>(null);
  const [remapOpen, setRemapOpen] = useState(false);
  const [calibrationRequestId, setCalibrationRequestId] = useState(0);
  const [calibrated, setCalibrated] = useState(false);
  const [bestQuality, setBestQuality] = useState<PoseQualityResult | null>(
    null,
  );
  const [detectingBestPhoto, setDetectingBestPhoto] = useState(false);

  const stopCamera = useCallback(() => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
  }, []);

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

  // Webcam setup
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
      .catch((e) => setCamError((e as Error).message));

    return () => {
      stopCamera();
    };
  }, [inputMode, stopCamera]);

  // Video file playback
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

  // Capture frames while recording (camera and video modes)
  useEffect(() => {
    if (
      !recording ||
      (inputMode !== "camera" && inputMode !== "video") ||
      !worldLandmarks ||
      !poseDataRef.current
    )
      return;
    const time = (performance.now() - startTimeRef.current) / 1000;
    const frame = buildSmoothedFrame(time);
    if (!frame) return;

    if (poseQuality.label === "Poor") {
      setRejectedFrameCount((count) => count + 1);
      rememberBestFrame(frame, poseQuality);
      return;
    }

    framesRef.current.push(frame);
    rememberBestFrame(frame, poseQuality);
    setFrameCount(framesRef.current.length);
    setElapsed(time);
  }, [
    buildSmoothedFrame,
    inputMode,
    poseQuality,
    recording,
    rememberBestFrame,
    worldLandmarks,
  ]);

  const handleStart = useCallback(() => {
    framesRef.current = [];
    bestFrameRef.current = null;
    smootherRef.current.reset();
    startTimeRef.current = performance.now();
    setFrameCount(0);
    setRejectedFrameCount(0);
    setBestQuality(null);
    setElapsed(0);
    setRecording(true);
  }, []);

  const handleStop = useCallback(() => setRecording(false), []);

  const handleClear = useCallback(() => {
    framesRef.current = [];
    bestFrameRef.current = null;
    smootherRef.current.reset();
    setFrameCount(0);
    setRejectedFrameCount(0);
    setBestQuality(null);
    setElapsed(0);
    setRecording(false);
  }, []);

  const handlePhotoSelect = useCallback(() => {
    importFile(["png", "jpg", "jpeg", "webp", "gif"], (file) => {
      setPhotoFile(file);
      handleClear();
    });
  }, [handleClear]);

  const handleVideoSelect = useCallback(() => {
    importFile(["mp4", "webm"], (file) => {
      setVideoFile(file);
      handleClear();
    });
  }, [handleClear]);

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

      framesRef.current = [frame];
      rememberBestFrame(frame, selectedQuality);
      setFrameCount(1);
      setRejectedFrameCount(0);
      setElapsed(0);

      if (selectedQuality.label === "Poor") {
        toast.warning("Captured pose quality is poor", {
          description:
            selectedQuality.warnings[0] ??
            "Try a full-body frame with visible elbows, knees, wrists, and ankles.",
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
  ]);

  const handleUseBestFrame = useCallback(() => {
    const best = bestFrameRef.current;
    if (!best) return;
    framesRef.current = [
      {
        time: 0,
        data: clonePoseData(best.frame.data),
      },
    ];
    setFrameCount(1);
    setRejectedFrameCount(0);
    setElapsed(0);
    setRecording(false);
    toast.success("Using best detected pose", {
      description: `${best.quality.label} quality, ${Math.round(
        best.quality.score * 100,
      )}% confidence.`,
    });
  }, []);

  const handleCalibrateRestPose = useCallback(() => {
    if (!worldLandmarksRef.current || !poseDataRef.current) {
      toast.warning("No pose is ready to calibrate", {
        description: "Load a photo or stand in frame until Pose shows detected.",
      });
      return;
    }
    setCalibrationRequestId((value) => value + 1);
  }, []);

  const handleCalibrationReady = useCallback(() => {
    setCalibrated(true);
    toast.success("Rest pose calibrated for this session");
  }, []);

  const handleNext = useCallback(() => {
    if (mappingAnalysis.issues.length > 0) {
      toast.warning("Bone mapping needs attention", {
        description: mappingAnalysis.issues[0],
      });
    }
    if (rejectedFrameCount > 0) {
      toast.warning("Some low-quality frames were skipped", {
        description: `${rejectedFrameCount} poor frame${
          rejectedFrameCount === 1 ? "" : "s"
        } rejected during capture.`,
      });
    }
    onFramesReady([...framesRef.current], boneRemap);
  }, [
    boneRemap,
    mappingAnalysis.issues,
    onFramesReady,
    rejectedFrameCount,
  ]);

  const inputError =
    inputMode === "photo" && !photoUrl
      ? "Upload a photo to capture a pose."
      : inputMode === "video" && !videoUrl
        ? "Upload a video to record frames."
        : null;
  const error =
    inputMode === "camera" ? (camError ?? mpError) : (inputError ?? mpError);

  const isVideoMode = inputMode === "camera" || inputMode === "video";
  const mappedBoneCount = mappingAnalysis.mapped;
  const expectedBoneCount = Object.keys(BODY_PART_LABELS).length;
  const poseDetected = Boolean(screenLandmarks && worldLandmarks);
  const modelReady = model?.loadState === "loaded";
  const mappingReady = mappedBoneCount > 0;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2 rounded-md border px-3 py-2">
        <StatusPill
          ok={modelReady}
          label="Model"
          value={modelReady ? "ready" : "not ready"}
        />
        <StatusPill
          ok={poseDetected}
          label="Pose"
          value={poseDetected ? "detected" : "waiting"}
        />
        <StatusPill
          ok={mappingReady}
          label="Mapping"
          value={
            mappingReady
              ? `${mappedBoneCount}/${expectedBoneCount}`
              : boneLoadError
                ? "error"
              : "loading"
          }
        />
        <QualityPill quality={poseQuality} />
        {calibrated && (
          <span className="inline-flex items-center gap-1 rounded-md border border-sky-500/30 bg-sky-500/10 px-2 py-1 text-xs text-sky-700">
            <Crosshair size={12} />
            Calibrated
          </span>
        )}
        <span className="ml-auto inline-flex items-center gap-1 text-xs text-muted-foreground">
          <ShieldCheck size={13} />
          Local browser detection
        </span>
      </div>

      <div className="flex flex-wrap gap-2">
        {isWeb() && (
          <InputModeOption
            active={inputMode === "camera"}
            icon={Camera}
            title="Camera"
            detail="Record live motion"
            onClick={() => setInputMode("camera")}
          />
        )}
        <InputModeOption
          active={inputMode === "photo"}
          icon={Image}
          title="Photo"
          detail="Capture one pose"
          onClick={() => setInputMode("photo")}
        />
        <InputModeOption
          active={inputMode === "video"}
          icon={Video}
          title="Video"
          detail="Record from a file"
          onClick={() => setInputMode("video")}
        />
      </div>

      <div className="flex gap-3 flex-wrap justify-center">
        <div className="flex flex-col gap-1">
          <p className="text-xs text-muted-foreground text-center">Input</p>
          <div
            className="relative rounded-md overflow-hidden bg-black"
            style={{ width: VIDEO_W, height: VIDEO_H }}
          >
            {isVideoMode ? (
              <video
                ref={videoRef}
                className={cn({
                  "w-full h-full": true,
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
                className="w-full h-full object-contain"
              />
            ) : (
              <div className="flex h-full w-full items-center justify-center text-sm text-muted-foreground px-4 text-center">
                Upload a photo to detect pose landmarks.
              </div>
            )}

            <SkeletonOverlay
              landmarks={screenLandmarks}
              width={VIDEO_W}
              height={VIDEO_H}
              mirror={inputMode === "camera"}
            />

            <div className="absolute top-2 left-2 flex gap-2">
              {!isReady && !error && (
                <span className="flex items-center gap-1 bg-black/60 text-white text-xs px-2 py-1 rounded">
                  <Loader2 size={12} className="animate-spin" /> Loading…
                </span>
              )}
              {isReady && inputMode === "camera" && (
                <span className="bg-black/60 text-white text-xs px-2 py-1 rounded">
                  {fps} FPS
                </span>
              )}
              {recording && (
                <span className="bg-red-600 text-white text-xs px-2 py-1 rounded animate-pulse">
                  ● REC {elapsed.toFixed(1)}s
                </span>
              )}
            </div>

            {error && (
              <div className="absolute inset-0 flex items-center justify-center bg-black/70 text-red-400 text-sm p-4 text-center">
                {error}
              </div>
            )}
          </div>

          {inputMode === "photo" && (
            <div className="flex gap-2 mt-2">
              <Button
                variant="outline"
                className="flex-1"
                onClick={handlePhotoSelect}
              >
                {photoUrl ? "Change Photo" : "Upload Photo"}
              </Button>
              <Button
                variant="outline"
                onClick={() => setPhotoFile(null)}
                disabled={!photoUrl}
              >
                Clear
              </Button>
            </div>
          )}

          {inputMode === "video" && (
            <div className="flex gap-2 mt-2">
              <Button
                variant="outline"
                className="flex-1"
                onClick={handleVideoSelect}
              >
                {videoUrl ? "Change Video" : "Upload Video"}
              </Button>
              <Button
                variant="outline"
                onClick={() => setVideoFile(null)}
                disabled={!videoUrl}
              >
                Clear
              </Button>
            </div>
          )}
        </div>

        <div className="flex flex-col gap-1">
          <p className="text-xs text-muted-foreground text-center">
            Model Preview
          </p>
          <div
            className="rounded-md overflow-hidden bg-muted border"
            style={{ width: VIDEO_W, height: VIDEO_H }}
          >
            <ModelPreview
              modelUuid={modelUuid}
              landmarksRef={worldLandmarksRef}
              remap={boneRemap}
              poseDataRef={poseDataRef}
              calibrationRef={calibrationRef}
              calibrationRequestId={calibrationRequestId}
              onCalibrationReady={handleCalibrationReady}
              rootMotion={rootMotion}
            />
          </div>
        </div>
      </div>

      <p className="text-sm text-muted-foreground text-center">
        {frameCount} frames recorded
        {frameCount > 0 && ` · ${elapsed.toFixed(1)}s`}
        {rejectedFrameCount > 0 &&
          ` · ${rejectedFrameCount} poor skipped`}
        {bestQuality &&
          ` · best ${bestQuality.label.toLowerCase()} ${Math.round(
            bestQuality.score * 100,
          )}%`}
      </p>

      {poseQuality.warnings.length > 0 && (
        <p className="rounded-md border border-amber-500/25 bg-amber-500/10 px-3 py-2 text-xs text-amber-800">
          {poseQuality.warnings[0]}
        </p>
      )}

      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          variant="outline"
          className="flex-1 gap-2"
          onClick={handleCalibrateRestPose}
          disabled={!poseDetected}
        >
          <Crosshair size={14} />
          Calibrate Rest Pose
        </Button>
        <Button
          type="button"
          variant="outline"
          className="flex-1 gap-2"
          onClick={handleUseBestFrame}
          disabled={!bestQuality}
        >
          <Sparkles size={14} />
          Use Best Frame
        </Button>
      </div>

      <button
        type="button"
        onClick={() => setRootMotion((v) => !v)}
        className={`flex items-center gap-2 text-sm px-3 py-1.5 rounded-md border transition-colors w-full justify-start ${
          rootMotion
            ? "bg-primary/10 border-primary/40 text-primary"
            : "border-transparent text-muted-foreground hover:text-foreground"
        }`}
      >
        <span className="text-base">↕</span>
        Root Motion
        <span className="ml-auto text-xs opacity-60">
          {rootMotion ? "on — hips height tracked" : "off — stationary"}
        </span>
      </button>

      <Collapsible open={remapOpen} onOpenChange={setRemapOpen}>
        <CollapsibleTrigger asChild>
          <Button
            variant="ghost"
            size="sm"
            className="w-full justify-start gap-2 text-muted-foreground"
          >
            <Settings2 size={14} />
            Bone Mapping{remapOpen ? " ▲" : " ▼"}
          </Button>
        </CollapsibleTrigger>
        <CollapsibleContent className="border rounded-md p-3 mt-1">
          <BoneRemapPanel
            modelUuid={modelUuid}
            remap={boneRemap}
            onChange={setBoneRemap}
            availableBones={availableBones}
          />
          {boneLoadError && (
            <p className="mt-2 text-xs text-destructive">{boneLoadError}</p>
          )}
        </CollapsibleContent>
      </Collapsible>

      <div className="flex gap-2 justify-center flex-wrap">
        <Button variant="outline" onClick={onCancel}>
          Cancel
        </Button>
        <Button
          variant="outline"
          onClick={handleClear}
          disabled={frameCount === 0 && !recording}
        >
          Clear
        </Button>
        {inputMode === "photo" ? (
          <Button
            onClick={handleCapturePhoto}
            disabled={!isReady || !!error || !photoUrl || detectingBestPhoto}
          >
            {detectingBestPhoto ? "Finding Best…" : "Capture Pose"}
          </Button>
        ) : recording ? (
          <Button variant="destructive" onClick={handleStop}>
            Stop
          </Button>
        ) : (
          <Button
            onClick={handleStart}
            disabled={
              !isReady || !!error || (inputMode === "video" && !videoUrl)
            }
          >
            {isReady ? "Record" : "Initializing…"}
          </Button>
        )}
        <Button onClick={handleNext} disabled={frameCount === 0 || recording}>
          Next →
        </Button>
      </div>
    </div>
  );
}
