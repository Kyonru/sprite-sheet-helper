import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { createPortal } from "react-dom";
import { useEffect, useState } from "react";
import { Heart, Bug, ExternalLink, Layers, User } from "lucide-react";

function GitHubIcon({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 0C5.374 0 0 5.373 0 12c0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23A11.509 11.509 0 0 1 12 5.803c1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576C20.566 21.797 24 17.3 24 12c0-6.627-5.373-12-12-12z" />
    </svg>
  );
}

function LinkedInIcon({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
      <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 0 1-2.063-2.065 2.064 2.064 0 1 1 2.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
    </svg>
  );
}
import { Separator } from "@/components/ui/separator";

type AboutModalState = { open: boolean };
type Listener = (state: AboutModalState) => void;
let _listener: Listener | null = null;

function dispatch(state: AboutModalState) {
  _listener?.(state);
}

// eslint-disable-next-line react-refresh/only-export-components
export function openAbout() {
  dispatch({ open: true });
}

interface LinkRowProps {
  href: string;
  icon: React.ReactNode;
  label: string;
}

function LinkRow({ href, icon, label }: LinkRowProps) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="flex items-center gap-2 text-sm px-3 py-2 rounded-md border border-border hover:bg-muted transition-colors group"
    >
      {icon}
      <span>{label}</span>
      <ExternalLink
        size={11}
        className="ml-auto opacity-0 group-hover:opacity-40 transition-opacity"
      />
    </a>
  );
}

export function AboutModalProvider() {
  const [state, setState] = useState<AboutModalState>({ open: false });

  useEffect(() => {
    _listener = (next) => setState(next);
    return () => {
      _listener = null;
    };
  }, []);

  const onClose = () => setState({ open: false });

  if (!state.open) return null;

  return createPortal(
    <Dialog open={true} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md z-999 p-0 overflow-hidden gap-0">
        <DialogHeader className="sr-only">
          <DialogTitle>About</DialogTitle>
        </DialogHeader>

        <div
          className="relative px-6 pt-8 pb-6 overflow-hidden text-white select-none"
          style={{
            background:
              "linear-gradient(135deg, oklch(0.18 0.06 270) 0%, oklch(0.20 0.10 250) 50%, oklch(0.17 0.07 290) 100%)",
          }}
        >
          <div
            className="pointer-events-none absolute -top-8 -right-8 w-40 h-40 rounded-full opacity-20"
            style={{
              background: "radial-gradient(circle, white, transparent 70%)",
            }}
          />
          <div
            className="pointer-events-none absolute -bottom-6 -left-6 w-28 h-28 rounded-full opacity-10"
            style={{
              background: "radial-gradient(circle, white, transparent 70%)",
            }}
          />

          <div className="relative flex items-center gap-3 mb-3">
            <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-white/10 backdrop-blur-sm border border-white/20">
              <Layers size={20} />
            </div>
            <div>
              <h2 className="text-lg font-bold tracking-tight leading-tight">
                Sprite Sheet Helper
              </h2>
              <p className="text-xs opacity-50 font-mono">open source</p>
            </div>
          </div>

          <p className="relative text-sm opacity-70 leading-relaxed max-w-xs">
            Lightweight tool for creating, previewing, and exporting sprite
            sheets. Built for fast iteration and clean workflows.
          </p>

          <div className="relative flex gap-2 mt-4 flex-wrap">
            <a
              href="https://github.com/Kyonru/sprite-sheet-helper"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full bg-white/10 hover:bg-white/20 border border-white/20 transition-colors"
            >
              <GitHubIcon size={12} />
              Repository
            </a>
            <a
              href="https://github.com/Kyonru/sprite-sheet-helper/issues"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full bg-white/10 hover:bg-white/20 border border-white/20 transition-colors"
            >
              <Bug size={12} />
              Report an issue
            </a>
          </div>
        </div>

        <div className="px-6 py-5 flex flex-col gap-5">
          <div className="flex items-start gap-3">
            <div className="flex items-center justify-center w-9 h-9 rounded-full bg-muted border shrink-0 mt-0.5">
              <User size={16} className="text-muted-foreground" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-sm">Kyonru</p>
              <p className="text-xs text-muted-foreground mb-2">
                Software engineer &amp; game developer
              </p>
              <div className="flex flex-col gap-1.5">
                <LinkRow
                  href="https://github.com/Kyonru"
                  icon={<GitHubIcon size={13} />}
                  label="GitHub"
                />
                <LinkRow
                  href="https://www.linkedin.com/in/kyonru/"
                  icon={<LinkedInIcon size={13} />}
                  label="LinkedIn"
                />
              </div>
            </div>
          </div>

          <Separator />

          <div>
            <p className="text-sm font-semibold mb-1">Support development</p>
            <p className="text-xs text-muted-foreground mb-3">
              If this tool saves you time, consider sponsoring to keep it going.
            </p>
            <a
              href="https://github.com/sponsors/Kyonru"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 text-sm px-4 py-2 rounded-md bg-primary text-primary-foreground hover:bg-primary/90 transition-colors w-full justify-center font-medium"
            >
              <Heart size={14} />
              Sponsor on GitHub
            </a>
          </div>
        </div>
      </DialogContent>
    </Dialog>,
    document.body,
  );
}
