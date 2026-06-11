import { useProjectStore } from "@/store/next/project";
import type {
  ProjectRecoveryEnvelope,
  ProjectSnapshot,
  RecoveryRuntimeMeta,
} from "@/types/project";
import { CURRENT_VERSION, RECOVERY_SNAPSHOT_VERSION } from "@/types/project";
import { warnRecoveryPersistFailed } from "@/utils/storage-quota";

const STORAGE_KEY = "sprite-sheet-helper.project-recovery-v1";

function canUseStorage(): boolean {
  if (typeof window === "undefined") return false;

  try {
    return typeof window.localStorage.getItem === "function";
  } catch {
    return false;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isRecoveryEnvelope(value: unknown): value is ProjectRecoveryEnvelope {
  if (!isRecord(value)) return false;
  if (value.version !== RECOVERY_SNAPSHOT_VERSION) return false;
  if (typeof value.appVersion !== "string") return false;
  if (typeof value.savedAt !== "number") return false;
  if (!isRecord(value.projectSnapshot)) return false;
  if (typeof value.projectSnapshot.version !== "number") return false;
  if (value.projectSnapshot.version > CURRENT_VERSION) return false;

  return true;
}

function getAppVersion(): string {
  if (typeof import.meta === "undefined") return "unknown";

  const env = import.meta.env as {
    APP_VERSION?: string;
    [key: string]: string | undefined;
  };

  return (
    env.APP_VERSION ??
    (typeof process !== "undefined" && process?.env?.["npm_package_version"]
      ? process.env.npm_package_version!
      : "unknown")
  );
}

export function buildRecoveryMeta(
  source: string,
  runtimeMeta: RecoveryRuntimeMeta = {},
): RecoveryRuntimeMeta {
  if (typeof window === "undefined") {
    return {
      ...runtimeMeta,
      source,
    };
  }

  return {
    ...runtimeMeta,
    source,
    url: runtimeMeta.url ?? window.location.href,
    userAgent: runtimeMeta.userAgent ?? window.navigator.userAgent,
  };
}

export function clearRecoveryEnvelope(): void {
  if (!canUseStorage()) return;

  window.localStorage.removeItem(STORAGE_KEY);
}

export function saveRecoveryEnvelope(
  projectSnapshot: ProjectSnapshot,
  runtimeMeta: RecoveryRuntimeMeta = {},
): void {
  if (!canUseStorage()) return;

  const payload: ProjectRecoveryEnvelope = {
    version: RECOVERY_SNAPSHOT_VERSION,
    appVersion: getAppVersion(),
    savedAt: Date.now(),
    projectSnapshot,
    runtimeMeta: {
      ...runtimeMeta,
      url:
        runtimeMeta.url ??
        (typeof window === "undefined" ? undefined : window.location.href),
      userAgent:
        runtimeMeta.userAgent ??
        (typeof window === "undefined" ? undefined : window.navigator.userAgent),
    },
  };

  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
  } catch (error) {
    console.warn("[recovery] failed to persist recovery snapshot", error);
    warnRecoveryPersistFailed();
  }
}

export function loadRecoveryEnvelope(): ProjectRecoveryEnvelope | null {
  if (!canUseStorage()) return null;

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;

    const parsed = JSON.parse(raw);
    if (!isRecoveryEnvelope(parsed)) {
      clearRecoveryEnvelope();
      return null;
    }

    return parsed;
  } catch {
    clearRecoveryEnvelope();
    return null;
  }
}

export function flushRecoveryFromStore(
  source: string,
  runtimeMeta: RecoveryRuntimeMeta = {},
): void {
  const snapshot = useProjectStore.getState().snapshot();
  saveRecoveryEnvelope(snapshot, buildRecoveryMeta(source, runtimeMeta));
}
