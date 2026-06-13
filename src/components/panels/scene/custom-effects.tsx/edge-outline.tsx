import { Effect } from "postprocessing";
import * as THREE from "three";
import { Uniform } from "three";
import { wrapEffect } from "@react-three/postprocessing";

const edgeOutlineFragmentShader = /* glsl */ `
uniform vec2 texelSize;
uniform vec3 outlineColor;
uniform float strength;
uniform float thickness;
uniform float threshold;
uniform float opacity;

float luminance(vec3 color) {
  return dot(color, vec3(0.299, 0.587, 0.114));
}

float colorDistance(vec3 a, vec3 b) {
  vec3 diff = a - b;
  return max(length(diff), abs(luminance(a) - luminance(b)));
}

void mainImage(const in vec4 inputColor, const in vec2 uv, out vec4 outputColor) {
  if (inputColor.a < 0.01) {
    outputColor = inputColor;
    return;
  }

  vec2 px = texelSize * max(thickness, 0.5);
  vec3 center = inputColor.rgb;

  vec3 left = texture2D(inputBuffer, uv + vec2(-px.x, 0.0)).rgb;
  vec3 right = texture2D(inputBuffer, uv + vec2(px.x, 0.0)).rgb;
  vec3 up = texture2D(inputBuffer, uv + vec2(0.0, px.y)).rgb;
  vec3 down = texture2D(inputBuffer, uv + vec2(0.0, -px.y)).rgb;
  vec3 upLeft = texture2D(inputBuffer, uv + vec2(-px.x, px.y)).rgb;
  vec3 downRight = texture2D(inputBuffer, uv + vec2(px.x, -px.y)).rgb;

  float edge = 0.0;
  edge = max(edge, colorDistance(center, left));
  edge = max(edge, colorDistance(center, right));
  edge = max(edge, colorDistance(center, up));
  edge = max(edge, colorDistance(center, down));
  edge = max(edge, colorDistance(center, upLeft));
  edge = max(edge, colorDistance(center, downRight));

  float mask = smoothstep(threshold, threshold + 0.08, edge * strength);
  vec3 color = mix(inputColor.rgb, outlineColor, clamp(mask * opacity, 0.0, 1.0));

  outputColor = vec4(color, inputColor.a);
}
`;

class EdgeOutlineEffectImpl extends Effect {
  constructor(
    options: {
      color?: string;
      strength?: number;
      thickness?: number;
      threshold?: number;
      opacity?: number;
    } = {},
  ) {
    const {
      color = "#111111",
      strength = 3,
      thickness = 1,
      threshold = 0.18,
      opacity = 1,
    } = options;

    super("EdgeOutlineEffect", edgeOutlineFragmentShader, {
      uniforms: new Map([
        ["texelSize", new Uniform(new THREE.Vector2(1 / 1024, 1 / 1024))],
        ["outlineColor", new Uniform(new THREE.Color(color))],
        ["strength", new Uniform(strength)],
        ["thickness", new Uniform(thickness)],
        ["threshold", new Uniform(threshold)],
        ["opacity", new Uniform(opacity)],
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

  setStrength(value: number) {
    this.uniforms.get("strength")!.value = value;
  }

  setThickness(value: number) {
    this.uniforms.get("thickness")!.value = value;
  }

  setThreshold(value: number) {
    this.uniforms.get("threshold")!.value = value;
  }

  setOpacity(value: number) {
    this.uniforms.get("opacity")!.value = value;
  }
}

export const EdgeOutlineEffect = wrapEffect(EdgeOutlineEffectImpl) as React.FC<{
  color?: string;
  strength?: number;
  thickness?: number;
  threshold?: number;
  opacity?: number;
}>;
