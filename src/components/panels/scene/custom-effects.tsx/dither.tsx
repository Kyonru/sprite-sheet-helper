import { Effect } from "postprocessing";
import { Uniform } from "three";
import { wrapEffect } from "@react-three/postprocessing";

const ditherFragmentShader = /* glsl */ `
uniform float ditherStrength;
uniform float ditherScale;

float getDither(ivec2 px) {
  int index = px.y * 4 + px.x;
  if (index == 0)  return 0.0;
  if (index == 1)  return 8.0;
  if (index == 2)  return 2.0;
  if (index == 3)  return 10.0;
  if (index == 4)  return 12.0;
  if (index == 5)  return 4.0;
  if (index == 6)  return 14.0;
  if (index == 7)  return 6.0;
  if (index == 8)  return 3.0;
  if (index == 9)  return 11.0;
  if (index == 10) return 1.0;
  if (index == 11) return 9.0;
  if (index == 12) return 15.0;
  if (index == 13) return 7.0;
  if (index == 14) return 13.0;
  return 5.0;
}

void mainImage(const in vec4 inputColor, const in vec2 uv, out vec4 outputColor) {
  if (inputColor.a < 0.01) {
    outputColor = vec4(0.0, 0.0, 0.0, 0.0);
    return;
  }

  ivec2 px = ivec2(mod(gl_FragCoord.xy / ditherScale, 4.0));
  float threshold = getDither(px) / 16.0 - 0.5;

  vec3 color = inputColor.rgb + threshold * ditherStrength;

  outputColor = vec4(clamp(color, 0.0, 1.0), inputColor.a);
}
`;

class DitherEffectImpl extends Effect {
  constructor(options: { ditherStrength?: number; ditherScale?: number } = {}) {
    const { ditherStrength = 0.1, ditherScale = 1.0 } = options;

    super("DitherEffect", ditherFragmentShader, {
      uniforms: new Map([
        ["ditherStrength", new Uniform(ditherStrength)],
        ["ditherScale", new Uniform(ditherScale)],
      ]),
    });
  }

  setDitherStrength(v: number) {
    this.uniforms.get("ditherStrength")!.value = v;
  }
  setDitherScale(v: number) {
    this.uniforms.get("ditherScale")!.value = v;
  }
}

export const DitherEffect = wrapEffect(DitherEffectImpl) as React.FC<{
  ditherStrength?: number;
  ditherScale?: number;
}>;
