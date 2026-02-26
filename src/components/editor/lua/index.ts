import { type CompletionContext } from "@codemirror/autocomplete";

import LUA_GLOBALS from "./globals";

export function luaCompletions(context: CompletionContext) {
  const word = context.matchBefore(/[\w.]+/);
  if (!word) return null;
  return {
    from: word.from,
    options: LUA_GLOBALS,
  };
}
