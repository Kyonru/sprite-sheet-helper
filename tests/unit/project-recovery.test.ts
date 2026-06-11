import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ProjectSnapshot } from "@/types/project";
import { CURRENT_VERSION } from "@/types/project";

const snapshot = {
  version: CURRENT_VERSION,
  savedAt: 123,
  settings: { name: "Recovered Project" },
} as ProjectSnapshot;

vi.mock("@/store/next/project", () => ({
  useProjectStore: {
    getState: () => ({
      snapshot: () => snapshot,
    }),
  },
}));

describe("project recovery persistence", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it("saves and loads a valid recovery envelope", async () => {
    const {
      flushRecoveryFromStore,
      loadRecoveryEnvelope,
    } = await import("@/utils/project-recovery");

    flushRecoveryFromStore("unit-test");

    const envelope = loadRecoveryEnvelope();
    expect(envelope?.version).toBe(1);
    expect(envelope?.projectSnapshot).toBeTruthy();
    expect(envelope?.projectSnapshot.version).toBe(CURRENT_VERSION);
    expect(envelope?.runtimeMeta?.source).toBe("unit-test");
  });

  it("clears corrupt recovery data instead of throwing", async () => {
    const { loadRecoveryEnvelope } = await import("@/utils/project-recovery");

    window.localStorage.setItem(
      "sprite-sheet-helper.project-recovery-v1",
      "{not-json",
    );

    expect(loadRecoveryEnvelope()).toBeNull();
    expect(
      window.localStorage.getItem("sprite-sheet-helper.project-recovery-v1"),
    ).toBeNull();
  });

  it("ignores recovery envelopes from future project versions", async () => {
    const { loadRecoveryEnvelope } = await import("@/utils/project-recovery");

    window.localStorage.setItem(
      "sprite-sheet-helper.project-recovery-v1",
      JSON.stringify({
        version: 1,
        appVersion: "test",
        savedAt: Date.now(),
        projectSnapshot: {
          version: CURRENT_VERSION + 1,
        },
      }),
    );

    expect(loadRecoveryEnvelope()).toBeNull();
    expect(
      window.localStorage.getItem("sprite-sheet-helper.project-recovery-v1"),
    ).toBeNull();
  });
});
