/**
 * Capture MediaPipe pose landmarks from a video, headlessly.
 *
 * Step one of the two-step benchmark: capture is slow and needs a browser
 * (MediaPipe ships as WASM), while measurement is instant. Splitting them means
 * a clip is captured once and re-measured for free after every change — which
 * is what makes a before/after number cheap enough to actually produce.
 *
 * Runs the SAME @mediapipe/tasks-vision version and model tier the app uses
 * (see src/hooks/next/use-mediapipe.ts), in a real browser, so a difference
 * measured downstream is a difference in our processing, not in the detector.
 * VIDEO running mode with monotonic timestamps is deliberate: it enables
 * MediaPipe's own frame-to-frame tracking, which IMAGE mode does not.
 *
 *   node scripts/pose-capture.mjs --video <mp4> --out <json> [--tier accurate] [--max-seconds 10]
 */

import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, readdirSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";

import puppeteer from "puppeteer";

// Keep in step with src/hooks/next/use-mediapipe.ts.
const TASKS_VISION_VERSION = "0.10.34";
const WASM_CDN = `https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@${TASKS_VISION_VERSION}/wasm`;
const MODEL_URLS = {
  fast: "https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task",
  balanced: "https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_full/float16/1/pose_landmarker_full.task",
  accurate: "https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_heavy/float16/1/pose_landmarker_heavy.task",
};

const argv = process.argv.slice(2);
const arg = (name, fallback) => {
  const i = argv.indexOf(`--${name}`);
  if (i >= 0 && argv[i + 1] !== undefined) return argv[i + 1];
  if (fallback !== undefined) return fallback;
  throw new Error(`--${name} is required`);
};

const video = resolve(arg("video"));
const out = resolve(arg("out"));
const tier = arg("tier", "accurate");
const maxSeconds = Number(arg("max-seconds", "0"));
const startSeconds = Number(arg("start", "0"));
const targetFps = Number(arg("fps", "0"));

if (!MODEL_URLS[tier]) throw new Error(`--tier must be fast|balanced|accurate (got "${tier}")`);

// ---- Probe the source, so fps is measured rather than assumed --------------
const probe = JSON.parse(
  execFileSync("ffprobe", [
    "-v", "error", "-select_streams", "v:0",
    "-show_entries", "stream=width,height,avg_frame_rate,r_frame_rate,duration",
    "-show_entries", "format=duration", "-of", "json", video,
  ], { encoding: "utf8" }),
);
const stream = probe.streams?.[0];
if (!stream) throw new Error(`${video} has no video stream`);
const rate = (value) => {
  if (!value) return 0;
  const [n, d] = value.split("/").map(Number);
  return d ? n / d : n;
};
const sourceFps = rate(stream.avg_frame_rate) || rate(stream.r_frame_rate) || 30;
const fps = targetFps > 0 ? targetFps : sourceFps;

const work = mkdtempSync(join(tmpdir(), "pose-capture-"));
try {
  const ffmpegArgs = ["-y", "-hide_banner", "-loglevel", "error"];
  // Seek BEFORE -i so ffmpeg skips rather than decodes the skipped span.
  if (startSeconds > 0) ffmpegArgs.push("-ss", String(startSeconds));
  if (maxSeconds > 0) ffmpegArgs.push("-t", String(maxSeconds));
  ffmpegArgs.push("-i", video, "-vf", `fps=${fps}`, "-q:v", "2", "-start_number", "0", join(work, "%06d.jpg"));
  execFileSync("ffmpeg", ffmpegArgs);

  const files = readdirSync(work).filter((f) => f.endsWith(".jpg")).sort();
  if (files.length === 0) throw new Error("ffmpeg produced no frames");
  console.log(`[capture] ${files.length} frames at ${fps.toFixed(3)} fps from ${video}`);

  const browser = await puppeteer.launch({
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox", "--use-gl=swiftshader", "--enable-unsafe-swiftshader"],
    protocolTimeout: 600000,
  });

  try {
    const page = await browser.newPage();
    page.on("pageerror", (e) => console.log("[pageerror]", String(e).slice(0, 200)));
    await page.setContent("<!doctype html><html><body></body></html>");

    await page.evaluate(
      async (wasmCdn, model, version) => {
        const mod = await import(`https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@${version}/vision_bundle.mjs`);
        const vision = await mod.FilesetResolver.forVisionTasks(wasmCdn);
        // CPU delegate: GPU is unavailable under swiftshader in headless, and
        // the landmarks are identical either way — only the speed differs.
        window.__LM = await mod.PoseLandmarker.createFromOptions(vision, {
          baseOptions: { modelAssetPath: model, delegate: "CPU" },
          runningMode: "VIDEO",
          numPoses: 1,
          minPoseDetectionConfidence: 0.5,
          minPosePresenceConfidence: 0.5,
          minTrackingConfidence: 0.5,
          outputSegmentationMasks: false,
        });
      },
      WASM_CDN, MODEL_URLS[tier], TASKS_VISION_VERSION,
    );

    const frames = [];
    let imageWidth = 0;
    let imageHeight = 0;
    const started = Date.now();

    for (let i = 0; i < files.length; i += 1) {
      const dataUrl = `data:image/jpeg;base64,${readFileSync(join(work, files[i])).toString("base64")}`;
      const result = await page.evaluate(
        async (url, ts) => {
          const img = new Image();
          await new Promise((res, rej) => {
            img.onload = res;
            img.onerror = () => rej(new Error("decode failed"));
            img.src = url;
          });
          const bitmap = await createImageBitmap(img);
          const outp = window.__LM.detectForVideo(bitmap, ts);
          bitmap.close();
          const r = (v) => Math.round(v * 1e6) / 1e6;
          const pack = (a) => a?.map((p) => ({ x: r(p.x), y: r(p.y), z: r(p.z), visibility: p.visibility === undefined ? undefined : r(p.visibility) }));
          return {
            world: pack(outp.worldLandmarks?.[0]),
            screen: pack(outp.landmarks?.[0]),
            size: { width: img.naturalWidth, height: img.naturalHeight },
          };
        },
        dataUrl, Math.round((i / fps) * 1000),
      );
      imageWidth = result.size.width;
      imageHeight = result.size.height;
      frames.push({ index: i, timeMs: Math.round((i / fps) * 1000), world: result.world, screen: result.screen });
      if ((i + 1) % 20 === 0 || i === files.length - 1) console.log(`[capture] ${i + 1}/${files.length}`);
    }

    const inferenceMs = Date.now() - started;
    const detected = frames.filter((f) => f.world).length;
    mkdirSync(dirname(out), { recursive: true });
    writeFileSync(out, `${JSON.stringify({
      provider: "mediapipe",
      tasksVisionVersion: TASKS_VISION_VERSION,
      modelTier: tier,
      runningMode: "VIDEO",
      sourceVideo: video,
      startSeconds,
      sourceFps,
      fps,
      imageWidth,
      imageHeight,
      frameCount: files.length,
      detectedFrames: detected,
      inferenceMs,
      msPerFrame: Number((inferenceMs / files.length).toFixed(1)),
      frames,
    })}\n`);
    console.log(`[capture] detected ${detected}/${files.length} in ${(inferenceMs / 1000).toFixed(1)}s (${(inferenceMs / files.length).toFixed(0)} ms/frame) -> ${out}`);
    if (detected === 0) process.exitCode = 1;
  } finally {
    await browser.close();
  }
} finally {
  rmSync(work, { recursive: true, force: true });
}
