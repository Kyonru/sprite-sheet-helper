import type { Page } from "puppeteer";

export async function waitForNextAnimationFrame(page: Page): Promise<void> {
  const marker = await page.evaluate(() => {
    const key = "__sshFrameMarker__";
    const current = Number(window[key as keyof Window] ?? 0);
    requestAnimationFrame(() => {
      Object.assign(window, { [key]: current + 1 });
    });
    return current;
  });

  await page.waitForFunction(
    (previous) => Number(window["__sshFrameMarker__" as keyof Window] ?? 0) > previous,
    { timeout: 10000 },
    marker,
  );
}
