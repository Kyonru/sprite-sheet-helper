import type {
  DirectionalAnimationGroup,
  ExportRow,
  ExportRowWorkflowMetadata,
} from "@/types/file";

function workflowGroupKey(workflow: ExportRowWorkflowMetadata) {
  return [
    workflow.workflowId,
    workflow.modelUuid ?? "",
    workflow.animationName,
  ].join("\0");
}

export function getRowWorkflowMetadata(
  row: ExportRow,
): ExportRowWorkflowMetadata | undefined {
  const workflow = row.metadata?.workflow;
  if (!workflow) return undefined;

  return {
    workflowId: workflow.workflowId,
    workflowLabel: workflow.workflowLabel,
    ...(workflow.modelUuid ? { modelUuid: workflow.modelUuid } : {}),
    animationName: workflow.animationName,
    directionLabel: workflow.directionLabel,
  };
}

export function buildDirectionalAnimationGroups(
  rows: ExportRow[],
): DirectionalAnimationGroup[] {
  const groups = new Map<string, DirectionalAnimationGroup>();

  for (const row of rows) {
    const workflow = getRowWorkflowMetadata(row);
    if (!workflow) continue;

    const key = workflowGroupKey(workflow);
    const direction = {
      label: workflow.directionLabel,
      animation: row.label,
    };
    const group = groups.get(key);

    if (group) {
      group.directions.push(direction);
      continue;
    }

    groups.set(key, {
      name: workflow.animationName,
      workflowId: workflow.workflowId,
      workflowLabel: workflow.workflowLabel,
      ...(workflow.modelUuid ? { modelUuid: workflow.modelUuid } : {}),
      directions: [direction],
    });
  }

  return Array.from(groups.values()).filter(
    (group) =>
      new Set(group.directions.map((direction) => direction.label)).size > 1,
  );
}
