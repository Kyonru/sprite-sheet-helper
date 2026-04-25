import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { Button } from "@/components/ui/button";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Settings2 } from "lucide-react";
import type { PoseFrame } from "@/utils/pose-to-animation";
import type { PoseBoneData, BoneFrame } from "@/utils/mediapipe-to-bones";
import type { BoneRemap } from "@/utils/bone-remap";
import { ModelPreview } from "./model-preview";

const VIDEO_W = 480;
const VIDEO_H = 360;
const DEG2RAD = Math.PI / 180;

// Bone pairs to swap when mirroring left↔right
const MIRROR_PAIRS: [keyof BoneRemap, keyof BoneRemap][] = [
  ["leftShoulder", "rightShoulder"],
  ["leftArm", "rightArm"],
  ["leftForeArm", "rightForeArm"],
  ["leftUpLeg", "rightUpLeg"],
  ["leftLeg", "rightLeg"],
  ["leftFoot", "rightFoot"],
];

// Reflect a quaternion across the character's sagittal plane (x=0 in Y-up space)
function mirrorQuat(q: THREE.Quaternion): THREE.Quaternion {
  return new THREE.Quaternion(-q.x, q.y, -q.z, q.w).normalize();
}

interface Correction {
  rotX: number; // degrees — forward/backward tilt
  rotY: number; // degrees — turn left/right
  rotZ: number; // degrees — lean left/right
  mirror: boolean; // swap left↔right limbs
}

function applyCorrection(pose: PoseBoneData, c: Correction): PoseBoneData {
  const corrQuat = new THREE.Quaternion().setFromEuler(
    new THREE.Euler(
      c.rotX * DEG2RAD,
      c.rotY * DEG2RAD,
      c.rotZ * DEG2RAD,
      "YXZ",
    ),
  );

  // Apply global rotation to hips (pre-multiply = world-space correction)
  const hipsQuat = new THREE.Quaternion().multiplyQuaternions(
    corrQuat,
    pose.hips.quaternion,
  );

  let bones: BoneFrame[] = pose.bones;

  if (c.mirror) {
    const byKey = new Map<string, BoneFrame>(
      pose.bones.map((b) => [b.boneKey, b]),
    );
    const result = new Map(byKey);
    for (const [lk, rk] of MIRROR_PAIRS) {
      const lb = byKey.get(lk);
      const rb = byKey.get(rk);
      if (lb && rb) {
        result.set(lk, { ...lb, quaternion: mirrorQuat(rb.quaternion) });
        result.set(rk, { ...rb, quaternion: mirrorQuat(lb.quaternion) });
      }
    }
    bones = [...result.values()];
  }

  return { hips: { ...pose.hips, quaternion: hipsQuat }, bones };
}

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
  const [editedFrames, setEditedFrames] = useState<PoseFrame[]>([...frames]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [correction, setCorrection] = useState<Correction>({
    rotX: 0,
    rotY: 0,
    rotZ: 0,
    mirror: false,
  });
  const [correctionsOpen, setCorrectionsOpen] = useState(false);

  // Null ref — live landmarks unused in static playback mode
  const landmarksRef = useRef<
    import("@mediapipe/tasks-vision").NormalizedLandmark[] | null
  >(null);
  const staticPoseRef = useRef<PoseBoneData | null>(null);

  const clampedIndex = Math.min(
    currentIndex,
    Math.max(0, editedFrames.length - 1),
  );

  // Sync the R3F static pose ref whenever the selected frame or correction changes
  useEffect(() => {
    const frame = editedFrames[clampedIndex];
    staticPoseRef.current = frame
      ? applyCorrection(frame.data, correction)
      : null;
  }, [editedFrames, clampedIndex, correction]);

  const setCorr = (update: Partial<Correction>) =>
    setCorrection((c) => ({ ...c, ...update }));

  const handleDelete = () => {
    if (editedFrames.length === 0) return;
    const next = normaliseTime(editedFrames.filter((_, i) => i !== clampedIndex));
    setEditedFrames(next);
    setCurrentIndex(Math.min(clampedIndex, next.length - 1));
  };

  const handleTrimBefore = () => {
    setEditedFrames(normaliseTime(editedFrames.slice(clampedIndex)));
    setCurrentIndex(0);
  };

  const handleTrimAfter = () => {
    setEditedFrames(normaliseTime(editedFrames.slice(0, clampedIndex + 1)));
  };

  const handleFlip = () => {
    // Cycle rotY by 180°, clamped to [-180, 180]
    const next = ((correction.rotY + 180 + 180) % 360) - 180;
    setCorr({ rotY: next });
  };

  const currentTime = editedFrames[clampedIndex]?.time ?? 0;
  const totalTime =
    editedFrames.length > 0 ? editedFrames[editedFrames.length - 1].time : 0;

  return (
    <div className="flex flex-col gap-4 items-center">
      {/* 3D preview */}
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
            Frame {clampedIndex + 1}&nbsp;/&nbsp;{editedFrames.length}
            &nbsp;&middot;&nbsp;
            {currentTime.toFixed(2)}s&nbsp;/&nbsp;{totalTime.toFixed(2)}s
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

      {/* Frame trim / delete */}
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

      {/* Corrections panel */}
      <Collapsible
        open={correctionsOpen}
        onOpenChange={setCorrectionsOpen}
        className="w-full"
      >
        <CollapsibleTrigger asChild>
          <Button
            variant="ghost"
            size="sm"
            className="w-full justify-start gap-2 text-muted-foreground"
          >
            <Settings2 size={14} />
            Corrections{correctionsOpen ? " ▲" : " ▼"}
          </Button>
        </CollapsibleTrigger>
        <CollapsibleContent className="border rounded-md p-3 mt-1 flex flex-col gap-3">
          {/* Rotation sliders */}
          <div className="grid grid-cols-[1.5rem_1fr_2.5rem] items-center gap-x-3 gap-y-2 text-sm">
            {(
              [
                ["X", "rotX", "Tilt forward / back"],
                ["Y", "rotY", "Turn left / right"],
                ["Z", "rotZ", "Lean left / right"],
              ] as const
            ).map(([label, key, title]) => (
              <>
                <span
                  key={`${key}-label`}
                  className="text-muted-foreground text-right"
                  title={title}
                >
                  {label}
                </span>
                <input
                  key={`${key}-slider`}
                  type="range"
                  min={-180}
                  max={180}
                  step={1}
                  value={correction[key]}
                  onChange={(e) => setCorr({ [key]: Number(e.target.value) })}
                  className="accent-primary"
                />
                <span
                  key={`${key}-val`}
                  className="text-right tabular-nums text-xs"
                >
                  {correction[key]}°
                </span>
              </>
            ))}
          </div>

          {/* Mirror + Flip + Reset */}
          <div className="flex flex-wrap gap-2 items-center">
            <Button
              size="sm"
              variant={correction.mirror ? "secondary" : "outline"}
              onClick={() => setCorr({ mirror: !correction.mirror })}
            >
              ⇄ Mirror L↔R
            </Button>
            <Button size="sm" variant="outline" onClick={handleFlip}>
              ↺ Flip 180°
            </Button>
            <Button
              size="sm"
              variant="ghost"
              className="text-muted-foreground ml-auto"
              onClick={() =>
                setCorrection({ rotX: 0, rotY: 0, rotZ: 0, mirror: false })
              }
            >
              Reset
            </Button>
          </div>
        </CollapsibleContent>
      </Collapsible>

      {/* Navigation */}
      <div className="flex gap-2 justify-between w-full">
        <Button variant="outline" onClick={onBack}>
          ← Back to capture
        </Button>
        <Button
          onClick={() =>
            onConfirm(
              editedFrames.map((f) => ({
                ...f,
                data: applyCorrection(f.data, correction),
              })),
            )
          }
          disabled={editedFrames.length === 0}
        >
          Save →
        </Button>
      </div>
    </div>
  );
}
