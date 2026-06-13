export type DocsTaskGuide = {
  id: string;
  title: string;
  description: string;
  docSlug: string;
};

export const DOC_ORDER = [
  "getting-started",
  "tutorial",
  "projects",
  "animations",
  "materials",
  "pose-studio",
  "camera-capture",
  "camera",
  "effects",
  "effects-recipes",
  "normal-maps",
  "lighting",
  "exporting",
  "workflows",
  "reproducible-workflows",
  "cli",
  "troubleshooting",
];

export const DOC_TASK_GUIDES: DocsTaskGuide[] = [
  {
    id: "capture",
    title: "Capture Frames",
    description: "Set up frame size, timing, camera, and capture rows.",
    docSlug: "camera-capture",
  },
  {
    id: "pose",
    title: "Pose Studio",
    description: "Capture a pose or motion clip, repair mapping, and edit it.",
    docSlug: "pose-studio",
  },
  {
    id: "materials",
    title: "Materials Workbench",
    description: "Assign reusable materials and generate texture variants.",
    docSlug: "materials",
  },
  {
    id: "effects",
    title: "Effects Recipes",
    description: "Use presets, stack order, and safe effect combinations.",
    docSlug: "effects-recipes",
  },
  {
    id: "export",
    title: "Export Workbench",
    description: "Validate atlas output, normal maps, manifests, and engines.",
    docSlug: "exporting",
  },
  {
    id: "workflows",
    title: "Auto Workflows",
    description: "Run multi-angle capture workflows with deterministic output.",
    docSlug: "workflows",
  },
  {
    id: "cli",
    title: "CLI Export",
    description: "Batch exports, workflow automation, and atlas flags.",
    docSlug: "cli",
  },
  {
    id: "troubleshooting",
    title: "Troubleshooting",
    description: "Fix missing frames, export blockers, and visual surprises.",
    docSlug: "troubleshooting",
  },
  {
    id: "normal-maps",
    title: "Normal Maps",
    description: "Capture clean normal atlases and understand placeholders.",
    docSlug: "normal-maps",
  },
];

export function docSlug(id: string): string {
  return id.split("/").pop()?.replace(".md", "") ?? "";
}
