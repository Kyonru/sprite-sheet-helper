import { access } from "fs/promises";
import { constants } from "fs";
import { resolve } from "path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { Browser, Page } from "puppeteer";
import { openPage } from "../../cli/browser";
import { createWorkflowE2EContext } from "../helpers/workflow-e2e";

const PORT = 4193;
let importModelPath = "";
let importAnimationSourcePath = "";

async function resolveFixturePath(
  requestedPath: string | undefined,
  ...fallbackPaths: string[]
): Promise<string> {
  const candidates = requestedPath
    ? [resolve(requestedPath), ...fallbackPaths.map((path) => resolve(path))]
    : fallbackPaths.map((path) => resolve(path));

  for (const path of candidates) {
    try {
      await access(path, constants.F_OK);
      return path;
    } catch {
      // Ignore and try next candidate
    }
  }

  throw new Error(
    `Missing fixture file for E2E test. Tried: ${candidates.join(", ")}`,
  );
}

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

async function getModelClipNames(
  page: Page,
  modelUuid: string,
): Promise<string[]> {
  return page.evaluate((uuid) => {
    const clips = window.__SSH_BRIDGE__.stores.models.getState().clips[uuid];
    return (clips ?? []).map(
      (clip: { clip: { name: string } }) => clip.clip.name,
    );
  }, modelUuid);
}

async function clickElementByText(
  page: Page,
  selector: string,
  expectedText: string,
  matchMode: "exact" | "includes" = "exact",
) {
  const clicked = await page.evaluate(
    (selectorArg, expectedTextArg, matchModeArg) => {
      const candidates = Array.from(
        document.querySelectorAll<HTMLElement>(selectorArg),
      );
      const match = candidates.find((entry) => {
        const text = entry.textContent?.trim() ?? "";
        return matchModeArg === "includes"
          ? text.includes(expectedTextArg)
          : text === expectedTextArg;
      });
      if (!match) return false;
      match.click();
      return true;
    },
    selector,
    expectedText,
    matchMode,
  );
  if (!clicked) {
    throw new Error(`Could not find ${selector} with text: ${expectedText}`);
  }
}

async function openImportModelFromFileMenu(page: Page) {
  await page.click('[data-testid="file-menu-trigger"]');
  await page.waitForSelector('[data-testid="file-import-model"]', {
    visible: true,
    timeout: 5_000,
  });
  await page.click('[data-testid="file-import-model"]');
}

async function importModelFromFile(page: Page, path: string): Promise<string> {
  const before = await getModelUuids(page);

  const fileChooser = page.waitForFileChooser();
  await Promise.all([fileChooser, openImportModelFromFileMenu(page)]);
  const chooser = await fileChooser;
  await chooser.accept([path]);

  await page.waitForFunction(
    (existingModelIds: string[]) => {
      const models = Object.keys(
        window.__SSH_BRIDGE__.stores.models.getState().models,
      );
      return models.some((id) => !existingModelIds.includes(id));
    },
    { timeout: 30_000 },
    before,
  );

  return page.evaluate((existingModelIds: string[]) => {
    const models = window.__SSH_BRIDGE__.stores.models.getState().models;
    return (
      Object.keys(models).find((uuid) => !existingModelIds.includes(uuid)) ?? ""
    );
  }, before);
}

async function waitForModelToLoad(page: Page, modelUuid: string) {
  await page.waitForFunction(
    (uuid) => {
      const model = window.__SSH_BRIDGE__.stores.models.getState().models[uuid];
      return model?.loadState === "loaded";
    },
    { timeout: 30_000 },
    modelUuid,
  );
}

async function waitForModelClips(page: Page, modelUuid: string) {
  await page.waitForFunction(
    (uuid) => {
      return (
        (window.__SSH_BRIDGE__.stores.models.getState().clips[uuid]?.length ??
          0) > 0
      );
    },
    { timeout: 30_000 },
    modelUuid,
  );
}

async function importFromSourceModel(
  page: Page,
  targetUuid: string,
  sourceUuid: string,
) {
  return page.evaluate(
    async (target, source) => {
      return window.__SSH_BRIDGE__.stores.models
        .getState()
        .importAnimationsFromSource(target, { sourceModelUuid: source });
    },
    targetUuid,
    sourceUuid,
  );
}

describe("Pose Studio model import after recorded sequence", () => {
  let context: Awaited<ReturnType<typeof createWorkflowE2EContext>> | undefined;
  let browser: Browser | undefined;
  let page: Page | undefined;
  const pageErrors: string[] = [];

  beforeAll(async () => {
    [importModelPath, importAnimationSourcePath] = await Promise.all([
      resolveFixturePath(process.env.E2E_IMPORT_MODEL_PATH, "example.fbx"),
      resolveFixturePath(
        process.env.E2E_IMPORT_ANIMATION_SOURCE_PATH,
        "example_animation.glb",
        "example.fbx",
        "example/models/example.fbx",
      ),
    ]);

    await Promise.all([
      access(importModelPath, constants.F_OK),
      access(importAnimationSourcePath, constants.F_OK),
    ]);

    context = await createWorkflowE2EContext(PORT);
    browser = context.browser;
    page = await openPage(browser, PORT, {
      timeoutMs: 120000,
    });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    page.on("pageerror", (error: any) => {
      pageErrors.push(`${error.message}\n${error.stack ?? ""}`);
    });
  });

  it("records a sequence, then imports animations from a different loaded model with suffixes", async () => {
    if (!page) throw new Error("Browser did not start");

    await page.waitForFunction(
      () =>
        document.querySelectorAll('[data-slot="menubar-trigger"]').length > 0,
      { timeout: 10_000 },
    );

    await page.evaluate(() => {
      const { setIterations, setIntervals } =
        window.__SSH_BRIDGE__.stores.images.getState();
      setIntervals(10);
      setIterations(4);
    });

    const initialModelCount = await getModelUuids(page);
    const targetModelUuid = await importModelFromFile(page, importModelPath);
    await waitForModelToLoad(page, targetModelUuid);
    expect(targetModelUuid).toBeTruthy();
    expect(initialModelCount).not.toContain(targetModelUuid);

    const initialRows = await getSequenceRowCount(page);
    await clickElementByText(page, "button", "Record", "includes");
    await page.waitForFunction(
      (rows) =>
        window.__SSH_BRIDGE__.stores.images.getState().images.length > rows,
      { timeout: 30_000 },
      initialRows,
    );

    const rowsAfterRecord = await getSequenceRowCount(page);
    expect(rowsAfterRecord).toBeGreaterThan(initialRows);

    const sourceModelUuid = await importModelFromFile(
      page,
      importAnimationSourcePath,
    );
    expect(sourceModelUuid).toBeTruthy();
    expect(sourceModelUuid).not.toBe(targetModelUuid);

    await waitForModelToLoad(page, sourceModelUuid);
    await waitForModelClips(page, sourceModelUuid);

    await importFromSourceModel(page, targetModelUuid, sourceModelUuid);
    const firstNames = await getModelClipNames(page, targetModelUuid);
    expect(firstNames.length).toBeGreaterThan(0);

    await importFromSourceModel(page, targetModelUuid, sourceModelUuid);
    const secondNames = await getModelClipNames(page, targetModelUuid);
    expect(secondNames.some((name) => name.includes("_1"))).toBe(true);

    await importFromSourceModel(page, targetModelUuid, sourceModelUuid);
    const thirdNames = await getModelClipNames(page, targetModelUuid);
    expect(thirdNames.some((name) => name.includes("_2"))).toBe(true);

    const rowsAfterAnimationImport = await getSequenceRowCount(page);
    expect(rowsAfterAnimationImport).toBe(rowsAfterRecord);

    const appRootMounted = await page.evaluate(() => {
      const appRoot = document.querySelector("#root");
      return Boolean(appRoot?.isConnected && appRoot.childNodes.length > 0);
    });
    expect(appRootMounted).toBe(true);
    expect(pageErrors).toHaveLength(0);
  }, 180_000);

  afterAll(async () => {
    await page?.close();
    await context?.close();
  });
});
