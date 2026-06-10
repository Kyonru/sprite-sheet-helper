import { access } from "fs/promises";
import { constants } from "fs";
import { resolve } from "path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { Browser, Page } from "puppeteer";
import { openPage } from "../../cli/browser";
import { createWorkflowE2EContext } from "../helpers/workflow-e2e";

const PORT = 4193;
const IMPORT_MODEL_PATH = resolve(
  process.env.E2E_IMPORT_MODEL_PATH ?? "example.fbx",
);

async function getSequenceRowCount(page: Page): Promise<number> {
  return page.evaluate(
    () => window.__SSH_BRIDGE__.stores.images.getState().images.length,
  );
}

async function getModelUuids(page: Page): Promise<string[]> {
  return page.evaluate(() =>
    Object.keys(window.__SSH_BRIDGE__.stores.models.getState().models),
  );
}

async function clickElementByText(
  page: Page,
  selector: string,
  expectedText: string,
  matchMode: "exact" | "includes" = "exact",
) {
  const clicked = await page.evaluate((selectorArg, expectedTextArg, matchModeArg) => {
    const candidates = Array.from(
      document.querySelectorAll<HTMLElement>(selectorArg),
    );
    const match = candidates.find(
      (entry) => {
        const text = entry.textContent?.trim() ?? "";
        return matchModeArg === "includes"
          ? text.includes(expectedTextArg)
          : text === expectedTextArg;
      },
    );
    if (!match) return false;
    match.click();
    return true;
  }, selector, expectedText, matchMode);
  if (!clicked) {
    throw new Error(`Could not find ${selector} with text: ${expectedText}`);
  }
}

async function openImportModelFromFileMenu(page: Page) {
  const opened = await page.evaluate(async () => {
    const triggers = Array.from(
      document.querySelectorAll<HTMLElement>('[data-slot="menubar-trigger"]'),
    );
    const delay = (ms: number) =>
      new Promise((resolve) => setTimeout(resolve, ms));

    const clickImportItem = () =>
      Array.from(document.querySelectorAll<HTMLElement>('[data-slot="menubar-item"]'))
        .find((item) => item.textContent?.includes("Import Model"));

    for (const trigger of triggers) {
      trigger.dispatchEvent(
        new PointerEvent("pointerdown", { bubbles: true, composed: true }),
      );
      trigger.click();
      await delay(80);
      const item = clickImportItem();
      if (item) {
        item.click();
        return true;
      }
      document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
      await delay(50);
    }

    return false;
  });
  if (!opened) {
    throw new Error("Could not open File > Import Model");
  }
}

describe("FBX import after recording sequence", () => {
  let context: Awaited<ReturnType<typeof createWorkflowE2EContext>> | undefined;
  let browser: Browser | undefined;
  let page: Page | undefined;
  const pageErrors: string[] = [];

  beforeAll(async () => {
    await access(IMPORT_MODEL_PATH, constants.F_OK);

    context = await createWorkflowE2EContext(PORT);
    browser = context.browser;
    page = await openPage(browser, PORT, {
      timeoutMs: 120000,
    });

    page.on("pageerror", (error) => {
      pageErrors.push(`${error.message}\n${error.stack ?? ""}`);
    });
  });

  afterAll(async () => {
    await page?.close();
    await context?.close();
  });

  it(
    "records a sequence, then imports FBX without losing the captured rows",
    async () => {
      if (!page) throw new Error("Browser did not start");

      await page.evaluate(() => {
        const { setIterations, setIntervals } =
          window.__SSH_BRIDGE__.stores.images.getState();
        setIntervals(10);
        setIterations(4);
      });

      const initialRows = await getSequenceRowCount(page);
      const modelUuidsBefore = await getModelUuids(page);

      await clickElementByText(page, "button", "Record");

      await page.waitForFunction(
        (rows) =>
          window.__SSH_BRIDGE__.stores.images.getState().images.length > rows,
        { timeout: 30_000 },
        initialRows,
      );

      const rowsAfterRecord = await getSequenceRowCount(page);
      expect(rowsAfterRecord).toBeGreaterThan(initialRows);

      await page.waitForFunction(
        () => document.querySelectorAll('[data-slot="menubar-trigger"]').length > 0,
        { timeout: 10_000 },
      );
      const fileChooser = page.waitForFileChooser();
      await Promise.all([fileChooser, openImportModelFromFileMenu(page)]);
      const chooser = await fileChooser;
      await chooser.accept([IMPORT_MODEL_PATH]);

      await page.waitForFunction(
        (existingModelIds: string[]) => {
          const models = window.__SSH_BRIDGE__.stores.models.getState().models;
          return Object.entries(models).some(
            ([uuid, model]) =>
              !existingModelIds.includes(uuid) &&
              (model.loadState === "loaded" || model.loadState === "error"),
          );
        },
        { timeout: 30_000 },
        modelUuidsBefore,
      );

      const importedModelStates = await page.evaluate(
        (existingModelIds: string[]) =>
          Object.entries(window.__SSH_BRIDGE__.stores.models.getState().models)
            .filter(([uuid]) => !existingModelIds.includes(uuid))
            .map(([, model]) => model.loadState),
        modelUuidsBefore,
      );
      expect(importedModelStates.length).toBeGreaterThan(0);
      expect(
        importedModelStates.every((state) => state === "loaded" || state === "error"),
      ).toBe(true);

      const rowsAfterImport = await getSequenceRowCount(page);
      expect(rowsAfterImport).toBe(rowsAfterRecord);

      const appRootMounted = await page.evaluate(() => {
        const appRoot = document.querySelector("#root");
        return Boolean(appRoot?.isConnected && appRoot.childNodes.length > 0);
      });
      expect(appRootMounted).toBe(true);
      expect(pageErrors).toHaveLength(0);
    },
    180_000,
  );
});
