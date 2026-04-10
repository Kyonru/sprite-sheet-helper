import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { createPortal } from "react-dom";
import { useEffect, useState, useCallback } from "react";
import { useEffectsStore } from "@/store/next/effects";
import { GlslEditor } from "./editor/glsl/editor";
import { validateGLSL } from "@/lib/gl-context";

type ShaderEditorState = {
  open: boolean;
  uuid: string | null;
};

type Listener = (state: ShaderEditorState) => void;
let _listener: Listener | null = null;

function dispatch(state: ShaderEditorState) {
  _listener?.(state);
}

// eslint-disable-next-line react-refresh/only-export-components
export function openShaderEditor(uuid: string) {
  dispatch({ open: true, uuid });
}

const PRESETS: Record<string, { label: string; code: string }> = {
  passthrough: {
    label: "Pass-through",
    code: `void mainImage(const in vec4 inputColor, const in vec2 uv, out vec4 outputColor) {
  outputColor = inputColor;
}`,
  },
  grayscale: {
    label: "Grayscale",
    code: `void mainImage(const in vec4 inputColor, const in vec2 uv, out vec4 outputColor) {
  float l = dot(inputColor.rgb, vec3(0.299, 0.587, 0.114));
  outputColor = vec4(vec3(l), inputColor.a);
}`,
  },
  invert: {
    label: "Invert",
    code: `void mainImage(const in vec4 inputColor, const in vec2 uv, out vec4 outputColor) {
  outputColor = vec4(1.0 - inputColor.rgb, inputColor.a);
}`,
  },
  crt: {
    label: "CRT Scanlines",
    code: `void mainImage(const in vec4 inputColor, const in vec2 uv, out vec4 outputColor) {
  vec4 col = inputColor;
  float scan = sin(uv.y * resolution.y * 1.2) * 0.05;
  col.rgb -= scan;
  vec2 v = uv * (1.0 - uv.yx);
  col.rgb *= pow(v.x * v.y * 20.0, 0.25);
  col.g *= 1.06;
  col.rb *= 0.95;
  outputColor = col;
}`,
  },
  vignette: {
    label: "Vignette",
    code: `void mainImage(const in vec4 inputColor, const in vec2 uv, out vec4 outputColor) {
  vec2 c = uv - 0.5;
  float v = 1.0 - smoothstep(0.3, 0.9, length(c) * 1.5);
  outputColor = vec4(inputColor.rgb * v, inputColor.a);
}`,
  },
  pixelate: {
    label: "Pixelate",
    code: `void mainImage(const in vec4 inputColor, const in vec2 uv, out vec4 outputColor) {
  float size = 150.0;
  vec2 cell = (floor(uv * size) + 0.5) / size;
  outputColor = texture2D(inputBuffer, cell);
}`,
  },
  halftone: {
    label: "Halftone",
    code: `void mainImage(const in vec4 inputColor, const in vec2 uv, out vec4 outputColor) {
  float luma = dot(inputColor.rgb, vec3(0.299, 0.587, 0.114));
  vec2 g = fract(uv * resolution / 7.0) - 0.5;
  float r = (1.0 - luma) * 0.52;
  float c = smoothstep(r, r - 0.04, length(g));
  outputColor = vec4(vec3(c), inputColor.a);
}`,
  },
  edgeDetect: {
    label: "Edge Detect",
    code: `void mainImage(const in vec4 inputColor, const in vec2 uv, out vec4 outputColor) {
  vec2 px = 1.0 / resolution;
  float tl = dot(texture2D(inputBuffer, uv + vec2(-px.x,  px.y)).rgb, vec3(.299,.587,.114));
  float t  = dot(texture2D(inputBuffer, uv + vec2( 0.0,   px.y)).rgb, vec3(.299,.587,.114));
  float tr = dot(texture2D(inputBuffer, uv + vec2( px.x,  px.y)).rgb, vec3(.299,.587,.114));
  float l  = dot(texture2D(inputBuffer, uv + vec2(-px.x,  0.0 )).rgb, vec3(.299,.587,.114));
  float r  = dot(texture2D(inputBuffer, uv + vec2( px.x,  0.0 )).rgb, vec3(.299,.587,.114));
  float bl = dot(texture2D(inputBuffer, uv + vec2(-px.x, -px.y)).rgb, vec3(.299,.587,.114));
  float b  = dot(texture2D(inputBuffer, uv + vec2( 0.0,  -px.y)).rgb, vec3(.299,.587,.114));
  float br = dot(texture2D(inputBuffer, uv + vec2( px.x, -px.y)).rgb, vec3(.299,.587,.114));
  float gx = -tl - 2.0*l - bl + tr + 2.0*r + br;
  float gy = -tl - 2.0*t - tr + bl + 2.0*b + br;
  float edge = sqrt(gx*gx + gy*gy);
  outputColor = vec4(vec3(edge * 3.0) * inputColor.rgb * 1.5 + inputColor.rgb * 0.15, inputColor.a);
}`,
  },
  dreamyBlur: {
    label: "Dreamy Blur",
    code: `void mainImage(const in vec4 inputColor, const in vec2 uv, out vec4 outputColor) {
  vec2 px = 1.0 / resolution;
  vec4 acc = vec4(0.0);
  float w = 0.0;
  for (int x = -3; x <= 3; x++) {
    for (int y = -3; y <= 3; y++) {
      float wt = exp(-float(x*x + y*y) * 0.18);
      vec2 off = vec2(float(x), float(y)) * px * 2.5;
      acc += texture2D(inputBuffer, uv + off) * wt;
      w += wt;
    }
  }
  acc /= w;
  float gray = dot(acc.rgb, vec3(.299, .587, .114));
  acc.rgb = mix(vec3(gray), acc.rgb, 1.4);
  outputColor = mix(inputColor, acc, 0.75);
}`,
  },
};

// ─── Component ───────────────────────────────────────────────────────────────

function ShaderEditorContent({ uuid }: { uuid: string }) {
  const effect = useEffectsStore((s) => s.effects[uuid]);
  const setEffect = useEffectsStore((s) => s.setEffect);

  const stored = effect?.type === "customShader" ? effect.fragmentShader : "";

  const [draft, setDraft] = useState(stored);
  const [status, setStatus] = useState<"ok" | "dirty" | "error">("ok");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const apply = useCallback(() => {
    const result = validateGLSL(draft);

    if (!result.ok) {
      setStatus("error");
      setErrorMsg(result.error);
      return;
    }

    // Secondary guard — validateGLSL compiles the raw function body,
    // but postprocessing needs mainImage to exist
    if (!draft.includes("void mainImage")) {
      setStatus("error");
      setErrorMsg(
        "Must define: void mainImage(const in vec4 inputColor, const in vec2 uv, out vec4 outputColor)",
      );
      return;
    }

    setEffect(uuid, { fragmentShader: draft } as never);
    setStatus("ok");
    setErrorMsg(null);
  }, [draft, uuid, setEffect]);

  if (effect?.type !== "customShader") return null;

  return (
    <div className="flex flex-col gap-2 min-h-0">
      <div className="flex items-start gap-2">
        <div className="font-mono text-[10px] leading-relaxed text-muted-foreground bg-muted/20 rounded px-2 py-1.5 select-none flex-1">
          <div>
            <span className="text-sky-400">vec4 </span>
            <span className="text-emerald-400">inputColor</span>
          </div>
          <div>
            <span className="text-sky-400">vec2 </span>
            <span className="text-emerald-400">uv</span>
            <span className="opacity-40"> // 0→1</span>
          </div>
          <div>
            <span className="text-sky-400">float </span>
            <span className="text-emerald-400">time</span>
          </div>
          <div>
            <span className="text-sky-400">sampler2D </span>
            <span className="text-emerald-400">inputBuffer</span>
            <span className="opacity-40"> // for resampling</span>
          </div>
          <div>
            <span className="text-sky-400">vec2 </span>
            <span className="text-emerald-400">resolution</span>
          </div>
        </div>

        <select
          className="font-mono text-[10px] bg-muted/20 border border-border rounded px-2 py-1.5 text-muted-foreground outline-none focus:border-primary/50 cursor-pointer"
          defaultValue=""
          onChange={(e) => {
            const preset = PRESETS[e.target.value];
            if (!preset) return;
            setDraft(preset.code);
            setStatus("dirty");
            setErrorMsg(null);
            e.target.value = "";
          }}
        >
          <option value="" disabled>
            presets
          </option>
          {Object.entries(PRESETS).map(([key, { label }]) => (
            <option key={key} value={key}>
              {label}
            </option>
          ))}
        </select>
      </div>
      <GlslEditor
        value={draft}
        onChange={(v) => {
          setDraft(v);
          setStatus("dirty");
          setErrorMsg(null);
        }}
      />

      {errorMsg && (
        <p className="font-mono text-[10px] text-destructive bg-destructive/10 rounded px-2 py-1 whitespace-pre-wrap leading-relaxed">
          {errorMsg}
        </p>
      )}
      <div className="flex items-center gap-2">
        <button
          onClick={apply}
          className="font-mono text-xs px-3 py-1.5 rounded bg-primary text-primary-foreground hover:bg-primary/90 active:scale-[0.97] transition-all"
        >
          Apply
        </button>
        <span className="ml-auto font-mono text-[10px] text-muted-foreground">
          {status === "ok" && "✓ compiled"}
          {status === "dirty" && "● unsaved"}
          {status === "error" && "✗ error"}
        </span>
      </div>
    </div>
  );
}

export function ShaderEditorProvider() {
  const [state, setState] = useState<ShaderEditorState>({
    open: false,
    uuid: null,
  });

  useEffect(() => {
    _listener = (next) => setState(next);
    return () => {
      _listener = null;
    };
  }, []);

  const onClose = () => setState({ open: false, uuid: null });

  if (!state.open || !state.uuid) return null;

  return createPortal(
    <Dialog open={true} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-2xl z-999">
        <DialogHeader>
          <DialogTitle className="font-mono text-sm">
            Fragment Shader
            <span className="ml-2 text-[10px] font-normal text-muted-foreground opacity-50">
              ⌘↵ apply
            </span>
          </DialogTitle>
        </DialogHeader>
        <ShaderEditorContent uuid={state.uuid} />
      </DialogContent>
    </Dialog>,
    document.body,
  );
}
