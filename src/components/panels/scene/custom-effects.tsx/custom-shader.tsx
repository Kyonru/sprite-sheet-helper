import { forwardRef, useMemo } from "react";
import { Effect } from "postprocessing";
import { Uniform, WebGLRenderer, WebGLRenderTarget } from "three";

const DEFAULT_SHADER = /* glsl */ `
void mainImage(const in vec4 inputColor, const in vec2 uv, out vec4 outputColor) {
  outputColor = inputColor;
}
`;

class CustomShaderEffectImpl extends Effect {
  constructor(fragmentShader: string) {
    super("CustomShaderEffect", fragmentShader, {
      uniforms: new Map([["time", new Uniform(0)]]),
    });
  }

  get time(): number {
    return this.uniforms.get("time")?.value ?? 0;
  }

  set time(value: number) {
    const timeUniform = this.uniforms.get("time");
    if (timeUniform) timeUniform.value = value;
  }

  update(
    _renderer: WebGLRenderer,
    _inputBuffer: WebGLRenderTarget,
    deltaTime: number,
  ) {
    const timeUniform = this.uniforms.get("time");
    if (timeUniform) timeUniform.value += deltaTime;
  }
}

interface CustomShaderEffectProps {
  fragmentShader?: string;
  onError?: (error: string | null) => void;
}

export const CustomShaderEffect = forwardRef<
  CustomShaderEffectImpl,
  CustomShaderEffectProps
>(function CustomShaderEffect(
  { fragmentShader = DEFAULT_SHADER, onError },
  ref,
) {
  const effect = useMemo(() => {
    try {
      const instance = new CustomShaderEffectImpl(fragmentShader);
      onError?.(null);
      return instance;
    } catch (e) {
      onError?.(String(e));
      return new CustomShaderEffectImpl(DEFAULT_SHADER);
    }
  }, [fragmentShader, onError]);

  return <primitive ref={ref} object={effect} dispose={null} />;
});
