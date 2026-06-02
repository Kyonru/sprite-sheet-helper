/* eslint-disable react-refresh/only-export-components */
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { PoseStudioShell } from "./pose-studio-shell";

type PoseStudioState = {
  open: boolean;
  modelUuid: string;
};

type Listener = (state: PoseStudioState) => void;

let listener: Listener | null = null;

function dispatch(state: PoseStudioState) {
  listener?.(state);
}

export function openPoseStudio(modelUuid: string) {
  dispatch({ open: true, modelUuid });
}

export function openCameraCapture(modelUuid: string) {
  openPoseStudio(modelUuid);
}

export function PoseStudioProvider() {
  const [state, setState] = useState<PoseStudioState>({
    open: false,
    modelUuid: "",
  });

  useEffect(() => {
    listener = setState;
    return () => {
      listener = null;
    };
  }, []);

  const close = () => setState((current) => ({ ...current, open: false }));

  if (!state.open) return null;

  return createPortal(
    <Dialog open={true} onOpenChange={close}>
      <DialogContent
        showCloseButton
        className="z-999 h-[94dvh] w-[96dvw] max-w-[96dvw] overflow-hidden p-0 sm:max-w-[96dvw]"
      >
        <DialogHeader className="sr-only">
          <DialogTitle>Pose Studio</DialogTitle>
        </DialogHeader>
        <PoseStudioShell
          key={state.modelUuid}
          modelUuid={state.modelUuid}
          onClose={close}
        />
      </DialogContent>
    </Dialog>,
    document.body,
  );
}

export const CameraAnimationCaptureProvider = PoseStudioProvider;
