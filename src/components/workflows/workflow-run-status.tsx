import { AlertTriangle, CircleCheck } from "lucide-react";
import type { WorkflowState } from "@/hooks/next/use-workflow";
import { cn } from "@/lib/utils";

export type WorkflowRunStatusProps = {
  state: WorkflowState;
  /** Sequences the run will capture, before it starts. */
  plannedSequences: number;
  /** Frames those sequences add up to, when every count is known. */
  plannedFrames?: number;
};

/**
 * One line that says what the run is, or was.
 *
 * Before a run it is the cost of pressing the button; during, it is the
 * progress; after, the outcome. All three sit in the same place directly above
 * the button rather than appearing in three different corners.
 */
export function WorkflowRunStatus({
  state,
  plannedSequences,
  plannedFrames,
}: WorkflowRunStatusProps) {
  const running = state.status === "running";
  const progress =
    state.totalSteps > 0 ? state.currentStep / state.totalSteps : 0;
  const warnings = state.fitWarnings ?? [];

  return (
    // The status is also how a test knows the run finished: an attribute rather
    // than a sentence, so the copy can change without breaking the wait.
    <div
      className="grid min-w-0 flex-1 gap-1.5"
      data-testid="workflow-run-status"
      data-status={state.status}
      data-phase={state.phase}
    >
      <div className="flex items-baseline gap-2">
        {running ? (
          <>
            <span className="min-w-0 truncate text-[13px] font-semibold text-foreground">
              {state.phase === "measuring"
                ? "Measuring animations for auto-fit"
                : state.currentLabel || "Capturing"}
            </span>
            <span className="ml-auto shrink-0 font-mono text-[11px] text-muted-foreground tabular-nums">
              {state.currentStep}/{state.totalSteps} · frame{" "}
              {state.currentFrame}/{state.expectedFrames}
              {state.startedAt
                ? ` · ${Math.max(0, Math.round((Date.now() - state.startedAt) / 1000))}s`
                : ""}
            </span>
          </>
        ) : state.status === "done" ? (
          <>
            <CircleCheck size={12} className="shrink-0 self-center text-ok" />
            <span className="text-[13px] text-foreground">
              Captured {state.totalSteps} sequence
              {state.totalSteps === 1 ? "" : "s"}.
            </span>
          </>
        ) : state.status === "error" ? (
          <>
            <AlertTriangle
              size={12}
              className="shrink-0 self-center text-destructive"
            />
            <span className="min-w-0 text-[11px] text-destructive">
              {state.failureStep ? `${state.failureStep}: ` : ""}
              {state.error}
            </span>
          </>
        ) : state.status === "cancelled" ? (
          <span className="text-[11px] text-muted-foreground">
            Cancelled. Sequences captured before the stop are kept.
          </span>
        ) : (
          <>
            {/* The cost of pressing the button, at the size of a headline
                rather than a footnote. */}
            <span className="text-[14px] font-semibold text-foreground tabular-nums">
              {plannedSequences} sequence{plannedSequences === 1 ? "" : "s"}
            </span>
            <span className="font-mono text-[11px] text-muted-foreground tabular-nums">
              {plannedFrames === undefined
                ? "frames from each clip"
                : `${plannedFrames} frames`}
            </span>
          </>
        )}
      </div>

      {running && (
        <div className="h-1 overflow-hidden rounded-full bg-surface-sunken">
          <div
            className="h-full rounded-full bg-brand transition-[width] duration-200"
            style={{ width: `${Math.round(progress * 100)}%` }}
          />
        </div>
      )}

      {warnings.length > 0 && (
        <ul className="grid gap-1">
          {warnings.map((warning) => (
            <li
              key={warning}
              className={cn(
                "flex items-start gap-1.5 rounded-md border border-warn/40 bg-warn/10 px-2 py-1",
                "text-[10px] leading-snug text-warn",
              )}
            >
              <AlertTriangle size={11} className="mt-0.5 shrink-0" />
              {warning}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
