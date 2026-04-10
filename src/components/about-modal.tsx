import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { createPortal } from "react-dom";
import { useEffect, useState } from "react";

type AboutModalState = {
  open: boolean;
};

type Listener = (state: AboutModalState) => void;
let _listener: Listener | null = null;

function dispatch(state: AboutModalState) {
  _listener?.(state);
}

// eslint-disable-next-line react-refresh/only-export-components
export function openAbout() {
  dispatch({ open: true });
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
      <DialogContent className="sm:max-w-150 z-999">
        <DialogHeader>
          <DialogTitle>About</DialogTitle>
        </DialogHeader>

        <div className="space-y-6 text-sm">
          <section>
            <h3 className="font-semibold text-base mb-1">This Software</h3>
            <p className="text-muted-foreground">
              Sprite Sheet Helper is a lightweight tool for creating,
              previewing, and exporting sprite sheets quickly and efficiently.
              It focuses on fast iteration, simplicity, and a clean workflow.
            </p>

            <a
              href="https://github.com/Kyonru/sprite-sheet-helper"
              target="_blank"
              className="text-primary underline text-sm"
            >
              View repository
            </a>
          </section>

          <section>
            <h3 className="font-semibold text-base mb-1">About the Creator</h3>
            <p className="text-muted-foreground">
              Kyonru, software engineer and a game developer.
            </p>
            <div className="flex flex-col gap-1">
              <a
                href="https://github.com/Kyonru"
                target="_blank"
                className="text-primary underline"
              >
                GitHub
              </a>

              <a
                href="https://www.linkedin.com/in/kyonru/"
                target="_blank"
                className="text-primary underline"
              >
                LinkedIn
              </a>
            </div>
          </section>

          <section>
            <h3 className="font-semibold text-base mb-1">Support / Donate</h3>

            <p className="text-muted-foreground">
              If you find this tool useful, consider supporting development.
            </p>

            <a
              href="https://github.com/sponsors/Kyonru"
              target="_blank"
              className="text-primary underline"
            >
              Sponsor on GitHub
            </a>
          </section>

          <section>
            <h3 className="font-semibold text-base mb-1">Report an Issue</h3>

            <p className="text-muted-foreground">
              Found a bug or want to request a feature?
            </p>

            <a
              href="https://github.com/Kyonru/sprite-sheet-helper/issues"
              target="_blank"
              className="text-primary underline"
            >
              Open an issue
            </a>
          </section>
        </div>
      </DialogContent>
    </Dialog>,
    document.body,
  );
}
