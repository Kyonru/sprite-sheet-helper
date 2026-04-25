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
import {
  Search,
  X,
  FileText,
  Rocket,
  Play,
  Camera,
  Video,
  Sparkles,
  Sun,
  Download,
  GitBranch,
  FolderOpen,
  Terminal,
  BookOpen,
} from "lucide-react";

// ── Types ─────────────────────────────────────────────────────────────────────

type DocsModalState = { open: boolean };
type Listener = (state: DocsModalState) => void;
let _listener: Listener | null = null;

function dispatch(state: DocsModalState) {
  _listener?.(state);
}

// eslint-disable-next-line react-refresh/only-export-components
export function openDocs() {
  dispatch({ open: true });
}

type DocEntry = { id: string; title: string; content: string };

// ── Helpers ───────────────────────────────────────────────────────────────────

function parseFrontmatter(raw: string) {
  const match = raw.match(/^---\n([\s\S]*?)\n---\n?/);
  if (!match) return { data: {}, content: raw };
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

const DOC_ORDER = [
  "getting-started",
  "tutorial",
  "projects",
  "animations",
  "camera-capture",
  "camera",
  "effects",
  "lighting",
  "exporting",
  "workflows",
  "cli",
];

function docSlug(id: string): string {
  return id.split("/").pop()?.replace(".md", "") ?? "";
}

function parseDocs(): DocEntry[] {
  const rawDocs = import.meta.glob("/src/docs/**/*.md", {
    eager: true,
    as: "raw",
  });
  const entries = Object.entries(rawDocs).map(([path, raw]) => {
    const { data, content } = parseFrontmatter(raw as string);
    return {
      id: path,
      title: data.title || docSlug(path) || "Untitled",
      content,
    };
  });
  return entries.sort((a, b) => {
    const ia = DOC_ORDER.indexOf(docSlug(a.id));
    const ib = DOC_ORDER.indexOf(docSlug(b.id));
    return (ia === -1 ? DOC_ORDER.length : ia) - (ib === -1 ? DOC_ORDER.length : ib);
  });
}

const SLUG_ICONS: Record<string, React.ReactNode> = {
  "getting-started": <Rocket size={14} />,
  animations: <Play size={14} />,
  camera: <Camera size={14} />,
  "camera-capture": <Video size={14} />,
  effects: <Sparkles size={14} />,
  lighting: <Sun size={14} />,
  exporting: <Download size={14} />,
  workflows: <GitBranch size={14} />,
  projects: <FolderOpen size={14} />,
  cli: <Terminal size={14} />,
  tutorial: <BookOpen size={14} />,
};

function docIcon(id: string): React.ReactNode {
  return SLUG_ICONS[docSlug(id)] ?? <FileText size={14} />;
}

// ── Component ─────────────────────────────────────────────────────────────────

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
    return () => { _listener = null; };
  }, []);

  useEffect(() => {
    if (state.open && docs.length > 0) setSelected(docs[0]);
  }, [state.open, docs]);

  const onClose = () => { setState({ open: false }); setQuery(""); };

  if (!state.open) return null;

  return createPortal(
    <div className="fixed inset-0 z-999 backdrop-blur-xs w-full">
      <Dialog open={true} onOpenChange={onClose}>
        <DialogContent className="sm:max-w-[90vw] h-[85vh] flex flex-col z-999 gap-0 p-0 overflow-hidden">
          <DialogHeader className="sr-only">
            <DialogTitle>Documentation</DialogTitle>
          </DialogHeader>

          {/* ── Top bar ──────────────────────────────────────────────────── */}
          <div className="flex items-center gap-3 px-4 py-3 border-b shrink-0">
            <span className="text-sm font-semibold text-foreground">Documentation</span>
            <div className="relative flex-1 max-w-xs">
              <Search
                size={13}
                className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none"
              />
              <Input
                placeholder="Search…"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                className="pl-7 pr-7 h-8 text-sm"
              />
              {query && (
                <button
                  type="button"
                  onClick={() => setQuery("")}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  <X size={12} />
                </button>
              )}
            </div>
          </div>

          {/* ── Body ─────────────────────────────────────────────────────── */}
          <div className="flex flex-1 overflow-hidden">

            {/* Sidebar */}
            <div className="w-56 shrink-0 border-r flex flex-col overflow-hidden">
              <p className="px-3 pt-3 pb-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                {query ? `${results.length} result${results.length !== 1 ? "s" : ""}` : `${docs.length} pages`}
              </p>
              <nav className="flex-1 overflow-y-auto py-1">
                {results.length === 0 ? (
                  <p className="px-3 py-4 text-xs text-muted-foreground text-center">
                    No results for &ldquo;{query}&rdquo;
                  </p>
                ) : (
                  results.map((doc) => {
                    const isActive = selected?.id === doc.id;
                    return (
                      <button
                        key={doc.id}
                        type="button"
                        onClick={() => setSelected(doc)}
                        className={[
                          "w-full flex items-center gap-2 px-3 py-2 text-sm text-left transition-colors",
                          "border-l-2",
                          isActive
                            ? "border-primary bg-muted text-foreground font-medium"
                            : "border-transparent text-muted-foreground hover:bg-muted/60 hover:text-foreground",
                        ].join(" ")}
                      >
                        <span className="shrink-0 opacity-60">{docIcon(doc.id)}</span>
                        <span className="truncate">{doc.title}</span>
                      </button>
                    );
                  })
                )}
              </nav>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto">
              {selected ? (
                <>
                  {/* Document header */}
                  <div className="px-6 pt-5 pb-4 border-b">
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <span className="opacity-60">{docIcon(selected.id)}</span>
                      <h2 className="text-base font-semibold text-foreground">
                        {selected.title}
                      </h2>
                    </div>
                  </div>

                  {/* Markdown body */}
                  <div className="px-6 py-5 prose dark:prose-invert max-w-none prose-sm">
                    <ReactMarkdown
                      remarkPlugins={[remarkGfm]}
                      rehypePlugins={[rehypeHighlight]}
                      components={{
                        a: ({ href, children }) => {
                          const target = href
                            ? docs.find(
                                (d) =>
                                  d.id.endsWith(`/${href}.md`) ||
                                  d.id.endsWith(`/${href}`),
                              )
                            : null;
                          if (target) {
                            return (
                              <button
                                type="button"
                                className="text-primary underline cursor-pointer font-normal"
                                onClick={() => setSelected(target)}
                              >
                                {children}
                              </button>
                            );
                          }
                          return (
                            <a href={href} target="_blank" rel="noopener noreferrer">
                              {children}
                            </a>
                          );
                        },
                      }}
                    >
                      {selected.content}
                    </ReactMarkdown>
                  </div>
                </>
              ) : (
                <div className="flex items-center justify-center h-full text-muted-foreground text-sm">
                  Select a page
                </div>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>,
    document.body,
  );
}
