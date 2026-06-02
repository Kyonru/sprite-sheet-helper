import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { mkdir, readFile, rm } from "fs/promises";
import { join, resolve } from "path";
import type { Browser, Page } from "puppeteer";
import type { ChildProcess } from "child_process";
import { spawn } from "child_process";
import { WORKFLOW_PRESETS } from "../../cli/data";
import { launchBrowser, openPage } from "../../cli/browser";
import { injectModel } from "../../cli/inject";
import { extractToOutput } from "../../cli/output";
import { triggerExport } from "../../cli/export";
import { captureWorkflow } from "../../cli/workflows";
import { expectExactPngPixels } from "../helpers/pixels";

const PORT = 4190;
const FIXTURE = resolve("example.fbx");
const ARTIFACT_ROOT = resolve(".e2e-artifacts/workflow-reproducibility");
const CAPTURE_OPTIONS = {
  frames: 4,
  fps: 10,
  width: 32,
  height: 32,
  cameraDistance: 2.5,
  normalMap: true,
};

type WorkflowOutput = {
  output: string;
  spritesheet: string;
  normal: string;
  json: string;
};

type JsonValue =
  | string
  | number
  | boolean
  | null
  | JsonValue[]
  | { [key: string]: JsonValue };

function normalizeJson(value: JsonValue): JsonValue {
  if (Array.isArray(value)) {
    return value.map(normalizeJson);
  }

  if (!value || typeof value !== "object") {
    return value;
  }

  return Object.fromEntries(
    Object.entries(value)
      .filter(([key]) => key !== "exportedAt")
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, entry]) => [key, normalizeJson(entry)]),
  );
}

async function readNormalizedSpritesheetJson(path: string): Promise<JsonValue> {
  return normalizeJson(JSON.parse(await readFile(path, "utf8")) as JsonValue);
}

async function runWorkflowExport(
  browser: Browser,
  workflow: string,
  runIndex: number,
): Promise<WorkflowOutput> {
  const page = await openPage(browser, PORT);
  const output = join(ARTIFACT_ROOT, workflow, `run-${runIndex}`);

  await rm(output, { recursive: true, force: true });
  await mkdir(output, { recursive: true });

  try {
    const modelUuid = await injectModel(page, FIXTURE);

    await captureWorkflow(page, {
      modelUuid,
      workflow,
      ...CAPTURE_OPTIONS,
    });

    const { href } = await triggerExport(page, "spritesheet", 120000);
    await extractToOutput(href, output);

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

async function closePage(page: Page): Promise<void> {
  try {
    await page.close();
  } catch {
    // Page may already be closed if the browser failed during the test.
  }
}

async function startPreviewServer(port: number): Promise<ChildProcess> {
  const proc = spawn(
    "npx",
    ["vite", "preview", "--port", String(port), "--host", "127.0.0.1"],
    {
      cwd: resolve("."),
      stdio: ["ignore", "pipe", "pipe"],
    },
  );

  await waitForPreviewServer(port, proc);
  return proc;
}

async function waitForPreviewServer(
  port: number,
  proc: ChildProcess,
  timeout = 60000,
): Promise<void> {
  const deadline = Date.now() + timeout;
  let output = "";

  await new Promise<void>((resolveReady, rejectReady) => {
    let settled = false;
    const resolveOnce = () => {
      if (settled) return;
      settled = true;
      resolveReady();
    };
    const rejectOnce = (error: Error) => {
      if (settled) return;
      settled = true;
      rejectReady(error);
    };
    const appendOutput = (chunk: Buffer) => {
      output += chunk.toString("utf8");
      if (output.includes("Local:")) resolveOnce();
    };

    proc.stdout?.on("data", appendOutput);
    proc.stderr?.on("data", appendOutput);
    proc.on("error", rejectOnce);
    proc.on("exit", (code) => {
      if (code !== 0) {
        rejectOnce(
          new Error(`vite preview exited with code ${code}\n${output}`),
        );
      }
    });

    const poll = async () => {
      if (settled) return;
      if (Date.now() > deadline) {
        rejectOnce(
          new Error(
            `Server on port ${port} did not start within ${timeout}ms\n${output}`,
          ),
        );
        return;
      }

      try {
        const response = await fetch(`http://127.0.0.1:${port}`);
        if (response.ok || response.status < 500) {
          resolveOnce();
          return;
        }
      } catch {
        // Not ready yet.
      }

      setTimeout(poll, 400);
    };

    setTimeout(poll, 500);
  });
}

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
  let server: ChildProcess | undefined;
  let browser: Browser | undefined;

  beforeAll(async () => {
    await rm(ARTIFACT_ROOT, { recursive: true, force: true });
    await mkdir(ARTIFACT_ROOT, { recursive: true });
    server = await startPreviewServer(PORT);
    browser = await launchBrowser();
  });

  afterAll(async () => {
    try {
      await browser?.close();
    } finally {
      server?.kill("SIGTERM");
    }
  });

  for (const workflow of WORKFLOW_PRESETS) {
    it(
      `${workflow.id} produces identical color and normal pixels across two runs`,
      async () => {
        if (!browser) throw new Error("Browser did not start");

        const first = await runWorkflowExport(browser, workflow.id, 1);
        const second = await runWorkflowExport(browser, workflow.id, 2);

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
