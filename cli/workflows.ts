import type { Page } from "puppeteer";
import type { CaptureOptions } from "./types.js";

interface WorkflowOptions extends CaptureOptions {
  workflow: string;
  cameraDistance?: number;
}

export async function captureWorkflow(
  page: Page,
  { fps, width, height, workflow: workflowId, cameraDistance }: WorkflowOptions,
): Promise<void> {
  await page.evaluate(
    (w: number, h: number, f: number, cam?: number) => {
      const { settings, images } = window.__SSH_BRIDGE__.stores;
      settings.getState().setExportWidth(w);
      settings.getState().setExportHeight(h);

      if (cam !== undefined) {
        settings.getState().setCameraDistance(cam);
      }
      images.getState().setIntervals(Math.round(1000 / f));
    },
    width,
    height,
    fps,
    cameraDistance,
  );

  await page.evaluate(
    (workflow: string) =>
      window.__SSH_BRIDGE__.PubSub.emit(
        window.__SSH_BRIDGE__.PubSub.EVENT_TYPE.SET_WORKFLOW,
        workflow,
      ),
    workflowId,
  );

  let workflowPromise: Promise<void> | null = null;

  await page.evaluate(() => {
    workflowPromise = new Promise<void>((resolve) => {
      window.__SSH_BRIDGE__.PubSub.once(
        window.__SSH_BRIDGE__.PubSub.EVENT_TYPE.STOP_WORKFLOW,
        () => {
          console.log("[sprite-sheet-helper] Workflow ended");
          resolve();
        },
      );
    });
  });

  await page.evaluate(() => {
    window.__SSH_BRIDGE__.PubSub.emit(
      window.__SSH_BRIDGE__.PubSub.EVENT_TYPE.START_WORKFLOW,
    );
  });

  await page.evaluate(async () => {
    if (workflowPromise) {
      await workflowPromise;
    }
  });

  process.stdout.write(" done\n");
}
