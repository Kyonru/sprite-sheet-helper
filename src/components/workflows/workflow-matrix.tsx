import { cn } from "@/lib/utils";
import {
  isWorkflowStepHidden,
  type WorkflowStepGroup,
} from "@/utils/workflows";

export type WorkflowMatrixProps = {
  groups: WorkflowStepGroup[];
  directionLabels: string[];
  skippedStepLabels: string[];
  hiddenAnimations: Record<string, string[]>;
  /** Frames each animation will capture, keyed by group. */
  framesByAnimation: Record<string, number>;
  selectedAnimationKey?: string;
  selectedDirectionLabel?: string;
  isRunning: boolean;
  /** Row labels already captured in this run, and the one capturing now. */
  capturedStepLabels: Set<string>;
  runningStepLabel?: string;
  onSetStepsEnabled: (labels: string[], enabled: boolean) => void;
  onSelectAnimation: (group: WorkflowStepGroup) => void;
  onSelectDirection: (label: string) => void;
};

type Coverage = "all" | "some" | "none";

function coverageOf(labels: string[], skipped: Set<string>): Coverage {
  const on = labels.filter((label) => !skipped.has(label)).length;
  if (on === 0) return "none";
  return on === labels.length ? "all" : "some";
}

/**
 * Toggles a whole row, column, or the grid.
 *
 * Drawn as a square like the cells it commands, one step quieter, so the header
 * reads as part of the grid rather than as a control bolted to it. This replaced
 * a double-click on the label — an interaction that worked but had to be
 * explained by a line of text under the grid, which is the tell that it was not
 * discoverable.
 */
function MasterToggle({
  coverage,
  label,
  disabled,
  onClick,
}: {
  coverage: Coverage;
  label: string;
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      aria-label={label}
      aria-pressed={coverage !== "none"}
      title={label}
      onClick={onClick}
      className="grid h-[22px] place-items-center rounded transition-colors hover:bg-row-hover disabled:hover:bg-transparent"
    >
      <span
        className={cn(
          "size-3 rounded-[3px] border transition-colors",
          coverage === "all"
            ? "border-brand/50 bg-brand/40"
            : coverage === "some"
              ? "border-brand/50 bg-brand/15"
              : "border-stroke-strong bg-transparent",
        )}
      />
    </button>
  );
}

/**
 * Every animation against every direction, as the grid it has always been.
 *
 * A workflow captures each clip from each angle: that is a multiplication, and
 * drawing it as one makes the sequence count something you can see rather than
 * a number to be believed. A nested list of checkboxes hid it — turning off one
 * direction across the board meant unticking a row per animation, and the two
 * ways of selecting something (an animation, an angle) had no relationship on
 * screen. Here they are the axes.
 *
 * Four targets, all visible: a cell toggles one sequence, a master square
 * toggles its row, column or the lot, and a label selects — a row picks the
 * animation the capture settings apply to, a column picks the direction the
 * camera frames.
 */
export function WorkflowMatrix({
  groups,
  directionLabels,
  skippedStepLabels,
  hiddenAnimations,
  framesByAnimation,
  selectedAnimationKey,
  selectedDirectionLabel,
  isRunning,
  capturedStepLabels,
  runningStepLabel,
  onSetStepsEnabled,
  onSelectAnimation,
  onSelectDirection,
}: WorkflowMatrixProps) {
  const skipped = new Set(skippedStepLabels);
  const allLabels = groups.flatMap((group) =>
    group.steps.map((step) => step.rowLabel),
  );
  const allCoverage = coverageOf(allLabels, skipped);
  const stepAt = (group: WorkflowStepGroup, direction: string) =>
    group.steps.find((step) => step.directionLabel === direction);

  return (
    <div className="grid gap-2">
      <div className="flex items-baseline gap-2">
        <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
          Sequences
        </span>
      </div>

      <div
        className="grid gap-x-1.5 gap-y-1 text-[11px]"
        style={{
          gridTemplateColumns: `minmax(0,1fr) repeat(${directionLabels.length}, 26px) auto`,
        }}
      >
        <span />
        {directionLabels.map((direction) => (
          <button
            key={direction}
            type="button"
            data-testid={`workflow-direction-${direction}`}
            disabled={isRunning}
            aria-pressed={direction === selectedDirectionLabel}
            title={`Frame ${direction}`}
            onClick={() => onSelectDirection(direction)}
            className={cn(
              "grid h-[20px] place-items-center rounded font-mono text-[10px] uppercase tracking-wider transition-colors",
              direction === selectedDirectionLabel
                ? "bg-brand-soft font-semibold text-foreground"
                : "text-muted-foreground hover:bg-row-hover hover:text-foreground",
            )}
          >
            {direction}
          </button>
        ))}
        <span className="self-center pe-0.5 text-right font-mono text-[9px] uppercase tracking-wider text-faint-foreground">
          Frames
        </span>

        {/* Masters: the grid's own header, in the grid's own language. The
            corner sits on the same left edge as the row masters below it. */}
        <div className="flex items-center">
          <MasterToggle
            coverage={allCoverage}
            label={
              allCoverage === "all"
                ? "Skip every sequence"
                : "Capture every sequence"
            }
            disabled={isRunning || allLabels.length === 0}
            onClick={() => onSetStepsEnabled(allLabels, allCoverage !== "all")}
          />
        </div>
        {directionLabels.map((direction) => {
          const columnLabels = groups
            .map((group) => stepAt(group, direction)?.rowLabel)
            .filter((label): label is string => Boolean(label));
          const coverage = coverageOf(columnLabels, skipped);

          return (
            <MasterToggle
              key={direction}
              coverage={coverage}
              label={`${coverage === "all" ? "Skip" : "Capture"} every ${direction} sequence`}
              disabled={isRunning || columnLabels.length === 0}
              onClick={() => onSetStepsEnabled(columnLabels, coverage !== "all")}
            />
          );
        })}
        <span />

        {groups.map((group) => {
          const groupLabels = group.steps.map((step) => step.rowLabel);
          const coverage = coverageOf(groupLabels, skipped);
          const hidden = group.steps.some((step) =>
            isWorkflowStepHidden(step, hiddenAnimations),
          );
          const selected = group.key === selectedAnimationKey;

          return (
            <div key={group.key} className="contents">
              <div className="flex items-center gap-1">
                <MasterToggle
                  coverage={coverage}
                  label={`${coverage === "all" ? "Skip" : "Capture"} every ${group.animationName} sequence`}
                  disabled={isRunning}
                  onClick={() =>
                    onSetStepsEnabled(groupLabels, coverage !== "all")
                  }
                />
                <button
                  type="button"
                  disabled={isRunning}
                  aria-pressed={selected}
                  onClick={() => onSelectAnimation(group)}
                  className={cn(
                    "flex h-[22px] min-w-0 flex-1 items-center gap-1.5 rounded px-1.5 text-left transition-colors",
                    selected
                      ? "bg-brand-soft font-semibold text-foreground"
                      : "text-muted-foreground hover:bg-row-hover hover:text-foreground",
                  )}
                >
                  <span
                    className={cn(
                      "min-w-0 truncate",
                      coverage === "none" &&
                        "text-faint-foreground line-through",
                    )}
                  >
                    {group.animationName}
                  </span>
                  {hidden && (
                    <span
                      title="Hidden in the model panel"
                      className="size-1 shrink-0 rounded-full bg-faint-foreground"
                    />
                  )}
                </button>
              </div>

              {directionLabels.map((direction) => {
                const step = stepAt(group, direction);
                if (!step) return <span key={direction} />;

                const enabled = !skipped.has(step.rowLabel);
                const captured = capturedStepLabels.has(step.rowLabel);
                const capturing = step.rowLabel === runningStepLabel;

                return (
                  <button
                    key={direction}
                    type="button"
                    disabled={isRunning}
                    aria-label={`${enabled ? "Skip" : "Capture"} ${step.rowLabel}`}
                    aria-pressed={enabled}
                    title={step.rowLabel}
                    onClick={() => onSetStepsEnabled([step.rowLabel], !enabled)}
                    className="grid h-[22px] place-items-center rounded transition-colors hover:bg-row-hover disabled:hover:bg-transparent"
                  >
                    {/*
                      A filled cell is a sequence that will exist. During a run
                      the fills sweep down the grid as each one is captured, so
                      progress is the same picture as the plan.
                    */}
                    <span
                      className={cn(
                        "size-3.5 rounded-[4px] transition-colors",
                        capturing
                          ? "animate-pulse bg-brand"
                          : captured
                            ? "bg-ok"
                            : enabled
                              ? "bg-brand/70"
                              : "border border-stroke-strong bg-transparent",
                      )}
                    />
                  </button>
                );
              })}

              <span className="self-center pe-0.5 text-right font-mono text-[11px] text-muted-foreground tabular-nums">
                {coverage === "none" ? "—" : (framesByAnimation[group.key] ?? 0)}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
