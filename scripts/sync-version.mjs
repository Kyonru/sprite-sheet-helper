#!/usr/bin/env node

import { readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { getAppVersions } from "./check-version-sync.mjs";

const modulePath = import.meta.url.startsWith("file:")
  ? fileURLToPath(import.meta.url)
  : undefined;
const defaultRoot = modulePath
  ? resolve(dirname(modulePath), "..")
  : process.cwd();
const TAURI_PACKAGE_VERSION_PATH = "../package.json";
const VERSION_PATTERN =
  /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?(?:\+[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?$/;

function readText(rootDir, path) {
  return readFileSync(resolve(rootDir, path), "utf8");
}

function readJson(rootDir, path) {
  return JSON.parse(readText(rootDir, path));
}

function formatJson(value) {
  return `${JSON.stringify(value, null, 2)}\n`;
}

function replaceSectionVersion(source, sectionName, version, path) {
  const header = `[${sectionName}]`;
  const sectionStart = source.indexOf(header);
  if (sectionStart < 0) throw new Error(`${path} is missing ${header}`);

  const contentStart = sectionStart + header.length;
  const followingSource = source.slice(contentStart);
  const nextSectionOffset = followingSource.search(/^\[/m);
  const sectionEnd =
    nextSectionOffset < 0 ? source.length : contentStart + nextSectionOffset;
  const section = source.slice(sectionStart, sectionEnd);
  const versionLine = /^(\s*version\s*=\s*["'])[^"']+(["']\s*)$/gm;
  const matches = [...section.matchAll(versionLine)];

  if (matches.length !== 1) {
    throw new Error(
      `${path} must contain exactly one version in ${header}; found ${matches.length}`,
    );
  }

  const updatedSection = section.replace(
    versionLine,
    (_match, before, after) => `${before}${version}${after}`,
  );
  return source.slice(0, sectionStart) + updatedSection + source.slice(sectionEnd);
}

function replaceCargoPackageVersion(source, packageName, version, path) {
  const headers = [...source.matchAll(/^\[\[package\]\]\r?$/gm)];
  const matchingBlocks = [];

  for (let index = 0; index < headers.length; index += 1) {
    const start = headers[index].index;
    const end = headers[index + 1]?.index ?? source.length;
    const block = source.slice(start, end);
    if (new RegExp(`^name = ["']${packageName}["']$`, "m").test(block)) {
      matchingBlocks.push({ start, end, block });
    }
  }

  if (matchingBlocks.length !== 1) {
    throw new Error(
      `${path} must contain exactly one ${packageName} package; found ${matchingBlocks.length}`,
    );
  }

  const [{ start, end, block }] = matchingBlocks;
  const versionLine = /^(\s*version\s*=\s*["'])[^"']+(["']\s*)$/gm;
  const matches = [...block.matchAll(versionLine)];
  if (matches.length !== 1) {
    throw new Error(
      `${path} package ${packageName} must contain exactly one version; found ${matches.length}`,
    );
  }

  const updatedBlock = block.replace(
    versionLine,
    (_match, before, after) => `${before}${version}${after}`,
  );
  return source.slice(0, start) + updatedBlock + source.slice(end);
}

function replaceAppStreamVersion(source, version, path) {
  const versionAttribute = /(<release\b[^>]*\bversion=["'])[^"']+(["'])/;
  if (!versionAttribute.test(source)) {
    throw new Error(`${path} is missing a release version`);
  }
  return source.replace(
    versionAttribute,
    (_match, before, after) => `${before}${version}${after}`,
  );
}

function assertManagedVersions(version, rootDir) {
  const versions = getAppVersions(rootDir);
  const managedSources = Object.entries(versions).filter(
    ([source]) => source !== "CHANGELOG.md latest entry",
  );
  const mismatches = managedSources.filter(([, value]) => value !== version);

  if (mismatches.length > 0) {
    const details = managedSources
      .map(([source, value]) => `  ${source}: ${value ?? "missing"}`)
      .join("\n");
    throw new Error(`Managed app versions are not synchronized:\n${details}`);
  }
}

export function syncAppVersions(rootDir = defaultRoot) {
  const packageJson = readJson(rootDir, "package.json");
  const version = packageJson.version;
  if (typeof version !== "string" || !VERSION_PATTERN.test(version)) {
    throw new Error(`package.json has an invalid semantic version: ${version}`);
  }

  const packageLock = readJson(rootDir, "package-lock.json");
  if (!packageLock.packages?.[""]) {
    throw new Error('package-lock.json is missing the root packages[""] entry');
  }
  packageLock.version = version;
  packageLock.packages[""].version = version;

  const cargoManifest = replaceSectionVersion(
    readText(rootDir, "src-tauri/Cargo.toml"),
    "package",
    version,
    "src-tauri/Cargo.toml",
  );
  const cargoLock = replaceCargoPackageVersion(
    readText(rootDir, "src-tauri/Cargo.lock"),
    "app",
    version,
    "src-tauri/Cargo.lock",
  );

  const tauriConfigSource = readText(rootDir, "src-tauri/tauri.conf.json");
  const tauriConfig = JSON.parse(tauriConfigSource);
  const tauriConfigOutput =
    tauriConfig.version === TAURI_PACKAGE_VERSION_PATH
      ? tauriConfigSource
      : formatJson({ ...tauriConfig, version: TAURI_PACKAGE_VERSION_PATH });
  const appStreamPath =
    "src-tauri/com.kyonru.spritesheethelper.metainfo.xml";
  const appStreamMetadata = replaceAppStreamVersion(
    readText(rootDir, appStreamPath),
    version,
    appStreamPath,
  );

  const outputs = [
    ["package-lock.json", formatJson(packageLock)],
    ["src-tauri/Cargo.toml", cargoManifest],
    ["src-tauri/Cargo.lock", cargoLock],
    ["src-tauri/tauri.conf.json", tauriConfigOutput],
    [appStreamPath, appStreamMetadata],
  ];
  const changed = outputs
    .filter(([path, content]) => readText(rootDir, path) !== content)
    .map(([path]) => path);

  for (const [path, content] of outputs) {
    if (changed.includes(path)) {
      writeFileSync(resolve(rootDir, path), content);
    }
  }

  assertManagedVersions(version, rootDir);
  return { version, changed };
}

const isMain =
  modulePath && process.argv[1] && modulePath === resolve(process.argv[1]);
if (isMain) {
  try {
    const { version, changed } = syncAppVersions();
    if (changed.length === 0) {
      console.log(`Managed app versions are already synchronized at ${version}`);
    } else {
      console.log(`Synchronized app version ${version} from package.json:`);
      for (const path of changed) console.log(`  ${path}`);
    }

    const changelogVersion = getAppVersions()["CHANGELOG.md latest entry"];
    if (changelogVersion !== version) {
      console.warn(
        `CHANGELOG.md remains at ${changelogVersion ?? "missing"}; add release notes for ${version} before releasing.`,
      );
    }
  } catch (error) {
    console.error(error.message);
    process.exit(1);
  }
}
