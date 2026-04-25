import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import type { PoseFrame } from "@/utils/pose-to-animation";
import type { PoseBoneData } from "@/utils/mediapipe-to-bones";
import type { BoneRemap } from "@/utils/bone-remap";
import { ModelPreview } from "./model-preview";

const VIDEO_W = 480;
const VIDEO_H = 360;

function normaliseTime(frames: PoseFrame[]): PoseFrame[] {
  if (frames.length === 0) return [];
  const offset = frames[0].time;
  return frames.map((f) => ({ ...f, time: f.time - offset }));
}

interface Props {
  frames: PoseFrame[];
  remap: BoneRemap;
  modelUuid: string;
  onConfirm: (frames: PoseFrame[]) => void;
  onBack: () => void;
}

export function ReviewStep({
  frames,
  remap,
  modelUuid,
  onConfirm,
  onBack,
}: Props) {
  const [editedFrames, setEditedFrames] = useState<PoseFrame[]>([
    ...frames,
  ]);
  const [currentIndex, setCurrentIndex] = useState(0);

  // Null ref — never receives live landmarks; static pose drives the model instead
  const landmarksRef = useRef<
    import("@mediapipe/tasks-vision").NormalizedLandmark[] | null
  >(null);
  const staticPoseRef = useRef<PoseBoneData | null>(null);

  // Keep staticPoseRef in sync so the R3F loop picks up the current frame
  useEffect(() => {
    staticPoseRef.current = editedFrames[currentIndex]?.data ?? null;
  }, [editedFrames, currentIndex]);

  const clampedIndex = Math.min(currentIndex, editedFrames.length - 1);

  const handleDelete = () => {
    if (editedFrames.length === 0) return;
    const next = editedFrames.filter((_, i) => i !== clampedIndex);
    setEditedFrames(normaliseTime(next));
    setCurrentIndex(Math.min(clampedIndex, next.length - 1));
  };

  const handleTrimBefore = () => {
    const next = editedFrames.slice(clampedIndex);
    setEditedFrames(normaliseTime(next));
    setCurrentIndex(0);
  };

  const handleTrimAfter = () => {
    const next = editedFrames.slice(0, clampedIndex + 1);
    setEditedFrames(normaliseTime(next));
    setCurrentIndex(next.length - 1);
  };

  const currentTime = editedFrames[clampedIndex]?.time ?? 0;
  const totalTime =
    editedFrames.length > 0
      ? editedFrames[editedFrames.length - 1].time
      : 0;

  return (
    <div className="flex flex-col gap-4 items-center">
      <div
        className="rounded-md overflow-hidden bg-muted border"
        style={{ width: VIDEO_W, height: VIDEO_H }}
      >
        <ModelPreview
          modelUuid={modelUuid}
          landmarksRef={landmarksRef}
          remap={remap}
          staticPoseRef={staticPoseRef}
        />
      </div>

      {/* Frame info */}
      <p className="text-sm text-muted-foreground">
        {editedFrames.length === 0 ? (
          "No frames"
        ) : (
          <>
            Frame {clampedIndex + 1} / {editedFrames.length} &middot;{" "}
            {currentTime.toFixed(2)}s &nbsp;/&nbsp; {totalTime.toFixed(2)}s
          </>
        )}
      </p>

      {/* Timeline scrubber */}
      <input
        type="range"
        className="w-full accent-primary"
        min={0}
        max={Math.max(0, editedFrames.length - 1)}
        step={1}
        value={clampedIndex}
        disabled={editedFrames.length === 0}
        onChange={(e) => setCurrentIndex(Number(e.target.value))}
      />

      {/* Edit controls */}
      <div className="flex flex-wrap gap-2 justify-center">
        <Button
          variant="outline"
          size="sm"
          onClick={handleTrimBefore}
          disabled={editedFrames.length === 0 || clampedIndex === 0}
          title="Keep from this frame onward"
        >
          ⊢ Trim start
        </Button>
        <Button
          variant="destructive"
          size="sm"
          onClick={handleDelete}
          disabled={editedFrames.length === 0}
        >
          Delete frame
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={handleTrimAfter}
          disabled={
            editedFrames.length === 0 ||
            clampedIndex === editedFrames.length - 1
          }
          title="Keep up to this frame"
        >
          Trim end ⊣
        </Button>
      </div>

      {/* Navigation */}
      <div className="flex gap-2 justify-between w-full">
        <Button variant="outline" onClick={onBack}>
          ← Back to capture
        </Button>
        <Button
          onClick={() => onConfirm(editedFrames)}
          disabled={editedFrames.length === 0}
        >
          Save →
        </Button>
      </div>
    </div>
  );
}
