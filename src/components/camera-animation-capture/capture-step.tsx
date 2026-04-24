import { useEffect, useRef, useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { useMediaPipe } from "@/hooks/next/use-mediapipe";
import type { PoseBoneData } from "@/utils/mediapipe-to-bones";
import { PoseSmoother } from "@/utils/animation-smoothing";
import type { PoseFrame } from "@/utils/pose-to-animation";
import { MIXAMO_DEFAULT_REMAP, type BoneRemap } from "@/utils/bone-remap";
import { SkeletonOverlay } from "./skeleton-overlay";
import { ModelPreview } from "./model-preview";
import { BoneRemapPanel } from "./bone-remap-panel";
import { Loader2, Settings2 } from "lucide-react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";

const VIDEO_W = 480;
const VIDEO_H = 360;

interface Props {
  modelUuid: string;
  onFramesReady: (frames: PoseFrame[]) => void;
  onCancel: () => void;
}

export function CaptureStep({ modelUuid, onFramesReady, onCancel }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const startTimeRef = useRef<number>(0);
  const smootherRef = useRef(new PoseSmoother(0.4));
  const framesRef = useRef<PoseFrame[]>([]);

  // Landmarks ref for the R3F preview (no re-renders)
  const worldLandmarksRef = useRef<import("@mediapipe/tasks-vision").NormalizedLandmark[] | null>(null);
  // Actual bone local quaternions written by ModelPreview each frame — used for recording
  const poseDataRef = useRef<PoseBoneData | null>(null);

  const [boneRemap, setBoneRemap] = useState<BoneRemap>({ ...MIXAMO_DEFAULT_REMAP });

  const [recording, setRecording] = useState(false);
  const [frameCount, setFrameCount] = useState(0);
  const [elapsed, setElapsed] = useState(0);
  const [camError, setCamError] = useState<string | null>(null);
  const [remapOpen, setRemapOpen] = useState(false);

  const { screenLandmarks, worldLandmarks, fps, isReady, error: mpError } = useMediaPipe(videoRef);

  // Keep landmark ref in sync for the R3F preview loop (no re-render needed)
  useEffect(() => {
    worldLandmarksRef.current = worldLandmarks;
  }, [worldLandmarks]);

  // Start webcam
  useEffect(() => {
    navigator.mediaDevices
      .getUserMedia({ video: { width: VIDEO_W, height: VIDEO_H, facingMode: "user" } })
      .then((stream) => {
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.play();
        }
      })
      .catch((e) => setCamError((e as Error).message));

    return () => {
      streamRef.current?.getTracks().forEach((t) => t.stop());
    };
  }, []);

  // Capture frames while recording — reads actual bone quaternions from the live preview
  useEffect(() => {
    if (!recording || !worldLandmarks || !poseDataRef.current) return;
    const pose = poseDataRef.current;
    const time = (performance.now() - startTimeRef.current) / 1000;

    const smoothed: PoseBoneData = {
      hips: {
        boneName: pose.hips.boneName,
        position: smootherRef.current.smoothVec("hips.pos", pose.hips.position),
        quaternion: smootherRef.current.smoothQuat("hips.quat", pose.hips.quaternion),
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
  }, [worldLandmarks, recording]);

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

  const handleNext = useCallback(() => {
    onFramesReady([...framesRef.current]);
  }, [onFramesReady]);

  const error = camError ?? mpError;

  return (
    <div className="flex flex-col gap-4">
      {/* Side-by-side: webcam + model preview */}
      <div className="flex gap-3 flex-wrap justify-center">
        {/* Webcam feed with skeleton overlay */}
        <div className="flex flex-col gap-1">
          <p className="text-xs text-muted-foreground text-center">Camera</p>
          <div
            className="relative rounded-md overflow-hidden bg-black"
            style={{ width: VIDEO_W, height: VIDEO_H }}
          >
            <video
              ref={videoRef}
              className="w-full h-full object-cover"
              style={{ transform: "scaleX(-1)" }}
              muted
              playsInline
            />
            <SkeletonOverlay landmarks={screenLandmarks} width={VIDEO_W} height={VIDEO_H} />

            <div className="absolute top-2 left-2 flex gap-2">
              {!isReady && !error && (
                <span className="flex items-center gap-1 bg-black/60 text-white text-xs px-2 py-1 rounded">
                  <Loader2 size={12} className="animate-spin" /> Loading…
                </span>
              )}
              {isReady && (
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
        </div>

        {/* 3D model preview */}
        <div className="flex flex-col gap-1">
          <p className="text-xs text-muted-foreground text-center">Model Preview</p>
          <div
            className="rounded-md overflow-hidden bg-muted border"
            style={{ width: VIDEO_W, height: VIDEO_H }}
          >
            <ModelPreview
              modelUuid={modelUuid}
              landmarksRef={worldLandmarksRef}
              remap={boneRemap}
              poseDataRef={poseDataRef}
            />
          </div>
        </div>
      </div>

      {/* Frame counter */}
      <p className="text-sm text-muted-foreground text-center">
        {frameCount} frames recorded{frameCount > 0 && ` · ${elapsed.toFixed(1)}s`}
      </p>

      {/* Bone remap panel */}
      <Collapsible open={remapOpen} onOpenChange={setRemapOpen}>
        <CollapsibleTrigger asChild>
          <Button variant="ghost" size="sm" className="w-full justify-start gap-2 text-muted-foreground">
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

      {/* Controls */}
      <div className="flex gap-2 justify-center flex-wrap">
        <Button variant="outline" onClick={onCancel}>Cancel</Button>
        <Button variant="outline" onClick={handleClear} disabled={frameCount === 0 && !recording}>
          Clear
        </Button>
        {recording ? (
          <Button variant="destructive" onClick={handleStop}>Stop</Button>
        ) : (
          <Button onClick={handleStart} disabled={!isReady || !!error}>
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
