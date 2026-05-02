import { useEffect, useRef, useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { importFile } from "@/utils/assets";
import { useMediaPipe } from "@/hooks/next/use-mediapipe";
import type { PoseBoneData } from "@/utils/mediapipe-to-bones";
import { PoseSmoother } from "@/utils/animation-smoothing";
import type { PoseFrame } from "@/utils/pose-to-animation";
import { MIXAMO_DEFAULT_REMAP, type BoneRemap } from "@/utils/bone-remap";
import { SkeletonOverlay } from "./skeleton-overlay";
import { ModelPreview } from "./model-preview";
import { BoneRemapPanel } from "./bone-remap-panel";
import { Loader2, Settings2 } from "lucide-react";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { isWeb } from "@/utils/platform";
import { cn } from "@/lib/utils";

const VIDEO_W = 480;
const VIDEO_H = 360;

type InputMode = "camera" | "photo" | "video";

interface Props {
  modelUuid: string;
  onFramesReady: (frames: PoseFrame[], remap: BoneRemap) => void;
  onCancel: () => void;
}

export function CaptureStep({ modelUuid, onFramesReady, onCancel }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const imageRef = useRef<HTMLImageElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const startTimeRef = useRef<number>(0);
  const smootherRef = useRef(new PoseSmoother(0.4));
  const framesRef = useRef<PoseFrame[]>([]);

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
  const [rootMotion, setRootMotion] = useState(false);

  const [recording, setRecording] = useState(false);
  const [frameCount, setFrameCount] = useState(0);
  const [elapsed, setElapsed] = useState(0);
  const [camError, setCamError] = useState<string | null>(null);
  const [remapOpen, setRemapOpen] = useState(false);

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
  } = useMediaPipe(
    inputMode === "camera" || inputMode === "video" ? videoRef : undefined,
    inputMode === "photo" ? imageRef : undefined,
  );

  useEffect(() => {
    worldLandmarksRef.current = worldLandmarks;
  }, [worldLandmarks]);

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

  // Capture frames while recording (camera and video modes)
  useEffect(() => {
    if (
      !recording ||
      (inputMode !== "camera" && inputMode !== "video") ||
      !worldLandmarks ||
      !poseDataRef.current
    )
      return;
    const pose = poseDataRef.current;
    const time = (performance.now() - startTimeRef.current) / 1000;

    const smoothed: PoseBoneData = {
      hips: {
        boneName: pose.hips.boneName,
        position: smootherRef.current.smoothVec("hips.pos", pose.hips.position),
        quaternion: smootherRef.current.smoothQuat(
          "hips.quat",
          pose.hips.quaternion,
        ),
      },
      bones: pose.bones.map((b) => ({
        boneKey: b.boneKey,
        boneName: b.boneName,
        quaternion: smootherRef.current.smoothQuat(b.boneName, b.quaternion),
      })),
    };

    framesRef.current.push({ time, data: smoothed });
    setFrameCount(framesRef.current.length);
    setElapsed(time);
  }, [worldLandmarks, recording, inputMode]);

  const handleStart = useCallback(() => {
    framesRef.current = [];
    smootherRef.current.reset();
    startTimeRef.current = performance.now();
    setFrameCount(0);
    setElapsed(0);
    setRecording(true);
  }, []);

  const handleStop = useCallback(() => setRecording(false), []);

  const handleClear = useCallback(() => {
    framesRef.current = [];
    smootherRef.current.reset();
    setFrameCount(0);
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

  const handleCapturePhoto = useCallback(() => {
    if (!worldLandmarks || !poseDataRef.current || !photoUrl) return;
    const pose = poseDataRef.current;

    const smoothed: PoseBoneData = {
      hips: {
        boneName: pose.hips.boneName,
        position: smootherRef.current.smoothVec("hips.pos", pose.hips.position),
        quaternion: smootherRef.current.smoothQuat(
          "hips.quat",
          pose.hips.quaternion,
        ),
      },
      bones: pose.bones.map((b) => ({
        boneKey: b.boneKey,
        boneName: b.boneName,
        quaternion: smootherRef.current.smoothQuat(b.boneName, b.quaternion),
      })),
    };

    framesRef.current = [{ time: 0, data: smoothed }];
    setFrameCount(1);
    setElapsed(0);
  }, [photoUrl, worldLandmarks]);

  const handleNext = useCallback(() => {
    onFramesReady([...framesRef.current], boneRemap);
  }, [onFramesReady, boneRemap]);

  const inputError =
    inputMode === "photo" && !photoUrl
      ? "Upload a photo to capture a pose."
      : inputMode === "video" && !videoUrl
        ? "Upload a video to record frames."
        : null;
  const error =
    inputMode === "camera" ? (camError ?? mpError) : (inputError ?? mpError);

  const isVideoMode = inputMode === "camera" || inputMode === "video";

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap gap-2 justify-center">
        {isWeb() && (
          <Button
            size="sm"
            variant={inputMode === "camera" ? "secondary" : "outline"}
            onClick={() => setInputMode("camera")}
          >
            Camera
          </Button>
        )}
        <Button
          size="sm"
          variant={inputMode === "photo" ? "secondary" : "outline"}
          onClick={() => setInputMode("photo")}
        >
          Photo
        </Button>
        <Button
          size="sm"
          variant={inputMode === "video" ? "secondary" : "outline"}
          onClick={() => setInputMode("video")}
        >
          Video
        </Button>
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
              rootMotion={rootMotion}
            />
          </div>
        </div>
      </div>

      <p className="text-sm text-muted-foreground text-center">
        {frameCount} frames recorded
        {frameCount > 0 && ` · ${elapsed.toFixed(1)}s`}
      </p>

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
          />
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
            disabled={!isReady || !!error || !photoUrl}
          >
            Capture Pose
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
