import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const toastWarning = vi.fn();
const toastError = vi.fn();

vi.mock("sonner", () => ({
  toast: {
    warning: (...args: unknown[]) => toastWarning(...args),
    error: (...args: unknown[]) => toastError(...args),
  },
}));

function mockStorageEstimate(usage: number, quota: number) {
  Object.defineProperty(navigator, "storage", {
    configurable: true,
    value: {
      estimate: vi.fn().mockResolvedValue({ usage, quota }),
    },
  });
}

describe("storage quota guard", () => {
  beforeEach(async () => {
    const { resetStorageWarningsForTests } = await import(
      "@/utils/storage-quota"
    );
    resetStorageWarningsForTests();
    toastWarning.mockClear();
    toastError.mockClear();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("estimates usage when the API is available", async () => {
    const { estimateStorageUsage } = await import("@/utils/storage-quota");

    mockStorageEstimate(50, 100);

    const estimate = await estimateStorageUsage();
    expect(estimate).toEqual({ usage: 50, quota: 100, ratio: 0.5 });
  });

  it("returns null when the estimate API is unavailable", async () => {
    const { estimateStorageUsage } = await import("@/utils/storage-quota");

    Object.defineProperty(navigator, "storage", {
      configurable: true,
      value: undefined,
    });

    expect(await estimateStorageUsage()).toBeNull();
  });

  it("returns null when quota is unknown", async () => {
    const { estimateStorageUsage } = await import("@/utils/storage-quota");

    mockStorageEstimate(10, 0);

    expect(await estimateStorageUsage()).toBeNull();
  });

  it("does not warn below the threshold", async () => {
    const { warnIfStorageAlmostFull } = await import("@/utils/storage-quota");

    mockStorageEstimate(10, 100);

    expect(await warnIfStorageAlmostFull()).toBe(false);
    expect(toastWarning).not.toHaveBeenCalled();
  });

  it("warns once per session above the threshold", async () => {
    const { warnIfStorageAlmostFull } = await import("@/utils/storage-quota");

    mockStorageEstimate(90, 100);

    expect(await warnIfStorageAlmostFull()).toBe(true);
    expect(await warnIfStorageAlmostFull()).toBe(true);
    expect(toastWarning).toHaveBeenCalledTimes(1);
  });

  it("detects QuotaExceededError DOMExceptions", async () => {
    const { isQuotaExceededError } = await import("@/utils/storage-quota");

    expect(
      isQuotaExceededError(
        new DOMException("quota", "QuotaExceededError"),
      ),
    ).toBe(true);
    expect(isQuotaExceededError(new Error("quota"))).toBe(false);
    expect(isQuotaExceededError(undefined)).toBe(false);
  });

  it("warns once when recovery persistence fails", async () => {
    const { warnRecoveryPersistFailed } = await import(
      "@/utils/storage-quota"
    );

    warnRecoveryPersistFailed();
    warnRecoveryPersistFailed();

    expect(toastWarning).toHaveBeenCalledTimes(1);
  });
});
