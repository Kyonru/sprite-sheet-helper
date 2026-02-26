import { useRef, useEffect } from "react";
import { EditorState } from "@codemirror/state";
import { EditorView, keymap } from "@codemirror/view";
import { defaultKeymap, historyKeymap } from "@codemirror/commands";
import { basicSetup } from "codemirror";
import { StreamLanguage } from "@codemirror/language";
import { lua } from "@codemirror/legacy-modes/mode/lua";
import {
  autocompletion,
  completionKeymap,
  closeBracketsKeymap,
} from "@codemirror/autocomplete";
import { oneDark } from "@codemirror/theme-one-dark";
import { luaCompletions } from "./lua";
import luaLinter from "./lua/linter";

interface EditorProps {
  value?: string;
  onChange?: (value: string) => void;
}

export const Editor = ({ value = "", onChange }: EditorProps) => {
  const editorRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<EditorView | null>(null);

  useEffect(() => {
    if (!editorRef.current) return;

    const state = EditorState.create({
      doc: value,
      extensions: [
        basicSetup,
        StreamLanguage.define(lua),
        oneDark,
        luaLinter.linter,
        luaLinter.indicators(),
        autocompletion({ override: [luaCompletions], activateOnTyping: true }),
        keymap.of([
          ...closeBracketsKeymap,
          ...defaultKeymap,
          ...historyKeymap,
          ...completionKeymap,
        ]),
        EditorView.updateListener.of((update) => {
          if (update.docChanged) {
            onChange?.(update.state.doc.toString());
          }
        }),
      ],
    });

    viewRef.current = new EditorView({ state, parent: editorRef.current });

    return () => {
      viewRef.current?.destroy();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // only mount once

  return <div className="h-full rounded-md overflow-hidden" ref={editorRef} />;
};
