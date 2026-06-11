import { mkdir, rm } from "fs/promises";
import { join } from "path";
import type { Browser, Page } from "puppeteer";
import { openPage } from "../../cli/browser";
import { injectModel } from "../../cli/inject";
import { extractToOutput } from "../../cli/output";
import {
  WORKFLOW_E2E_CAPTURE_OPTIONS,
  WORKFLOW_FIXTURE,
  closePage,
  parseEnvBoolean,
  pauseForVisibleE2EStep,
  type WorkflowOutput,
} from "./workflow-e2e";

type UiDownload = {
  href: string;
  filename: string;
};

export async function captureUiDownload(
  page: Page,
  clickExport: () => Promise<void>,
  timeoutMs = 120000,
): Promise<UiDownload> {
  let captureResolve!: (value: UiDownload) => void;
  const capturePromise = new Promise<UiDownload>((resolve) => {
    captureResolve = resolve;
  });

  await page.exposeFunction(
    "__sshUiCapture__",
    (href: string, filename: string) => {
      captureResolve({ href, filename });
    },
  );

  await page.evaluate(() => {
    const originalClick = HTMLAnchorElement.prototype.click;
    HTMLAnchorElement.prototype.click = function () {
      if (this.download && this.href.startsWith("data:")) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (window as any).__sshUiCapture__(this.href, this.download);
        return;
      }
      return originalClick.call(this);
    };
  });

  await clickExport();

  const timeoutPromise = new Promise<never>((_, reject) =>
    setTimeout(
      () => reject(new Error(`UI export timed out after ${timeoutMs}ms`)),
      timeoutMs,
    ),
  );

  return Promise.race([capturePromise, timeoutPromise]);
}

export async function waitForWorkflowUiDone(page: Page): Promise<void> {
  await page.waitForFunction(
    () => document.body.textContent?.includes("All sequences captured successfully."),
    { timeout: 300000 },
  );
}

export async function runWebUiWorkflowExport({
  browser,
  port,
  workflow,
  output,
}: {
  browser: Browser;
  port: number;
  workflow: string;
  output: string;
}): Promise<WorkflowOutput> {
  const page = await openPage(browser, port, {
    debug: parseEnvBoolean("E2E_DEBUG"),
    timeoutMs: 120000,
    log: console.log,
    error: console.error,
  });

  await rm(output, { recursive: true, force: true });
  await mkdir(output, { recursive: true });

  try {
    await pauseForVisibleE2EStep("App opened");
    const modelUuid = await injectModel(page, WORKFLOW_FIXTURE, { silent: true });
    await pauseForVisibleE2EStep("Model loaded");
    await configureDeterministicWorkflowCapture(page);
    await pauseForVisibleE2EStep("Deterministic capture settings applied");
    await exerciseDowngradeThroughUi(page, modelUuid);
    await prepareSceneThroughUi(page, modelUuid);
    await runWorkflowThroughUi(page, workflow);
    await playCapturedSequenceStrip(page);

    const download = await captureUiDownload(page, async () => {
      await page.waitForSelector('[data-testid="prepare-export-button"]:not([disabled])', {
        timeout: 60000,
      });
      await clickElement(page, '[data-testid="prepare-export-button"]');
      await pauseForVisibleE2EStep("Export preflight opened");
      await page.waitForSelector('[data-testid="preflight-export-button"]', {
        timeout: 60000,
      });
      await configureAtlasThroughUi(page);
      await page.waitForSelector('[data-testid="export-format-love2d-lua"]', {
        timeout: 60000,
      });
      await clickElement(page, '[data-testid="export-format-love2d-lua"]');
      await pauseForVisibleE2EStep("Love2D format selected");
      const exportReady = await page
        .waitForFunction(
          () => {
            const button = document.querySelector<HTMLButtonElement>(
              '[data-testid="preflight-export-button"]',
            );
            return Boolean(button && !button.disabled);
          },
          { timeout: 10000 },
        )
        .then(() => true)
        .catch(() => false);
      if (!exportReady) {
        const diagnostics = await getPreflightDiagnostics(page);
        throw new Error(
          `Preflight export button did not become enabled.\n${diagnostics}`,
        );
      }
      await clickElement(page, '[data-testid="preflight-export-button"]');
      await pauseForVisibleE2EStep("Export clicked");
    });

    await extractToOutput(download.href, output);
    await pauseForVisibleE2EStep(`Downloaded ${download.filename}`);

    return {
      output,
      spritesheet: join(output, "spritesheet.png"),
      normal: join(output, "spritesheet_normal.png"),
      json: join(output, "spritesheet.json"),
    };
  } finally {
    await closePage(page);
  }
}

async function exerciseDowngradeThroughUi(
  page: Page,
  modelUuid: string,
): Promise<void> {
  await page.waitForSelector('[data-testid="downgrade-analyze-button"]', {
    timeout: 60000,
  });
  await fillNumberInput(page, '[data-testid="downgrade-triangle-budget-input"]', 600);
  await fillNumberInput(page, '[data-testid="downgrade-texture-size-input"]', 64);
  await fillNumberInput(page, '[data-testid="downgrade-animation-fps-input"]', 8);
  await page.evaluate((uuid) => {
    window.__SSH_BRIDGE__.stores.modelDowngrades.getState().setRecipe(uuid, {
      triangleBudget: 600,
      textureSize: 64,
      animationFps: 8,
    });
  }, modelUuid);
  await page.waitForFunction(
    (uuid) => {
      const recipe = window.__SSH_BRIDGE__.stores.modelDowngrades.getState()
        .entries[uuid]?.recipe;
      return (
        recipe?.triangleBudget === 600 &&
        recipe.textureSize === 64 &&
        recipe.animationFps === 8
      );
    },
    { timeout: 60000 },
    modelUuid,
  );
  await pauseForVisibleE2EStep("Downgrade recipe edited");

  await clickElement(page, '[data-testid="downgrade-analyze-button"]');
  await page.waitForFunction(
    (uuid) => {
      const entry = window.__SSH_BRIDGE__.stores.modelDowngrades.getState()
        .entries[uuid];
      return Boolean(entry?.analysis || entry?.report?.before);
    },
    { timeout: 120000 },
    modelUuid,
  );
  await pauseForVisibleE2EStep("Model downgrade analysis completed");
}

async function prepareSceneThroughUi(
  page: Page,
  modelUuid: string,
): Promise<void> {
  await page.waitForSelector('[data-testid="lighting-menu-trigger"]', {
    timeout: 60000,
  });
  await page.click('[data-testid="lighting-menu-trigger"]');
  await page.waitForSelector('[data-testid="lighting-menu-item-point"]', {
    timeout: 60000,
  });
  await page.click('[data-testid="lighting-menu-item-point"]');
  await pauseForVisibleE2EStep("Point light added from UI");

  await page.waitForSelector('[data-testid="effects-menu-trigger"]', {
    timeout: 60000,
  });
  await page.click('[data-testid="effects-menu-trigger"]');
  await page.waitForSelector('[data-testid="effects-category-stylization"]', {
    timeout: 60000,
  });
  await page.hover('[data-testid="effects-category-stylization"]');
  await page.waitForSelector('[data-testid="effects-menu-item-pixelation"]', {
    timeout: 60000,
  });
  await page.click('[data-testid="effects-menu-item-pixelation"]');
  await pauseForVisibleE2EStep("Pixelation effect added from UI");

  await page.waitForSelector('[data-testid="effects-menu-trigger"]', {
    timeout: 60000,
  });
  await page.click('[data-testid="effects-menu-trigger"]');
  await page.waitForSelector('[data-testid="effects-category-color"]', {
    timeout: 60000,
  });
  await page.hover('[data-testid="effects-category-color"]');
  await page.waitForSelector('[data-testid="effects-menu-item-brightnessContrast"]', {
    timeout: 60000,
  });
  await page.click('[data-testid="effects-menu-item-brightnessContrast"]');
  await pauseForVisibleE2EStep("Brightness / Contrast effect added from UI");

  await page.evaluate((uuid: string) => {
    const { entities, transforms } = window.__SSH_BRIDGE__.stores;
    transforms.getState().setTransform(uuid, {
      position: [0.08, 0.78, 0],
      rotation: [0, 0.2, 0],
      scale: [1, 1, 1],
    });

    const lightUuid = Object.entries(entities.getState().entities).find(
      ([, entity]) => entity.type === "light" && entity.metadata?.type === "point",
    )?.[0];

    if (lightUuid) {
      transforms.getState().setTransform(lightUuid, {
        position: [1.25, 2.15, 1.75],
      });
    }
  }, modelUuid);
  await page.waitForFunction(
    () => {
      const effects = window.__SSH_BRIDGE__.stores.effects.getState().effects;
      const types = Object.values(effects).map((effect) => effect.type);
      return types.includes("pixelation") && types.includes("brightnessContrast");
    },
    { timeout: 60000 },
  );
  await pauseForVisibleE2EStep("Model and light moved");
}

async function playCapturedSequenceStrip(page: Page): Promise<void> {
  await page.waitForSelector('button[aria-label="Play sequence"]:not([disabled])', {
    timeout: 60000,
  });
  await clickElement(page, 'button[aria-label="Play sequence"]');
  await pauseForVisibleE2EStep("Sequence strip playing");
  await new Promise((resolve) => setTimeout(resolve, 300));
  await clickElement(page, 'button[aria-label="Play sequence"]');
  await pauseForVisibleE2EStep("Sequence strip stopped");
}

async function configureDeterministicWorkflowCapture(page: Page): Promise<void> {
  await page.evaluate(
    ({ fps, frames, width, height, cameraDistance, normalMap }) => {
      const { settings, images } = window.__SSH_BRIDGE__.stores;
      settings.getState().setMode("spritesheet");
      settings.getState().setExportWidth(width);
      settings.getState().setExportHeight(height);
      settings.getState().setCameraDistance(cameraDistance);
      settings.getState().setExportNormalMap(normalMap);
      images.getState().setIntervals(Math.round(1000 / fps));
      images.getState().setIterations(frames);
    },
    WORKFLOW_E2E_CAPTURE_OPTIONS,
  );
}

async function runWorkflowThroughUi(page: Page, workflow: string): Promise<void> {
  await page.waitForSelector('[data-testid="workflow-menu-trigger"]', {
    timeout: 60000,
  });
  await page.click('[data-testid="workflow-menu-trigger"]');
  await pauseForVisibleE2EStep("Workflow menu opened");
  await page.waitForSelector(`[data-testid="workflow-preset-${workflow}"]`, {
    timeout: 60000,
  });
  await page.click(`[data-testid="workflow-preset-${workflow}"]`);
  await pauseForVisibleE2EStep(`${workflow} workflow selected`);
  await exerciseWorkflowCameraControls(page);
  await page.waitForSelector("#run-workflow-button:not([disabled])", {
    timeout: 60000,
  });
  await page.click("#run-workflow-button");
  await pauseForVisibleE2EStep("Workflow run started");
  await waitForWorkflowUiDone(page);
  await pauseForVisibleE2EStep("Workflow run completed");
  await clickButtonByText(page, "Close");
  await page.waitForSelector("#run-workflow-button", {
    hidden: true,
    timeout: 60000,
  });
}

type WorkflowCameraUiValues = {
  distance: number;
  elevation: number;
  theta: number;
};

type WorkflowCameraInputSelectors = {
  distance: string;
  elevation: string;
  theta: string;
};

const WORKFLOW_CAMERA_DISTANCE_SELECTORS = [
  '[data-testid="workflow-camera-distance-input"]',
  '#workflow-camera-distance',
] as const;

const WORKFLOW_CAMERA_ELEVATION_SELECTORS = [
  '[data-testid="workflow-camera-elevation-input"]',
  '#workflow-camera-elevation',
] as const;

const WORKFLOW_CAMERA_THETA_SELECTORS = [
  '[data-testid="workflow-camera-theta-input"]',
  '#workflow-camera-theta',
] as const;

async function waitForWorkflowCameraControlSelectors(
  page: Page,
): Promise<WorkflowCameraInputSelectors> {
  const resolveSelector = async (selectors: readonly string[]): Promise<string> => {
    const deadline = Date.now() + 60000;

    while (Date.now() < deadline) {
      for (const selector of selectors) {
        const element = await page.$(selector);
        if (element) {
          return selector;
        }
      }

      await page.waitForTimeout(50);
    }

    throw new Error(
      `Missing workflow camera control input. Checked selectors: ${selectors.join(", ")}`,
    );
  };

  return {
    distance: await resolveSelector(WORKFLOW_CAMERA_DISTANCE_SELECTORS),
    elevation: await resolveSelector(WORKFLOW_CAMERA_ELEVATION_SELECTORS),
    theta: await resolveSelector(WORKFLOW_CAMERA_THETA_SELECTORS),
  };
}

async function exerciseWorkflowCameraControls(page: Page): Promise<void> {
  const inputSelectors = await waitForWorkflowCameraControlSelectors(page);
  await page.waitForSelector('[data-testid="workflow-camera-preview"] canvas', {
    timeout: 60000,
  });
  const beforeSlider = await readWorkflowCameraValues(page);
  let sliderMoved = await nudgeWorkflowCameraDistanceSlider(
    page,
    inputSelectors,
    beforeSlider,
  );

  if (!sliderMoved) {
    const currentSelectors = await waitForWorkflowCameraControlSelectors(page);
    await fillNumberInput(
      page,
      currentSelectors.distance,
      beforeSlider.distance + 0.5,
    );
    sliderMoved = await page
      .waitForFunction(
        (previous, selectors) => {
          const read = (selector: string) =>
            Number(
              (
                document.querySelector<HTMLInputElement>(selector)?.value ?? "NaN"
              ).trim(),
            );
          const current = {
            distance: read(selectors.distance),
            elevation: read(selectors.elevation),
            theta: read(selectors.theta),
          };
          return (
            Math.abs(current.distance - previous.distance) > 0.001 ||
            Math.abs(current.elevation - previous.elevation) > 0.001 ||
            Math.abs(current.theta - previous.theta) > 0.001
          );
        },
        { timeout: 10000 },
        beforeSlider,
        currentSelectors,
      )
      .then(() => true)
      .catch(() => false);
  }

  if (!sliderMoved) {
    throw new Error(
      `Workflow camera controls did not update values after slider/input interaction: ${JSON.stringify(
        beforeSlider,
      )}`,
    );
  }
  await pauseForVisibleE2EStep("Workflow camera moved with slider control");

  const manualSelectors = await waitForWorkflowCameraControlSelectors(page);
  await fillNumberInput(page, manualSelectors.distance, 3.4);
  await fillNumberInput(page, manualSelectors.elevation, 52);
  await fillNumberInput(page, manualSelectors.theta, 25);
  const manual = await readWorkflowCameraValues(page);
  if (
    manual.distance !== 3.4 ||
    manual.elevation !== 52 ||
    manual.theta !== 25
  ) {
    throw new Error(
      `Manual workflow camera inputs did not apply: ${JSON.stringify(manual)}`,
    );
  }
  await pauseForVisibleE2EStep("Workflow camera values typed manually");

  await clickElement(page, '[data-testid="workflow-camera-main-defaults-button"]');
  await page.waitForFunction(
    () => {
      const settings = window.__SSH_BRIDGE__.stores.settings.getState();
      return settings.cameraDistance === 3.4 && settings.cameraAngle === 52;
    },
    { timeout: 60000 },
  );
  await pauseForVisibleE2EStep("Workflow camera values applied to main defaults");

  const directionButton = await page.$('[data-testid="workflow-direction-E"]');
  if (directionButton) {
    await directionButton.click();
    await pauseForVisibleE2EStep("Workflow direction E selected");
  }
}

async function nudgeWorkflowCameraDistanceSlider(
  page: Page,
  inputSelectors: WorkflowCameraInputSelectors,
  previous: WorkflowCameraUiValues,
): Promise<boolean> {
  const handle = await page
    .waitForSelector(
      '[data-testid="workflow-camera-distance-slider"] [role="slider"]',
      { timeout: 10000 },
    )
    .catch(() => null);
  if (!handle) return false;

  await handle.focus();
  await page.keyboard.press("ArrowRight");
  await page.keyboard.press("ArrowRight");
  await page.keyboard.press("ArrowRight");

  return page
    .waitForFunction(
      (before, selectors) => {
        const value = Number(
          (
            document.querySelector<HTMLInputElement>(selectors.distance)
              ?.value ?? "NaN"
          ).trim(),
        );
        return Math.abs(value - before.distance) > 0.001;
      },
      { timeout: 5000 },
      previous,
      inputSelectors,
    )
    .then(() => true)
    .catch(() => false);
}

async function readWorkflowCameraValues(
  page: Page,
): Promise<WorkflowCameraUiValues> {
  const selectors = await waitForWorkflowCameraControlSelectors(page);
  return page.evaluate((workflowSelectors) => {
    const read = (selector: string) =>
      Number(
        (
          document.querySelector<HTMLInputElement>(selector)?.value ?? "NaN"
        ).trim(),
      );
    return {
      distance: read(workflowSelectors.distance),
      elevation: read(workflowSelectors.elevation),
      theta: read(workflowSelectors.theta),
    };
  }, selectors);
}

async function configureAtlasThroughUi(page: Page): Promise<void> {
  await clickElement(page, '[data-testid="atlas-layout-packed-button"]');
  await fillNumberInput(page, '[data-testid="atlas-padding-input"]', 1);
  await fillNumberInput(page, '[data-testid="atlas-extrude-input"]', 1);
  await fillNumberInput(page, '[data-testid="atlas-max-size-input"]', 512);
  await clickElement(page, '[data-testid="atlas-scale-2x-button"]');
  await page.waitForFunction(
    () => {
      const settings = window.__SSH_BRIDGE__.stores.settings.getState();
      return (
        settings.atlasLayout === "packed" &&
        settings.atlasPadding === 1 &&
        settings.atlasBleed === 1 &&
        settings.maxAtlasSize === 512 &&
        settings.atlasScale === 2
      );
    },
    { timeout: 60000 },
  );
  await pauseForVisibleE2EStep("Packed atlas settings applied");
}

async function clickButtonByText(page: Page, text: string): Promise<void> {
  await page.waitForFunction(
    (label) =>
      Array.from(document.querySelectorAll("button")).some(
        (button) => button.textContent?.trim() === label && !button.disabled,
      ),
    { timeout: 60000 },
    text,
  );
  await page.evaluate((label) => {
    const button = Array.from(document.querySelectorAll("button")).find(
      (entry) => entry.textContent?.trim() === label && !entry.disabled,
    );
    button?.click();
  }, text);
}

async function clickElement(page: Page, selector: string): Promise<void> {
  await page.waitForSelector(selector, { timeout: 60000 });
  await page.click(selector);
}

async function fillNumberInput(
  page: Page,
  selector: string,
  value: number,
): Promise<void> {
  await page.waitForFunction(
    (targetSelector) => !!document.querySelector(targetSelector),
    { timeout: 60000 },
    selector,
  );
  await page.evaluate(
    (targetSelector, nextValue) => {
      const input = document.querySelector<HTMLInputElement>(targetSelector);
      if (!input) throw new Error(`Missing input: ${targetSelector}`);
      const setter = Object.getOwnPropertyDescriptor(
        window.HTMLInputElement.prototype,
        "value",
      )?.set;
      setter?.call(input, nextValue);
      input.dispatchEvent(new Event("input", { bubbles: true }));
      input.dispatchEvent(new Event("change", { bubbles: true }));
      input.blur();
    },
    selector,
    String(value),
  );
  await page.waitForFunction(
    (targetSelector, expected) =>
      document.querySelector<HTMLInputElement>(targetSelector)?.value ===
      expected,
    { timeout: 10000 },
    selector,
    String(value),
  );
}

async function getPreflightDiagnostics(page: Page): Promise<string> {
  return page.evaluate(() => {
    const button = document.querySelector<HTMLButtonElement>(
      '[data-testid="preflight-export-button"]',
    );
    const bodyText = document.body.textContent?.replace(/\s+/g, " ").trim() ?? "";
    const preflightIndex = bodyText.indexOf("Export Preflight");
    const excerpt =
      preflightIndex >= 0
        ? bodyText.slice(preflightIndex, preflightIndex + 1200)
        : bodyText.slice(0, 1200);

    return JSON.stringify(
      {
        buttonFound: Boolean(button),
        buttonDisabled: button?.disabled ?? null,
        excerpt,
      },
      null,
      2,
    );
  });
}
