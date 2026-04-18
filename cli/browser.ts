import puppeteer from "puppeteer";
import type { Browser, Page } from "puppeteer";

export async function launchBrowser(): Promise<Browser> {
  const browser = await puppeteer.launch({
    headless: true,
    args: [
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--disable-web-security",
    ],
  });
  return browser;
}

export async function openPage(browser: Browser, port: number): Promise<Page> {
  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 800 });

  page.on("console", (msg) => {
    const text = msg.text();
    if (msg.type() === "error") console.error(`[browser] ${text}`);
    else console.log(`[browser] ${text}`);
  });
  page.on("pageerror", (err) => console.error(`[browser:pageerror] ${err.message}`));

  await page.goto(`http://localhost:${port}`, { waitUntil: "networkidle0", timeout: 30000 });

  await page.waitForFunction(() => "__SSH_BRIDGE__" in window, { timeout: 15000 });

  return page;
}
