import {
  Component,
  type ReactNode,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import {
  AlertTriangle,
  ChevronDown,
  Copy,
  Download,
  Loader2,
  RefreshCw,
  RotateCcw,
} from "lucide-react";
import { toast } from "sonner";
import type { ErrorInfo } from "react";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { useProjectStore } from "@/store/next/project";
import { migrateSnapshot } from "@/store/next/project/migration";
import { useCamerasStore } from "@/store/next/cameras";
import { useEffectsStore } from "@/store/next/effects";
import { useEntitiesStore } from "@/store/next/entities";
import { useHistoryStore } from "@/store/next/history";
import { useImagesStore } from "@/store/next/images";
import { useLightsStore } from "@/store/next/lights";
import { useMaterialsStore } from "@/store/next/materials";
import { useModelDowngradesStore } from "@/store/next/model-downgrades";
import { useModelsStore } from "@/store/next/models";
import { useSettingsStore } from "@/store/next/settings";
import { useTargetsStore } from "@/store/next/targets";
import { useTransformsStore } from "@/store/next/transforms";
import { useAuthoredModelsStore } from "@/store/next/authored-models";
import { downloadFile } from "@/utils/assets";
import {
  buildRecoveryMeta,
  clearRecoveryEnvelope,
  loadRecoveryEnvelope,
  saveRecoveryEnvelope,
} from "@/utils/project-recovery";

import type { ProjectSnapshot } from "@/types/project";

const RECOVERY_DEBOUNCE_MS = 1100;

type CrashSource = "render" | "window.onerror" | "unhandledrejection";

type CrashInfo = {
  source: CrashSource;
  timestamp: number;
  message: string;
  stack?: string;
  componentStack?: string;
  filename?: string;
  lineno?: number;
  colno?: number;
};

class CrashBoundary extends Component<
  {
    onCrash: (error: Error, info: ErrorInfo) => void;
    children: ReactNode;
  },
  { isCrashed: boolean }
> {
  constructor(props: {
    onCrash: (error: Error, info: ErrorInfo) => void;
    children: ReactNode;
  }) {
    super(props);
    this.state = { isCrashed: false };
  }

  static getDerivedStateFromError() {
    return { isCrashed: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    this.props.onCrash(error, info);
  }

  render() {
    if (this.state.isCrashed) {
      return null;
    }

    return this.props.children;
  }
}

function buildDebugPayload(
  crash: CrashInfo,
  snapshot: ProjectSnapshot,
) {
  const history = snapshot.history;

  return {
    version: 1,
    crash,
    project: {
      version: snapshot.version,
      name: snapshot.settings.name,
      savedAt: snapshot.savedAt,
      lastActions: {
        past: history.past.slice(-20),
        future: history.future.slice(0, 20),
        transaction: history.transaction,
        isDirty: history.isDirty,
      },
    },
    runtime: {
      url: window.location.href,
      userAgent: window.navigator.userAgent,
    },
    timestamp: new Date().toISOString(),
  };
}

function formatCrashFilename(timestamp: number): string {
  return `debug-trail-${new Date(timestamp).toISOString().replace(/[:.]/g, "-")}.zip`;
}

const CRASH_SOURCE_LABELS: Record<CrashSource, string> = {
  render: "Render error",
  "window.onerror": "Runtime error",
  unhandledrejection: "Unhandled promise rejection",
};

function buildCrashDetails(crash: CrashInfo): string {
  const location = crash.filename
    ? `${crash.filename}${crash.lineno != null ? `:${crash.lineno}${crash.colno != null ? `:${crash.colno}` : ""}` : ""}`
    : null;

  return [
    crash.message,
    location && `at ${location}`,
    crash.stack,
    crash.componentStack && `Component stack:${crash.componentStack}`,
  ]
    .filter(Boolean)
    .join("\n\n");
}

export function CrashRecoveryManager({
  children,
}: {
  children: ReactNode;
}) {
  const [isReady, setIsReady] = useState(false);
  const [crash, setCrash] = useState<CrashInfo | null>(null);
  const [isDebugSaving, setIsDebugSaving] = useState(false);

  const flushTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isBootstrapping = useRef(true);
  const hasHandledCrash = useRef(false);

  const snapshotForRecovery = useCallback(() => {
    const projectStore = useProjectStore.getState();
    return projectStore.snapshot();
  }, []);

  const scheduleRecoveryPersist = useCallback((source: string) => {
    if (isBootstrapping.current) return;

    if (flushTimer.current) clearTimeout(flushTimer.current);
    flushTimer.current = setTimeout(() => {
      const snapshot = snapshotForRecovery();
      saveRecoveryEnvelope(snapshot, buildRecoveryMeta(source));
    }, RECOVERY_DEBOUNCE_MS);
  }, [snapshotForRecovery]);

  const flushRecovery = useCallback((source: string) => {
    if (flushTimer.current) {
      clearTimeout(flushTimer.current);
      flushTimer.current = null;
    }
    const snapshot = snapshotForRecovery();
    saveRecoveryEnvelope(snapshot, buildRecoveryMeta(source));
  }, [snapshotForRecovery]);

  const handleCrash = useCallback(
    (payload: CrashInfo) => {
      if (hasHandledCrash.current) return;
      hasHandledCrash.current = true;
      setCrash(payload);
      const snapshot = snapshotForRecovery();
      saveRecoveryEnvelope(snapshot, buildRecoveryMeta(`crash:${payload.source}`));
    },
    [snapshotForRecovery],
  );

  useEffect(() => {
    const restore = async () => {
      const envelope = loadRecoveryEnvelope();
      if (!envelope) {
        isBootstrapping.current = false;
        setIsReady(true);
        return;
      }

      try {
        const snapshot = migrateSnapshot(envelope.projectSnapshot);
        await useProjectStore.getState().applySnapshot(snapshot);
      } catch (error) {
        console.error("[recovery] failed to restore project", error);
        clearRecoveryEnvelope();
        useProjectStore.getState().forceReset();
      } finally {
        isBootstrapping.current = false;
        setIsReady(true);
      }
    };

    restore();
  }, []);

  useEffect(() => {
    if (!isReady) return;

    const unsubs: Array<() => void> = [
      useEntitiesStore.subscribe(() => scheduleRecoveryPersist("entities")),
      useTransformsStore.subscribe(() => scheduleRecoveryPersist("transforms")),
      useModelsStore.subscribe(() => scheduleRecoveryPersist("models")),
      useCamerasStore.subscribe(() => scheduleRecoveryPersist("cameras")),
      useHistoryStore.subscribe(() => scheduleRecoveryPersist("history")),
      useTargetsStore.subscribe(() => scheduleRecoveryPersist("targets")),
      useLightsStore.subscribe(() => scheduleRecoveryPersist("lights")),
      useImagesStore.subscribe(() => scheduleRecoveryPersist("images")),
      useSettingsStore.subscribe(() => scheduleRecoveryPersist("settings")),
      useEffectsStore.subscribe(() => scheduleRecoveryPersist("effects")),
      useMaterialsStore.subscribe(() => scheduleRecoveryPersist("materials")),
      useModelDowngradesStore.subscribe(() =>
        scheduleRecoveryPersist("modelDowngrades"),
      ),
      useAuthoredModelsStore.subscribe(() =>
        scheduleRecoveryPersist("authoredModels"),
      ),
    ];

    const onVisibility = () => {
      if (document.visibilityState === "hidden") {
        flushRecovery("visibility-hidden");
      }
    };
    const onPageHide = () => flushRecovery("pagehide");
    const onBeforeUnload = () => flushRecovery("beforeunload");
    const onWindowError = (event: ErrorEvent) => {
      handleCrash({
        source: "window.onerror",
        timestamp: Date.now(),
        message: event.message || "Unknown error",
        stack: event.error?.stack,
        filename: event.filename,
        lineno: event.lineno,
        colno: event.colno,
      });
    };
    const onUnhandledRejection = (event: PromiseRejectionEvent) => {
      const reason = event.reason;
      const message =
        reason instanceof Error ? reason.message : `${reason ?? "Unknown error"}`;
      const stack = reason instanceof Error ? reason.stack : undefined;

      handleCrash({
        source: "unhandledrejection",
        timestamp: Date.now(),
        message,
        stack,
      });
    };

    window.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("pagehide", onPageHide);
    window.addEventListener("beforeunload", onBeforeUnload);
    window.addEventListener("error", onWindowError);
    window.addEventListener("unhandledrejection", onUnhandledRejection);

    return () => {
      unsubs.forEach((unsubscribe) => unsubscribe());
      window.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("pagehide", onPageHide);
      window.removeEventListener("beforeunload", onBeforeUnload);
      window.removeEventListener("error", onWindowError);
      window.removeEventListener("unhandledrejection", onUnhandledRejection);
      if (flushTimer.current) clearTimeout(flushTimer.current);
    };
  }, [flushRecovery, isReady, scheduleRecoveryPersist, handleCrash]);

  const handleSaveDebugTrail = useCallback(async () => {
    if (!crash) return;
    setIsDebugSaving(true);

    try {
      const snapshot = snapshotForRecovery();
      const payload = buildDebugPayload(crash, snapshot);
      const blob = await useProjectStore
        .getState()
        .buildZipBlob(snapshot, payload);

      downloadFile(blob, formatCrashFilename(crash.timestamp));
      toast.success("Debug trail saved");
    } catch (error) {
      console.error("[crash] failed to save debug trail", error);
      toast.error("Failed to save debug trail");
    } finally {
      setIsDebugSaving(false);
    }
  }, [crash, snapshotForRecovery]);

  const handleCopyDetails = useCallback(async () => {
    if (!crash) return;

    try {
      await navigator.clipboard.writeText(buildCrashDetails(crash));
      toast.success("Crash details copied");
    } catch (error) {
      console.error("[crash] failed to copy details", error);
      toast.error("Failed to copy crash details");
    }
  }, [crash]);

  const handleReloadAndRestore = useCallback(() => {
    // The recovery envelope was persisted when the crash was caught,
    // so a plain reload goes through the restore path on bootstrap.
    window.location.reload();
  }, []);

  const handleResetApp = useCallback(() => {
    clearRecoveryEnvelope();
    useProjectStore.getState().forceReset();
    window.location.reload();
  }, []);

  return (
    <>
      <CrashBoundary
        onCrash={(error, info) =>
          handleCrash({
            source: "render",
            timestamp: Date.now(),
            message: error.message,
            stack: error.stack,
            componentStack: info.componentStack ?? undefined,
          })
        }
      >
        {isReady ? children : null}
      </CrashBoundary>
      {crash && (
        <AlertDialog open onOpenChange={() => undefined}>
          <AlertDialogContent
            className="max-h-[calc(100vh-2rem)] overflow-y-auto sm:max-w-xl"
            onEscapeKeyDown={(event) => event.preventDefault()}
          >
            <AlertDialogHeader className="gap-3 text-left">
              <div className="flex items-start gap-3">
                <div className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-md border border-destructive/25 bg-destructive/10 text-destructive">
                  <AlertTriangle className="size-5" />
                </div>
                <div className="min-w-0 space-y-1">
                  <AlertDialogTitle>The app crashed</AlertDialogTitle>
                  <p className="text-xs text-muted-foreground">
                    {CRASH_SOURCE_LABELS[crash.source]} ·{" "}
                    {new Date(crash.timestamp).toLocaleTimeString()}
                  </p>
                </div>
              </div>
              <AlertDialogDescription className="leading-6">
                Your project was saved just before the crash. Reload to pick up
                where you left off, or save a debug trail with the project and
                crash context to report the issue.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <div className="overflow-hidden rounded-md border bg-muted/30">
              <div className="flex items-start gap-2 p-3">
                <p className="min-w-0 flex-1 wrap-break-word font-mono text-xs text-muted-foreground">
                  {crash.message}
                </p>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={handleCopyDetails}
                  className="-m-1.5 size-7 shrink-0 text-muted-foreground"
                  aria-label="Copy crash details"
                >
                  <Copy className="size-3.5" />
                </Button>
              </div>
              {(crash.stack || crash.componentStack) && (
                <Collapsible>
                  <CollapsibleTrigger className="group flex w-full items-center gap-1.5 border-t px-3 py-2 text-xs text-muted-foreground transition-colors hover:text-foreground">
                    <ChevronDown className="size-3.5 transition-transform group-data-[state=open]:rotate-180" />
                    Technical details
                  </CollapsibleTrigger>
                  <CollapsibleContent>
                    <pre className="max-h-48 overflow-auto border-t bg-muted/50 p-3 font-mono text-[11px] leading-relaxed text-muted-foreground">
                      {buildCrashDetails(crash)}
                    </pre>
                  </CollapsibleContent>
                </Collapsible>
              )}
            </div>
            <AlertDialogFooter className="flex-col gap-2 sm:flex-col sm:justify-stretch">
              <Button
                type="button"
                onClick={handleReloadAndRestore}
                className="w-full justify-center"
              >
                <RefreshCw />
                Reload and restore project
              </Button>
              <div className="grid w-full grid-cols-1 gap-2 sm:grid-cols-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleSaveDebugTrail}
                  disabled={isDebugSaving}
                  className="w-full justify-center"
                >
                  {isDebugSaving ? (
                    <Loader2 className="animate-spin" />
                  ) : (
                    <Download />
                  )}
                  {isDebugSaving ? "Saving..." : "Save debug trail"}
                </Button>
                <Button
                  type="button"
                  variant="destructive"
                  onClick={handleResetApp}
                  className="w-full justify-center"
                >
                  <RotateCcw />
                  Reset app
                </Button>
              </div>
              <p className="text-center text-xs text-muted-foreground">
                Resetting clears the saved project — unsaved progress will be
                lost.
              </p>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}
    </>
  );
}
