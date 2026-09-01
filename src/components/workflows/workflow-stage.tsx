import { useEffect, useRef, useState } from "react";
import { ScrubField } from "@/components/ui/scrub-field";
import { WorkflowCameraPreview } from "@/components/workflows/workflow-camera-preview";
import type { CameraType } from "@/types/camera";
import type { InPlaceAxisMode } from "@/utils/animation-clips";
import type {
  ResolvedWorkflowCamera,
  WorkflowCameraTarget,
} from "@/utils/workflow-camera";
import { cn } from "@/lib/utils";

/**
 * The largest box of a given aspect ratio that fits its container.
 *
 * `aspect-ratio` alone cannot honour a width cap and a height cap at once — it
 * drops the ratio as soon as both are definite, which let a 3:1 sprite render
 * 1920px wide inside a 760px column and get clipped. Measuring is the only way
 * to fit both.
 */
function useFittedBox(aspect: number) {
  const ref = useRef<HTMLDivElement>(null);
  const [box, setBox] = useState<{ width: number; height: number } | null>(null);

  useEffect(() => {
    const element = ref.current;
    if (!element) return;

    const fit = () => {
      const { width, height } = element.getBoundingClientRect();
      if (width <= 0 || height <= 0) return;
      const ratio = Number.isFinite(aspect) && aspect > 0 ? aspect : 1;
      const fittedWidth = Math.min(width, height * ratio);
      setBox({ width: fittedWidth, height: fittedWidth / ratio });
    };

    fit();
    const observer = new ResizeObserver(fit);
    observer.observe(element);
    return () => observer.disconnect();
  }, [aspect]);

  return { ref, box };
}

function Segment({
  options,
  value,
  disabled,
  onChange,
  testIds,
}: {
  options: { value: string; label: string }[];
  value: string;
  disabled?: boolean;
  onChange: (value: string) => void;
  testIds?: Record<string, string>;
}) {
  return (
    <span className="flex rounded-md border border-stroke p-px">
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          data-testid={testIds?.[option.value]}
          aria-pressed={option.value === value}
          disabled={disabled}
          onClick={() => onChange(option.value)}
          className={cn(
            "h-[17px] rounded-[4px] px-2 text-[10px] transition-colors disabled:opacity-40",
            option.value === value
              ? "bg-brand-soft font-semibold text-foreground"
              : "text-muted-foreground hover:text-foreground",
          )}
        >
          {option.label}
        </button>
      ))}
    </span>
  );
}

function TextAction({
  onClick,
  disabled,
  children,
  testId,
}: {
  onClick: () => void;
  disabled?: boolean;
  children: React.ReactNode;
  testId?: string;
}) {
  return (
    <button
      type="button"
      data-testid={testId}
      disabled={disabled}
      onClick={onClick}
      className="text-[10px] text-muted-foreground underline-offset-2 transition-colors hover:text-foreground hover:underline disabled:opacity-40 disabled:hover:no-underline"
    >
      {children}
    </button>
  );
}

export type WorkflowStageProps = {
  camera: ResolvedWorkflowCamera;
  directionLabel: string;
  previewAppliesTo: "all" | "selected";
  cameraType: CameraType;
  distanceLabel: string;
  /** Width ÷ height of the exported frame, so the preview is shaped like it. */
  frameAspect: number;
  autoFit: boolean;
  fitMargin: number;
  onAutoFitChange: (value: boolean) => void;
  onFitMarginChange: (value: number) => void;
  isRunning: boolean;
  selectedAnimation: {
    modelUuid?: string;
    animationName?: string;
    forceAnimationsInPlace?: boolean;
    forceAnimationsInPlaceMode?: InPlaceAxisMode;
  };
  canReset: boolean;
  hasSelectedOverride: boolean;
  onScopeChange: (scope: "all" | "selected") => void;
  onCameraTypeChange: (type: CameraType) => void;
  onCameraChange: (values: {
    distance?: number;
    phi?: number;
    theta?: number;
    target?: WorkflowCameraTarget;
  }) => void;
  onPreviewCameraChange: (camera: {
    distance: number;
    phi: number;
    theta: number;
  }) => void;
  onPreviewTargetChange: (target: [number, number, number]) => void;
  onReset: () => void;
  onApplyToMainDefaults: () => void;
  onSaveSelected: () => void;
  onApplyToAll: () => void;
  onClearOverride: () => void;
};

/**
 * The shot: what the camera sees, and the handful of numbers that move it.
 *
 * The preview is the largest thing in the dialog because it is the only one
 * that answers "will this look right". Its controls sit directly under it as a
 * single bar — no panel border, no repeated labels — so the picture is what the
 * eye lands on and the numbers are read only when something needs changing.
 */
export function WorkflowStage({
  camera,
  directionLabel,
  previewAppliesTo,
  cameraType,
  distanceLabel,
  frameAspect,
  autoFit,
  fitMargin,
  onAutoFitChange,
  onFitMarginChange,
  isRunning,
  selectedAnimation,
  canReset,
  hasSelectedOverride,
  onScopeChange,
  onCameraTypeChange,
  onCameraChange,
  onPreviewCameraChange,
  onPreviewTargetChange,
  onReset,
  onApplyToMainDefaults,
  onSaveSelected,
  onApplyToAll,
  onClearOverride,
}: WorkflowStageProps) {
  const { ref: previewAreaRef, box: previewBox } = useFittedBox(frameAspect);

  return (
    <section className="mx-auto flex min-h-0 w-full max-w-[760px] flex-col gap-3">
      <div className="flex items-baseline gap-2">
        <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
          Camera
        </span>
        <span className="font-mono text-[10px] text-foreground">
          {directionLabel}
        </span>
        {hasSelectedOverride && (
          <span
            title={`${directionLabel} has its own framing`}
            className="size-1 self-center rounded-full bg-brand"
          />
        )}
        <span className="ml-auto font-mono text-[10px] text-faint-foreground tabular-nums">
          φ{camera.phi.toFixed(0)}° θ{camera.theta.toFixed(0)}°{" "}
          {(camera.zoom ?? camera.distance).toFixed(2)}
        </span>
      </div>

      {/*
        The preview is shaped like the sprite it stands for.

        In a wide letterbox the model sat in the middle of a field of empty
        grid — the largest element in the dialog carrying the least
        information — because a wider viewport at the same camera distance
        simply shows more world. Matching the export's aspect ratio makes the
        frame the actual frame: what fills it here fills the sprite.
      */}
      <div
        ref={previewAreaRef}
        className="grid min-h-0 flex-1 place-items-center overflow-hidden"
      >
        <div
          style={
            previewBox
              ? { width: previewBox.width, height: previewBox.height }
              : { width: "100%", height: "100%" }
          }
        >
          <WorkflowCameraPreview
            camera={camera}
            selectedDirection={directionLabel}
            selectedAnimation={selectedAnimation}
            onCameraChange={onPreviewCameraChange}
            onTargetChange={onPreviewTargetChange}
          />
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
        <span className="flex items-center gap-1.5">
          <span className="text-[9px] uppercase tracking-wider text-faint-foreground">
            Edits
          </span>
          <Segment
            value={previewAppliesTo}
            disabled={isRunning}
            onChange={(scope) => onScopeChange(scope as "all" | "selected")}
            options={[
              { value: "all", label: "All angles" },
              { value: "selected", label: `${directionLabel} only` },
            ]}
          />
        </span>
        <span className="ml-auto flex items-center gap-1.5">
          <span className="text-[9px] uppercase tracking-wider text-faint-foreground">
            Lens
          </span>
          <Segment
            value={cameraType}
            disabled={isRunning}
            onChange={(type) => onCameraTypeChange(type as CameraType)}
            testIds={{
              perspective: "workflow-camera-projection-perspective",
              orthographic: "workflow-camera-projection-orthographic",
            }}
            options={[
              { value: "perspective", label: "Perspective" },
              { value: "orthographic", label: "Orthographic" },
            ]}
          />
        </span>
      </div>

      {/*
        Framing, where the preview makes the case for it: a default distance
        that leaves the character a speck in the frame is visible here, and
        auto-fit is the answer — it measures every clip and solves one distance
        and target that hold the widest pose. Until now it was reachable only
        from the CLI's `--fit auto`.
      */}
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
        <span className="text-[9px] uppercase tracking-wider text-faint-foreground">
          Framing
        </span>
        <Segment
          value={autoFit ? "auto" : "manual"}
          disabled={isRunning}
          onChange={(mode) => onAutoFitChange(mode === "auto")}
          options={[
            { value: "manual", label: "Manual" },
            { value: "auto", label: "Fit to animation" },
          ]}
        />
        {autoFit && (
          <span className="ml-auto w-28">
            <ScrubField
              label="Margin"
              unit="px"
              value={fitMargin}
              min={0}
              max={512}
              step={1}
              disabled={isRunning}
              aria-label="Fit margin"
              data-testid="workflow-fit-margin"
              onValueChange={onFitMarginChange}
            />
          </span>
        )}
      </div>

      <div className="grid grid-cols-3 gap-2">
        <ScrubField
          label={autoFit ? `${distanceLabel} · solved` : distanceLabel}
          value={camera.distance}
          min={0.1}
          step={0.1}
          disabled={isRunning || autoFit}
          data-testid="workflow-camera-distance-input"
          aria-label={distanceLabel}
          onValueChange={(distance) => onCameraChange({ distance })}
        />
        <ScrubField
          label="Elev"
          unit="°"
          value={camera.phi}
          min={1}
          max={179}
          step={1}
          disabled={isRunning}
          data-testid="workflow-camera-elevation-input"
          aria-label="Elevation"
          onValueChange={(phi) => onCameraChange({ phi })}
        />
        <ScrubField
          label="Rot"
          unit="°"
          value={camera.theta}
          min={0}
          max={359}
          step={1}
          disabled={isRunning}
          data-testid="workflow-camera-theta-input"
          aria-label="Direction rotation"
          onValueChange={(theta) => onCameraChange({ theta })}
        />
      </div>

      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <span className="font-mono text-[10px] text-faint-foreground tabular-nums">
          target {camera.target.map((value) => value.toFixed(2)).join(" ")}
        </span>
        <span className="ml-auto flex flex-wrap items-center gap-x-3 gap-y-1">
          <TextAction
            testId="workflow-camera-reset-button"
            disabled={isRunning || !canReset}
            onClick={onReset}
          >
            Reset
          </TextAction>
          <TextAction
            testId="workflow-camera-main-defaults-button"
            disabled={isRunning}
            onClick={onApplyToMainDefaults}
          >
            To main camera
          </TextAction>
          <TextAction
            testId="workflow-camera-apply-selected-to-all-button"
            disabled={isRunning}
            onClick={onApplyToAll}
          >
            Apply to all angles
          </TextAction>
          {/* Pinning is one idea, so it is one control that reports its state
              rather than a Save button beside a Clear button. */}
          <TextAction
            testId="workflow-camera-save-selected-button"
            disabled={isRunning}
            onClick={hasSelectedOverride ? onClearOverride : onSaveSelected}
          >
            {hasSelectedOverride ? `Unpin ${directionLabel}` : `Pin ${directionLabel}`}
          </TextAction>
        </span>
      </div>
    </section>
  );
}
