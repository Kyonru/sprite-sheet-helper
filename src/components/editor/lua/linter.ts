import { linter, lintGutter, type Diagnostic } from "@codemirror/lint";
import * as luaparse from "luaparse";

export interface Token {
  line: number;
  column: number;
  message: string;
}

const luaLinter = linter((view) => {
  const diagnostics: Diagnostic[] = [];
  const code = view.state.doc.toString();

  try {
    luaparse.parse(code, { luaVersion: "5.3" });
  } catch (e: unknown) {
    const error = e as Token;

    // luaparse errors have line/column info
    if (error.line !== undefined) {
      const line = view.state.doc.line(error.line);
      const from = line.from + (error.column ?? 0);

      diagnostics.push({
        from,
        to: from + 1,
        severity: "error",
        message: error.message,
      });
    }
  }

  return diagnostics;
});

export default {
  linter: luaLinter,
  indicators: lintGutter,
};
