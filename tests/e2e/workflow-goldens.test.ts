import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { copyFile, mkdir, readFile, rm, writeFile } from "fs/promises";
import { join, resolve } from "path";
import { PNG } from "pngjs";
import type { Browser } from "puppeteer";
import { WORKFLOW_PRESETS } from "../../cli/data";
import { expectExactPngPixels } from "../helpers/pixels";
import {
  WORKFLOW_GOLDEN_ROOT,
  createWorkflowE2EContext,
  readNormalizedSpritesheetJson,
  runWorkflowExport,
} from "../helpers/workflow-e2e";

const PORT = 4191;
const ARTIFACT_ROOT = resolve(".e2e-artifacts/workflow-goldens");
const UPDATE_GOLDENS = process.env.UPDATE_WORKFLOW_GOLDENS === "true";

async function writeGoldenReference(workflow: string, actualOutput: string) {
  const destination = join(WORKFLOW_GOLDEN_ROOT, workflow);
  const normalizedJson = await readNormalizedSpritesheetJson(
    join(actualOutput, "spritesheet.json"),
  );

  await rm(destination, { recursive: true, force: true });
  await mkdir(destination, { recursive: true });
  await copyFile(
    join(actualOutput, "spritesheet.png"),
    join(destination, "spritesheet.png"),
  );
  await copyFile(
    join(actualOutput, "spritesheet_normal.png"),
    join(destination, "spritesheet_normal.png"),
  );
  await writeFile(
    join(destination, "spritesheet.json"),
    `${JSON.stringify(normalizedJson, null, 2)}\n`,
  );
}

async function expectSpritesheetJsonGolden(
  workflow: string,
  expectedPath: string,
  actualPath: string,
) {
  const expected = await readNormalizedSpritesheetJson(expectedPath);
  const actual = await readNormalizedSpritesheetJson(actualPath);

  try {
    expect(actual).toEqual(expected);
  } catch (error) {
    throw new Error(
      `[${workflow}] spritesheet.json layout differs from golden\n${(error as Error).message}`,
    );
  }
}

async function expectPngDimensionsGolden(
  workflow: string,
  image: string,
  expectedPath: string,
  actualPath: string,
) {
  const [expected, actual] = await Promise.all([
    readPngDimensions(expectedPath),
    readPngDimensions(actualPath),
  ]);

  try {
    expect(actual).toEqual(expected);
  } catch (error) {
    throw new Error(
      `[${workflow}] ${image} dimensions differ from golden\n${(error as Error).message}`,
    );
  }
}

async function readPngDimensions(path: string) {
  const png = PNG.sync.read(await readFile(path));
  return { width: png.width, height: png.height };
}

async function expectPlatformGoldenPng(
  workflow: string,
  image: string,
  expectedPath: string,
  actualPath: string,
) {
  if (process.platform === "darwin") {
    await expectExactPngPixels(expectedPath, actualPath, {
      workflow,
      image,
    });
    return;
  }

  await expectPngDimensionsGolden(workflow, image, expectedPath, actualPath);
}

describe("workflow golden exports", () => {
  let context: Awaited<ReturnType<typeof createWorkflowE2EContext>> | undefined;
  let browser: Browser | undefined;

  beforeAll(async () => {
    await rm(ARTIFACT_ROOT, { recursive: true, force: true });
    await mkdir(ARTIFACT_ROOT, { recursive: true });
    context = await createWorkflowE2EContext(PORT);
    browser = context.browser;

    if (UPDATE_GOLDENS) {
      await rm(WORKFLOW_GOLDEN_ROOT, { recursive: true, force: true });
      await mkdir(WORKFLOW_GOLDEN_ROOT, { recursive: true });
    }
  });

  afterAll(async () => {
    await context?.close();
  });

  for (const workflow of WORKFLOW_PRESETS) {
    it(
      UPDATE_GOLDENS
        ? `updates ${workflow.id} golden export`
        : `${workflow.id} matches committed golden export`,
      async () => {
        if (!browser) throw new Error("Browser did not start");

        const actual = await runWorkflowExport({
          browser,
          port: PORT,
          workflow: workflow.id,
          output: join(ARTIFACT_ROOT, workflow.id, "actual"),
        });
        const expected = join(WORKFLOW_GOLDEN_ROOT, workflow.id);

        if (UPDATE_GOLDENS) {
          await writeGoldenReference(workflow.id, actual.output);
          return;
        }

        await expectSpritesheetJsonGolden(
          workflow.id,
          join(expected, "spritesheet.json"),
          actual.json,
        );
        await expectPlatformGoldenPng(
          workflow.id,
          "spritesheet.png",
          join(expected, "spritesheet.png"),
          actual.spritesheet,
        );
        await expectPlatformGoldenPng(
          workflow.id,
          "spritesheet_normal.png",
          join(expected, "spritesheet_normal.png"),
          actual.normal,
        );
      },
      300000,
    );
  }
});
