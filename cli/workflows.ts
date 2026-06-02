import type { Page } from "puppeteer";
import type { CaptureOptions } from "./types.js";

interface WorkflowOptions extends CaptureOptions {
  workflow: string;
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
    normalMap,
  }: WorkflowOptions,
): Promise<void> {
  await page.evaluate(
    (w: number, h: number, f: number, cam?: number, n?: boolean) => {
      const { settings, images } = window.__SSH_BRIDGE__.stores;
      settings.getState().setExportWidth(w);
      settings.getState().setExportHeight(h);
      settings.getState().setExportNormalMap(!!n);

      if (cam !== undefined) {
        settings.getState().setCameraDistance(cam);
      }
      images.getState().setIntervals(Math.round(1000 / f));
    },
    width,
    height,
    fps,
    cameraDistance,
    normalMap,
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

  await page.evaluate(
    (workflow: string) =>
      window.__SSH_BRIDGE__.PubSub.emit(
        window.__SSH_BRIDGE__.PubSub.EVENT_TYPE.START_WORKFLOW,
        workflow,
      ),
    workflowId,
  );

  const timeoutMs = Math.max(60000, Math.round((frames * 1000) / fps) + 900000);
  const timeoutPromise = new Promise<never>((_, reject) => {
    setTimeout(
      () => reject(new Error(`Workflow timed out after ${timeoutMs}ms`)),
      timeoutMs,
    );
  });

  const result = await Promise.race([workflowPromise, timeoutPromise]);

  if (result.status !== "done") {
    throw new Error(
      result.status === "cancelled"
        ? "Workflow was cancelled"
        : (result.error ?? "Workflow failed"),
    );
  }

  process.stdout.write(" done\n");
}
