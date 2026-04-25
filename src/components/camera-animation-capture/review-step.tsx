import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { Button } from "@/components/ui/button";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Settings2, Bone } from "lucide-react";
import type { PoseFrame } from "@/utils/pose-to-animation";
import type { PoseBoneData, BoneFrame } from "@/utils/mediapipe-to-bones";
import type { BoneRemap } from "@/utils/bone-remap";
import { ModelPreview } from "./model-preview";

const VIDEO_W = 480;
const VIDEO_H = 360;
const DEG2RAD = Math.PI / 180;

// ── Mirror helpers ────────────────────────────────────────────────────────────

const MIRROR_PAIRS: [keyof BoneRemap, keyof BoneRemap][] = [
  ["leftShoulder", "rightShoulder"],
  ["leftArm", "rightArm"],
  ["leftForeArm", "rightForeArm"],
  ["leftUpLeg", "rightUpLeg"],
  ["leftLeg", "rightLeg"],
  ["leftFoot", "rightFoot"],
];

function mirrorQuat(q: THREE.Quaternion): THREE.Quaternion {
  return new THREE.Quaternion(-q.x, q.y, -q.z, q.w).normalize();
}

// ── Types ─────────────────────────────────────────────────────────────────────

interface Correction {
  rotX: number;
  rotY: number;
  rotZ: number;
  mirror: boolean;
}

/** Absolute euler angles in degrees, stored per boneKey per frame index. */
type EulerOverride = { x: number; y: number; z: number };
/** All overrides for a single frame: boneKey → euler. */
type FrameOverrides = Record<string, EulerOverride>;
/** All overrides across all frames: frameIndex → FrameOverrides. */
type AllOverrides = Record<number, FrameOverrides>;

// ── Pure transform helpers ────────────────────────────────────────────────────

function applyCorrection(pose: PoseBoneData, c: Correction): PoseBoneData {
  const corrQuat = new THREE.Quaternion().setFromEuler(
    new THREE.Euler(c.rotX * DEG2RAD, c.rotY * DEG2RAD, c.rotZ * DEG2RAD, "YXZ"),
  );
  const hipsQuat = new THREE.Quaternion().multiplyQuaternions(
    corrQuat,
    pose.hips.quaternion,
  );

  let bones: BoneFrame[] = pose.bones;
  if (c.mirror) {
    const byKey = new Map<string, BoneFrame>(pose.bones.map((b) => [b.boneKey, b]));
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

function applyBoneOverrides(pose: PoseBoneData, overrides: FrameOverrides): PoseBoneData {
  if (Object.keys(overrides).length === 0) return pose;
  return {
    ...pose,
    bones: pose.bones.map((b) => {
      const ov = overrides[b.boneKey];
      if (!ov) return b;
      return {
        ...b,
        quaternion: new THREE.Quaternion().setFromEuler(
          new THREE.Euler(ov.x * DEG2RAD, ov.y * DEG2RAD, ov.z * DEG2RAD, "YXZ"),
        ),
      };
    }),
  };
}

function quatToEulerDeg(q: THREE.Quaternion): EulerOverride {
  const e = new THREE.Euler().setFromQuaternion(q, "YXZ");
  return {
    x: Math.round(e.x / DEG2RAD),
    y: Math.round(e.y / DEG2RAD),
    z: Math.round(e.z / DEG2RAD),
  };
}

function normaliseTime(frames: PoseFrame[]): PoseFrame[] {
  if (frames.length === 0) return [];
  const offset = frames[0].time;
  return frames.map((f) => ({ ...f, time: f.time - offset }));
}

function buildFinalPose(
  frame: PoseFrame,
  correction: Correction,
  overrides: FrameOverrides,
): PoseBoneData {
  return applyBoneOverrides(applyCorrection(frame.data, correction), overrides);
}

// ── Bone label map ────────────────────────────────────────────────────────────

const BONE_LABELS: Partial<Record<keyof BoneRemap, string>> = {
  spine: "Spine",
  spine1: "Spine 1",
  spine2: "Spine 2",
  neck: "Neck",
  head: "Head",
  leftShoulder: "L Clavicle",
  rightShoulder: "R Clavicle",
  leftArm: "L Upper Arm",
  rightArm: "R Upper Arm",
  leftForeArm: "L Forearm",
  rightForeArm: "R Forearm",
  leftUpLeg: "L Upper Leg",
  rightUpLeg: "R Upper Leg",
  leftLeg: "L Shin",
  rightLeg: "R Shin",
  leftFoot: "L Foot",
  rightFoot: "R Foot",
};

// ── Sub-components ────────────────────────────────────────────────────────────

interface BoneSliderRowProps {
  label: string;
  value: number;
  onChange: (v: number) => void;
}

function BoneSliderRow({ label, value, onChange }: BoneSliderRowProps) {
  return (
    <>
      <span className="text-muted-foreground text-right text-xs">{label}</span>
      <input
        type="range"
        min={-180}
        max={180}
        step={1}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="accent-primary"
      />
      <span className="text-right tabular-nums text-xs w-10">{value}°</span>
    </>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

interface Props {
  frames: PoseFrame[];
  remap: BoneRemap;
  modelUuid: string;
  onConfirm: (frames: PoseFrame[]) => void;
  onBack: () => void;
}

export function ReviewStep({ frames, remap, modelUuid, onConfirm, onBack }: Props) {
  const [editedFrames, setEditedFrames] = useState<PoseFrame[]>([...frames]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [correction, setCorrection] = useState<Correction>({
    rotX: 0, rotY: 0, rotZ: 0, mirror: false,
  });
  const [allOverrides, setAllOverrides] = useState<AllOverrides>({});
  const [correctionsOpen, setCorrectionsOpen] = useState(false);
  const [bonesOpen, setBonesOpen] = useState(false);
  const [expandedBone, setExpandedBone] = useState<string | null>(null);

  const landmarksRef = useRef<
    import("@mediapipe/tasks-vision").NormalizedLandmark[] | null
  >(null);
  const staticPoseRef = useRef<PoseBoneData | null>(null);

  const clampedIndex = Math.min(currentIndex, Math.max(0, editedFrames.length - 1));
  const frameOverrides = allOverrides[clampedIndex] ?? {};

  // Keep the R3F ref in sync: corrections → bone overrides → preview
  useEffect(() => {
    const frame = editedFrames[clampedIndex];
    staticPoseRef.current = frame
      ? buildFinalPose(frame, correction, allOverrides[clampedIndex] ?? {})
      : null;
  }, [editedFrames, clampedIndex, correction, allOverrides]);

  // ── Global correction helpers ──────────────────────────────────────────────

  const setCorr = (update: Partial<Correction>) =>
    setCorrection((c) => ({ ...c, ...update }));

  const handleFlip = () => {
    const next = ((correction.rotY + 180 + 180) % 360) - 180;
    setCorr({ rotY: next });
  };

  // ── Frame edit handlers ────────────────────────────────────────────────────

  const handleDelete = () => {
    if (editedFrames.length === 0) return;
    const next = normaliseTime(editedFrames.filter((_, i) => i !== clampedIndex));
    // Remove overrides for deleted frame; shift indices above it down by 1
    setAllOverrides((prev) => {
      const result: AllOverrides = {};
      for (const [k, v] of Object.entries(prev)) {
        const idx = Number(k);
        if (idx === clampedIndex) continue;
        result[idx > clampedIndex ? idx - 1 : idx] = v;
      }
      return result;
    });
    setEditedFrames(next);
    setCurrentIndex(Math.min(clampedIndex, next.length - 1));
  };

  const handleTrimBefore = () => {
    const offset = clampedIndex;
    setAllOverrides((prev) => {
      const result: AllOverrides = {};
      for (const [k, v] of Object.entries(prev)) {
        const idx = Number(k);
        if (idx < offset) continue;
        result[idx - offset] = v;
      }
      return result;
    });
    setEditedFrames(normaliseTime(editedFrames.slice(clampedIndex)));
    setCurrentIndex(0);
  };

  const handleTrimAfter = () => {
    setAllOverrides((prev) => {
      const result: AllOverrides = {};
      for (const [k, v] of Object.entries(prev)) {
        const idx = Number(k);
        if (idx <= clampedIndex) result[idx] = v;
      }
      return result;
    });
    setEditedFrames(normaliseTime(editedFrames.slice(0, clampedIndex + 1)));
  };

  // ── Per-bone override helpers ──────────────────────────────────────────────

  /** Get euler for a bone on the current frame: override if set, else derive from corrected pose. */
  const getBoneEuler = (boneKey: string): EulerOverride => {
    const existing = frameOverrides[boneKey];
    if (existing) return existing;

    const frame = editedFrames[clampedIndex];
    if (!frame) return { x: 0, y: 0, z: 0 };

    const corrected = applyCorrection(frame.data, correction);
    const bone = corrected.bones.find((b) => b.boneKey === boneKey);
    return bone ? quatToEulerDeg(bone.quaternion) : { x: 0, y: 0, z: 0 };
  };

  const setBoneAxis = (boneKey: string, axis: "x" | "y" | "z", value: number) => {
    const current = getBoneEuler(boneKey);
    setAllOverrides((prev) => ({
      ...prev,
      [clampedIndex]: {
        ...(prev[clampedIndex] ?? {}),
        [boneKey]: { ...current, [axis]: value },
      },
    }));
  };

  const resetBone = (boneKey: string) => {
    setAllOverrides((prev) => {
      const frameOvs = { ...(prev[clampedIndex] ?? {}) };
      delete frameOvs[boneKey];
      return { ...prev, [clampedIndex]: frameOvs };
    });
  };

  const applyBoneToAllFrames = (boneKey: string) => {
    const euler = frameOverrides[boneKey];
    if (!euler) return;
    setAllOverrides((prev) => {
      const next = { ...prev };
      editedFrames.forEach((_, i) => {
        next[i] = { ...(next[i] ?? {}), [boneKey]: euler };
      });
      return next;
    });
  };

  // ── Render helpers ─────────────────────────────────────────────────────────

  const currentTime = editedFrames[clampedIndex]?.time ?? 0;
  const totalTime = editedFrames.length > 0 ? editedFrames[editedFrames.length - 1].time : 0;
  const currentBones = editedFrames[clampedIndex]?.data.bones ?? [];
  const hasAnyOverride = Object.keys(frameOverrides).length > 0;

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
        <Button variant="outline" size="sm" onClick={handleTrimBefore}
          disabled={editedFrames.length === 0 || clampedIndex === 0}
          title="Keep from this frame onward">
          ⊢ Trim start
        </Button>
        <Button variant="destructive" size="sm" onClick={handleDelete}
          disabled={editedFrames.length === 0}>
          Delete frame
        </Button>
        <Button variant="outline" size="sm" onClick={handleTrimAfter}
          disabled={editedFrames.length === 0 || clampedIndex === editedFrames.length - 1}
          title="Keep up to this frame">
          Trim end ⊣
        </Button>
      </div>

      {/* ── Global Corrections ─────────────────────────────────────────────── */}
      <Collapsible open={correctionsOpen} onOpenChange={setCorrectionsOpen} className="w-full">
        <CollapsibleTrigger asChild>
          <Button variant="ghost" size="sm" className="w-full justify-start gap-2 text-muted-foreground">
            <Settings2 size={14} />
            Corrections{correctionsOpen ? " ▲" : " ▼"}
          </Button>
        </CollapsibleTrigger>
        <CollapsibleContent className="border rounded-md p-3 mt-1 flex flex-col gap-3">
          <div className="grid grid-cols-[1.5rem_1fr_2.5rem] items-center gap-x-3 gap-y-2 text-sm">
            {(
              [
                ["X", "rotX", "Tilt forward / back"],
                ["Y", "rotY", "Turn left / right"],
                ["Z", "rotZ", "Lean left / right"],
              ] as const
            ).map(([label, key, title]) => (
              <>
                <span key={`${key}-l`} className="text-muted-foreground text-right" title={title}>
                  {label}
                </span>
                <input key={`${key}-s`} type="range" min={-180} max={180} step={1}
                  value={correction[key]}
                  onChange={(e) => setCorr({ [key]: Number(e.target.value) })}
                  className="accent-primary" />
                <span key={`${key}-v`} className="text-right tabular-nums text-xs">
                  {correction[key]}°
                </span>
              </>
            ))}
          </div>
          <div className="flex flex-wrap gap-2 items-center">
            <Button size="sm" variant={correction.mirror ? "secondary" : "outline"}
              onClick={() => setCorr({ mirror: !correction.mirror })}>
              ⇄ Mirror L↔R
            </Button>
            <Button size="sm" variant="outline" onClick={handleFlip}>
              ↺ Flip 180°
            </Button>
            <Button size="sm" variant="ghost" className="text-muted-foreground ml-auto"
              onClick={() => setCorrection({ rotX: 0, rotY: 0, rotZ: 0, mirror: false })}>
              Reset
            </Button>
          </div>
        </CollapsibleContent>
      </Collapsible>

      {/* ── Per-bone Adjustments ───────────────────────────────────────────── */}
      <Collapsible open={bonesOpen} onOpenChange={setBonesOpen} className="w-full">
        <CollapsibleTrigger asChild>
          <Button variant="ghost" size="sm" className="w-full justify-start gap-2 text-muted-foreground">
            <Bone size={14} />
            Bone Adjustments
            {hasAnyOverride && (
              <span className="ml-1 text-xs text-primary">● {Object.keys(frameOverrides).length} override{Object.keys(frameOverrides).length !== 1 ? "s" : ""}</span>
            )}
            {bonesOpen ? " ▲" : " ▼"}
          </Button>
        </CollapsibleTrigger>
        <CollapsibleContent className="border rounded-md mt-1 overflow-hidden">
          {currentBones.length === 0 ? (
            <p className="p-3 text-sm text-muted-foreground">No frames captured.</p>
          ) : (
            <ul className="divide-y">
              {currentBones.map((b) => {
                const label = BONE_LABELS[b.boneKey as keyof BoneRemap] ?? b.boneKey;
                const isExpanded = expandedBone === b.boneKey;
                const hasOverride = !!frameOverrides[b.boneKey];
                const euler = getBoneEuler(b.boneKey);

                return (
                  <li key={b.boneKey}>
                    {/* Bone row header */}
                    <button
                      type="button"
                      className="w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-muted/50 transition-colors text-left"
                      onClick={() => setExpandedBone(isExpanded ? null : b.boneKey)}
                    >
                      <span className="flex-1">{label}</span>
                      {hasOverride && (
                        <span className="text-xs text-primary" title="Has override on this frame">●</span>
                      )}
                      <span className="text-muted-foreground text-xs">{isExpanded ? "▲" : "▼"}</span>
                    </button>

                    {/* Expanded: euler sliders */}
                    {isExpanded && (
                      <div className="px-3 pb-3 flex flex-col gap-2 bg-muted/30">
                        <div className="grid grid-cols-[1.5rem_1fr_2.5rem] items-center gap-x-3 gap-y-1">
                          <BoneSliderRow label="X" value={euler.x}
                            onChange={(v) => setBoneAxis(b.boneKey, "x", v)} />
                          <BoneSliderRow label="Y" value={euler.y}
                            onChange={(v) => setBoneAxis(b.boneKey, "y", v)} />
                          <BoneSliderRow label="Z" value={euler.z}
                            onChange={(v) => setBoneAxis(b.boneKey, "z", v)} />
                        </div>
                        <div className="flex gap-2 mt-1">
                          <Button size="sm" variant="ghost" className="text-muted-foreground text-xs"
                            onClick={() => resetBone(b.boneKey)} disabled={!hasOverride}>
                            Reset bone
                          </Button>
                          <Button size="sm" variant="ghost" className="text-xs ml-auto"
                            onClick={() => applyBoneToAllFrames(b.boneKey)}
                            disabled={!hasOverride || editedFrames.length <= 1}
                            title="Copy this bone's override to every frame">
                            Apply to all frames
                          </Button>
                        </div>
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </CollapsibleContent>
      </Collapsible>

      {/* Navigation */}
      <div className="flex gap-2 justify-between w-full">
        <Button variant="outline" onClick={onBack}>
          ← Back to capture
        </Button>
        <Button
          disabled={editedFrames.length === 0}
          onClick={() =>
            onConfirm(
              editedFrames.map((f, i) =>
                ({ ...f, data: buildFinalPose(f, correction, allOverrides[i] ?? {}) })
              ),
            )
          }
        >
          Save →
        </Button>
      </div>
    </div>
  );
}
