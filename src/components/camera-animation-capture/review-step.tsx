import { useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Bone,
  Clipboard,
  ClipboardPaste,
  FlipHorizontal,
  Move3D,
  Redo2,
  Rotate3D,
  RotateCcw,
  Settings2,
  Undo2,
} from "lucide-react";
import type { PoseFrame } from "@/utils/pose-to-animation";
import type { PoseBoneData } from "@/utils/mediapipe-to-bones";
import type { BoneRemap } from "@/utils/bone-remap";
import { ModelPreview } from "./model-preview";
import {
  DEFAULT_POSE_CORRECTION,
  POSE_BONE_GROUPS,
  POSE_BONE_LABELS,
  applyPoseBoneOverrideToAllFrames,
  applyPoseCorrection,
  buildFinalPose,
  buildFinalPoseFrames,
  copyPoseFrameOverrides,
  deletePoseFrame,
  getPoseBoneEuler,
  getPoseBonePosition,
  pastePoseFrameOverrides,
  quaternionToEulerDeg,
  resetPoseBoneOverride,
  resetPoseFrameOverrides,
  setPoseBoneOverride,
  trimPoseFramesAfter,
  trimPoseFramesBefore,
  vectorToPositionOverride,
  type PoseBoneOverride,
  type PoseEditDraft,
  type PoseFrameOverrides,
} from "@/utils/pose-edit";

const PREVIEW_H = 460;

type HistoryState = {
  past: PoseEditDraft[];
  future: PoseEditDraft[];
};

interface BoneSliderRowProps {
  label: string;
  value: number;
  min?: number;
  max?: number;
  step?: number;
  onEditStart?: () => void;
  onEditEnd?: () => void;
  onChange: (value: number) => void;
}

function BoneSliderRow({
  label,
  value,
  min = -180,
  max = 180,
  step = 1,
  onEditStart,
  onEditEnd,
  onChange,
}: BoneSliderRowProps) {
  return (
    <label className="grid grid-cols-[1.5rem_1fr_3rem] items-center gap-2 text-xs">
      <span className="text-muted-foreground text-right">{label}</span>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onFocus={onEditStart}
        onBlur={onEditEnd}
        onPointerDown={onEditStart}
        onPointerUp={onEditEnd}
        onPointerCancel={onEditEnd}
        onChange={(event) => onChange(Number(event.target.value))}
        className="accent-primary"
      />
      <input
        type="number"
        min={min}
        max={max}
        step={step}
        value={value}
        onFocus={onEditStart}
        onBlur={onEditEnd}
        onKeyDown={(event) => {
          if (event.key === "Enter") onEditEnd?.();
        }}
        onChange={(event) => onChange(Number(event.target.value))}
        className="h-7 rounded border bg-background px-1 text-right tabular-nums"
      />
    </label>
  );
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
  const [draft, setDraft] = useState<PoseEditDraft>({
    frames: [...frames],
    correction: { ...DEFAULT_POSE_CORRECTION },
    overrides: {},
  });
  const [history, setHistory] = useState<HistoryState>({
    past: [],
    future: [],
  });
  const [currentIndex, setCurrentIndex] = useState(0);
  const [selectedBone, setSelectedBone] = useState<string | null>(null);
  const [transformMode, setTransformMode] = useState<"rotate" | "translate">(
    "rotate",
  );
  const [globalTransformMode, setGlobalTransformMode] = useState<
    "rotate" | "translate"
  >("rotate");
  const [copiedPose, setCopiedPose] = useState<PoseFrameOverrides | null>(null);

  const landmarksRef =
    useRef<import("@mediapipe/tasks-vision").NormalizedLandmark[] | null>(null);
  const staticPoseRef = useRef<PoseBoneData | null>(null);
  const historyTransactionRef = useRef<PoseEditDraft | null>(null);

  const clampedIndex = Math.min(
    currentIndex,
    Math.max(0, draft.frames.length - 1),
  );
  const currentFrame = draft.frames[clampedIndex];
  const frameOverrides = useMemo(
    () => draft.overrides[clampedIndex] ?? {},
    [draft.overrides, clampedIndex],
  );
  const currentBones = useMemo(
    () => currentFrame?.data.bones ?? [],
    [currentFrame],
  );
  const selectedBoneData =
    currentBones.find((bone) => bone.boneKey === selectedBone) ??
    currentBones[0];
  const selectedBoneKey = selectedBoneData?.boneKey ?? null;
  const selectedBoneEuler = selectedBoneKey
    ? getPoseBoneEuler(
        currentFrame,
        draft.correction,
        frameOverrides,
        selectedBoneKey,
      )
    : { x: 0, y: 0, z: 0 };
  const selectedBonePosition = selectedBoneKey
    ? getPoseBonePosition(
        currentFrame,
        draft.correction,
        frameOverrides,
        selectedBoneKey,
      )
    : { x: 0, y: 0, z: 0 };

  const mappedBoneKeys = useMemo(
    () => new Set(currentBones.map((bone) => bone.boneKey)),
    [currentBones],
  );

  useEffect(() => {
    const frame = draft.frames[clampedIndex];
    staticPoseRef.current = frame
      ? buildFinalPose(frame, draft.correction, frameOverrides)
      : null;
  }, [draft, clampedIndex, frameOverrides]);

  useEffect(() => {
    if (!selectedBoneKey && currentBones[0]) {
      setSelectedBone(currentBones[0].boneKey);
    }
  }, [currentBones, selectedBoneKey]);

  const pushHistory = (previous: PoseEditDraft) => {
    setHistory((state) => ({
      past: [...state.past, previous].slice(-60),
      future: [],
    }));
  };

  const beginHistoryTransaction = () => {
    setDraft((current) => {
      if (!historyTransactionRef.current) {
        historyTransactionRef.current = current;
      }
      return current;
    });
  };

  const endHistoryTransaction = () => {
    setDraft((current) => {
      const previous = historyTransactionRef.current;
      historyTransactionRef.current = null;
      if (previous && previous !== current) pushHistory(previous);
      return current;
    });
  };

  const commitDraft = (updater: (current: PoseEditDraft) => PoseEditDraft) => {
    setDraft((current) => {
      const next = updater(current);
      if (next !== current && !historyTransactionRef.current) {
        pushHistory(current);
      }
      return next;
    });
  };

  const undo = () => {
    historyTransactionRef.current = null;
    setHistory((state) => {
      const previous = state.past.at(-1);
      if (!previous) return state;
      setDraft(() => {
        setCurrentIndex((index) =>
          Math.min(index, Math.max(0, previous.frames.length - 1)),
        );
        return previous;
      });
      return {
        past: state.past.slice(0, -1),
        future: [draft, ...state.future].slice(0, 60),
      };
    });
  };

  const redo = () => {
    historyTransactionRef.current = null;
    setHistory((state) => {
      const next = state.future[0];
      if (!next) return state;
      setDraft(() => {
        setCurrentIndex((index) =>
          Math.min(index, Math.max(0, next.frames.length - 1)),
        );
        return next;
      });
      return {
        past: [...state.past, draft].slice(-60),
        future: state.future.slice(1),
      };
    });
  };

  const updateCorrection = (
    update: Partial<PoseEditDraft["correction"]>,
  ) => {
    commitDraft((current) => ({
      ...current,
      correction: { ...current.correction, ...update },
    }));
  };

  const setBoneEuler = (boneKey: string, euler: PoseBoneOverride) => {
    commitDraft((current) => ({
      ...current,
      overrides: setPoseBoneOverride(
        current.overrides,
        clampedIndex,
        boneKey,
        {
          ...euler,
          position: current.overrides[clampedIndex]?.[boneKey]?.position,
        },
      ),
    }));
  };

  const setBonePosition = (
    boneKey: string,
    position: NonNullable<PoseBoneOverride["position"]>,
  ) => {
    commitDraft((current) => {
      const rotation = getPoseBoneEuler(
        current.frames[clampedIndex],
        current.correction,
        current.overrides[clampedIndex] ?? {},
        boneKey,
      );
      return {
        ...current,
        overrides: setPoseBoneOverride(
          current.overrides,
          clampedIndex,
          boneKey,
          { ...rotation, position },
        ),
      };
    });
  };

  const setBoneAxis = (
    boneKey: string,
    axis: "x" | "y" | "z",
    value: number,
  ) => {
    const current = getPoseBoneEuler(
      currentFrame,
      draft.correction,
      frameOverrides,
      boneKey,
    );
    setBoneEuler(boneKey, { ...current, [axis]: value });
  };

  const setBonePositionAxis = (
    boneKey: string,
    axis: keyof NonNullable<PoseBoneOverride["position"]>,
    value: number,
  ) => {
    const current = getPoseBonePosition(
      currentFrame,
      draft.correction,
      frameOverrides,
      boneKey,
    );
    setBonePosition(boneKey, { ...current, [axis]: value });
  };

  const resetBone = (boneKey: string) => {
    commitDraft((current) => ({
      ...current,
      overrides: resetPoseBoneOverride(current.overrides, clampedIndex, boneKey),
    }));
  };

  const applyBoneToAllFrames = (boneKey: string) => {
    commitDraft((current) => ({
      ...current,
      overrides: applyPoseBoneOverrideToAllFrames(
        current.overrides,
        current.frames,
        clampedIndex,
        boneKey,
      ),
    }));
  };

  const mirrorCurrentPose = () => {
    if (!currentFrame) return;
    commitDraft((current) => {
      const finalPose = buildFinalPose(
        current.frames[clampedIndex],
        current.correction,
        current.overrides[clampedIndex] ?? {},
      );
      const mirrored = applyPoseCorrection(finalPose, {
        ...DEFAULT_POSE_CORRECTION,
        mirror: true,
      });
      const overrides: PoseFrameOverrides = {};
      mirrored.bones.forEach((bone) => {
        const override = quaternionToEulerDeg(bone.quaternion);
        if (bone.position) {
          override.position = vectorToPositionOverride(bone.position);
        }
        overrides[bone.boneKey] = override;
      });
      return {
        ...current,
        overrides: { ...current.overrides, [clampedIndex]: overrides },
      };
    });
  };

  const clearAllEdits = () => {
    commitDraft((current) => ({
      ...current,
      correction: { ...DEFAULT_POSE_CORRECTION },
      overrides: {},
    }));
  };

  const resetCurrentPose = () => {
    commitDraft((current) => ({
      ...current,
      overrides: resetPoseFrameOverrides(current.overrides, clampedIndex),
    }));
  };

  const copyCurrentPose = () => {
    setCopiedPose(copyPoseFrameOverrides(draft.overrides, clampedIndex));
  };

  const pasteCurrentPose = () => {
    if (!copiedPose) return;
    commitDraft((current) => ({
      ...current,
      overrides: pastePoseFrameOverrides(
        current.overrides,
        clampedIndex,
        copiedPose,
      ),
    }));
  };

  const handleDelete = () => {
    if (!currentFrame) return;
    commitDraft((current) => deletePoseFrame(current, clampedIndex));
    setCurrentIndex((index) => Math.max(0, Math.min(index, draft.frames.length - 2)));
  };

  const handleTrimBefore = () => {
    commitDraft((current) => trimPoseFramesBefore(current, clampedIndex));
    setCurrentIndex(0);
  };

  const handleTrimAfter = () => {
    commitDraft((current) => trimPoseFramesAfter(current, clampedIndex));
  };

  const hasSelectedOverride =
    !!selectedBoneKey && !!frameOverrides[selectedBoneKey];
  const overrideCount = Object.keys(frameOverrides).length;
  const totalTime =
    draft.frames.length > 0 ? draft.frames[draft.frames.length - 1].time : 0;
  const currentTime = currentFrame?.time ?? 0;

  return (
    <div className="flex min-h-0 flex-col gap-3">
      <div className="grid min-h-0 grid-cols-[minmax(420px,1fr)_360px] gap-3 max-lg:grid-cols-1">
        <div className="flex min-h-0 flex-col gap-2">
          <div
            className="overflow-hidden rounded-md border bg-muted"
            style={{ width: "100%", height: PREVIEW_H }}
          >
            <ModelPreview
              modelUuid={modelUuid}
              landmarksRef={landmarksRef}
              remap={remap}
              staticPoseRef={staticPoseRef}
              transformMode={transformMode}
              selectedBoneKey={selectedBoneKey}
              onSelectBone={setSelectedBone}
              onBoneEulerChange={setBoneEuler}
              onBonePositionChange={setBonePosition}
              onGizmoEditStart={beginHistoryTransaction}
              onGizmoEditEnd={endHistoryTransaction}
            />
          </div>

          <div className="flex flex-wrap items-center gap-2 rounded-md border px-3 py-2">
            <span className="text-sm text-muted-foreground">
              {draft.frames.length === 0
                ? "No frames"
                : `Frame ${clampedIndex + 1} / ${draft.frames.length} · ${currentTime.toFixed(2)}s / ${totalTime.toFixed(2)}s`}
            </span>
            <div className="ml-auto flex gap-1">
              <Button
                size="icon"
                variant="ghost"
                onClick={undo}
                disabled={history.past.length === 0}
                title="Undo"
              >
                <Undo2 size={15} />
              </Button>
              <Button
                size="icon"
                variant="ghost"
                onClick={redo}
                disabled={history.future.length === 0}
                title="Redo"
              >
                <Redo2 size={15} />
              </Button>
            </div>
          </div>

          <input
            type="range"
            className="w-full accent-primary"
            min={0}
            max={Math.max(0, draft.frames.length - 1)}
            step={1}
            value={clampedIndex}
            disabled={draft.frames.length === 0}
            onChange={(event) => setCurrentIndex(Number(event.target.value))}
          />

          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleTrimBefore}
              disabled={draft.frames.length === 0 || clampedIndex === 0}
              title="Keep from this frame onward"
            >
              Trim start
            </Button>
            <Button
              variant="destructive"
              size="sm"
              onClick={handleDelete}
              disabled={draft.frames.length === 0}
            >
              Delete frame
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleTrimAfter}
              disabled={
                draft.frames.length === 0 ||
                clampedIndex === draft.frames.length - 1
              }
              title="Keep up to this frame"
            >
              Trim end
            </Button>
          </div>
        </div>

        <div className="flex min-h-0 flex-col gap-3">
          <section className="rounded-md border">
            <div className="flex items-center gap-2 border-b px-3 py-2 text-sm font-medium">
              <Bone size={15} />
              Bones
              {overrideCount > 0 && (
                <span className="ml-auto text-xs text-primary">
                  {overrideCount} edited
                </span>
              )}
            </div>
            <div className="max-h-56 overflow-y-auto p-2">
              {POSE_BONE_GROUPS.map((group) => (
                <div key={group.label} className="mb-2 last:mb-0">
                  <p className="px-1 pb-1 text-xs font-medium uppercase text-muted-foreground">
                    {group.label}
                  </p>
                  <div className="grid grid-cols-2 gap-1">
                    {group.keys
                      .filter((key) => mappedBoneKeys.has(key))
                      .map((key) => {
                        const hasOverride = !!frameOverrides[key];
                        const selected = selectedBoneKey === key;
                        return (
                          <Button
                            key={key}
                            type="button"
                            size="sm"
                            variant={selected ? "secondary" : "ghost"}
                            className="h-8 justify-start gap-1 px-2 text-xs"
                            onClick={() => setSelectedBone(key)}
                          >
                            <span className="truncate">
                              {POSE_BONE_LABELS[key] ?? key}
                            </span>
                            {hasOverride && (
                              <span className="ml-auto text-primary">●</span>
                            )}
                          </Button>
                        );
                      })}
                  </div>
                </div>
              ))}
            </div>
          </section>

          <section className="rounded-md border">
            <div className="flex items-center gap-2 border-b px-3 py-2 text-sm font-medium">
              <Settings2 size={15} />
              Selected Bone
              {selectedBoneKey && (
                <span className="ml-auto text-xs text-muted-foreground">
                  {POSE_BONE_LABELS[selectedBoneKey as keyof BoneRemap] ??
                    selectedBoneKey}
                </span>
              )}
            </div>
            <div className="flex flex-col gap-2 p-3">
              {selectedBoneKey ? (
                <>
                  <div className="grid grid-cols-2 gap-2">
                    <Button
                      type="button"
                      size="sm"
                      variant={transformMode === "rotate" ? "secondary" : "outline"}
                      onClick={() => setTransformMode("rotate")}
                    >
                      <Rotate3D size={14} />
                      Rotate
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant={
                        transformMode === "translate" ? "secondary" : "outline"
                      }
                      onClick={() => setTransformMode("translate")}
                    >
                      <Move3D size={14} />
                      Move
                    </Button>
                  </div>
                  {transformMode === "rotate" ? (
                    <>
                      <BoneSliderRow
                        label="X"
                        value={selectedBoneEuler.x}
                        onEditStart={beginHistoryTransaction}
                        onEditEnd={endHistoryTransaction}
                        onChange={(value) =>
                          setBoneAxis(selectedBoneKey, "x", value)
                        }
                      />
                      <BoneSliderRow
                        label="Y"
                        value={selectedBoneEuler.y}
                        onEditStart={beginHistoryTransaction}
                        onEditEnd={endHistoryTransaction}
                        onChange={(value) =>
                          setBoneAxis(selectedBoneKey, "y", value)
                        }
                      />
                      <BoneSliderRow
                        label="Z"
                        value={selectedBoneEuler.z}
                        onEditStart={beginHistoryTransaction}
                        onEditEnd={endHistoryTransaction}
                        onChange={(value) =>
                          setBoneAxis(selectedBoneKey, "z", value)
                        }
                      />
                    </>
                  ) : (
                    <>
                      <BoneSliderRow
                        label="X"
                        min={-100}
                        max={100}
                        step={0.1}
                        value={selectedBonePosition.x}
                        onEditStart={beginHistoryTransaction}
                        onEditEnd={endHistoryTransaction}
                        onChange={(value) =>
                          setBonePositionAxis(selectedBoneKey, "x", value)
                        }
                      />
                      <BoneSliderRow
                        label="Y"
                        min={-100}
                        max={100}
                        step={0.1}
                        value={selectedBonePosition.y}
                        onEditStart={beginHistoryTransaction}
                        onEditEnd={endHistoryTransaction}
                        onChange={(value) =>
                          setBonePositionAxis(selectedBoneKey, "y", value)
                        }
                      />
                      <BoneSliderRow
                        label="Z"
                        min={-100}
                        max={100}
                        step={0.1}
                        value={selectedBonePosition.z}
                        onEditStart={beginHistoryTransaction}
                        onEditEnd={endHistoryTransaction}
                        onChange={(value) =>
                          setBonePositionAxis(selectedBoneKey, "z", value)
                        }
                      />
                    </>
                  )}
                  <div className="flex gap-2 pt-1">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => resetBone(selectedBoneKey)}
                      disabled={!hasSelectedOverride}
                    >
                      Reset
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="ml-auto"
                      onClick={() => applyBoneToAllFrames(selectedBoneKey)}
                      disabled={!hasSelectedOverride || draft.frames.length <= 1}
                    >
                      Apply to all
                    </Button>
                  </div>
                </>
              ) : (
                <p className="text-sm text-muted-foreground">No mapped bones.</p>
              )}
            </div>
          </section>

          <section className="rounded-md border">
            <div className="border-b px-3 py-2 text-sm font-medium">
              Pose Actions
            </div>
            <div className="grid grid-cols-2 gap-2 p-3">
              <Button
                size="sm"
                variant="outline"
                onClick={mirrorCurrentPose}
                disabled={!currentFrame}
              >
                <FlipHorizontal size={14} />
                Mirror current
              </Button>
              <Button
                size="sm"
                variant={draft.correction.mirror ? "secondary" : "outline"}
                onClick={() =>
                  updateCorrection({ mirror: !draft.correction.mirror })
                }
              >
                <FlipHorizontal size={14} />
                Mirror all
              </Button>
              <Button size="sm" variant="outline" onClick={copyCurrentPose}>
                <Clipboard size={14} />
                Copy pose
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={pasteCurrentPose}
                disabled={!copiedPose}
              >
                <ClipboardPaste size={14} />
                Paste pose
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  const next =
                    ((draft.correction.rotY + 180 + 180) % 360) - 180;
                  updateCorrection({ rotY: next });
                }}
              >
                <RotateCcw size={14} />
                Flip 180
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={resetCurrentPose}
                disabled={!currentFrame}
              >
                Reset current
              </Button>
              <Button
                size="sm"
                variant="ghost"
                className="col-span-2 text-muted-foreground"
                onClick={clearAllEdits}
              >
                Reset all edits
              </Button>
            </div>
          </section>

          <section className="rounded-md border">
            <div className="border-b px-3 py-2 text-sm font-medium">
              Global Correction
            </div>
            <div className="flex flex-col gap-2 p-3">
              <div className="grid grid-cols-2 gap-2">
                <Button
                  type="button"
                  size="sm"
                  variant={
                    globalTransformMode === "rotate" ? "secondary" : "outline"
                  }
                  onClick={() => setGlobalTransformMode("rotate")}
                >
                  <Rotate3D size={14} />
                  Rotate
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant={
                    globalTransformMode === "translate"
                      ? "secondary"
                      : "outline"
                  }
                  onClick={() => setGlobalTransformMode("translate")}
                >
                  <Move3D size={14} />
                  Move
                </Button>
              </div>
              {globalTransformMode === "rotate" ? (
                <>
                  <BoneSliderRow
                    label="X"
                    value={draft.correction.rotX}
                    onEditStart={beginHistoryTransaction}
                    onEditEnd={endHistoryTransaction}
                    onChange={(value) => updateCorrection({ rotX: value })}
                  />
                  <BoneSliderRow
                    label="Y"
                    value={draft.correction.rotY}
                    onEditStart={beginHistoryTransaction}
                    onEditEnd={endHistoryTransaction}
                    onChange={(value) => updateCorrection({ rotY: value })}
                  />
                  <BoneSliderRow
                    label="Z"
                    value={draft.correction.rotZ}
                    onEditStart={beginHistoryTransaction}
                    onEditEnd={endHistoryTransaction}
                    onChange={(value) => updateCorrection({ rotZ: value })}
                  />
                </>
              ) : (
                <>
                  <BoneSliderRow
                    label="X"
                    min={-100}
                    max={100}
                    step={0.1}
                    value={draft.correction.moveX ?? 0}
                    onEditStart={beginHistoryTransaction}
                    onEditEnd={endHistoryTransaction}
                    onChange={(value) => updateCorrection({ moveX: value })}
                  />
                  <BoneSliderRow
                    label="Y"
                    min={-100}
                    max={100}
                    step={0.1}
                    value={draft.correction.moveY ?? 0}
                    onEditStart={beginHistoryTransaction}
                    onEditEnd={endHistoryTransaction}
                    onChange={(value) => updateCorrection({ moveY: value })}
                  />
                  <BoneSliderRow
                    label="Z"
                    min={-100}
                    max={100}
                    step={0.1}
                    value={draft.correction.moveZ ?? 0}
                    onEditStart={beginHistoryTransaction}
                    onEditEnd={endHistoryTransaction}
                    onChange={(value) => updateCorrection({ moveZ: value })}
                  />
                </>
              )}
            </div>
          </section>
        </div>
      </div>

      <div className="flex gap-2 justify-between">
        <Button variant="outline" onClick={onBack}>
          Back to capture
        </Button>
        <Button
          disabled={draft.frames.length === 0}
          onClick={() => onConfirm(buildFinalPoseFrames(draft))}
        >
          Save
        </Button>
      </div>
    </div>
  );
}
