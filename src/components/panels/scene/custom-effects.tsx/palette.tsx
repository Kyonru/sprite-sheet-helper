// palette-effect.tsx
import { Effect } from "postprocessing";
import { Uniform } from "three";
import { wrapEffect } from "@react-three/postprocessing";

const paletteFragmentShader = /* glsl */ `
uniform int paletteIndex;

vec3 linearToSRGB(vec3 c) {
  return pow(max(c, 0.0), vec3(1.0 / 2.2));
}

vec3 paletteGameboy(int i) {
  if (i == 0) return vec3(0.06, 0.22, 0.06);
  if (i == 1) return vec3(0.19, 0.38, 0.19);
  if (i == 2) return vec3(0.55, 0.67, 0.06);
  return       vec3(0.61, 0.73, 0.06);
}

vec3 paletteGBA(int i) {
  if (i == 0)  return vec3(0.98, 0.98, 0.96);
  if (i == 1)  return vec3(0.80, 0.80, 0.78);
  if (i == 2)  return vec3(0.60, 0.60, 0.58);
  if (i == 3)  return vec3(0.40, 0.40, 0.39);
  if (i == 4)  return vec3(0.10, 0.10, 0.10);
  if (i == 5)  return vec3(0.90, 0.20, 0.18);
  if (i == 6)  return vec3(0.95, 0.55, 0.10);
  if (i == 7)  return vec3(0.95, 0.90, 0.10);
  if (i == 8)  return vec3(0.15, 0.78, 0.18);
  if (i == 9)  return vec3(0.08, 0.45, 0.90);
  if (i == 10) return vec3(0.55, 0.18, 0.85);
  if (i == 11) return vec3(0.92, 0.18, 0.60);
  if (i == 12) return vec3(0.20, 0.85, 0.80);
  if (i == 13) return vec3(0.55, 0.35, 0.18);
  if (i == 14) return vec3(0.92, 0.70, 0.55);
  return        vec3(0.08, 0.25, 0.50);
}

vec3 paletteCGA(int i) {
  if (i == 0) return vec3(0.0, 0.0, 0.0);
  if (i == 1) return vec3(0.0, 1.0, 1.0);
  if (i == 2) return vec3(1.0, 0.0, 1.0);
  return       vec3(1.0, 1.0, 1.0);
}

vec3 paletteNES(int i) {
  if (i == 0) return vec3(0.0, 0.0, 0.0);
  if (i == 1) return vec3(1.0, 1.0, 1.0);
  if (i == 2) return vec3(1.0, 0.0, 0.0);
  if (i == 3) return vec3(0.0, 1.0, 0.0);
  if (i == 4) return vec3(0.0, 0.0, 1.0);
  if (i == 5) return vec3(1.0, 1.0, 0.0);
  if (i == 6) return vec3(1.0, 0.0, 1.0);
  return       vec3(0.0, 1.0, 1.0);
}

vec3 palettePico8(int i) {
  if (i == 0)  return vec3(0.0,   0.0,   0.0);
  if (i == 1)  return vec3(0.114, 0.169, 0.325);
  if (i == 2)  return vec3(0.494, 0.145, 0.325);
  if (i == 3)  return vec3(0.0,   0.529, 0.318);
  if (i == 4)  return vec3(0.671, 0.322, 0.212);
  if (i == 5)  return vec3(0.412, 0.412, 0.412);
  if (i == 6)  return vec3(0.761, 0.761, 0.761);
  if (i == 7)  return vec3(1.0,   0.945, 0.918);
  if (i == 8)  return vec3(1.0,   0.0,   0.302);
  if (i == 9)  return vec3(1.0,   0.639, 0.0);
  if (i == 10) return vec3(1.0,   0.925, 0.153);
  if (i == 11) return vec3(0.0,   0.894, 0.212);
  if (i == 12) return vec3(0.161, 0.678, 1.0);
  if (i == 13) return vec3(0.514, 0.463, 0.612);
  if (i == 14) return vec3(1.0,   0.467, 0.659);
  return        vec3(1.0,   0.8,   0.667);
}

vec3 paletteLospec(int i) {
  if (i == 0)  return vec3(0.686, 0.208, 0.208);
  if (i == 1)  return vec3(0.780, 0.325, 0.278);
  if (i == 2)  return vec3(0.780, 0.447, 0.361);
  if (i == 3)  return vec3(0.780, 0.482, 0.263);
  if (i == 4)  return vec3(1.000, 0.859, 0.427);
  if (i == 5)  return vec3(0.894, 0.859, 0.255);
  if (i == 6)  return vec3(0.635, 0.894, 0.353);
  if (i == 7)  return vec3(0.463, 0.769, 0.573);
  if (i == 8)  return vec3(0.196, 0.576, 0.424);
  if (i == 9)  return vec3(0.255, 0.494, 0.494);
  if (i == 10) return vec3(0.314, 0.392, 0.796);
  if (i == 11) return vec3(0.416, 0.388, 0.624);
  if (i == 12) return vec3(0.447, 0.294, 0.624);
  if (i == 13) return vec3(0.400, 0.165, 0.529);
  if (i == 14) return vec3(0.584, 0.247, 0.616);
  if (i == 15) return vec3(0.769, 0.329, 0.706);
  if (i == 16) return vec3(0.882, 0.537, 0.835);
  if (i == 17) return vec3(0.847, 0.933, 1.000);
  if (i == 18) return vec3(0.294, 0.757, 0.757);
  if (i == 19) return vec3(0.486, 0.663, 0.796);
  if (i == 20) return vec3(0.486, 0.471, 0.671);
  if (i == 21) return vec3(0.384, 0.380, 0.471);
  if (i == 22) return vec3(0.388, 0.400, 0.388);
  if (i == 23) return vec3(0.212, 0.204, 0.298);
  return        vec3(0.0,   0.0,   0.0);
}

vec3 paletteMacintosh(int i) {
  if (i == 0)  return vec3(1.0,   1.0,   1.0);
  if (i == 1)  return vec3(1.0,   1.0,   0.0);
  if (i == 2)  return vec3(1.0,   0.624, 0.0);
  if (i == 3)  return vec3(0.988, 0.0,   0.0);
  if (i == 4)  return vec3(0.988, 0.0,   0.988);
  if (i == 5)  return vec3(0.376, 0.0,   0.988);
  if (i == 6)  return vec3(0.0,   0.0,   0.824);
  if (i == 7)  return vec3(0.0,   0.624, 0.824);
  if (i == 8)  return vec3(0.0,   0.745, 0.0);
  if (i == 9)  return vec3(0.0,   0.494, 0.0);
  if (i == 10) return vec3(0.373, 0.235, 0.059);
  if (i == 11) return vec3(0.647, 0.412, 0.176);
  if (i == 12) return vec3(1.0,   0.624, 0.471);
  if (i == 13) return vec3(0.749, 0.749, 0.749);
  if (i == 14) return vec3(0.502, 0.502, 0.502);
  return        vec3(0.0,   0.0,   0.0);
}

vec3 paletteAmiga(int i) {
  if (i == 0)  return vec3(1.0,   1.0,   1.0);
  if (i == 1)  return vec3(0.0,   0.0,   0.0);
  if (i == 2)  return vec3(0.533, 0.533, 0.533);
  if (i == 3)  return vec3(0.800, 0.800, 0.800);
  if (i == 4)  return vec3(0.600, 0.0,   0.0);
  if (i == 5)  return vec3(1.0,   0.0,   0.0);
  if (i == 6)  return vec3(0.0,   0.533, 0.0);
  if (i == 7)  return vec3(0.0,   1.0,   0.0);
  if (i == 8)  return vec3(0.0,   0.0,   0.600);
  if (i == 9)  return vec3(0.0,   0.0,   1.0);
  if (i == 10) return vec3(0.533, 0.267, 0.0);
  if (i == 11) return vec3(1.0,   0.533, 0.0);
  if (i == 12) return vec3(0.533, 0.0,   0.533);
  if (i == 13) return vec3(1.0,   0.0,   1.0);
  if (i == 14) return vec3(0.0,   0.533, 0.533);
  return        vec3(0.0,   1.0,   1.0);
}

vec3 paletteZXSpectrum(int i) {
  if (i == 0)  return vec3(0.0,   0.0,   0.0);
  if (i == 1)  return vec3(0.0,   0.0,   0.804);
  if (i == 2)  return vec3(0.804, 0.0,   0.0);
  if (i == 3)  return vec3(0.804, 0.0,   0.804);
  if (i == 4)  return vec3(0.0,   0.804, 0.0);
  if (i == 5)  return vec3(0.0,   0.804, 0.804);
  if (i == 6)  return vec3(0.804, 0.804, 0.0);
  if (i == 7)  return vec3(0.804, 0.804, 0.804);
  if (i == 8)  return vec3(0.0,   0.0,   0.0);
  if (i == 9)  return vec3(0.0,   0.0,   1.0);
  if (i == 10) return vec3(1.0,   0.0,   0.0);
  if (i == 11) return vec3(1.0,   0.0,   1.0);
  if (i == 12) return vec3(0.0,   1.0,   0.0);
  if (i == 13) return vec3(0.0,   1.0,   1.0);
  if (i == 14) return vec3(1.0,   1.0,   0.0);
  return        vec3(1.0,   1.0,   1.0);
}

vec3 getPaletteColor(int palette, int i) {
  if (palette == 0) return paletteGameboy(i);
  if (palette == 1) return paletteGBA(i);
  if (palette == 2) return paletteCGA(i);
  if (palette == 3) return paletteNES(i);
  if (palette == 4) return palettePico8(i);
  if (palette == 5) return paletteLospec(i);
  if (palette == 6) return paletteMacintosh(i);
  if (palette == 7) return paletteAmiga(i);
  return paletteZXSpectrum(i);
}

int getPaletteSize(int palette) {
  if (palette == 0) return 4;
  if (palette == 1) return 16;
  if (palette == 2) return 4;
  if (palette == 3) return 8;
  if (palette == 4) return 16;
  if (palette == 5) return 25;
  if (palette == 6) return 16;
  if (palette == 7) return 16;
  return 16;
}

void mainImage(const in vec4 inputColor, const in vec2 uv, out vec4 outputColor) {
  if (inputColor.a < 0.01) {
    outputColor = vec4(0.0, 0.0, 0.0, 0.0);
    return;
  }

  vec3 color = linearToSRGB(texture2D(inputBuffer, uv).rgb);

  float minDist = 1e10;
  vec3 closest = getPaletteColor(paletteIndex, 0);
  int size = getPaletteSize(paletteIndex);

  for (int i = 0; i < 32; i++) {
    if (i >= size) break;
    vec3 p = getPaletteColor(paletteIndex, i);
    vec3 diff = color - p;
    float dist = dot(diff, diff);
    if (dist < minDist) {
      minDist = dist;
      closest = p;
    }
  }

  outputColor = vec4(closest, inputColor.a);
}
`;

export const PALETTE_INDEX = {
  gameboy: 0,
  gba: 1,
  cga: 2,
  nes: 3,
  pico8: 4,
  lospec: 5,
  macintosh: 6,
  amiga: 7,
  zxSpectrum: 8,
} as const;

export type PaletteName = keyof typeof PALETTE_INDEX;

class PaletteEffectImpl extends Effect {
  constructor(options: { palette?: number } = {}) {
    const { palette = 0 } = options;

    super("PaletteEffect", paletteFragmentShader, {
      uniforms: new Map([["paletteIndex", new Uniform(palette)]]),
    });
  }

  setPalette(index: number) {
    this.uniforms.get("paletteIndex")!.value = index;
  }
}

export const PaletteEffect = wrapEffect(PaletteEffectImpl) as React.FC<{
  palette?: number;
}>;
