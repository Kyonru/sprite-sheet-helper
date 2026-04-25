import {
  useEffect,
  useRef,
  useState,
  useCallback,
  type RefObject,
} from "react";
import type {
  NormalizedLandmark,
  PoseLandmarker,
} from "@mediapipe/tasks-vision";

const WASM_CDN =
  "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm";
const MODEL_URL =
  "https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task";

export interface UseMediPipeResult {
  /** Normalized [0,1] screen-space landmarks — use for overlay drawing */
  screenLandmarks: NormalizedLandmark[] | null;
  /** Metric-space 3D landmarks — use for bone rotation calculation */
  worldLandmarks: NormalizedLandmark[] | null;
  fps: number;
  isReady: boolean;
  error: string | null;
}

export function useMediaPipe(
  videoRef?: RefObject<HTMLVideoElement | null>,
  imageRef?: RefObject<HTMLImageElement | null>,
): UseMediPipeResult {
  const landmarkerRef = useRef<PoseLandmarker | null>(null);
  const rafRef = useRef<number>(0);
  const lastTimeRef = useRef<number>(0);

  const [screenLandmarks, setScreenLandmarks] = useState<
    NormalizedLandmark[] | null
  >(null);
  const [worldLandmarks, setWorldLandmarks] = useState<
    NormalizedLandmark[] | null
  >(null);
  const [fps, setFps] = useState(0);
  const [isReady, setIsReady] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const detect = useCallback(async () => {
    const landmarker = landmarkerRef.current;
    if (!landmarker) return;

    if (imageRef?.current) {
      const image = imageRef.current;
      if (!image.complete) {
        rafRef.current = requestAnimationFrame(detect);
        return;
      }

      const result =
        (landmarker as any).detectForImage?.(image) ??
        (landmarker as any).detect?.(image);

      if (result.landmarks?.[0]) setScreenLandmarks(result.landmarks[0]);
      if (result.worldLandmarks?.[0])
        setWorldLandmarks(result.worldLandmarks[0]);
      setFps(0);

      rafRef.current = requestAnimationFrame(detect);
      return;
    }

    const video = videoRef?.current;
    if (!video || video.readyState < 2) {
      rafRef.current = requestAnimationFrame(detect);
      return;
    }

    const now = performance.now();
    const result = landmarker.detectForVideo(video, now);

    if (result.landmarks?.[0]) setScreenLandmarks(result.landmarks[0]);
    if (result.worldLandmarks?.[0]) setWorldLandmarks(result.worldLandmarks[0]);

    const delta = now - lastTimeRef.current;
    if (delta > 0) setFps(Math.round(1000 / delta));
    lastTimeRef.current = now;

    rafRef.current = requestAnimationFrame(detect);
  }, [videoRef, imageRef]);

  useEffect(() => {
    let cancelled = false;

    async function init() {
      try {
        const { PoseLandmarker, FilesetResolver } =
          await import("@mediapipe/tasks-vision");
        const vision = await FilesetResolver.forVisionTasks(WASM_CDN);
        const landmarker = await PoseLandmarker.createFromOptions(vision, {
          baseOptions: { modelAssetPath: MODEL_URL, delegate: "GPU" },
          runningMode: imageRef ? "IMAGE" : "VIDEO",
          numPoses: 1,
          minPoseDetectionConfidence: 0.5,
          minPosePresenceConfidence: 0.5,
          minTrackingConfidence: 0.5,
          outputSegmentationMasks: false,
        });

        if (cancelled) {
          landmarker.close();
          return;
        }

        landmarkerRef.current = landmarker;
        setIsReady(true);
        rafRef.current = requestAnimationFrame(detect);
      } catch (e) {
        if (!cancelled) setError((e as Error).message);
      }
    }

    init();

    return () => {
      cancelled = true;
      cancelAnimationFrame(rafRef.current);
      landmarkerRef.current?.close();
      landmarkerRef.current = null;
    };
  }, [detect, imageRef]);

  return { screenLandmarks, worldLandmarks, fps, isReady, error };
}
