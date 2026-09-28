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

/**
 * Pinned to the installed package version.
 *
 * This used to resolve `@latest`, so the WASM binary could drift ahead of the
 * JavaScript that drives it — a mismatch that surfaces as an opaque failure to
 * initialise rather than anything the app can report.
 */
const TASKS_VISION_VERSION = "0.10.34";
const WASM_CDN = `https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@${TASKS_VISION_VERSION}/wasm`;

/**
 * How hard the detector works.
 *
 * A still photo is detected once, on a click, so there is no reason to spend
 * accuracy on latency there — `accurate` is roughly three times the work of
 * `fast` and noticeably better on partial occlusion, foreshortening and side
 * views, which is exactly what reference photos are full of. A live camera has
 * to keep up with the frame rate, so it gets the balanced model.
 */
export type PoseModelTier = "fast" | "balanced" | "accurate";

const MODEL_URLS: Record<PoseModelTier, string> = {
  fast: "https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task",
  balanced:
    "https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_full/float16/1/pose_landmarker_full.task",
  accurate:
    "https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_heavy/float16/1/pose_landmarker_heavy.task",
};

export const POSE_MODEL_TIER_LABELS: Record<PoseModelTier, string> = {
  fast: "Fast",
  balanced: "Balanced",
  accurate: "Accurate",
};

/** Live input has to keep up with the camera; a still does not. */
const DEFAULT_VIDEO_TIER: PoseModelTier = "balanced";
const DEFAULT_IMAGE_TIER: PoseModelTier = "accurate";

/**
 * How much of the previous frame to keep when smoothing live landmarks.
 *
 * Raw per-frame detections jitter by a few millimetres even on a still subject,
 * which reads as a permanent tremble on the posed model. Smoothing is applied
 * only to live input: a photo is detected once, and averaging one detection
 * with nothing is just the detection.
 */
const LIVE_SMOOTHING = 0.55;

export interface UseMediPipeResult {
  /** Normalized [0,1] screen-space landmarks — use for overlay drawing */
  screenLandmarks: NormalizedLandmark[] | null;
  /** Metric-space 3D landmarks — use for bone rotation calculation */
  worldLandmarks: NormalizedLandmark[] | null;
  fps: number;
  isReady: boolean;
  /** True while the detector is loading, so callers can say why nothing works. */
  isLoading: boolean;
  error: string | null;
  modelTier: PoseModelTier;
  setModelTier: (tier: PoseModelTier) => void;
  detectImageCandidates: (
    image: HTMLImageElement,
  ) => Promise<PoseLandmarkCandidate[]>;
  applyDetectedCandidate: (candidate: PoseLandmarkCandidate) => void;
}

export interface UseMediaPipeOptions {
  /** Preserve the historical live-input EMA; photos are never filtered here. */
  smoothLiveLandmarks?: boolean;
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

/**
 * Upscale a small image before detection.
 *
 * The landmarker works from a fixed-size input tensor, so a 200px reference
 * photo is being asked to fill it from very little data. Giving it a clean
 * upscale first measurably steadies the landmarks on small sources, and costs
 * nothing on large ones because it is skipped.
 */
const MIN_DETECTION_EDGE = 512;

function makeUpscaledCanvas(image: HTMLImageElement): HTMLCanvasElement | null {
  const { width, height } = getImageSize(image);
  const longest = Math.max(width, height);
  if (longest >= MIN_DETECTION_EDGE) return null;

  const scale = MIN_DETECTION_EDGE / longest;
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(width * scale);
  canvas.height = Math.round(height * scale);
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;

  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
  return canvas;
}

/** Blend two landmark sets, keeping the newer one's confidence fields. */
function smoothLandmarks(
  previous: NormalizedLandmark[] | null,
  next: NormalizedLandmark[],
  keep: number,
): NormalizedLandmark[] {
  if (!previous || previous.length !== next.length) return next;

  return next.map((landmark, index) => {
    const before = previous[index];
    if (!before) return landmark;
    return {
      ...landmark,
      x: before.x * keep + landmark.x * (1 - keep),
      y: before.y * keep + landmark.y * (1 - keep),
      z: before.z * keep + landmark.z * (1 - keep),
    };
  });
}

export function useMediaPipe(
  videoRef?: RefObject<HTMLVideoElement | null>,
  imageRef?: RefObject<HTMLImageElement | null>,
  options: UseMediaPipeOptions = {},
): UseMediPipeResult {
  const smoothLiveLandmarks = options.smoothLiveLandmarks ?? true;
  const landmarkerRef = useRef<PoseLandmarker | null>(null);
  const rafRef = useRef<number>(0);
  const lastTimeRef = useRef<number>(0);
  const previousScreenRef = useRef<NormalizedLandmark[] | null>(null);
  const previousWorldRef = useRef<NormalizedLandmark[] | null>(null);

  const isImageMode = Boolean(imageRef);
  const [modelTier, setModelTier] = useState<PoseModelTier>(
    isImageMode ? DEFAULT_IMAGE_TIER : DEFAULT_VIDEO_TIER,
  );

  const [screenLandmarks, setScreenLandmarks] = useState<
    NormalizedLandmark[] | null
  >(null);
  const [worldLandmarks, setWorldLandmarks] = useState<
    NormalizedLandmark[] | null
  >(null);
  const [fps, setFps] = useState(0);
  const [isReady, setIsReady] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const applyDetectedCandidate = useCallback(
    (candidate: PoseLandmarkCandidate) => {
      if (candidate.screenLandmarks) {
        setScreenLandmarks(candidate.screenLandmarks);
      }
      if (candidate.worldLandmarks) {
        setWorldLandmarks(candidate.worldLandmarks);
      }
    },
    [],
  );

  const detectImageCandidates = useCallback(
    async (image: HTMLImageElement): Promise<PoseLandmarkCandidate[]> => {
      const landmarker = landmarkerRef.current;
      if (!landmarker || !image.complete) return [];

      const upscaled = makeUpscaledCanvas(image);
      const sources: {
        label: string;
        source: HTMLImageElement | HTMLCanvasElement;
      }[] = [
        { label: "Original", source: image },
        { label: "Padded", source: makeContainCanvas(image, 0.08) },
        { label: "Tight Center", source: makeCenterCropCanvas(image, 0.92) },
        ...(upscaled ? [{ label: "Upscaled", source: upscaled }] : []),
      ];

      const candidates: PoseLandmarkCandidate[] = [];
      for (const { label, source } of sources) {
        const result = landmarker.detect(source);
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

  // ── Create the detector ────────────────────────────────────────────────
  // Only the running mode and the model tier can invalidate it. It used to
  // depend on the detection callback, so every render that changed a ref
  // identity tore down the WASM instance and built another one.
  useEffect(() => {
    let cancelled = false;
    setIsReady(false);
    setIsLoading(true);
    setError(null);

    async function init() {
      try {
        const { PoseLandmarker, FilesetResolver } = await import(
          "@mediapipe/tasks-vision"
        );
        const vision = await FilesetResolver.forVisionTasks(WASM_CDN);
        const landmarker = await PoseLandmarker.createFromOptions(vision, {
          baseOptions: {
            modelAssetPath: MODEL_URLS[modelTier],
            delegate: "GPU",
          },
          runningMode: isImageMode ? "IMAGE" : "VIDEO",
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
        setIsLoading(false);
      } catch (e) {
        if (!cancelled) {
          setError((e as Error).message);
          setIsLoading(false);
        }
      }
    }

    init();

    return () => {
      cancelled = true;
      landmarkerRef.current?.close();
      landmarkerRef.current = null;
    };
  }, [isImageMode, modelTier]);

  // ── Still images: detect once, when the image changes ──────────────────
  // The old loop re-ran detection on every animation frame for a picture that
  // could not change, pinning the GPU and pushing a state update per frame.
  useEffect(() => {
    if (!isImageMode || !isReady) return;
    const image = imageRef?.current;
    if (!image) return;

    let cancelled = false;

    const run = () => {
      const landmarker = landmarkerRef.current;
      if (!landmarker || cancelled) return;

      const result = landmarker.detect(image);
      if (cancelled) return;

      setScreenLandmarks(result.landmarks?.[0] ?? null);
      setWorldLandmarks(result.worldLandmarks?.[0] ?? null);
      setFps(0);
    };

    if (image.complete) {
      run();
    } else {
      image.addEventListener("load", run, { once: true });
      return () => {
        cancelled = true;
        image.removeEventListener("load", run);
      };
    }

    return () => {
      cancelled = true;
    };
    // `imageRef.current?.src` is the meaningful input: a new photo is a new
    // element source, and that is what should trigger another detection.
  }, [isImageMode, isReady, imageRef, imageRef?.current?.src]);

  // ── Live input: one detection per animation frame ──────────────────────
  useEffect(() => {
    if (isImageMode || !isReady) return;

    let cancelled = false;

    const tick = () => {
      if (cancelled) return;

      const landmarker = landmarkerRef.current;
      const video = videoRef?.current;

      if (!landmarker || !video || video.readyState < 2) {
        rafRef.current = requestAnimationFrame(tick);
        return;
      }

      const now = performance.now();
      const result = landmarker.detectForVideo(video, now);

      const screen = result.landmarks?.[0] ?? null;
      const world = result.worldLandmarks?.[0] ?? null;

      if (screen) {
        const next = smoothLiveLandmarks
          ? smoothLandmarks(previousScreenRef.current, screen, LIVE_SMOOTHING)
          : screen;
        previousScreenRef.current = smoothLiveLandmarks ? next : null;
        setScreenLandmarks(next);
      }
      if (world) {
        const next = smoothLiveLandmarks
          ? smoothLandmarks(previousWorldRef.current, world, LIVE_SMOOTHING)
          : world;
        previousWorldRef.current = smoothLiveLandmarks ? next : null;
        setWorldLandmarks(next);
      }

      const delta = now - lastTimeRef.current;
      if (delta > 0) setFps(Math.round(1000 / delta));
      lastTimeRef.current = now;

      rafRef.current = requestAnimationFrame(tick);
    };

    rafRef.current = requestAnimationFrame(tick);

    return () => {
      cancelled = true;
      cancelAnimationFrame(rafRef.current);
      previousScreenRef.current = null;
      previousWorldRef.current = null;
    };
  }, [isImageMode, isReady, smoothLiveLandmarks, videoRef]);

  return {
    screenLandmarks,
    worldLandmarks,
    fps,
    isReady,
    isLoading,
    error,
    modelTier,
    setModelTier,
    detectImageCandidates,
    applyDetectedCandidate,
  };
}
