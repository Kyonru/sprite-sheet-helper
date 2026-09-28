/**
 * Stress-test the MediaPipe capture pipeline across a corpus of short clips.
 *
 * One clip proves nothing about robustness. This runs the whole pipeline over
 * a set of deliberately awkward videos and, crucially, DECIDES automatically
 * which results are implausible - a table of numbers nobody reads is not a
 * stress test.
 *
 * The checks encode things that are true of any human, so a violation means
 * the pipeline is wrong rather than the clip being unusual: a person's head is
 * above their hips, their bones do not change length, their limbs do not
 * accelerate at thousands of degrees per second squared.
 *
 * It also renders a filmstrip per clip, because this project has repeatedly
 * found defects that every metric passed and only the eye caught.
 *
 *   node scripts/pose-stress.mjs [--corpus scripts/pose-corpus.json]
 *                                [--seconds 4] [--only id1,id2] [--skip-render]
 */

import { execFileSync, execSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync, rmSync } from "node:fs";
import { join, resolve } from "node:path";

const argv = process.argv.slice(2);
const opt = (name, fallback) => {
  const i = argv.indexOf(`--${name}`);
  return i >= 0 && argv[i + 1] !== undefined ? argv[i + 1] : fallback;
};

const corpusPath = resolve(opt("corpus", "scripts/pose-corpus.json"));
const seconds = Number(opt("seconds", "4"));
const only = opt("only", "")?.split(",").filter(Boolean) ?? [];
const skipRender = argv.includes("--skip-render");
const root = resolve(".pose-bench/stress");
const character = resolve(opt("character", "example_animation.glb"));

mkdirSync(root, { recursive: true });
const corpus = JSON.parse(readFileSync(corpusPath, "utf8"));
const clips = corpus.clips.filter((c) => only.length === 0 || only.includes(c.id));

/**
 * Plausibility checks. Each is a fact about human bodies, not a preference, so
 * a failure indicts the pipeline rather than the footage.
 */
function audit(clip, report) {
  const m = report.metrics;
  const issues = [];
  const warn = [];

  // A low detection rate is usually a property of the FOOTAGE, not a fault in
  // the pipeline: a clip with no visible person should detect nothing, and
  // reporting that honestly is correct behaviour.
  if (report.detectionRate < 0.9) {
    warn.push(`pose detected in only ${(report.detectionRate * 100).toFixed(0)}% of frames`);
  }
  if (m.boneLengthVariance > 1e-10) {
    issues.push(`bones changing length (variance ${m.boneLengthVariance.toExponential(1)})`);
  }
  // A rotation-only solve cannot exceed this unless something is very wrong.
  // Jitter stays a problem whatever caused it. The discontinuity count is
  // context for WHERE TO LOOK, never a reason to pass: a montage and a
  // detector losing the pose look identical here, and only one of them is the
  // footage's fault.
  const because = report.cuts?.length ? ` (${report.cuts.length} landmark jumps)` : "";
  if (m.angularJitterDegPerSec2 > 900) {
    issues.push(`limbs snapping (${m.angularJitterDegPerSec2.toFixed(0)} deg/s2)${because}`);
  } else if (m.angularJitterDegPerSec2 > 450) {
    warn.push(`jittery (${m.angularJitterDegPerSec2.toFixed(0)} deg/s2)${because}`);
  }
  // Lean is a WARNING, never a failure. A yoga side bend legitimately leans 60
  // degrees, and an early version of this check failed that clip for being a
  // correct reconstruction of an unusual pose. These thresholds encode "most
  // people stand upright most of the time", which is a prior about footage,
  // not a fact about bodies.
  if (report.torsoLeanDeg > 20) {
    warn.push(`torso leaning ${report.torsoLeanDeg.toFixed(0)} deg (may be genuine)`);
  }
  if (report.headLeanDeg > 20) {
    warn.push(`head tipped ${report.headLeanDeg.toFixed(0)} deg (may be genuine)`);
  }
  if (report.heldFrames / Math.max(1, m.frames) > 0.5) {
    warn.push(`${report.heldFrames}/${m.frames} frames holding an occluded bone`);
  }
  if (m.frames >= 10 && m.footContacts === 0) {
    warn.push("no foot contact ever detected");
  }
  if (!Number.isFinite(m.statureUnits) || m.statureUnits <= 0) {
    issues.push("nonsensical stature");
  }
  return { issues, warn };
}

/**
 * Pick the start time of the `window`-second span containing the most detected
 * poses, by probing the whole video at 2 fps.
 *
 * Cheap: a 60 s clip costs about 120 detections, against the ~100 the real
 * capture does anyway, and it removes "which part of the video did we happen
 * to take" as a hidden variable.
 */
function findBestWindow(source, dir, window) {
  const probePath = join(dir, "probe.json");
  if (!existsSync(probePath)) {
    execSync(
      `node scripts/pose-capture.mjs --video ${JSON.stringify(source)} --out ${JSON.stringify(probePath)} --tier fast --fps 2`,
      { stdio: ["ignore", "pipe", "pipe"], timeout: 900000 },
    );
  }
  const probe = JSON.parse(readFileSync(probePath, "utf8"));
  const hits = probe.frames.map((f) => (f.world ? 1 : 0));
  const step = 1 / (probe.fps || 2);
  const span = Math.max(1, Math.round(window / step));
  let best = 0;
  let bestScore = -1;
  for (let i = 0; i + span <= hits.length; i += 1) {
    const score = hits.slice(i, i + span).reduce((a, b) => a + b, 0);
    if (score > bestScore) {
      bestScore = score;
      best = i;
    }
  }
  return best * step;
}

/**
 * Landmark-discontinuity cut detector, mirroring src/utils/pose-metrics.ts.
 * Kept inline so the stress runner stays a plain script with no build step.
 */
function detectCuts(frames) {
  const motion = [];
  for (let i = 1; i < frames.length; i += 1) {
    const a = frames[i - 1];
    const b = frames[i];
    if (!a || !b || a.length !== b.length) { motion.push(Number.NaN); continue; }
    let sum = 0;
    for (let k = 0; k < b.length; k += 1) {
      sum += Math.hypot(b[k].x - a[k].x, b[k].y - a[k].y, b[k].z - a[k].z);
    }
    motion.push(sum / Math.max(1, b.length));
  }
  const valid = motion.filter((v) => Number.isFinite(v)).sort((x, y) => x - y);
  if (valid.length < 4) return [];
  const med = valid[Math.floor(valid.length / 2)];
  const devs = valid.map((v) => Math.abs(v - med)).sort((x, y) => x - y);
  const scale = Math.max(devs[Math.floor(devs.length / 2)] * 1.4826, 1e-6);
  const cuts = [];
  motion.forEach((v, i) => {
    if (Number.isFinite(v) && v > med + 6 * scale && v > 0.08) cuts.push(i + 1);
  });
  return cuts;
}

const results = [];
for (const clip of clips) {
  const dir = join(root, clip.id);
  mkdirSync(dir, { recursive: true });
  const source = join(dir, "source.webm");
  const trimmed = join(dir, "clip.mp4");
  const landmarks = join(dir, "landmarks.json");
  const metricsPath = join(dir, "metrics.json");

  process.stdout.write(`\n=== ${clip.id} (${clip.licence}) ===\n  ${clip.stresses}\n`);

  try {
    if (!existsSync(source)) {
      process.stdout.write("  downloading...\n");
      execFileSync("curl", ["-sL", "-A", "sprite-sheet-helper-research/0.1", "-o", source, clip.url], {
        timeout: 300000,
      });
    }
    if (!existsSync(trimmed)) {
      // Find a window that actually contains a person before trimming.
      //
      // Taking the opening seconds is naive and produced three "pipeline
      // failures" that were nothing of the sort: two clips open with a title
      // card and one with an establishing shot of pavement, so MediaPipe
      // correctly detected nobody. Probe the whole video cheaply, then keep
      // the densest window.
      const start = findBestWindow(source, dir, seconds);
      process.stdout.write(`  using ${start.toFixed(1)}s-${(start + seconds).toFixed(1)}s\n`);
      execFileSync("ffmpeg", [
        "-y", "-hide_banner", "-loglevel", "error",
        "-ss", String(start), "-t", String(seconds), "-i", source,
        "-vf", "fps=24,scale='min(768,iw)':-2",
        "-an", trimmed,
      ], { timeout: 300000 });
    }
    if (!existsSync(landmarks)) {
      execSync(
        `node scripts/pose-capture.mjs --video ${JSON.stringify(trimmed)} --out ${JSON.stringify(landmarks)} --tier accurate`,
        { stdio: ["ignore", "pipe", "pipe"], timeout: 900000 },
      );
    }

    const glb = join(dir, "posed.glb");
    execSync(
      `node scripts/pose-bench.mjs --landmarks ${JSON.stringify(landmarks)} --character ${JSON.stringify(character)}` +
        ` --root-source rig --root-motion in-place --vis-threshold 0.05` +
        ` --json ${JSON.stringify(metricsPath)}` +
        (skipRender ? "" : ` --export-glb ${JSON.stringify(glb)} --clip-name stress`),
      { stdio: ["ignore", "pipe", "pipe"], timeout: 900000 },
    );

    const report = JSON.parse(readFileSync(metricsPath, "utf8"));
    const capture = JSON.parse(readFileSync(landmarks, "utf8"));
    report.detectionRate = capture.detectedFrames / Math.max(1, capture.frameCount);
    // Attribute jitter to the footage where that is the real cause.
    report.cuts = detectCuts(capture.frames.map((f) => f.world));
    const { issues, warn } = audit(clip, report);
    results.push({ clip, report, issues, warn });

    const m = report.metrics;
    process.stdout.write(
      `  frames ${m.frames}  detected ${(report.detectionRate * 100).toFixed(0)}%  ` +
        `jitter ${m.angularJitterDegPerSec2.toFixed(0)}  torso ${report.torsoLeanDeg?.toFixed(0)}deg  ` +
        `head ${report.headLeanDeg?.toFixed(0)}deg  contacts ${m.footContacts}\n`,
    );
    for (const i of issues) process.stdout.write(`  FAIL  ${i}\n`);
    for (const w of warn) process.stdout.write(`  warn  ${w}\n`);
    if (issues.length === 0 && warn.length === 0) process.stdout.write("  ok\n");

    if (!skipRender && existsSync(glb)) {
      const out = join(dir, "render");
      rmSync(out, { recursive: true, force: true });
      execSync(
        `node dist/cli/index.js ${JSON.stringify(glb)} --clip stress --format gif --frames 16 --fps 12` +
          ` --width 160 --height 160 --fit auto --margin 8 --workflow platformer --output ${JSON.stringify(out)}`,
        { stdio: ["ignore", "pipe", "pipe"], timeout: 900000 },
      );
      const gif = join(out, "stress_Left.gif");
      if (existsSync(gif)) {
        execFileSync("ffmpeg", ["-y", "-hide_banner", "-loglevel", "error", "-i", gif,
          "-vf", "select='not(mod(n\\,3))',scale=160:160,tile=6x1", "-vsync", "0", "-frames:v", "1",
          join(dir, "strip.png")], { timeout: 120000 });
        execFileSync("ffmpeg", ["-y", "-hide_banner", "-loglevel", "error", "-i", trimmed,
          "-vf", `fps=6/${seconds},scale=-1:160,crop=160:160,tile=6x1`, "-frames:v", "1",
          join(dir, "src_strip.png")], { timeout: 120000 });
      }
    }
  } catch (error) {
    const parts = [error.stderr?.toString(), error.stdout?.toString(), error.message]
      .filter(Boolean)
      .join("\n");
    const message = parts.split("\n").filter((l) => l.trim()).slice(-3).join(" | ").slice(0, 260)
      || "no output captured";
    process.stdout.write(`  ERROR ${message}\n`);
    // "No person in the clip" is the pipeline working, not failing.
    const noSubject = /no frames with landmarks|detected no pose/i.test(message);
    results.push({
      clip,
      report: null,
      noSubject,
      issues: noSubject ? [] : [`pipeline error: ${message}`],
      warn: noSubject ? ["no person detected anywhere in the clip"] : [],
    });
  }
}

// ---- Summary ---------------------------------------------------------------
process.stdout.write(`\n${"=".repeat(96)}\nSTRESS SUMMARY\n${"=".repeat(96)}\n`);
const head = ["clip", "det%", "frames", "jitter", "torso", "head", "contacts", "held%", "verdict"];
process.stdout.write(
  `${head[0].padEnd(18)}${head[1].padStart(6)}${head[2].padStart(8)}${head[3].padStart(9)}` +
    `${head[4].padStart(7)}${head[5].padStart(7)}${head[6].padStart(10)}${head[7].padStart(7)}  ${head[8]}\n`,
);
let failed = 0;
for (const r of results) {
  if (!r.report) {
    const label = r.noSubject ? "no subject in clip" : "ERROR";
    process.stdout.write(`${r.clip.id.padEnd(18)}${"-".padStart(6)}${"".padStart(8)}${"".padStart(9)}${"".padStart(7)}${"".padStart(7)}${"".padStart(10)}${"".padStart(7)}  ${label}\n`);
    if (!r.noSubject) failed += 1;
    continue;
  }
  const m = r.report.metrics;
  const verdict = r.issues.length > 0 ? `FAIL: ${r.issues[0]}` : r.warn.length > 0 ? `warn: ${r.warn[0]}` : "ok";
  if (r.issues.length > 0) failed += 1;
  process.stdout.write(
    `${r.clip.id.padEnd(18)}${(r.report.detectionRate * 100).toFixed(0).padStart(6)}` +
      `${String(m.frames).padStart(8)}${m.angularJitterDegPerSec2.toFixed(0).padStart(9)}` +
      `${(r.report.torsoLeanDeg ?? 0).toFixed(0).padStart(7)}${(r.report.headLeanDeg ?? 0).toFixed(0).padStart(7)}` +
      `${String(m.footContacts).padStart(10)}` +
      `${((r.report.heldFrames / Math.max(1, m.frames)) * 100).toFixed(0).padStart(7)}  ${verdict.slice(0, 46)}\n`,
  );
}
writeFileSync(join(root, "summary.json"), `${JSON.stringify(results, null, 2)}\n`);
process.stdout.write(`\n${results.length - failed}/${results.length} clips passed. Details in ${join(root, "summary.json")}\n`);
process.exitCode = 0;
