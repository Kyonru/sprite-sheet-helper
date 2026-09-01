import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { mkdir, readFile, rm } from "fs/promises";
import { join, resolve } from "path";
import type { Browser } from "puppeteer";
import {
  expectExactPngPixels,
  findRepeatedFrames,
  readAtlasFrames,
  type FrameRect,
} from "../helpers/pixels";
import {
  WORKFLOW_ANIMATION_FIXTURE,
  createWorkflowE2EContext,
  runWorkflowExport,
  type WorkflowOutput,
} from "../helpers/workflow-e2e";

const PORT = 4192;
const ARTIFACT_ROOT = resolve(".e2e-artifacts/workflow-animation-capture");

/*
  The golden and reproducibility suites both drive `example.fbx`, which carries
  no animation clips — every sequence they capture is one static pose, so
  nothing they assert can say anything about how animation is sampled over
  time. This suite exists to cover exactly that: it runs a real clip and holds
  capture to the two properties a sprite pipeline depends on — the same input
  produces the same frames, and each frame is a different pose.
*/

/** A 0.967s walk cycle: long enough that 8 frames at 10fps stay inside it. */
const CLIP = "walk";
const CAPTURE = { frames: 8, fps: 10, width: 48, height: 48, normalMap: false };

type SpritesheetJson = {
  animations: { name: string; fps: number; quads: FrameRect[] }[];
};

async function readAnimations(output: WorkflowOutput) {
  const json = JSON.parse(
    await readFile(output.json, "utf8"),
  ) as SpritesheetJson;
  return json.animations;
}

describe("animated workflow capture", () => {
  let context: Awaited<ReturnType<typeof createWorkflowE2EContext>> | undefined;
  let browser: Browser | undefined;
  const runs: WorkflowOutput[] = [];

  beforeAll(async () => {
    await rm(ARTIFACT_ROOT, { recursive: true, force: true });
    await mkdir(ARTIFACT_ROOT, { recursive: true });
    context = await createWorkflowE2EContext(PORT);
    browser = context.browser;

    if (!browser) throw new Error("Browser did not start");

    // Every other clip is skipped so the run stays short; `front-facing` has a
    // single direction, so each clip contributes exactly one step.
    const skipStepLabels = [
      "agree",
      "headShake",
      "idle",
      "run",
      "sad_pose",
      "sneak_pose",
    ].map((clip) => `${clip}_Front`);

    for (const name of ["run-1", "run-2"]) {
      runs.push(
        await runWorkflowExport({
          browser,
          port: PORT,
          workflow: "front-facing",
          output: join(ARTIFACT_ROOT, name),
          fixture: WORKFLOW_ANIMATION_FIXTURE,
          captureOptions: CAPTURE,
          skipStepLabels,
        }),
      );
    }
  }, 600000);

  afterAll(async () => {
    await context?.close();
  });

  it("captures the clip that was asked for", async () => {
    const animations = await readAnimations(runs[0]);

    expect(animations.map((animation) => animation.name)).toEqual([
      `${CLIP}_Front`,
    ]);
    expect(animations[0].quads).toHaveLength(CAPTURE.frames);
    expect(animations[0].fps).toBe(CAPTURE.fps);
  });

  it("gives every frame a different pose", async () => {
    const [animation] = await readAnimations(runs[0]);
    const frames = await readAtlasFrames(runs[0].spritesheet, animation.quads);
    const repeated = findRepeatedFrames(frames);

    // 8 frames at 10fps covers 0.8s of a 0.967s clip, so nothing here should
    // be sampling past the end or landing on a pose twice.
    expect(repeated).toEqual([]);
    expect(new Set(frames.map((frame) => frame.toString("base64"))).size).toBe(
      CAPTURE.frames,
    );
  });

  it("produces identical pixels across two identical runs", async () => {
    await expectExactPngPixels(runs[0].spritesheet, runs[1].spritesheet, {
      workflow: "front-facing",
      image: "spritesheet.png",
    });
  });
});
