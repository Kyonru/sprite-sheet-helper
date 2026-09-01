import { useEffect, useRef, useState } from "react";
import type { NormalizedLandmark } from "@mediapipe/tasks-vision";

// Pairs of landmark indices to draw bones
const CONNECTIONS: [number, number][] = [
  [11, 12], // shoulders
  [11, 13],
  [13, 15], // left arm
  [12, 14],
  [14, 16], // right arm
  [11, 23],
  [12, 24], // torso sides
  [23, 24], // hips
  [23, 25],
  [25, 27], // left leg
  [24, 26],
  [26, 28], // right leg
];

interface Props {
  landmarks: NormalizedLandmark[] | null;
  width: number;
  height: number;
  mirror?: boolean;
  fit?: "stretch" | "contain" | "cover";
  sourceWidth?: number;
  sourceHeight?: number;
}

export function SkeletonOverlay({
  landmarks,
  width,
  height,
  mirror = true,
  fit = "stretch",
  sourceWidth,
  sourceHeight,
}: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [size, setSize] = useState({ width, height });

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const updateSize = () => {
      const rect = canvas.getBoundingClientRect();
      setSize({
        width: Math.max(1, Math.round(rect.width || width)),
        height: Math.max(1, Math.round(rect.height || height)),
      });
    };

    updateSize();
    const observer = new ResizeObserver(updateSize);
    observer.observe(canvas);
    return () => observer.disconnect();
  }, [height, width]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const canvasWidth = size.width;
    const canvasHeight = size.height;
    canvas.width = canvasWidth;
    canvas.height = canvasHeight;

    ctx.clearRect(0, 0, canvasWidth, canvasHeight);
    if (!landmarks || landmarks.length === 0) return;

    const mediaWidth = sourceWidth && sourceWidth > 0 ? sourceWidth : width;
    const mediaHeight = sourceHeight && sourceHeight > 0 ? sourceHeight : height;
    const scale =
      fit === "contain"
        ? Math.min(canvasWidth / mediaWidth, canvasHeight / mediaHeight)
        : fit === "cover"
          ? Math.max(canvasWidth / mediaWidth, canvasHeight / mediaHeight)
          : 1;
    const drawWidth = fit === "stretch" ? canvasWidth : mediaWidth * scale;
    const drawHeight = fit === "stretch" ? canvasHeight : mediaHeight * scale;
    const offsetX = fit === "stretch" ? 0 : (canvasWidth - drawWidth) / 2;
    const offsetY = fit === "stretch" ? 0 : (canvasHeight - drawHeight) / 2;

    const xFor = (x: number) =>
      offsetX + (mirror ? 1 - x : x) * drawWidth;
    const yFor = (y: number) => offsetY + y * drawHeight;

    // Draw bones
    ctx.strokeStyle = "#22c55e";
    ctx.lineWidth = 2;
    for (const [a, b] of CONNECTIONS) {
      const pa = landmarks[a];
      const pb = landmarks[b];
      if (!pa || !pb) continue;
      ctx.beginPath();
      ctx.moveTo(xFor(pa.x), yFor(pa.y));
      ctx.lineTo(xFor(pb.x), yFor(pb.y));
      ctx.stroke();
    }

    // Draw joints
    for (const lm of landmarks) {
      const confidence =
        (lm as NormalizedLandmark & { visibility?: number }).visibility ?? 1;
      if (confidence < 0.3) continue;
      ctx.beginPath();
      ctx.arc(xFor(lm.x), yFor(lm.y), 4, 0, Math.PI * 2);
      ctx.fillStyle = confidence > 0.7 ? "#22c55e" : "#facc15";
      ctx.fill();
    }
  }, [
    fit,
    height,
    landmarks,
    mirror,
    size.height,
    size.width,
    sourceHeight,
    sourceWidth,
    width,
  ]);

  return (
    <canvas
      ref={canvasRef}
      width={size.width}
      height={size.height}
      className="absolute inset-0 h-full w-full pointer-events-none"
    />
  );
}
