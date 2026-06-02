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

  constructor(private result?: WorkflowResult) {
    this.bridge = {
      stores: {
        settings: {
          getState: () => ({
            setExportWidth: () => undefined,
            setExportHeight: () => undefined,
            setExportNormalMap: () => undefined,
            setCameraDistance: () => undefined,
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
        emit: (event) => {
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
