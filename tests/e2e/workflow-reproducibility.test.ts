import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { mkdir, rm } from "fs/promises";
import { join, resolve } from "path";
import type { Browser } from "puppeteer";
import { WORKFLOW_PRESETS } from "../../cli/data";
import { expectExactPngPixels } from "../helpers/pixels";
import {
  createWorkflowE2EContext,
  readNormalizedSpritesheetJson,
  runWorkflowExport,
} from "../helpers/workflow-e2e";

const PORT = 4190;
const ARTIFACT_ROOT = resolve(".e2e-artifacts/workflow-reproducibility");

async function expectSpritesheetJsonMatch(
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
      `[${workflow}] spritesheet.json layout differs\n${(error as Error).message}`,
    );
  }
}

describe("workflow pixel reproducibility", () => {
  let context: Awaited<ReturnType<typeof createWorkflowE2EContext>> | undefined;
  let browser: Browser | undefined;

  beforeAll(async () => {
    await rm(ARTIFACT_ROOT, { recursive: true, force: true });
    await mkdir(ARTIFACT_ROOT, { recursive: true });
    context = await createWorkflowE2EContext(PORT);
    browser = context.browser;
  });

  afterAll(async () => {
    await context?.close();
  });

  for (const workflow of WORKFLOW_PRESETS) {
    it(
      `${workflow.id} produces identical color and normal pixels across two runs`,
      async () => {
        if (!browser) throw new Error("Browser did not start");

        const first = await runWorkflowExport({
          browser,
          port: PORT,
          workflow: workflow.id,
          output: join(ARTIFACT_ROOT, workflow.id, "run-1"),
        });
        const second = await runWorkflowExport({
          browser,
          port: PORT,
          workflow: workflow.id,
          output: join(ARTIFACT_ROOT, workflow.id, "run-2"),
        });

        await expectSpritesheetJsonMatch(workflow.id, first.json, second.json);
        await expectExactPngPixels(first.spritesheet, second.spritesheet, {
          workflow: workflow.id,
          image: "spritesheet.png",
        });
        await expectExactPngPixels(first.normal, second.normal, {
          workflow: workflow.id,
          image: "spritesheet_normal.png",
        });
      },
      300000,
    );
  }
});
