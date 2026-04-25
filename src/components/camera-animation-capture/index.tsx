import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { DisclaimerStep } from "./disclaimer-step";
import { CaptureStep } from "./capture-step";
import { ReviewStep } from "./review-step";
import { SaveStep } from "./save-step";
import type { PoseFrame } from "@/utils/pose-to-animation";
import { MIXAMO_DEFAULT_REMAP, type BoneRemap } from "@/utils/bone-remap";
import { cn } from "@/lib/utils";

type Step = "disclaimer" | "capture" | "review" | "save";

type CaptureState = {
  open: boolean;
  modelUuid: string;
};

type Listener = (state: CaptureState) => void;
let _listener: Listener | null = null;

function dispatch(state: CaptureState) {
  _listener?.(state);
}

export function openCameraCapture(modelUuid: string) {
  dispatch({ open: true, modelUuid });
}

export function CameraAnimationCaptureProvider() {
  const [state, setState] = useState<CaptureState>({
    open: false,
    modelUuid: "",
  });
  const [step, setStep] = useState<Step>("disclaimer");
  const [frames, setFrames] = useState<PoseFrame[]>([]);
  const [remap, setRemap] = useState<BoneRemap>({ ...MIXAMO_DEFAULT_REMAP });

  useEffect(() => {
    _listener = (next) => {
      setState(next);
      setStep("disclaimer");
      setFrames([]);
      setRemap({ ...MIXAMO_DEFAULT_REMAP });
    };
    return () => {
      _listener = null;
    };
  }, []);

  const close = () => setState((s) => ({ ...s, open: false }));

  if (!state.open) return null;

  const stepTitles: Record<Step, string> = {
    disclaimer: "Camera Animation Capture",
    capture: "Record Movement",
    review: "Review Captured Poses",
    save: "Save Animation",
  };

  return createPortal(
    <div className="fixed inset-0 z-999 backdrop-blur-xs overflow-auto">
      <Dialog open={true} onOpenChange={close}>
        <DialogContent
          className={cn([
            "z-999 items-baseline justify-center overflow-auto",
            (step === "capture" || step === "review") &&
              "sm:max-w-dvw max-w-dvw w-[90dvw] h-[90vh]",
          ])}
        >
          <DialogHeader>
            <DialogTitle>{stepTitles[step]}</DialogTitle>
          </DialogHeader>

          {step === "disclaimer" && (
            <DisclaimerStep
              onAccept={() => setStep("capture")}
              onCancel={close}
            />
          )}

          {step === "capture" && (
            <CaptureStep
              modelUuid={state.modelUuid}
              onFramesReady={(f, r) => {
                setFrames(f);
                setRemap(r);
                setStep("review");
              }}
              onCancel={close}
            />
          )}

          {step === "review" && (
            <ReviewStep
              frames={frames}
              remap={remap}
              modelUuid={state.modelUuid}
              onConfirm={(edited: PoseFrame[]) => {
                setFrames(edited);
                setStep("save");
              }}
              onBack={() => setStep("capture")}
            />
          )}

          {step === "save" && (
            <SaveStep
              frames={frames}
              modelUuid={state.modelUuid}
              onDone={close}
              onBack={() => setStep("review")}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>,
    document.body,
  );
}
