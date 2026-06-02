import { mkdir, readFile, rm } from "fs/promises";
import { join, resolve } from "path";
import { spawn } from "child_process";
import type { ChildProcess } from "child_process";
import type { Browser, Page } from "puppeteer";
import { launchBrowser, openPage } from "../../cli/browser";
import { injectModel } from "../../cli/inject";
import { extractToOutput } from "../../cli/output";
import { triggerExport } from "../../cli/export";
import { captureWorkflow } from "../../cli/workflows";

export const WORKFLOW_E2E_CAPTURE_OPTIONS = {
  frames: 4,
  fps: 10,
  width: 32,
  height: 32,
  cameraDistance: 2.5,
  normalMap: true,
};

export const WORKFLOW_FIXTURE = resolve("example.fbx");
export const WORKFLOW_GOLDEN_ROOT = resolve("tests/suitcase/workflows");

export type WorkflowOutput = {
  output: string;
  spritesheet: string;
  normal: string;
  json: string;
};

export type JsonValue =
  | string
  | number
  | boolean
  | null
  | JsonValue[]
  | { [key: string]: JsonValue };

export function normalizeJson(value: JsonValue): JsonValue {
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

export async function readNormalizedSpritesheetJson(
  path: string,
): Promise<JsonValue> {
  return normalizeJson(JSON.parse(await readFile(path, "utf8")) as JsonValue);
}

export async function runWorkflowExport({
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
  const page = await openPage(browser, port);

  await rm(output, { recursive: true, force: true });
  await mkdir(output, { recursive: true });

  try {
    const modelUuid = await injectModel(page, WORKFLOW_FIXTURE);

    await captureWorkflow(page, {
      modelUuid,
      workflow,
      ...WORKFLOW_E2E_CAPTURE_OPTIONS,
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

export async function closePage(page: Page): Promise<void> {
  try {
    await page.close();
  } catch {
    // Page may already be closed if the browser failed during the test.
  }
}

export async function startPreviewServer(port: number): Promise<ChildProcess> {
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

export async function createWorkflowE2EContext(port: number) {
  const server = await startPreviewServer(port);
  const browser = await launchBrowser();

  return {
    browser,
    server,
    async close() {
      try {
        await browser.close();
      } finally {
        server.kill("SIGTERM");
      }
    },
  };
}
