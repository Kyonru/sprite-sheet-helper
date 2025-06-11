export interface Light {
  type?: "ambient" | "directional" | "point" | "spot";
  enabled: boolean;
  intensity: number;
  color: string;
}

export interface AmbientLight extends Light {
  type: "ambient";
}

export interface PointLight extends Light {
  type: "point";
  decay: number;
  position: [number, number, number];
  distance: number;
  power: number;
}

export interface SpotLight extends Light {
  type: "spot";
  position: [number, number, number];
  distance: number;
  angle: number;
  penumbra: number;
  decay: number;
  power: number;
  lookAtObject: boolean;
  rotation: [number, number, number];
  transform: "translate" | "scale" | "rotate";
  castShadow: boolean;
  direction: [number, number, number];
}
