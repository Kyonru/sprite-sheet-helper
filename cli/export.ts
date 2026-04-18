import type { Page } from "puppeteer";

export async function triggerExport(
  page: Page,
  format: string,
  timeoutMs = 60000,
): Promise<{ href: string; filename: string }> {
  let captureResolve!: (value: { href: string; filename: string }) => void;
  const capturePromise = new Promise<{ href: string; filename: string }>((res) => {
    captureResolve = res;
  });

  await page.exposeFunction("__sshCapture__", (href: string, filename: string) => {
    captureResolve({ href, filename });
  });

  // downloadFile() creates a detached <a> and calls .click() directly — DOM click
  // events don't bubble from detached nodes, so we intercept at the prototype level.
  await page.evaluate(() => {
    const orig = HTMLAnchorElement.prototype.click;
    HTMLAnchorElement.prototype.click = function () {
      if (this.download && this.href.startsWith("data:")) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (window as any).__sshCapture__(this.href, this.download);
        return;
      }
      return orig.call(this);
    };
  });

  await page.evaluate(
    (fmt: string) =>
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (window as any).__SSH_BRIDGE__.PubSub.emit("start_export", fmt),
    format,
  );

  const timeoutPromise = new Promise<never>((_, rej) =>
    setTimeout(() => rej(new Error(`Export timed out after ${timeoutMs}ms`)), timeoutMs),
  );

  return Promise.race([capturePromise, timeoutPromise]);
}
