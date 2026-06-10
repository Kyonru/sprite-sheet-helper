import { afterEach, describe, expect, it, vi } from "vitest";
import type { Page } from "puppeteer";
import { captureWorkflow } from "../../cli/workflows";

type WorkflowResult = {
  status: "done" | "cancelled" | "error";
  error?: string;
};

type ExposedWorkflowCallback = (result: WorkflowResult) => void;

type FakeBridge = {
  stores: {
    settings: {
      getState: () => {
        setExportWidth: (value: number) => void;
        setExportHeight: (value: number) => void;
        setExportNormalMap: (value: boolean) => void;
        setCameraDistance: (value: number) => void;
        setCameraAngle: (value: number) => void;
      };
    };
    images: {
      getState: () => {
        setIntervals: (value: number) => void;
        setIterations: (value: number) => void;
      };
    };
  };
  PubSub: {
    EVENT_TYPE: Record<string, string>;
    once: (event: string, listener: (payload: WorkflowResult) => void) => void;
    emit: (event: string, payload?: unknown) => void;
  };
};

type TestWindow = {
  __SSH_BRIDGE__: FakeBridge;
  __sshWorkflowDone__?: ExposedWorkflowCallback;
};

class FakeWorkflowPage {
  private listeners = new Map<string, (payload: WorkflowResult) => void>();
  private bridge: FakeBridge;
  public iterations = 0;
  public startWorkflowPayload?: unknown;

  constructor(private result?: WorkflowResult) {
    this.bridge = {
      stores: {
        settings: {
          getState: () => ({
            setExportWidth: () => undefined,
            setExportHeight: () => undefined,
            setExportNormalMap: () => undefined,
            setCameraDistance: () => undefined,
            setCameraAngle: () => undefined,
          }),
        },
        images: {
          getState: () => ({
            setIntervals: () => undefined,
            setIterations: (value) => {
              this.iterations = value;
            },
          }),
        },
      },
      PubSub: {
        EVENT_TYPE: {
          SET_WORKFLOW: "set_workflow",
          START_WORKFLOW: "start_workflow",
          STOP_WORKFLOW: "stop_workflow",
        },
        once: (event, listener) => {
          this.listeners.set(event, listener);
        },
        emit: (event, payload) => {
          if (event === "start_workflow") {
            this.startWorkflowPayload = payload;
          }
          if (event !== "start_workflow" || !this.result) return;
          this.listeners.get("stop_workflow")?.(this.result);
        },
      },
    };
  }

  async exposeFunction(
    name: "__sshWorkflowDone__",
    fn: ExposedWorkflowCallback,
  ) {
    (window as unknown as TestWindow)[name] = fn;
  }

  async evaluate<Args extends unknown[]>(
    fn: (...args: Args) => unknown,
    ...args: Args
  ) {
    (window as unknown as TestWindow).__SSH_BRIDGE__ = this.bridge;
    return fn(...args);
  }
}

const options = {
  modelUuid: "model-id",
  frames: 1,
  fps: 10,
  width: 16,
  height: 16,
  workflow: "topdown-1dir",
  cameraDistance: 2,
  normalMap: false,
};

describe("captureWorkflow CLI wait", () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
    delete (window as unknown as Partial<TestWindow>).__sshWorkflowDone__;
  });

  it("resolves when the browser workflow reports done", async () => {
    vi.spyOn(process.stdout, "write").mockImplementation(() => true);
    const page = new FakeWorkflowPage({ status: "done" });

    await expect(
      captureWorkflow(page as unknown as Page, options),
    ).resolves.toBeUndefined();
    expect(page.iterations).toBe(options.frames);
  });

  it("passes workflow camera options through the start event", async () => {
    vi.spyOn(process.stdout, "write").mockImplementation(() => true);
    const page = new FakeWorkflowPage({ status: "done" });

    await captureWorkflow(page as unknown as Page, {
      ...options,
      cameraAngle: 0,
      directionRotationOffset: 45,
      target: [0, 0.8, 0],
      directionOverrides: {
        Forward: { phi: 30, theta: 10, distance: 3, target: [1, 2, 3] },
      },
      forceAnimationsInPlace: true,
      skipStepLabels: ["walk_N", "run_S"],
      captureNormalMaps: true,
      workflowTimeout: 12345,
    });

    expect(page.startWorkflowPayload).toEqual({
      workflowId: "topdown-1dir",
      options: {
        cameraDistance: 2,
        cameraAngle: 0,
        directionRotationOffset: 45,
        target: [0, 0.8, 0],
        directionOverrides: {
          Forward: { phi: 30, theta: 10, distance: 3, target: [1, 2, 3] },
        },
        forceAnimationsInPlace: true,
        skipStepLabels: ["walk_N", "run_S"],
        captureNormalMaps: true,
      },
    });
  });

  it("rejects when the browser workflow is cancelled", async () => {
    const page = new FakeWorkflowPage({ status: "cancelled" });

    await expect(captureWorkflow(page as unknown as Page, options)).rejects.toThrow(
      "Workflow was cancelled",
    );
  });

  it("rejects when the browser workflow reports an error", async () => {
    const page = new FakeWorkflowPage({
      status: "error",
      error: "bad step",
    });

    await expect(captureWorkflow(page as unknown as Page, options)).rejects.toThrow(
      "bad step",
    );
  });

  it("rejects when the workflow never reports completion", async () => {
    vi.useFakeTimers();
    const page = new FakeWorkflowPage();
    const promise = captureWorkflow(page as unknown as Page, options);
    const expectation = expect(promise).rejects.toThrow("Workflow timed out");

    await vi.advanceTimersByTimeAsync(901000);

    await expectation;
  });
});
