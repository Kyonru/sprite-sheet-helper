import { useMemo } from "react";
import { Effect } from "postprocessing";
import {
  Uniform,
  WebGLRenderTarget,
  HalfFloatType,
  NearestFilter,
  ShaderMaterial,
  Color,
  type WebGLRenderer,
} from "three";
// @ts-expect-error These path are not typed
import { FullScreenQuad } from "three/examples/jsm/postprocessing/Pass";
// @ts-expect-error These path are not typed
import { Texture } from "three/src/textures/Texture";

export const SmearEffect = ({
  enabled = true,
  damp = 0.96,
  tint = "#ffffff",
  legacy = false,
}: {
  enabled?: boolean;
  damp?: number;
  tint?: string;
  legacy?: boolean;
}) => {
  const effect = useMemo(
    () => new AfterimageEffect({ enabled, damp, tint, legacy }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  effect.setDamp(damp);
  effect.setTint(tint);
  effect.setLegacy(legacy);

  return <primitive object={effect} />;
};

const outputShader = `
  uniform sampler2D tFinal;
  uniform bool enabled;

  void mainImage(const in vec4 inputColor, const in vec2 uv, out vec4 outputColor)
  {
    if (!enabled) {
      outputColor = inputColor;
      return;
    }
    vec4 finalColor = texture2D(tFinal, uv);
    outputColor = finalColor;
  }
`;

const frameBlendShader = {
  vertexShader: /* glsl */ `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,

  fragmentShader: /* glsl */ `
    uniform float damp;
    uniform vec3 tint;
    uniform bool legacy;
    uniform sampler2D tOld;
    uniform sampler2D tNew;

    varying vec2 vUv;

    vec4 when_gt(vec4 x, float y) {
      return max(sign(x - y), 0.0);
    }

    void main() {
      vec4 texelOld = texture2D(tOld, vUv);
      vec4 texelNew = texture2D(tNew, vUv);

      vec4 trail;
      if (legacy) {
        texelOld *= damp * when_gt(texelOld, 0.1);
        texelOld.rgb *= tint;
        trail = texelOld;
      } else {
        trail = texelOld * damp;
        trail.rgb *= tint;
      }

      gl_FragColor = max(texelNew, trail);
    }
  `,
};

type UniformType =
  | Uniform<Texture | null>
  | Uniform<number>
  | Uniform<boolean>
  | Uniform<Color>;

class AfterimageEffect extends Effect {
  compTexture: WebGLRenderTarget;
  oldTexture: WebGLRenderTarget;
  compFsMaterial: ShaderMaterial;
  compFsQuad: FullScreenQuad;
  shader: { vertexShader: string; fragmentShader: string };

  constructor({
    enabled = false,
    damp = 0.96,
    tint = "#ffffff",
    legacy = false,
  } = {}) {
    super("AfterimageEffect", outputShader, {
      uniforms: new Map<string, UniformType>([
        ["damp", new Uniform(damp)],
        ["tint", new Uniform(new Color(tint))],
        ["legacy", new Uniform(legacy)],
        ["tOld", new Uniform(null)],
        ["tNew", new Uniform(null)],
        ["tFinal", new Uniform(null)],
        ["enabled", new Uniform(enabled)],
      ]),
    });

    this.shader = frameBlendShader;

    this.compTexture = new WebGLRenderTarget(
      window.innerWidth,
      window.innerHeight,
      {
        magFilter: NearestFilter,
        type: HalfFloatType,
      },
    );

    this.oldTexture = new WebGLRenderTarget(
      window.innerWidth,
      window.innerHeight,
      {
        magFilter: NearestFilter,
        type: HalfFloatType,
      },
    );

    this.compFsMaterial = new ShaderMaterial({
      uniforms: Object.fromEntries(this.uniforms),
      vertexShader: this.shader.vertexShader,
      fragmentShader: this.shader.fragmentShader,
    });

    this.compFsQuad = new FullScreenQuad(this.compFsMaterial);
  }

  update(renderer: WebGLRenderer, inputBuffer: WebGLRenderTarget) {
    if (this.uniforms.get("enabled")?.value === false) return;

    const prevTarget = renderer.getRenderTarget();

    (this.uniforms.get("tOld") as Uniform<Texture>).value =
      this.oldTexture.texture;
    (this.uniforms.get("tNew") as Uniform<Texture>).value = inputBuffer.texture;

    renderer.setRenderTarget(this.compTexture);
    this.compFsQuad.render(renderer);
    renderer.setRenderTarget(prevTarget);

    (this.uniforms.get("tFinal") as Uniform<Texture>).value =
      this.compTexture.texture;

    const temp = this.oldTexture;
    this.oldTexture = this.compTexture;
    this.compTexture = temp;
  }

  setSize(width: number, height: number): void {
    this.compTexture.setSize(width, height);
    this.oldTexture.setSize(width, height);
  }

  setDamp(v: number): void {
    (this.uniforms.get("damp") as Uniform<number>).value = v;
  }

  setTint(hex: string): void {
    (this.uniforms.get("tint") as Uniform<Color>).value.set(hex);
  }

  setLegacy(v: boolean): void {
    (this.uniforms.get("legacy") as Uniform<boolean>).value = v;
  }
}
