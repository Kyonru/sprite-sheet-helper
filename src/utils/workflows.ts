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
};

export function buildWorkflowSteps(
  workflow: WorkflowDefinition,
  { clips, modelUuids }: BuildWorkflowStepsInput,
): WorkflowStep[] {
  const clipEntries = Object.entries(clips).filter(
    ([, modelClips]) => modelClips.length > 0,
  );

  if (clipEntries.length === 0) {
    return workflow.directions.map((dir) => ({
      animationName: "none",
      directionLabel: dir.label,
      rowLabel: `none_${dir.label}`,
    }));
  }

  const rawSteps = clipEntries.flatMap(([modelUuid, modelClips]) => {
    const animationNames = [...new Set(modelClips.map((c) => c.clip.name))];
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
