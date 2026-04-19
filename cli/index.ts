#!/usr/bin/env node
import { parseArgs } from "util";
import { resolve, extname } from "path";
import { startServer, stopServer } from "./server.js";
import { launchBrowser, openPage } from "./browser.js";
import { injectModel } from "./inject.js";
import { captureFrames } from "./capture.js";
import { triggerExport } from "./export.js";
import { extractToOutput } from "./output.js";
import type { ChildProcess } from "child_process";
import type { Browser } from "puppeteer";
import {
  WORKFLOW_PRESETS,
  EXPORT_FORMATS,
  ACCEPTED_MODEL_FILE_TYPES,
} from "./data.js";
import { captureWorkflow } from "./workflows.js";

const FORMAT_ALIASES: Record<string, string> = {
  "bevy-rust": "bevy",
  love2d: "love2d-lua",
  anim8: "love2d-anim8",
};

interface CliArgs {
  glbPath: string;
  format: string;
  frames: number;
  fps: number;
  width: number;
  height: number;
  output: string;
  port: number;
  workflow?: string;
  cameraDistance?: number;
}

function parseCliArgs(): CliArgs {
  const { values, positionals } = parseArgs({
    args: process.argv.slice(2),
    options: {
      format: { type: "string", default: "spritesheet" },
      frames: { type: "string", default: "8" },
      fps: { type: "string", default: "10" },
      width: { type: "string", default: "64" },
      height: { type: "string", default: "64" },
      output: { type: "string", default: "./out" },
      port: { type: "string", default: "4174" },
      workflow: { type: "string", default: undefined },
      cameraDistance: { type: "string", default: "5" },
    },
    allowPositionals: true,
  });

  const glbPath = positionals[0];
  if (!glbPath) {
    console.error(
      `Usage: sprite-sheet-helper <input> [options]\nAccepted model formats: ${ACCEPTED_MODEL_FILE_TYPES.join(", ")}`,
    );
    process.exit(1);
  }

  const ext = extname(glbPath).replace(".", "").toLowerCase();
  if (!(ACCEPTED_MODEL_FILE_TYPES as readonly string[]).includes(ext)) {
    console.error(
      `Unsupported model format ".${ext}". Accepted: ${ACCEPTED_MODEL_FILE_TYPES.join(", ")}`,
    );
    process.exit(1);
  }

  const rawFormat = values.format ?? "spritesheet";
  const format = FORMAT_ALIASES[rawFormat] ?? rawFormat;

  if (!(EXPORT_FORMATS as readonly string[]).includes(format)) {
    console.error(
      `Unknown format "${rawFormat}". Valid: ${EXPORT_FORMATS.join(", ")}`,
    );
    process.exit(1);
  }

  if (values.workflow) {
    const workflow = WORKFLOW_PRESETS.find((w) => w.id === values.workflow);
    if (!workflow) {
      console.error(
        `Unknown workflow "${values.workflow}". Valid: ${WORKFLOW_PRESETS.map((w) => w.id).join(", ")}`,
      );
      process.exit(1);
    }
  }

  return {
    glbPath: resolve(glbPath),
    format,
    frames: parseInt(values.frames ?? "8", 10),
    fps: parseFloat(values.fps ?? "10"),
    width: parseInt(values.width ?? "64", 10),
    height: parseInt(values.height ?? "64", 10),
    output: resolve(values.output ?? "./out"),
    port: parseInt(values.port ?? "4174", 10),
    workflow: values.workflow,
    cameraDistance: parseFloat(values.cameraDistance ?? "5"),
  };
}

async function main() {
  const args = parseCliArgs();

  console.log(
    `[sprite-sheet-helper] format=${args.format} frames=${args.frames} size=${args.width}x${args.height}`,
  );

  let serverProc: ChildProcess | undefined;
  let browser: Browser | undefined;

  try {
    console.log(
      `[sprite-sheet-helper] Starting preview server on port ${args.port}...`,
    );
    serverProc = await startServer(args.port);

    console.log("[sprite-sheet-helper] Launching headless browser...");
    browser = await launchBrowser();
    const page = await openPage(browser, args.port);

    console.log(`[sprite-sheet-helper] Injecting model: ${args.glbPath}`);
    const modelUuid = await injectModel(page, args.glbPath);

    console.log("Injected model passed", args.workflow);

    if (args.workflow) {
      console.log(`[sprite-sheet-helper] Setting workflow to ${args.workflow}`);
      await captureWorkflow(page, {
        modelUuid,
        frames: args.frames,
        fps: args.fps,
        width: args.width,
        height: args.height,
        workflow: args.workflow,
        cameraDistance: args.cameraDistance,
      });
    } else {
      console.log(`[sprite-sheet-helper] Capturing frames...`);
      await captureFrames(page, {
        modelUuid,
        frames: args.frames,
        fps: args.fps,
        width: args.width,
        height: args.height,
      });
    }

    console.log(`[sprite-sheet-helper] Exporting as ${args.format}...`);
    const { href } = await triggerExport(page, args.format);

    console.log(`[sprite-sheet-helper] Writing to ${args.output}...`);
    const files = await extractToOutput(href, args.output);

    console.log(
      `[sprite-sheet-helper] Done — ${files.length} file(s) written:`,
    );
    for (const f of files) console.log(`  ${f}`);
  } finally {
    await browser?.close();
    if (serverProc) stopServer(serverProc);
  }
}

main().catch((err: Error) => {
  console.error("[sprite-sheet-helper] Error:", err.message);
  process.exit(1);
});
