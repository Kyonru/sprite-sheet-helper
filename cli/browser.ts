import puppeteer from "puppeteer";
import type { Browser, Page } from "puppeteer";

export type BrowserOptions = {
  headful?: boolean;
  slowMo?: number;
  devtools?: boolean;
  protocolTimeout?: number;
};

export type PageOptions = {
  debug?: boolean;
  timeoutMs?: number;
  log?: (message: string) => void;
  error?: (message: string) => void;
};

export async function launchBrowser(options: BrowserOptions = {}): Promise<Browser> {
  const browser = await puppeteer.launch({
    headless: options.headful ? false : true,
    slowMo: options.slowMo,
    devtools: options.devtools,
    protocolTimeout: options.protocolTimeout,
    args: [
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--disable-web-security",
    ],
  });
  return browser;
}

export async function openPage(
  browser: Browser,
  port: number,
  options: PageOptions = {},
): Promise<Page> {
  const page = await browser.newPage();
  const timeoutMs = options.timeoutMs ?? 30000;
  page.setDefaultTimeout(timeoutMs);
  page.setDefaultNavigationTimeout(timeoutMs);
  await page.setViewport({ width: 1280, height: 800 });

  if (options.debug) {
    page.on("console", (msg) => {
      const text = msg.text();
      if (msg.type() === "error") {
        options.error?.(`[browser] ${text}`);
      } else {
        options.log?.(`[browser] ${text}`);
      }
    });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    page.on("pageerror", (err: any) =>
      options.error?.(`[browser:pageerror] ${err.message}`),
    );
  }

  await page.goto(`http://localhost:${port}`, {
    waitUntil: "networkidle0",
    timeout: timeoutMs,
  });

  await page.waitForFunction(() => "__SSH_BRIDGE__" in window, {
    timeout: Math.max(timeoutMs, 15000),
  });

  return page;
}
