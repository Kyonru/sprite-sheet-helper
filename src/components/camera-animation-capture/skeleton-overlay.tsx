import { useEffect, useRef } from "react";
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
}

export function SkeletonOverlay({
  landmarks,
  width,
  height,
  mirror = true,
}: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.clearRect(0, 0, width, height);
    if (!landmarks || landmarks.length === 0) return;

    const xFor = (x: number) => (mirror ? 1 - x : x) * width;

    // Draw bones
    ctx.strokeStyle = "#22c55e";
    ctx.lineWidth = 2;
    for (const [a, b] of CONNECTIONS) {
      const pa = landmarks[a];
      const pb = landmarks[b];
      if (!pa || !pb) continue;
      ctx.beginPath();
      ctx.moveTo(xFor(pa.x), pa.y * height);
      ctx.lineTo(xFor(pb.x), pb.y * height);
      ctx.stroke();
    }

    // Draw joints
    for (const lm of landmarks) {
      const confidence =
        (lm as NormalizedLandmark & { visibility?: number }).visibility ?? 1;
      if (confidence < 0.3) continue;
      ctx.beginPath();
      ctx.arc(xFor(lm.x), lm.y * height, 4, 0, Math.PI * 2);
      ctx.fillStyle = confidence > 0.7 ? "#22c55e" : "#facc15";
      ctx.fill();
    }
  }, [landmarks, width, height, mirror]);

  return (
    <canvas
      ref={canvasRef}
      width={width}
      height={height}
      className="absolute inset-0 pointer-events-none"
    />
  );
}
