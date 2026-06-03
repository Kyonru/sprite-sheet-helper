#!/usr/bin/env node
import { readFile } from "fs/promises";
import { dirname, resolve as pathResolve } from "path";
import { fileURLToPath } from "url";
import type { ChildProcess } from "child_process";
import type { Browser, Page } from "puppeteer";
import { startServer, stopServer } from "./server.js";
import { launchBrowser, openPage } from "./browser.js";
import { injectModel } from "./inject.js";
import { captureFrames } from "./capture.js";
import { triggerExport } from "./export.js";
import { extractToOutput } from "./output.js";
import { captureWorkflow } from "./workflows.js";
import {
  CliUsageError,
  parseCliCommand,
  type CliCommand,
  type CliJob,
  type CliRunCommand,
} from "./options.js";

type Logger = {
  log: (message: string) => void;
  error: (message: string) => void;
};

type JobSummary = {
  id: string;
  status: "ok" | "error";
  input: string;
  output: string;
  format: string;
  workflow?: string;
  frames: number;
  fps: number;
  width: number;
  height: number;
  normalMap: boolean;
  atlasOptions: CliJob["atlasOptions"];
  files: string[];
  warnings: string[];
  elapsedMs: number;
  error?: string;
};

type CliSummary = {
  status: "ok" | "error";
  jobs: JobSummary[];
  files: string[];
  warnings: string[];
  elapsedMs: number;
};

const rootCandidates = [
  pathResolve(dirname(fileURLToPath(import.meta.url)), "../.."),
  pathResolve(dirname(fileURLToPath(import.meta.url)), ".."),
];

async function readVersion(): Promise<string> {
  for (const root of rootCandidates) {
    try {
      const packageJson = JSON.parse(
        await readFile(pathResolve(root, "package.json"), "utf8"),
      ) as { version?: string };
      if (packageJson.version) return packageJson.version;
    } catch {
      // Try the next candidate. Source and dist builds sit at different depths.
    }
  }
  return "0.4.0";
}

async function main() {
  const startedAt = Date.now();
  const command = await parseCliCommand(process.argv.slice(2), {
    version: await readVersion(),
  });

  if (command.kind !== "run") {
    printInfoCommand(command);
    return;
  }

  if (command.dryRun) {
    printDryRun(command, Date.now() - startedAt);
    return;
  }

  const summary = await runCommand(command, startedAt);
  if (command.json) {
    process.stdout.write(`${JSON.stringify(summary, null, 2)}\n`);
  } else if (!command.quiet) {
    printHumanSummary(summary);
  } else if (summary.status !== "ok") {
    printErrorSummary(summary);
  }

  if (summary.status !== "ok") {
    process.exitCode = 1;
  }
}

async function runCommand(
  command: CliRunCommand,
  startedAt: number,
): Promise<CliSummary> {
  const logger = createLogger(command);
  const jobSummaries: JobSummary[] = [];

  for (const job of command.jobs) {
    const result = await runJob(job, command, logger);
    jobSummaries.push(result);
    if (result.status === "error") break;
  }

  const status = jobSummaries.every((job) => job.status === "ok")
    ? "ok"
    : "error";
  const files = jobSummaries.flatMap((job) => job.files);
  const warnings = jobSummaries.flatMap((job) => job.warnings);

  return {
    status,
    jobs: jobSummaries,
    files,
    warnings,
    elapsedMs: Date.now() - startedAt,
  };
}

async function runJob(
  job: CliJob,
  command: CliRunCommand,
  logger: Logger,
): Promise<JobSummary> {
  const startedAt = Date.now();
  const warnings: string[] = [];
  const run = async () => runJobInner(job, command, logger);

  try {
    const files = job.timeout
      ? await withTimeout(run(), job.timeout, `Job "${job.id}" timed out`)
      : await run();
    return {
      id: job.id,
      status: "ok",
      input: job.input,
      output: job.output,
      format: job.format,
      workflow: job.workflow,
      frames: job.frames,
      fps: job.fps,
      width: job.width,
      height: job.height,
      normalMap: job.normalMap,
      atlasOptions: job.atlasOptions,
      files,
      warnings,
      elapsedMs: Date.now() - startedAt,
    };
  } catch (error) {
    return {
      id: job.id,
      status: "error",
      input: job.input,
      output: job.output,
      format: job.format,
      workflow: job.workflow,
      frames: job.frames,
      fps: job.fps,
      width: job.width,
      height: job.height,
      normalMap: job.normalMap,
      atlasOptions: job.atlasOptions,
      files: [],
      warnings,
      elapsedMs: Date.now() - startedAt,
      error: (error as Error).message,
    };
  }
}

async function runJobInner(
  job: CliJob,
  command: CliRunCommand,
  logger: Logger,
): Promise<string[]> {
  let serverProc: ChildProcess | undefined;
  let browser: Browser | undefined;
  let page: Page | undefined;

  try {
    logger.log(
      `[sprite-sheet-helper] job=${job.id} format=${job.format} frames=${job.frames} size=${job.width}x${job.height}`,
    );
    logger.log(
      `[sprite-sheet-helper] Starting preview server on port ${job.port}...`,
    );
    serverProc = await startServer(job.port, job.timeout);

    logger.log("[sprite-sheet-helper] Launching browser...");
    browser = await launchBrowser({ headful: command.headful });
    page = await openPage(browser, job.port, {
      debug: command.debug,
      timeoutMs: job.timeout,
      log: logger.log,
      error: logger.error,
    });

    logger.log(`[sprite-sheet-helper] Injecting model: ${job.input}`);
    const modelUuid = await injectModel(page, job.input, {
      silent: command.quiet || command.json,
    });

    if (job.cameraAngle !== undefined && !job.workflow) {
      logger.log(
        `[sprite-sheet-helper] Setting camera angle to ${job.cameraAngle}`,
      );
      await page.evaluate((angle: number) => {
        window.__SSH_BRIDGE__.stores.settings.getState().setCameraAngle(angle);
      }, job.cameraAngle);
    }

    if (job.workflow) {
      logger.log(`[sprite-sheet-helper] Running workflow ${job.workflow}...`);
      await captureWorkflow(page, {
        modelUuid,
        frames: job.frames,
        fps: job.fps,
        width: job.width,
        height: job.height,
        workflow: job.workflow,
        cameraDistance: job.cameraDistance,
        cameraAngle: job.cameraAngle,
        directionRotationOffset: job.directionRotationOffset,
        target: job.target,
        directionOverrides: job.directionOverrides,
        normalMap: job.normalMap,
        workflowTimeout: job.workflowTimeout,
        silent: command.quiet || command.json,
      });
    } else {
      logger.log("[sprite-sheet-helper] Capturing frames...");
      await captureFrames(page, {
        modelUuid,
        frames: job.frames,
        fps: job.fps,
        width: job.width,
        height: job.height,
        cameraDistance: job.cameraDistance,
        normalMap: job.normalMap,
        silent: command.quiet || command.json,
      });
    }

    logger.log(`[sprite-sheet-helper] Exporting as ${job.format}...`);
    const { href } = await triggerExport(
      page,
      job.format,
      job.atlasOptions,
      job.exportTimeout,
    );

    logger.log(`[sprite-sheet-helper] Writing to ${job.output}...`);
    return await extractToOutput(href, job.output);
  } finally {
    try {
      await page?.close();
    } catch {
      // Page may already be closed.
    }
    try {
      await browser?.close();
    } catch {
      // Browser may already be closed.
    }
    if (serverProc && !command.keepServer) {
      stopServer(serverProc);
      await new Promise((resolve) => setTimeout(resolve, 100));
      logger.log("[sprite-sheet-helper] Server stopped");
    }
  }
}

function printInfoCommand(command: Exclude<CliCommand, CliRunCommand>) {
  if (command.json) {
    process.stdout.write(`${JSON.stringify(command, null, 2)}\n`);
    return;
  }

  if (command.kind === "help") {
    process.stdout.write(`${command.text}\n`);
    return;
  }

  if (command.kind === "version") {
    process.stdout.write(`${command.version}\n`);
    return;
  }

  if (command.kind === "list-formats") {
    process.stdout.write(`${command.formats.join("\n")}\n`);
    return;
  }

  process.stdout.write(
    `${command.workflows
      .map((workflow) => `${workflow.id}\t${workflow.label}`)
      .join("\n")}\n`,
  );
}

function printDryRun(command: CliRunCommand, elapsedMs: number) {
  const summary: CliSummary = {
    status: "ok",
    jobs: command.jobs.map((job) => ({
      id: job.id,
      status: "ok",
      input: job.input,
      output: job.output,
      format: job.format,
      workflow: job.workflow,
      frames: job.frames,
      fps: job.fps,
      width: job.width,
      height: job.height,
      normalMap: job.normalMap,
      atlasOptions: job.atlasOptions,
      files: [],
      warnings: [],
      elapsedMs: 0,
    })),
    files: [],
    warnings: [],
    elapsedMs,
  };

  if (command.json) {
    process.stdout.write(`${JSON.stringify(summary, null, 2)}\n`);
    return;
  }

  for (const job of command.jobs) {
    process.stdout.write(
      [
        `[sprite-sheet-helper] dry run: ${job.id}`,
        `  input: ${job.input}`,
        `  output: ${job.output}`,
        `  format: ${job.format}`,
        `  workflow: ${job.workflow ?? "-"}`,
        `  frames: ${job.frames} @ ${job.fps}fps`,
        `  size: ${job.width}x${job.height}`,
      ].join("\n") + "\n",
    );
  }
}

function printHumanSummary(summary: CliSummary) {
  for (const job of summary.jobs) {
    if (job.status === "error") {
      process.stderr.write(
        `[sprite-sheet-helper] ${job.id} failed: ${job.error ?? "Unknown error"}\n`,
      );
      continue;
    }
    process.stdout.write(
      `[sprite-sheet-helper] ${job.id} done — ${job.files.length} file(s) written:\n`,
    );
    for (const file of job.files) {
      process.stdout.write(`  ${file}\n`);
    }
  }
  process.stdout.write(
    `[sprite-sheet-helper] ${summary.status === "ok" ? "Done" : "Failed"} in ${summary.elapsedMs}ms\n`,
  );
}

function printErrorSummary(summary: CliSummary) {
  for (const job of summary.jobs) {
    if (job.status === "error") {
      process.stderr.write(
        `[sprite-sheet-helper] ${job.id} failed: ${job.error ?? "Unknown error"}\n`,
      );
    }
  }
}

function createLogger(command: CliRunCommand): Logger {
  return {
    log(message) {
      if (!command.quiet && !command.json) console.log(message);
      else if (command.debug) console.error(message);
    },
    error(message) {
      if (!command.quiet && !command.json) console.error(message);
      else if (command.debug) console.error(message);
    },
  };
}

function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
  label: string,
): Promise<T> {
  let timeout: ReturnType<typeof setTimeout>;
  const timeoutPromise = new Promise<never>((_, reject) => {
    timeout = setTimeout(
      () => reject(new Error(`${label} after ${timeoutMs}ms`)),
      timeoutMs,
    );
  });
  return Promise.race([promise, timeoutPromise]).finally(() =>
    clearTimeout(timeout),
  );
}

main().catch((error: Error) => {
  const message =
    error instanceof CliUsageError
      ? error.message
      : `[sprite-sheet-helper] Error: ${error.message}`;
  console.error(message);
  process.exit(1);
});
