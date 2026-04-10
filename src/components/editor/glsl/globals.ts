export const GLSL_COMPLETIONS = [
  // postprocessing context
  { label: "inputColor", type: "variable", detail: "vec4 — scene color at uv" },
  {
    label: "outputColor",
    type: "variable",
    detail: "vec4 — write your result here",
  },
  { label: "uv", type: "variable", detail: "vec2 — 0.0 → 1.0" },
  {
    label: "inputBuffer",
    type: "variable",
    detail: "sampler2D — use for resampling",
  },
  { label: "resolution", type: "variable", detail: "vec2 — screen size in px" },
  { label: "time", type: "variable", detail: "float — seconds elapsed" },
  // math
  { label: "sin", type: "function", detail: "float sin(float)" },
  { label: "cos", type: "function", detail: "float cos(float)" },
  { label: "tan", type: "function", detail: "float tan(float)" },
  { label: "abs", type: "function", detail: "genType abs(genType)" },
  { label: "floor", type: "function", detail: "genType floor(genType)" },
  { label: "ceil", type: "function", detail: "genType ceil(genType)" },
  { label: "fract", type: "function", detail: "genType fract(genType)" },
  { label: "mod", type: "function", detail: "genType mod(genType, float)" },
  {
    label: "clamp",
    type: "function",
    detail: "genType clamp(genType, float, float)",
  },
  {
    label: "mix",
    type: "function",
    detail: "genType mix(genType, genType, float)",
  },
  { label: "step", type: "function", detail: "genType step(float, genType)" },
  {
    label: "smoothstep",
    type: "function",
    detail: "genType smoothstep(float, float, genType)",
  },
  { label: "length", type: "function", detail: "float length(genType)" },
  { label: "dot", type: "function", detail: "float dot(genType, genType)" },
  { label: "cross", type: "function", detail: "vec3 cross(vec3, vec3)" },
  {
    label: "normalize",
    type: "function",
    detail: "genType normalize(genType)",
  },
  {
    label: "reflect",
    type: "function",
    detail: "genType reflect(genType, genType)",
  },
  { label: "pow", type: "function", detail: "genType pow(genType, genType)" },
  { label: "exp", type: "function", detail: "genType exp(genType)" },
  { label: "log", type: "function", detail: "genType log(genType)" },
  { label: "sqrt", type: "function", detail: "genType sqrt(genType)" },
  { label: "min", type: "function", detail: "genType min(genType, genType)" },
  { label: "max", type: "function", detail: "genType max(genType, genType)" },
  // sampling
  {
    label: "texture2D",
    type: "function",
    detail: "vec4 texture2D(sampler2D, vec2)",
  },
  // constructors — most common
  { label: "vec2", type: "type" },
  { label: "vec3", type: "type" },
  { label: "vec4", type: "type" },
  { label: "mat2", type: "type" },
  { label: "mat3", type: "type" },
  { label: "mat4", type: "type" },
  // mainImage snippet
  {
    label: "mainImage",
    type: "function",
    detail: "insert mainImage signature",
    apply:
      "void mainImage(const in vec4 inputColor, const in vec2 uv, out vec4 outputColor) {\n\t\n}",
  },
];
