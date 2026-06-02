import type { AtlasOptions, ExportFormat } from "@/types/file";
import type { ExportValidationMessage } from "./export-validation";

const STORAGE_KEY = "sprite-sheet-helper.export-history";
const MAX_HISTORY = 12;

export type ExportHistoryEntry = {
  id: string;
  timestamp: string;
  format: ExportFormat;
  filename: string;
  frameCount: number;
  animationCount: number;
  pageCount: number;
  normalStatus: string;
  atlasOptions: AtlasOptions;
  warnings: string[];
};

function canUseStorage() {
  return typeof window !== "undefined" && Boolean(window.localStorage);
}

export function loadExportHistory(): ExportHistoryEntry[] {
  if (!canUseStorage()) return [];

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.slice(0, MAX_HISTORY) : [];
  } catch {
    return [];
  }
}

export function saveExportHistory(
  entries: ExportHistoryEntry[],
): ExportHistoryEntry[] {
  const next = entries.slice(0, MAX_HISTORY);
  if (canUseStorage()) {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  }
  return next;
}

export function addExportHistoryEntry(
  entry: Omit<ExportHistoryEntry, "id" | "timestamp" | "warnings"> & {
    messages?: ExportValidationMessage[];
    warnings?: string[];
  },
): ExportHistoryEntry[] {
  const warnings =
    entry.warnings ??
    entry.messages
      ?.filter((message) => message.severity !== "info")
      .map((message) => message.message) ??
    [];
  const nextEntry: ExportHistoryEntry = {
    ...entry,
    id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
    timestamp: new Date().toISOString(),
    warnings,
  };

  return saveExportHistory([nextEntry, ...loadExportHistory()]);
}

export function clearExportHistory(): ExportHistoryEntry[] {
  if (canUseStorage()) {
    window.localStorage.removeItem(STORAGE_KEY);
  }
  return [];
}
