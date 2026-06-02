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
import type { PoseLandmarkCandidate } from "@/utils/pose-retargeting";

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
  detectImageCandidates: (
    image: HTMLImageElement,
  ) => Promise<PoseLandmarkCandidate[]>;
  applyDetectedCandidate: (candidate: PoseLandmarkCandidate) => void;
}

function getImageSize(image: HTMLImageElement) {
  return {
    width: image.naturalWidth || image.width || 1,
    height: image.naturalHeight || image.height || 1,
  };
}

function makeContainCanvas(
  image: HTMLImageElement,
  padding: number,
): HTMLCanvasElement {
  const { width, height } = getImageSize(image);
  const canvas = document.createElement("canvas");
  const size = Math.max(width, height);
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  if (!ctx) return canvas;

  ctx.fillStyle = "#000";
  ctx.fillRect(0, 0, size, size);
  const scale = ((1 - padding * 2) * size) / Math.max(width, height);
  const drawWidth = width * scale;
  const drawHeight = height * scale;
  ctx.drawImage(
    image,
    (size - drawWidth) / 2,
    (size - drawHeight) / 2,
    drawWidth,
    drawHeight,
  );
  return canvas;
}

function makeCenterCropCanvas(
  image: HTMLImageElement,
  cropScale: number,
): HTMLCanvasElement {
  const { width, height } = getImageSize(image);
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) return canvas;

  const sourceWidth = width * cropScale;
  const sourceHeight = height * cropScale;
  ctx.drawImage(
    image,
    (width - sourceWidth) / 2,
    (height - sourceHeight) / 2,
    sourceWidth,
    sourceHeight,
    0,
    0,
    width,
    height,
  );
  return canvas;
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

  const applyDetectedCandidate = useCallback(
    (candidate: PoseLandmarkCandidate) => {
      if (candidate.screenLandmarks) setScreenLandmarks(candidate.screenLandmarks);
      if (candidate.worldLandmarks) setWorldLandmarks(candidate.worldLandmarks);
      setFps(0);
    },
    [],
  );

  const detectImageCandidates = useCallback(
    async (image: HTMLImageElement): Promise<PoseLandmarkCandidate[]> => {
      const landmarker = landmarkerRef.current;
      if (!landmarker || !image.complete) return [];

      const sources: { label: string; source: HTMLImageElement | HTMLCanvasElement }[] = [
        { label: "Original", source: image },
        { label: "Padded", source: makeContainCanvas(image, 0.08) },
        { label: "Tight Center", source: makeCenterCropCanvas(image, 0.92) },
      ];

      const candidates: PoseLandmarkCandidate[] = [];
      for (const { label, source } of sources) {
        const result =
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          (landmarker as any).detectForImage?.(source) ??
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          (landmarker as any).detect?.(source);
        const screen = result.landmarks?.[0] ?? null;
        const world = result.worldLandmarks?.[0] ?? null;
        if (screen || world) {
          candidates.push({
            id: label.toLowerCase().replace(/\s+/g, "-"),
            label,
            screenLandmarks: screen,
            worldLandmarks: world,
          });
        }
      }

      return candidates;
    },
    [],
  );

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
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (landmarker as any).detectForImage?.(image) ??
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
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

  return {
    screenLandmarks,
    worldLandmarks,
    fps,
    isReady,
    error,
    detectImageCandidates,
    applyDetectedCandidate,
  };
}
