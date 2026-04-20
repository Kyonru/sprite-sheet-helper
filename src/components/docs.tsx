import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { createPortal } from "react-dom";
import { useEffect, useMemo, useState } from "react";
import Fuse from "fuse.js";
import ReactMarkdown from "react-markdown";
import rehypeHighlight from "rehype-highlight";
import remarkGfm from "remark-gfm";
import "highlight.js/styles/github-dark.css";

type DocsModalState = {
  open: boolean;
};

type Listener = (state: DocsModalState) => void;
let _listener: Listener | null = null;

function dispatch(state: DocsModalState) {
  _listener?.(state);
}

// eslint-disable-next-line react-refresh/only-export-components
export function openDocs() {
  dispatch({ open: true });
}

type DocEntry = {
  id: string;
  title: string;
  content: string;
};

function parseFrontmatter(raw: string) {
  const match = raw.match(/^---\n([\s\S]*?)\n---\n?/);

  if (!match) {
    return { data: {}, content: raw };
  }

  const yaml = match[1];
  const content = raw.slice(match[0].length);

  const data: Record<string, string> = {};

  yaml.split("\n").forEach((line) => {
    const [key, ...rest] = line.split(":");
    if (!key) return;
    data[key.trim()] = rest.join(":").trim();
  });

  return { data, content };
}

function parseDocs(): DocEntry[] {
  const rawDocs = import.meta.glob("/src/docs/**/*.md", {
    eager: true,
    as: "raw",
  });

  return Object.entries(rawDocs).map(([path, raw]) => {
    const { data, content } = parseFrontmatter(raw as string);

    return {
      id: path,
      title:
        data.title || path.split("/").pop()?.replace(".md", "") || "Untitled",
      content,
    };
  });
}

export function DocsModalProvider() {
  const [state, setState] = useState<DocsModalState>({ open: false });
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<DocEntry | null>(null);

  const docs = useMemo(() => parseDocs(), []);

  const fuse = useMemo(
    () =>
      new Fuse(docs, {
        keys: ["title", "content"],
        threshold: 0.2,
        minMatchCharLength: 2,
        ignoreLocation: true,
        useExtendedSearch: true,
      }),
    [docs],
  );

  const results = query ? fuse.search(query).map((r) => r.item) : docs;

  useEffect(() => {
    _listener = (next) => setState(next);
    return () => {
      _listener = null;
    };
  }, []);

  useEffect(() => {
    if (state.open && docs.length > 0) {
      setSelected(docs[0]);
    }
  }, [state.open, docs]);

  const onClose = () => {
    setState({ open: false });
    setQuery("");
  };

  if (!state.open) return null;

  return createPortal(
    <div className="fixed inset-0 z-999 backdrop-blur-xs w-full">
      <Dialog open={true} onOpenChange={onClose}>
        <DialogContent className="sm:max-w-[90vw] h-[85vh] flex flex-col z-999">
          <DialogHeader>
            <DialogTitle>Documentation</DialogTitle>
          </DialogHeader>

          <Input
            placeholder="Search docs..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="mt-2"
          />

          <div className="flex flex-1 overflow-hidden mt-4 border rounded-md w-full">
            <div className="w-1/3 border-r overflow-y-auto">
              {results.map((doc) => (
                <button
                  key={doc.id}
                  onClick={() => setSelected(doc)}
                  className={`w-full text-left px-3 py-2 text-sm hover:bg-muted ${
                    selected?.id === doc.id ? "bg-muted" : ""
                  }`}
                >
                  {doc.title}
                </button>
              ))}
            </div>

            <div className="flex-1 overflow-y-auto p-4 prose dark:prose-invert max-w-none">
              {selected ? (
                <ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeHighlight]}>
                  {selected.content}
                </ReactMarkdown>
              ) : (
                <p className="text-sm text-muted-foreground">
                  Select a document
                </p>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>,
    document.body,
  );
}
