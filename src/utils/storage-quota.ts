import { toast } from "sonner";

export const STORAGE_WARNING_RATIO = 0.85;

export type StorageUsage = {
  usage: number;
  quota: number;
  ratio: number;
};

export async function estimateStorageUsage(): Promise<StorageUsage | null> {
  if (typeof navigator === "undefined") return null;

  const storage = navigator.storage;
  if (!storage || typeof storage.estimate !== "function") return null;

  try {
    const { usage, quota } = await storage.estimate();
    if (!quota) return null;

    const used = usage ?? 0;
    return { usage: used, quota, ratio: used / quota };
  } catch {
    return null;
  }
}

export function isQuotaExceededError(error: unknown): boolean {
  return (
    typeof DOMException !== "undefined" &&
    error instanceof DOMException &&
    (error.name === "QuotaExceededError" || error.code === 22)
  );
}

let warnedAlmostFull = false;
let warnedRecoveryFailed = false;

// Warnings fire once per session so background saves don't spam toasts.
export async function warnIfStorageAlmostFull(): Promise<boolean> {
  const estimate = await estimateStorageUsage();
  if (!estimate || estimate.ratio < STORAGE_WARNING_RATIO) return false;

  if (!warnedAlmostFull) {
    warnedAlmostFull = true;
    toast.warning("Browser storage is almost full", {
      description:
        "Save a .sshProj backup of your project. New models or textures may fail to persist.",
    });
  }

  return true;
}

export function notifyQuotaExceeded(what: string): void {
  toast.error(`Browser storage is full — ${what} was not saved`, {
    description:
      "Free up space or save a .sshProj backup, then try again.",
  });
}

export function warnRecoveryPersistFailed(): void {
  if (warnedRecoveryFailed) return;
  warnedRecoveryFailed = true;

  toast.warning("Crash recovery could not be saved", {
    description:
      "Browser storage may be full. Save a .sshProj backup so your work is not lost.",
  });
}

export function resetStorageWarningsForTests(): void {
  warnedAlmostFull = false;
  warnedRecoveryFailed = false;
}
