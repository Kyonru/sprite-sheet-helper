import * as THREE from "three";

export interface WorkflowDirection {
  label: string;
  phi: number;
  theta: number;
}

export const WORKFLOWS = [
  "topdown-8dir",
  "topdown-4dir",
  "topdown-1dir",
  "isometric",
  "isometric-1dir",
  "platformer",
  "platformer-1dir",
  "front-back-2dir",
  "three-quarter-4dir",
  "three-quarter-8dir",
  "front-facing",
  "profile-1dir",
  "diagonal-4dir",
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
  {
    id: "topdown-1dir",
    label: "Top Down Single Direction",
    description:
      "Nearly-overhead camera (phi=1°) single direction. Game rotates sprite based on movement.",
    directions: [{ label: "Forward", phi: 1, theta: 0 }],
  },
  {
    id: "platformer-1dir",
    label: "Platformer Single Side",
    description:
      "Horizon-level (phi=90°) single direction. Game flips sprite for opposite direction.",
    directions: [{ label: "Right", phi: 90, theta: 90 }],
  },
  {
    id: "front-back-2dir",
    label: "Front & Back - RPG Style",
    description:
      "Horizon-level (phi=90°) front and back views. Classic RPG character style.",
    directions: [
      { label: "Front", phi: 90, theta: 0 },
      { label: "Back", phi: 90, theta: 180 },
    ],
  },
  {
    id: "three-quarter-4dir",
    label: "3/4 View 4-directional - Diablo Style",
    description:
      "45° elevation at 4 cardinal directions. Classic isometric RPG perspective.",
    directions: [
      { label: "N", phi: 45, theta: 0 },
      { label: "E", phi: 45, theta: 90 },
      { label: "S", phi: 45, theta: 180 },
      { label: "W", phi: 45, theta: 270 },
    ],
  },
  {
    id: "three-quarter-8dir",
    label: "3/4 View 8-directional - Diablo Style",
    description:
      "45° elevation at 8 cardinal + diagonal angles. Full 8-direction Diablo-style view.",
    directions: [
      { label: "N", phi: 45, theta: 0 },
      { label: "NE", phi: 45, theta: 45 },
      { label: "E", phi: 45, theta: 90 },
      { label: "SE", phi: 45, theta: 135 },
      { label: "S", phi: 45, theta: 180 },
      { label: "SW", phi: 45, theta: 225 },
      { label: "W", phi: 45, theta: 270 },
      { label: "NW", phi: 45, theta: 315 },
    ],
  },
  {
    id: "isometric-1dir",
    label: "Isometric Single Direction",
    description:
      "45° elevation single isometric corner. Game rotates sprite based on movement.",
    directions: [{ label: "SE", phi: 45, theta: 45 }],
  },
  {
    id: "front-facing",
    label: "Front-Facing - Doom Style",
    description:
      "Horizon-level (phi=90°) character facing camera. Simple single sprite.",
    directions: [{ label: "Front", phi: 90, theta: 0 }],
  },
  {
    id: "profile-1dir",
    label: "Profile View Single",
    description:
      "Pure side view (phi=90°, theta=90°). Game mirrors sprite for opposite direction.",
    directions: [{ label: "Right", phi: 90, theta: 90 }],
  },
  {
    id: "diagonal-4dir",
    label: "Diagonal Only 4-direction",
    description:
      "Nearly-overhead camera (phi=1°) at diagonal angles only (NE, SE, SW, NW).",
    directions: [
      { label: "NE", phi: 1, theta: 45 },
      { label: "SE", phi: 1, theta: 135 },
      { label: "SW", phi: 1, theta: 225 },
      { label: "NW", phi: 1, theta: 315 },
    ],
  },
];
