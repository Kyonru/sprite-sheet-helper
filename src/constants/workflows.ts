import * as THREE from "three";

export interface WorkflowDirection {
  label: string;
  phi: number;
  theta: number;
}

export const WORKFLOWS = [
  "topdown-8dir",
  "topdown-4dir",
  "isometric",
  "platformer",
] as const;

export type WorkflowId = (typeof WORKFLOWS)[number];

export interface WorkflowDefinition {
  id: WorkflowId;
  label: string;
  description: string;
  directions: WorkflowDirection[];
}

export function computePosition(
  phi: number,
  theta: number,
  distance: number,
  target: [number, number, number] = [0, 0, 0],
): [number, number, number] {
  const s = new THREE.Spherical(
    distance,
    THREE.MathUtils.degToRad(phi),
    THREE.MathUtils.degToRad(theta),
  );
  const v = new THREE.Vector3().setFromSpherical(s);
  return [v.x + target[0], v.y + target[1], v.z + target[2]];
}

export const WORKFLOW_PRESETS: WorkflowDefinition[] = [
  {
    id: "topdown-8dir",
    label: "Top Down 8-directional",
    description:
      "Nearly-overhead camera (phi=1°) at 8 cardinal + diagonal angles.",
    directions: [
      { label: "N", phi: 1, theta: 0 },
      { label: "NE", phi: 1, theta: 45 },
      { label: "E", phi: 1, theta: 90 },
      { label: "SE", phi: 1, theta: 135 },
      { label: "S", phi: 1, theta: 180 },
      { label: "SW", phi: 1, theta: 225 },
      { label: "W", phi: 1, theta: 270 },
      { label: "NW", phi: 1, theta: 315 },
    ],
  },
  {
    id: "topdown-4dir",
    label: "Top Down 4-directional",
    description: "Nearly-overhead camera (phi=1°) at 4 cardinal angles.",
    directions: [
      { label: "N", phi: 1, theta: 0 },
      { label: "E", phi: 1, theta: 90 },
      { label: "S", phi: 1, theta: 180 },
      { label: "W", phi: 1, theta: 270 },
    ],
  },
  {
    id: "isometric",
    label: "Isometric",
    description:
      "45° elevation at 4 diagonal angles (classic isometric corners).",
    directions: [
      { label: "SE", phi: 45, theta: 45 },
      { label: "NE", phi: 45, theta: 135 },
      { label: "NW", phi: 45, theta: 225 },
      { label: "SW", phi: 45, theta: 315 },
    ],
  },
  {
    id: "platformer",
    label: "Platformer / Side View",
    description: "Horizon-level (phi=90°) with Right and Left angles.",
    directions: [
      { label: "Right", phi: 90, theta: 90 },
      { label: "Left", phi: 90, theta: 270 },
    ],
  },
];
