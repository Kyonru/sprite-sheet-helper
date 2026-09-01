import { ChevronDown } from "lucide-react";
import * as THREE from "three";
import type { LoopType } from "@/store/next/models";
import { ScrubField } from "@/components/ui/scrub-field";
import { Switch } from "@/components/ui/switch";
import { IN_PLACE_AXIS_OPTIONS } from "@/utils/animation-clips";
import type { InPlaceAxisMode } from "@/utils/animation-clips";
import { cn } from "@/lib/utils";

const LOOP_OPTIONS = {
  "Loop once": THREE.LoopOnce,
  "Loop repeat": THREE.LoopRepeat,
  "Ping pong": THREE.LoopPingPong,
} satisfies Record<string, LoopType>;

/**
 * A select shaped like a `ScrubField`.
 *
 * The two sat side by side as a 24px pill and a stock form control, which read
 * as two different systems. Same height, same surface, same 10px label inside
 * the box, value on the right — the only difference is the chevron that says it
 * opens.
 */
function FieldSelect({
  label,
  value,
  options,
  disabled,
  onChange,
  id,
  testId,
}: {
  /** Omitted when the row beside it already names the control. */
  label?: string;
  value: string | number;
  options: { value: string | number; label: string }[];
  disabled?: boolean;
  onChange: (value: string) => void;
  id?: string;
  testId?: string;
}) {
  return (
    <span
      className={cn(
        "group relative flex h-6 items-center gap-2 overflow-hidden rounded-md border border-stroke bg-surface-sunken px-2",
        "transition-colors hover:border-stroke-strong focus-within:border-brand-line",
        disabled && "pointer-events-none opacity-50",
      )}
    >
      {label ? (
        <span className="pointer-events-none shrink-0 text-[10px] text-muted-foreground">
          {label}
        </span>
      ) : null}
      <select
        id={id}
        data-testid={testId}
        value={value}
        disabled={disabled}
        onChange={(event) => onChange(event.target.value)}
        className="min-w-0 flex-1 cursor-pointer appearance-none bg-transparent pe-3 text-right text-[11px] text-foreground outline-none"
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      <ChevronDown
        size={10}
        aria-hidden="true"
        className="pointer-events-none absolute right-1.5 text-faint-foreground"
      />
    </span>
  );
}

function SectionTitle({
  children,
  hint,
}: {
  children: React.ReactNode;
  hint?: React.ReactNode;
}) {
  return (
    <div className="flex items-baseline gap-2">
      <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
        {children}
      </span>
      {hint ? (
        <span className="ml-auto min-w-0 truncate font-mono text-[10px] text-faint-foreground tabular-nums">
          {hint}
        </span>
      ) : null}
    </div>
  );
}

function Toggle({
  label,
  hint,
  checked,
  disabled,
  onChange,
  testId,
}: {
  label: string;
  hint?: string;
  checked: boolean;
  disabled?: boolean;
  onChange: (checked: boolean) => void;
  testId?: string;
}) {
  return (
    <label className="flex items-center justify-between gap-3">
      <span className="min-w-0">
        <span className="block text-[12px] text-foreground">{label}</span>
        {hint ? (
          <span className="mt-0.5 block text-[10px] leading-snug text-faint-foreground">
            {hint}
          </span>
        ) : null}
      </span>
      <Switch
        data-testid={testId}
        checked={checked}
        disabled={disabled}
        onCheckedChange={(next) => onChange(Boolean(next))}
        className="shrink-0"
      />
    </label>
  );
}

export type WorkflowCaptureSectionProps = {
  isRunning: boolean;
  intervalMs: number;
  frameCount: number;
  matchClipLength: boolean;
  onIntervalChange: (value: number) => void;
  onFrameCountChange: (value: number) => void;
  onMatchClipLengthChange: (value: boolean) => void;
  captureNormalMaps: boolean;
  onCaptureNormalMapsChange: (value: boolean) => void;
  showIsolateModels: boolean;
  isolateModels: boolean;
  onIsolateModelsChange: (value: boolean) => void;
  selection?: {
    animationName: string;
    intervalMs: number;
    frameCount: number;
    clipFrames: number;
    matchesClipLength: boolean;
    overruns: boolean;
    hasOverride: boolean;
    onIntervalChange: (value: number) => void;
    onFrameCountChange: (value: number) => void;
    onMatchClip: () => void;
    onReset: () => void;
  };
};

/**
 * How many frames, how far apart — stated once for the run, with the selected
 * animation's exception underneath it when it has one.
 */
export function WorkflowCaptureSection({
  isRunning,
  intervalMs,
  frameCount,
  matchClipLength,
  onIntervalChange,
  onFrameCountChange,
  onMatchClipLengthChange,
  captureNormalMaps,
  onCaptureNormalMapsChange,
  showIsolateModels,
  isolateModels,
  onIsolateModelsChange,
  selection,
}: WorkflowCaptureSectionProps) {
  return (
    <section className="grid gap-3">
      <SectionTitle
        hint={`${Math.round(1000 / Math.max(1, intervalMs))} fps${
          matchClipLength ? " · frames from clip" : ""
        }`}
      >
        Capture
      </SectionTitle>

      <div className="grid grid-cols-2 gap-2">
        <ScrubField
          label="Interval"
          unit="ms"
          value={intervalMs}
          min={1}
          max={5000}
          step={1}
          disabled={isRunning}
          aria-label="Capture interval"
          data-testid="workflow-default-frame-interval"
          onValueChange={onIntervalChange}
        />
        <ScrubField
          label="Frames"
          value={frameCount}
          min={1}
          max={1000}
          step={1}
          disabled={isRunning || matchClipLength}
          aria-label="Frames per sequence"
          data-testid="workflow-default-frame-count"
          onValueChange={onFrameCountChange}
        />
      </div>

      <Toggle
        label="Match clip length"
        hint="Each animation takes the frames its own clip is worth."
        checked={matchClipLength}
        disabled={isRunning}
        onChange={onMatchClipLengthChange}
        testId="workflow-match-clip-length"
      />

      {selection && (
        <div className="grid gap-1.5 border-s-2 border-brand-line ps-2">
          <div className="flex items-baseline gap-2">
            <span className="min-w-0 truncate text-[10px] font-semibold text-foreground">
              {selection.animationName}
            </span>
            <span
              className={cn(
                "ml-auto font-mono text-[10px] tabular-nums",
                selection.overruns ? "text-warn" : "text-faint-foreground",
              )}
            >
              {selection.overruns
                ? `${selection.frameCount - selection.clipFrames} frames repeat`
                : `clip is ${selection.clipFrames}f`}
            </span>
            {selection.hasOverride && (
              <button
                type="button"
                disabled={isRunning}
                onClick={selection.onReset}
                className="text-[10px] text-muted-foreground underline-offset-2 transition-colors hover:text-foreground hover:underline disabled:opacity-40"
              >
                Reset
              </button>
            )}
          </div>

          <div className="grid grid-cols-2 gap-1.5">
            <ScrubField
              label="Interval"
              unit="ms"
              value={selection.intervalMs}
              min={1}
              max={5000}
              step={1}
              disabled={isRunning}
              aria-label={`${selection.animationName} capture interval`}
              data-testid="workflow-animation-frame-interval"
              onValueChange={selection.onIntervalChange}
            />
            <ScrubField
              label="Frames"
              value={selection.frameCount}
              min={1}
              max={1000}
              step={1}
              disabled={isRunning || selection.matchesClipLength}
              aria-label={`${selection.animationName} frame count`}
              data-testid="workflow-animation-frame-count"
              onValueChange={selection.onFrameCountChange}
            />
          </div>

          {!selection.matchesClipLength && (
            <button
              type="button"
              disabled={isRunning}
              onClick={selection.onMatchClip}
              data-testid="workflow-animation-match-clip"
              className="justify-self-start text-[10px] text-muted-foreground underline-offset-2 transition-colors hover:text-foreground hover:underline disabled:opacity-40"
            >
              Match this clip
            </button>
          )}
        </div>
      )}

      <Toggle
        label="Normal maps"
        checked={captureNormalMaps}
        disabled={isRunning}
        onChange={onCaptureNormalMapsChange}
      />
      {showIsolateModels && (
        <Toggle
          label="One model at a time"
          hint="Hide the other models while each sequence records."
          checked={isolateModels}
          disabled={isRunning}
          onChange={onIsolateModelsChange}
          testId="workflow-isolate-models"
        />
      )}
    </section>
  );
}

export type WorkflowAnimationSectionProps = {
  isRunning: boolean;
  selection?: {
    animationName: string;
    startFrame: number;
    lengthFrames: number;
    clipFrames: number;
    fps: number;
    loop: LoopType;
    onRangeChange: (startFrame: number, lengthFrames: number) => void;
    onLoopChange: (loop: LoopType) => void;
  };
  forceInPlace: boolean;
  onForceInPlaceChange: (value: boolean) => void;
  freezeAxes: InPlaceAxisMode;
  onFreezeAxesChange: (value: InPlaceAxisMode) => void;
};

/**
 * The clip: which part of it plays, and how it plays.
 *
 * Frames here are the clip's own, at its own rate — the Capture section counts
 * the frames a capture takes at the capture rate, which is a different number
 * for the same animation. Each says which it means.
 */
export function WorkflowAnimationSection({
  isRunning,
  selection,
  forceInPlace,
  onForceInPlaceChange,
  freezeAxes,
  onFreezeAxesChange,
}: WorkflowAnimationSectionProps) {
  return (
    <section className="grid gap-3">
      <SectionTitle
        hint={
          selection
            ? `${selection.animationName} · ${Math.round(selection.fps)} fps clip`
            : "none selected"
        }
      >
        Animation
      </SectionTitle>

      {selection ? (
        <>
          <div className="grid grid-cols-[1fr_1fr_auto] items-center gap-1.5">
            <ScrubField
              label="Start"
              value={selection.startFrame}
              min={0}
              max={Math.max(0, selection.clipFrames - 1)}
              step={1}
              disabled={isRunning}
              aria-label="Trim start frame"
              data-testid="workflow-animation-start-frame"
              onValueChange={(start) =>
                selection.onRangeChange(start, selection.lengthFrames)
              }
            />
            <ScrubField
              label="Length"
              value={selection.lengthFrames}
              min={1}
              max={Math.max(1, selection.clipFrames)}
              step={1}
              disabled={isRunning}
              aria-label="Trim length in frames"
              data-testid="workflow-animation-duration-frames"
              onValueChange={(length) =>
                selection.onRangeChange(selection.startFrame, length)
              }
            />
            <span className="font-mono text-[10px] text-faint-foreground tabular-nums">
              of {selection.clipFrames}
            </span>
          </div>

          <div className="flex items-center justify-between gap-3">
            <span className="text-[12px] text-foreground">
              Looping
              <span className="ms-1 text-[10px] text-faint-foreground">
                playback only
              </span>
            </span>
            <FieldSelect
              testId="workflow-animation-loop"
              value={selection.loop}
              disabled={isRunning}
              onChange={(next) =>
                selection.onLoopChange(Number(next) as LoopType)
              }
              options={Object.entries(LOOP_OPTIONS).map(([label, value]) => ({
                value,
                label,
              }))}
            />
          </div>
        </>
      ) : (
        <p className="text-[10px] leading-snug text-faint-foreground">
          Pick an animation in the grid to trim it or change how it plays back.
        </p>
      )}

      <Toggle
        label="Force in place"
        hint="Keep root motion from walking the character out of frame."
        checked={forceInPlace}
        disabled={isRunning}
        onChange={onForceInPlaceChange}
      />

      {forceInPlace && (
        <div className="flex items-center justify-between gap-3">
          <span className="text-[12px] text-foreground">Freeze axes</span>
          <FieldSelect
            id="workflow-force-in-place-mode"
            value={freezeAxes ?? "all"}
            disabled={isRunning}
            onChange={(next) => onFreezeAxesChange(next as InPlaceAxisMode)}
            options={Object.entries(IN_PLACE_AXIS_OPTIONS).map(
              ([label, value]) => ({ value, label }),
            )}
          />
        </div>
      )}
    </section>
  );
}
