import { CompletionContext } from "@codemirror/autocomplete";

import { GLSL_COMPLETIONS } from "./globals";

export function glslCompletions(context: CompletionContext) {
  const word = context.matchBefore(/\w*/);
  if (!word || (word.from === word.to && !context.explicit)) return null;
  return { from: word.from, options: GLSL_COMPLETIONS };
}
