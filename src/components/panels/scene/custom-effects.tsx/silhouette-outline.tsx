import { Effect } from "postprocessing";
import * as THREE from "three";
import { Uniform } from "three";
import { wrapEffect } from "@react-three/postprocessing";

const silhouetteOutlineFragmentShader = /* glsl */ `
uniform vec2 texelSize;
uniform vec3 outlineColor;
uniform float thickness;
uniform float opacity;
uniform float alphaThreshold;

float alphaAt(vec2 uv) {
  return texture2D(inputBuffer, uv).a;
}

void mainImage(const in vec4 inputColor, const in vec2 uv, out vec4 outputColor) {
  float centerAlpha = inputColor.a;
  float radius = max(thickness, 1.0);
  vec2 px = texelSize * radius;

  float neighborAlpha = 0.0;
  neighborAlpha = max(neighborAlpha, alphaAt(uv + vec2(-px.x, 0.0)));
  neighborAlpha = max(neighborAlpha, alphaAt(uv + vec2(px.x, 0.0)));
  neighborAlpha = max(neighborAlpha, alphaAt(uv + vec2(0.0, -px.y)));
  neighborAlpha = max(neighborAlpha, alphaAt(uv + vec2(0.0, px.y)));
  neighborAlpha = max(neighborAlpha, alphaAt(uv + vec2(-px.x, -px.y)));
  neighborAlpha = max(neighborAlpha, alphaAt(uv + vec2(-px.x, px.y)));
  neighborAlpha = max(neighborAlpha, alphaAt(uv + vec2(px.x, -px.y)));
  neighborAlpha = max(neighborAlpha, alphaAt(uv + vec2(px.x, px.y)));

  float outside = step(alphaThreshold, neighborAlpha) * (1.0 - step(alphaThreshold, centerAlpha));

  if (outside > 0.0) {
    outputColor = vec4(outlineColor, opacity);
    return;
  }

  outputColor = inputColor;
}
`;

class SilhouetteOutlineEffectImpl extends Effect {
  constructor(
    options: {
      color?: string;
      thickness?: number;
      opacity?: number;
      alphaThreshold?: number;
    } = {},
  ) {
    const {
      color = "#111111",
      thickness = 2,
      opacity = 1,
      alphaThreshold = 0.01,
    } = options;

    super("SilhouetteOutlineEffect", silhouetteOutlineFragmentShader, {
      uniforms: new Map<string, Uniform<THREE.Vector2 | THREE.Color | number>>([
        ["texelSize", new Uniform(new THREE.Vector2(1 / 1024, 1 / 1024))],
        ["outlineColor", new Uniform(new THREE.Color(color))],
        ["thickness", new Uniform(thickness)],
        ["opacity", new Uniform(opacity)],
        ["alphaThreshold", new Uniform(alphaThreshold)],
      ]),
    });
  }

  setSize(width: number, height: number) {
    this.uniforms
      .get("texelSize")!
      .value.set(1 / Math.max(width, 1), 1 / Math.max(height, 1));
  }

  setColor(value: string) {
    this.uniforms.get("outlineColor")!.value.set(value);
  }

  setThickness(value: number) {
    this.uniforms.get("thickness")!.value = value;
  }

  setOpacity(value: number) {
    this.uniforms.get("opacity")!.value = value;
  }

  setAlphaThreshold(value: number) {
    this.uniforms.get("alphaThreshold")!.value = value;
  }
}

export const SilhouetteOutlineEffect = wrapEffect(
  SilhouetteOutlineEffectImpl,
) as React.FC<{
  color?: string;
  thickness?: number;
  opacity?: number;
  alphaThreshold?: number;
}>;
