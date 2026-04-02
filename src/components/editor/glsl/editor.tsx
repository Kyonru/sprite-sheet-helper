import { useRef, useEffect } from "react";
import { EditorState } from "@codemirror/state";
import { EditorView, keymap } from "@codemirror/view";
import { defaultKeymap, historyKeymap } from "@codemirror/commands";
import { basicSetup } from "codemirror";
import { StreamLanguage } from "@codemirror/language";
import {
  autocompletion,
  completionKeymap,
  closeBracketsKeymap,
} from "@codemirror/autocomplete";
import { oneDark } from "@codemirror/theme-one-dark";
import { glslCompletions } from ".";
import { glslLanguage, glslLinter } from "./linter";

interface GlslEditorProps {
  value?: string;
  onChange?: (value: string) => void;
}

export function GlslEditor({ value = "", onChange }: GlslEditorProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<EditorView | null>(null);
  // Track the last value we pushed in so we can avoid echo-back loops
  const lastPushed = useRef<string>(value);

  useEffect(() => {
    if (!containerRef.current) return;

    const state = EditorState.create({
      doc: value,
      extensions: [
        basicSetup,
        StreamLanguage.define(glslLanguage),
        oneDark,
        autocompletion({
          override: [glslCompletions],
          activateOnTyping: true,
        }),
        keymap.of([
          ...closeBracketsKeymap,
          ...defaultKeymap,
          ...historyKeymap,
          ...completionKeymap,
        ]),
        glslLinter,
        EditorView.updateListener.of((update) => {
          if (update.docChanged) {
            const next = update.state.doc.toString();
            lastPushed.current = next;
            onChange?.(next);
          }
        }),
      ],
    });

    viewRef.current = new EditorView({ state, parent: containerRef.current });

    return () => {
      viewRef.current?.destroy();
      viewRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Sync external value changes (preset selection) into the live editor
  useEffect(() => {
    const view = viewRef.current;
    if (!view) return;
    if (value === lastPushed.current) return; // came from our own onChange, skip

    lastPushed.current = value;
    view.dispatch({
      changes: {
        from: 0,
        to: view.state.doc.length,
        insert: value,
      },
    });
  }, [value]);

  return (
    <div
      ref={containerRef}
      className="h-80 rounded overflow-hidden text-xs [&_.cm-editor]:h-full [&_.cm-scroller]:overflow-auto"
    />
  );
}
