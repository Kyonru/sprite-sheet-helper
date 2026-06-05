import { appendFileSync, mkdirSync, readdirSync, writeFileSync } from "node:fs";
import { basename, extname, join, relative, sep } from "node:path";

const root = process.cwd();
const modelsDir = join(root, "models");
const configPath = join(root, "sprite-sheet-helper.generated.json");
const supportedExtensions = new Set([".fbx", ".glb", ".gltf", ".obj"]);

function envString(name, fallback) {
  const value = process.env[name];
  return value === undefined || value === "" ? fallback : value;
}

function envNumber(name, fallback) {
  const value = envString(name, String(fallback));
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    throw new Error(`${name} must be a number. Received: ${value}`);
  }
  return parsed;
}

function envInteger(name, fallback) {
  const value = envNumber(name, fallback);
  if (!Number.isInteger(value)) {
    throw new Error(`${name} must be an integer. Received: ${value}`);
  }
  return value;
}

function envBoolean(name, fallback) {
  const value = envString(name, fallback ? "true" : "false").toLowerCase();
  if (["true", "1", "yes", "on"].includes(value)) return true;
  if (["false", "0", "no", "off"].includes(value)) return false;
  throw new Error(`${name} must be true or false. Received: ${value}`);
}

function toRepoPath(path) {
  return relative(root, path).split(sep).join("/");
}

function toModelPath(path) {
  return relative(modelsDir, path).split(sep).join("/");
}

function slugify(path, usedIds) {
  const withoutExtension = toModelPath(path).replace(/\.[^.]+$/, "");
  const base =
    withoutExtension
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") || basename(path, extname(path)).toLowerCase();

  let id = base;
  let suffix = 2;
  while (usedIds.has(id)) {
    id = `${base}-${suffix}`;
    suffix += 1;
  }
  usedIds.add(id);
  return id;
}

function walkModels(dir) {
  let entries;
  try {
    entries = readdirSync(dir, { withFileTypes: true });
  } catch (error) {
    if (error && typeof error === "object" && "code" in error && error.code === "ENOENT") {
      return [];
    }
    throw error;
  }

  const files = [];
  for (const entry of entries.sort((a, b) => a.name.localeCompare(b.name))) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...walkModels(path));
      continue;
    }
    if (!entry.isFile()) continue;
    if (supportedExtensions.has(extname(entry.name).toLowerCase())) {
      files.push(path);
    }
  }
  return files;
}

const modelFiles = walkModels(modelsDir);
const usedIds = new Set();
const jobs = modelFiles.map((path) => {
  const id = slugify(path, usedIds);
  return {
    id,
    input: toRepoPath(path),
    output: `dist/sprites/${id}`,
  };
});

const config = {
  defaults: {
    format: envString("SPRITE_FORMAT", "spritesheet"),
    workflow: envString("SPRITE_WORKFLOW", "topdown-4dir"),
    frames: envInteger("SPRITE_FRAMES", 4),
    fps: envInteger("SPRITE_FPS", 10),
    width: envInteger("SPRITE_WIDTH", 64),
    height: envInteger("SPRITE_HEIGHT", 64),
    normalMap: envBoolean("SPRITE_NORMAL_MAP", true),
    atlasLayout: envString("SPRITE_ATLAS_LAYOUT", "rows"),
    atlasPadding: envInteger("SPRITE_ATLAS_PADDING", 0),
    atlasBleed: envInteger("SPRITE_ATLAS_BLEED", 0),
    atlasScale: envNumber("SPRITE_ATLAS_SCALE", 1),
    maxAtlasSize: envInteger("SPRITE_MAX_ATLAS_SIZE", 2048),
    multiPage: envBoolean("SPRITE_MULTI_PAGE", false),
  },
  jobs,
};

mkdirSync("dist", { recursive: true });
writeFileSync(configPath, `${JSON.stringify(config, null, 2)}\n`);

if (process.env.GITHUB_OUTPUT) {
  appendFileSync(process.env.GITHUB_OUTPUT, `has-jobs=${jobs.length > 0}\n`);
  appendFileSync(process.env.GITHUB_OUTPUT, `job-count=${jobs.length}\n`);
}

console.log(`Found ${jobs.length} model${jobs.length === 1 ? "" : "s"}.`);
for (const job of jobs) {
  console.log(`- ${job.id}: ${job.input} -> ${job.output}`);
}
