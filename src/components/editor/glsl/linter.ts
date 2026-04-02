import { linter, type Diagnostic } from "@codemirror/lint";
import { validateGLSL } from "@/lib/gl-context";
import { clike } from "@codemirror/legacy-modes/mode/clike";

function words(str: string): Record<string, boolean> {
  return Object.fromEntries(str.split(" ").map((w) => [w, true]));
}

export const glslLanguage = clike({
  name: "glsl",
  keywords: words(
    "break continue discard do else for if return while switch case default",
  ),
  types: words(
    "float int uint bool vec2 vec3 vec4 ivec2 ivec3 ivec4 uvec2 uvec3 uvec4 " +
      "bvec2 bvec3 bvec4 mat2 mat3 mat4 mat2x2 mat2x3 mat2x4 mat3x2 mat3x3 " +
      "mat3x4 mat4x2 mat4x3 mat4x4 sampler2D sampler3D samplerCube void",
  ),
  blockKeywords: words("void struct"),
  atoms: words("true false"),
  hooks: {},
});

export const glslLinter = linter(
  (view) => {
    const code = view.state.doc.toString();
    const result = validateGLSL(code);
    if (result.ok) return [];

    // Parse "line N: message" from the error string
    const match = result.error.match(/line (\d+):/);
    const line = match ? Math.max(1, parseInt(match[1]) - 3) : 1; // offset for our prepended header
    const lineInfo = view.state.doc.line(Math.min(line, view.state.doc.lines));

    const diagnostic: Diagnostic = {
      from: lineInfo.from,
      to: lineInfo.to,
      severity: "error",
      message: result.error,
    };

    return [diagnostic];
  },
  { delay: 600 },
); // debounce — don't compile on every keystroke
