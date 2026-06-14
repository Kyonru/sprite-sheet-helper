import type { WorkflowDefinition } from "@/constants/workflows";

export interface WorkflowStep {
  modelUuid?: string;
  animationName: string;
  directionLabel: string;
  rowLabel: string;
}

export type WorkflowClipEntry = {
  clip: {
    name: string;
  };
};

export type BuildWorkflowStepsInput = {
  clips: Record<string, WorkflowClipEntry[]>;
  modelUuids: string[];
  hiddenAnimations?: Record<string, string[]>;
  includeHiddenAnimations?: boolean;
};

export function buildWorkflowSteps(
  workflow: WorkflowDefinition,
  {
    clips,
    modelUuids,
    hiddenAnimations = {},
    includeHiddenAnimations = false,
  }: BuildWorkflowStepsInput,
): WorkflowStep[] {
  const clipEntries = Object.entries(clips).filter(
    ([modelUuid, modelClips]) =>
      modelClips.some(
        (entry) =>
          includeHiddenAnimations ||
          !hiddenAnimations[modelUuid]?.includes(entry.clip.name),
      ),
  );

  if (clipEntries.length === 0) {
    return workflow.directions.map((dir) => ({
      animationName: "none",
      directionLabel: dir.label,
      rowLabel: `none_${dir.label}`,
    }));
  }

  const rawSteps = clipEntries.flatMap(([modelUuid, modelClips]) => {
    const hiddenNames = hiddenAnimations[modelUuid] ?? [];
    const animationNames = [
      ...new Set(
        modelClips
          .map((c) => c.clip.name)
          .filter(
            (name) => includeHiddenAnimations || !hiddenNames.includes(name),
          ),
      ),
    ];
    return animationNames.flatMap((animationName) =>
      workflow.directions.map((dir) => ({
        modelUuid,
        animationName,
        directionLabel: dir.label,
      })),
    );
  });

  const labelCounts = rawSteps.reduce<Record<string, number>>((acc, step) => {
    const label = `${step.animationName}_${step.directionLabel}`;
    acc[label] = (acc[label] ?? 0) + 1;
    return acc;
  }, {});

  return rawSteps.map((step) => {
    const baseLabel = `${step.animationName}_${step.directionLabel}`;
    const needsModelPrefix = labelCounts[baseLabel] > 1 || modelUuids.length > 1;
    const modelPrefix = needsModelPrefix
      ? `${step.modelUuid?.slice(0, 8) ?? "scene"}_`
      : "";

    return {
      ...step,
      rowLabel: `${modelPrefix}${baseLabel}`,
    };
  });
}

export type WorkflowStepGroup = {
  key: string;
  animationName: string;
  steps: WorkflowStep[];
};

export function isWorkflowStepHidden(
  step: WorkflowStep,
  hiddenAnimations: Record<string, string[]>,
): boolean {
  return Boolean(
    step.modelUuid &&
      step.animationName !== "none" &&
      hiddenAnimations[step.modelUuid]?.includes(step.animationName),
  );
}

export function getHiddenWorkflowStepLabels(
  steps: WorkflowStep[],
  hiddenAnimations: Record<string, string[]>,
): string[] {
  return steps
    .filter((step) => isWorkflowStepHidden(step, hiddenAnimations))
    .map((step) => step.rowLabel);
}

export function groupWorkflowStepsByAnimation(
  steps: WorkflowStep[],
): WorkflowStepGroup[] {
  const groups = new Map<string, WorkflowStepGroup>();

  for (const step of steps) {
    const key = step.animationName;
    const group = groups.get(key);

    if (group) {
      group.steps.push(step);
      continue;
    }

    groups.set(key, {
      key,
      animationName: step.animationName,
      steps: [step],
    });
  }

  return Array.from(groups.values());
}
