import type { Page } from "puppeteer";
import type { CaptureOptions } from "./types.js";

interface WorkflowOptions extends CaptureOptions {
  workflow: string;
  workflowTimeout?: number;
}

type WorkflowResult = {
  status: "done" | "cancelled" | "error";
  error?: string;
};

export async function captureWorkflow(
  page: Page,
  {
    fps,
    frames,
    width,
    height,
    workflow: workflowId,
    cameraDistance,
    cameraAngle,
    directionRotationOffset,
    target,
    directionOverrides,
    normalMap,
    workflowTimeout,
    silent,
  }: WorkflowOptions,
): Promise<void> {
  await page.evaluate(
    (
      w: number,
      h: number,
      f: number,
      frameCount: number,
      cam?: number,
      n?: boolean,
      cameraAngle?: number,
    ) => {
      const { settings, images } = window.__SSH_BRIDGE__.stores;
      settings.getState().setExportWidth(w);
      settings.getState().setExportHeight(h);
      settings.getState().setExportNormalMap(!!n);

      if (cam !== undefined) {
        settings.getState().setCameraDistance(cam);
      }
      if (cameraAngle !== undefined) {
        settings.getState().setCameraAngle(cameraAngle);
      }
      images.getState().setIntervals(Math.round(1000 / f));
      images.getState().setIterations(frameCount);
    },
    width,
    height,
    fps,
    frames,
    cameraDistance,
    normalMap,
    cameraAngle,
  );

  await page.evaluate(
    (workflow: string) =>
      window.__SSH_BRIDGE__.PubSub.emit(
        window.__SSH_BRIDGE__.PubSub.EVENT_TYPE.SET_WORKFLOW,
        workflow,
      ),
    workflowId,
  );

  let resolveWorkflow!: (result: WorkflowResult) => void;
  const workflowPromise = new Promise<WorkflowResult>((resolve) => {
    resolveWorkflow = resolve;
  });

  await page.exposeFunction("__sshWorkflowDone__", (result: WorkflowResult) => {
    resolveWorkflow(result);
  });

  await page.evaluate(() => {
    window.__SSH_BRIDGE__.PubSub.once(
      window.__SSH_BRIDGE__.PubSub.EVENT_TYPE.STOP_WORKFLOW,
      (payload: WorkflowResult) => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (window as any).__sshWorkflowDone__({
          status: payload.status,
          error: payload.error,
        });
      },
    );
  });

  const workflowRunOptions = {
    ...(cameraDistance === undefined ? {} : { cameraDistance }),
    ...(cameraAngle === undefined ? {} : { cameraAngle }),
    ...(directionRotationOffset === undefined ? {} : { directionRotationOffset }),
    ...(target === undefined ? {} : { target }),
    ...(directionOverrides === undefined ? {} : { directionOverrides }),
  };

  await page.evaluate(
    (workflow: string, options: Record<string, unknown>) =>
      window.__SSH_BRIDGE__.PubSub.emit(
        window.__SSH_BRIDGE__.PubSub.EVENT_TYPE.START_WORKFLOW,
        {
          workflowId: workflow,
          options,
        },
      ),
    workflowId,
    workflowRunOptions,
  );

  const timeoutMs =
    workflowTimeout ?? Math.max(60000, Math.round((frames * 1000) / fps) + 900000);
  let timeout: ReturnType<typeof setTimeout>;
  const timeoutPromise = new Promise<never>((_, reject) => {
    timeout = setTimeout(
      () => reject(new Error(`Workflow timed out after ${timeoutMs}ms`)),
      timeoutMs,
    );
  });

  const result = await Promise.race([workflowPromise, timeoutPromise]).finally(
    () => clearTimeout(timeout),
  );

  if (result.status !== "done") {
    throw new Error(
      result.status === "cancelled"
        ? "Workflow was cancelled"
        : (result.error ?? "Workflow failed"),
    );
  }

  if (!silent) process.stdout.write(" done\n");
}
