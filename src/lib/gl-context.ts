let _gl: WebGLRenderingContext | WebGL2RenderingContext | null = null;

export function setGLContext(
  gl: WebGLRenderingContext | WebGL2RenderingContext,
) {
  _gl = gl;
}

export function validateGLSL(
  fragmentShader: string,
): { ok: true } | { ok: false; error: string } {
  if (!_gl) return { ok: true }; // no context yet, skip silently

  const gl = _gl;
  const sh = gl.createShader(gl.FRAGMENT_SHADER);
  if (!sh) return { ok: true };

  // postprocessing prepends its own header so we mimic it minimally

  const source = buildValidationShader(fragmentShader);

  gl.shaderSource(sh, source);
  gl.compileShader(sh);

  const ok = gl.getShaderParameter(sh, gl.COMPILE_STATUS) as boolean;
  const log = gl.getShaderInfoLog(sh) ?? "";
  gl.deleteShader(sh);

  if (!ok) {
    const clean = log
      .replace(/ERROR: \d+:(\d+):/g, "line $1:")
      .replace(/\0/g, "")
      .trim();
    return { ok: false, error: clean };
  }

  return { ok: true };
}

function buildValidationShader(userCode: string) {
  return `
  #ifdef GL_ES
  precision highp float;
  #endif

  uniform sampler2D inputBuffer;
  uniform vec2 resolution;
  uniform float time;

  varying vec2 vUv;

  ${userCode}

  void main() {
    vec4 color;
    mainImage(texture2D(inputBuffer, vUv), vUv, color);
    gl_FragColor = color;
  }
  `;
}
