import { useCallback, useEffect, useState } from "react";
import {
  MenubarContent,
  MenubarGroup,
  MenubarItem,
  MenubarMenu,
  MenubarSeparator,
  MenubarTrigger,
} from "@/components/ui/menubar";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { CircleCheckIcon, LoaderCircleIcon, WorkflowIcon } from "lucide-react";
import { useWorkflow } from "@/hooks/next/use-workflow";
import {
  WORKFLOW_PRESETS,
  type WorkflowDefinition,
  type WorkflowId,
} from "@/constants/workflows";
import { useSettingsStore } from "@/store/next/settings";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { EventType, PubSub } from "@/lib/events";

export const WorkflowsMenu = () => {
  const [selectedWorkflow, setSelectedWorkflow] =
    useState<WorkflowDefinition | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);

  const {
    workflowState,
    runWorkflow,
    abortWorkflow,
    buildSteps,
    resetWorkflow,
    presets,
  } = useWorkflow();

  const cameraDistance = useSettingsStore((state) => state.cameraDistance);

  const steps = selectedWorkflow ? buildSteps(selectedWorkflow) : [];
  const isRunning = workflowState.status === "running";
  const isDone = workflowState.status === "done";

  const onSelectWorkflow = useCallback(
    (workflow: WorkflowDefinition) => {
      setSelectedWorkflow(workflow);
      resetWorkflow();
      setDialogOpen(true);
    },
    [setSelectedWorkflow, resetWorkflow, setDialogOpen],
  );

  const onRun = async () => {
    if (!selectedWorkflow) return;
    await runWorkflow(selectedWorkflow);
  };

  const onClose = () => {
    if (isRunning) return;
    setDialogOpen(false);
    setSelectedWorkflow(null);
  };

  useEffect(() => {
    const setWorkflow = (workflowId: WorkflowId) => {
      const workflow = WORKFLOW_PRESETS.find((w) => w.id === workflowId);
      if (!workflow) return;
      onSelectWorkflow(workflow);
    };

    PubSub.on(EventType.SET_WORKFLOW, setWorkflow);
    return () => {
      PubSub.off(EventType.SET_WORKFLOW, setWorkflow);
    };
  }, [onSelectWorkflow]);

  useEffect(() => {
    const onStartWorkflow = () => {
      if (!selectedWorkflow) return;
      runWorkflow(selectedWorkflow);
    };

    PubSub.on(EventType.START_WORKFLOW, onStartWorkflow);

    return () => {
      PubSub.off(EventType.START_WORKFLOW, onStartWorkflow);
    };
  }, [selectedWorkflow, runWorkflow]);

  return (
    <>
      <MenubarMenu>
        <MenubarTrigger>
          <WorkflowIcon className="w-4 h-4" />
        </MenubarTrigger>
        <MenubarContent className="z-999">
          <MenubarGroup>
            <MenubarItem disabled className="text-muted-foreground text-xs">
              Auto-capture workflows
            </MenubarItem>
          </MenubarGroup>
          <MenubarSeparator />
          <MenubarGroup>
            {presets.map((workflow) => (
              <MenubarItem
                key={workflow.id}
                onSelect={() => onSelectWorkflow(workflow)}
                disabled={isRunning}
              >
                {workflow.label}
              </MenubarItem>
            ))}
          </MenubarGroup>
        </MenubarContent>
      </MenubarMenu>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-lg" showCloseButton={!isRunning}>
          <DialogHeader>
            <DialogTitle>{selectedWorkflow?.label ?? "Workflow"}</DialogTitle>
            <DialogDescription>
              {selectedWorkflow?.description}
            </DialogDescription>
          </DialogHeader>

          <div className="flex flex-col gap-2">
            <div className="flex items-center gap-2">
              <div className="grid flex-1 gap-2">
                <Label htmlFor="camera-distance">Camera distance</Label>
                <Input
                  id="camera-distance"
                  type="number"
                  defaultValue={cameraDistance}
                  disabled={isRunning}
                  onChange={(e) =>
                    useSettingsStore
                      .getState()
                      .setCameraDistance(parseFloat(e.target.value))
                  }
                />
              </div>
            </div>
            <p className="text-sm font-medium">
              Will generate {steps.length} sequence
              {steps.length !== 1 ? "s" : ""}:
            </p>

            <div className="max-h-60 overflow-y-auto rounded border p-2 flex flex-col gap-1">
              {steps.map((step, i) => {
                const isCurrentStep =
                  isRunning && i + 1 === workflowState.currentStep;
                const isPast = isRunning
                  ? i + 1 < workflowState.currentStep
                  : isDone;

                return (
                  <div
                    key={step.rowLabel}
                    className={`flex items-center justify-between rounded px-2 py-1 text-sm gap-2 ${
                      isCurrentStep
                        ? "bg-primary/10 border border-primary/30"
                        : ""
                    } ${isPast ? "opacity-40" : ""}`}
                  >
                    <span className="font-mono flex-1">{step.rowLabel}</span>
                    <span className="text-muted-foreground text-xs">
                      {step.animationName} · {step.directionLabel}
                    </span>
                    {isPast && (
                      <CircleCheckIcon className="w-3 h-3 text-green-500 shrink-0" />
                    )}
                    {isCurrentStep && (
                      <LoaderCircleIcon className="w-3 h-3 animate-spin shrink-0" />
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {isRunning && (
            <div className="flex flex-col gap-1">
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>Capturing: {workflowState.currentLabel}</span>
                <span>
                  {workflowState.currentStep} / {workflowState.totalSteps}
                </span>
              </div>
              <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
                <div
                  className="h-full bg-primary transition-all duration-200"
                  style={{
                    width: `${(workflowState.currentStep / workflowState.totalSteps) * 100}%`,
                  }}
                />
              </div>
            </div>
          )}

          {isDone && (
            <p className="text-sm text-green-500 flex items-center gap-1">
              <CircleCheckIcon className="w-4 h-4" />
              All sequences captured successfully.
            </p>
          )}

          {workflowState.status === "error" && (
            <p className="text-sm text-destructive">
              Error: {workflowState.error}
            </p>
          )}

          <DialogFooter>
            {isRunning ? (
              <Button variant="destructive" onClick={abortWorkflow}>
                Cancel
              </Button>
            ) : isDone ? (
              <Button onClick={onClose}>Close</Button>
            ) : (
              <>
                <Button variant="outline" onClick={onClose}>
                  Cancel
                </Button>
                <Button
                  id="run-workflow-button"
                  onClick={onRun}
                  disabled={steps.length === 0}
                >
                  Run Workflow ({steps.length} sequences)
                </Button>
              </>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};
