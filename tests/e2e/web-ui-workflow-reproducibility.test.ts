import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { access, mkdir, readFile, rm } from "fs/promises";
import { join, resolve } from "path";
import type { Browser } from "puppeteer";
import { expectExactPngPixels } from "../helpers/pixels";
import {
  createWorkflowE2EContext,
  parseEnvBoolean,
  readNormalizedSpritesheetJson,
} from "../helpers/workflow-e2e";
import { runWebUiWorkflowExport } from "../helpers/web-ui-workflow-e2e";

const PORT = 4192;
const WORKFLOW_ID = "topdown-4dir";
const ARTIFACT_ROOT = resolve(
  ".e2e-artifacts/web-ui-workflow-reproducibility",
);

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
      `[${workflow}] web UI spritesheet.json layout differs\n${(error as Error).message}`,
    );
  }
}

async function expectNormalizedJsonFileMatch(
  workflow: string,
  fileName: string,
  expectedPath: string,
  actualPath: string,
) {
  const expected = await readNormalizedSpritesheetJson(expectedPath);
  const actual = await readNormalizedSpritesheetJson(actualPath);

  try {
    expect(actual).toEqual(expected);
  } catch (error) {
    throw new Error(
      `[${workflow}] web UI ${fileName} differs\n${(error as Error).message}`,
    );
  }
}

async function expectLuaFileMatch(
  workflow: string,
  fileName: string,
  expectedPath: string,
  actualPath: string,
) {
  const expected = normalizeGeneratedLua(await readFile(expectedPath, "utf8"));
  const actual = normalizeGeneratedLua(await readFile(actualPath, "utf8"));

  try {
    expect(actual).toBe(expected);
  } catch (error) {
    throw new Error(
      `[${workflow}] web UI ${fileName} differs\n${(error as Error).message}`,
    );
  }
}

function normalizeGeneratedLua(source: string): string {
  return source
    .split("\n")
    .filter((line) => !/^-- \d{4}-\d{2}-\d{2}T/.test(line))
    .join("\n");
}

async function expectRichUiScenarioOutput(output: string) {
  const spritesheet = JSON.parse(
    await readFile(join(output, "spritesheet.json"), "utf8"),
  ) as {
    meta: {
      animationCount: number;
      frameCount: number;
      normalImage?: string;
    };
    animations: Array<{
      frameWidth: number;
      frameHeight: number;
    }>;
  };
  const manifest = JSON.parse(
    await readFile(join(output, "spritesheet.manifest.json"), "utf8"),
  ) as {
    exporterId: string;
    atlas: {
      layout: string;
      padding: number;
      extrude: number;
      scale: number;
      maxAtlasSize: number;
      pageCount: number;
      pages: Array<{ normalImage?: string }>;
    };
    animations: unknown[];
  };

  expect(spritesheet.meta.animationCount).toBeGreaterThan(1);
  expect(spritesheet.meta.frameCount).toBeGreaterThan(4);
  expect(spritesheet.meta.normalImage).toBe("spritesheet_normal.png");
  expect(spritesheet.animations[0]).toMatchObject({
    frameWidth: 64,
    frameHeight: 64,
  });
  expect(manifest).toMatchObject({
    exporterId: "love2d-lua",
    atlas: {
      layout: "packed",
      padding: 1,
      extrude: 1,
      scale: 2,
      maxAtlasSize: 512,
      pageCount: 1,
    },
  });
  expect(manifest.atlas.pages[0]?.normalImage).toBe("spritesheet_normal.png");
  expect(manifest.animations.length).toBeGreaterThan(1);
}

describe("web UI workflow reproducibility", () => {
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

  it(
    "topdown-4dir produces identical Love2D output through visible UI controls",
    async () => {
      if (!browser) throw new Error("Browser did not start");

      if (parseEnvBoolean("E2E_SINGLE_RUN")) {
        const output = join(ARTIFACT_ROOT, WORKFLOW_ID, "single-run");
        await runWebUiWorkflowExport({
          browser,
          port: PORT,
          workflow: WORKFLOW_ID,
          output,
        });

        await Promise.all(
          [
            "spritesheet.png",
            "spritesheet_normal.png",
            "spritesheet.json",
            "spritesheet.manifest.json",
            "spritesheet.lua",
            "main.lua",
          ].map((fileName) => access(join(output, fileName))),
        );
        await expectRichUiScenarioOutput(output);
        return;
      }

      const first = await runWebUiWorkflowExport({
        browser,
        port: PORT,
        workflow: WORKFLOW_ID,
        output: join(ARTIFACT_ROOT, WORKFLOW_ID, "run-1"),
      });
      const second = await runWebUiWorkflowExport({
        browser,
        port: PORT,
        workflow: WORKFLOW_ID,
        output: join(ARTIFACT_ROOT, WORKFLOW_ID, "run-2"),
      });

      await expectSpritesheetJsonMatch(WORKFLOW_ID, first.json, second.json);
      await expectRichUiScenarioOutput(first.output);
      await expectRichUiScenarioOutput(second.output);
      await expectNormalizedJsonFileMatch(
        WORKFLOW_ID,
        "spritesheet.manifest.json",
        join(first.output, "spritesheet.manifest.json"),
        join(second.output, "spritesheet.manifest.json"),
      );
      await expectExactPngPixels(first.spritesheet, second.spritesheet, {
        workflow: WORKFLOW_ID,
        image: "web-ui love2d spritesheet.png",
      });
      await expectExactPngPixels(first.normal, second.normal, {
        workflow: WORKFLOW_ID,
        image: "web-ui love2d spritesheet_normal.png",
      });
      await expectLuaFileMatch(
        WORKFLOW_ID,
        "spritesheet.lua",
        join(first.output, "spritesheet.lua"),
        join(second.output, "spritesheet.lua"),
      );
      await expectLuaFileMatch(
        WORKFLOW_ID,
        "main.lua",
        join(first.output, "main.lua"),
        join(second.output, "main.lua"),
      );
    },
    300000,
  );
});
