import type { Page } from "puppeteer";
import { CaptureOptions } from "./types.js";

const TWO_PI = Math.PI * 2;

export async function captureFrames(
  page: Page,
  { modelUuid, frames, fps, width, height }: CaptureOptions,
): Promise<void> {
  await page.evaluate(
    (w: number, h: number, f: number) => {
      const { settings, images } = window.__SSH_BRIDGE__.stores;
      settings.getState().setExportWidth(w);
      settings.getState().setExportHeight(h);
      images.getState().setIntervals(Math.round(1000 / f));
    },
    width,
    height,
    fps,
  );

  await page.evaluate(
    (w: number, h: number, f: number) => {
      window.__SSH_BRIDGE__.stores.images
        .getState()
        .createEmptyRow(w, h, Math.round(1000 / f));
    },
    width,
    height,
    fps,
  );

  const selectedRow = await page.evaluate(
    () => window.__SSH_BRIDGE__.stores.images.getState().selectedRow as string,
  );

  process.stdout.write(`Capturing ${frames} frames`);

  for (let i = 0; i < frames; i++) {
    const angle = (TWO_PI / frames) * i;

    await page.evaluate(
      (uuid: string, y: number) => {
        window.__SSH_BRIDGE__.stores.transforms
          .getState()
          .setTransform(uuid, { rotation: [0, y, 0] });
      },
      modelUuid,
      angle,
    );

    await page.evaluate(
      () => new Promise<void>((r) => requestAnimationFrame(() => r())),
    );

    await page.evaluate(() => {
      window.__SSH_BRIDGE__.PubSub.emit(
        window.__SSH_BRIDGE__.PubSub.EVENT_TYPE.TAKE_SINGLE_SCREENSHOT,
      );
    });

    await page.waitForFunction(
      (row: string, count: number) => {
        const imgs = window.__SSH_BRIDGE__.stores.images.getState().images;
        return imgs[row] && imgs[row].images.length >= count;
      },
      { timeout: 10000 },
      selectedRow,
      i + 1,
    );

    process.stdout.write(".");
  }

  process.stdout.write(" done\n");
}
