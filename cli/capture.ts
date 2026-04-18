import type { Page } from "puppeteer";

const TWO_PI = Math.PI * 2;

interface CaptureOptions {
  modelUuid: string;
  frames: number;
  fps: number;
  width: number;
  height: number;
}

export async function captureFrames(page: Page, { modelUuid, frames, fps, width, height }: CaptureOptions): Promise<void> {
  await page.evaluate(
    (w: number, h: number, f: number) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { settings, images } = (window as any).__SSH_BRIDGE__.stores;
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
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (window as any).__SSH_BRIDGE__.stores.images
        .getState()
        .createEmptyRow(w, h, Math.round(1000 / f));
    },
    width,
    height,
    fps,
  );

  const selectedRow = await page.evaluate(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    () => (window as any).__SSH_BRIDGE__.stores.images.getState().selectedRow as string,
  );

  process.stdout.write(`Capturing ${frames} frames`);

  for (let i = 0; i < frames; i++) {
    const angle = (TWO_PI / frames) * i;

    await page.evaluate(
      (uuid: string, y: number) => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (window as any).__SSH_BRIDGE__.stores.transforms
          .getState()
          .setTransform(uuid, { rotation: [0, y, 0] });
      },
      modelUuid,
      angle,
    );

    await page.evaluate(() => new Promise<void>((r) => requestAnimationFrame(() => r())));

    await page.evaluate(() => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (window as any).__SSH_BRIDGE__.PubSub.emit("take_single_screenshot");
    });

    await page.waitForFunction(
      (row: string, count: number) => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const imgs = (window as any).__SSH_BRIDGE__.stores.images.getState().images;
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
