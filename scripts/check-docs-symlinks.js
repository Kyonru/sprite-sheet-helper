#!/usr/bin/env node
import { lstat, readlink, readdir } from "node:fs/promises";
import { basename, join, relative } from "node:path";

const root = process.cwd();
const sourceDir = join(root, "src", "docs");
const docsDir = join(root, "docs");

const sourceFiles = (await readdir(sourceDir))
  .filter((file) => file.endsWith(".md"))
  .sort();

const failures = [];

for (const file of sourceFiles) {
  const docsPath = join(docsDir, file);
  const expectedTarget = `../src/docs/${file}`;

  try {
    const stat = await lstat(docsPath);
    if (!stat.isSymbolicLink()) {
      failures.push(`${relative(root, docsPath)} exists but is not a symlink.`);
      continue;
    }

    const actualTarget = await readlink(docsPath);
    if (actualTarget !== expectedTarget) {
      failures.push(
        `${relative(root, docsPath)} points to ${actualTarget}, expected ${expectedTarget}.`,
      );
    }
  } catch {
    failures.push(`${relative(root, docsPath)} is missing.`);
  }
}

for (const entry of await readdir(docsDir)) {
  if (!entry.endsWith(".md") || entry === "index.md") continue;
  if (!sourceFiles.includes(basename(entry))) {
    failures.push(`${relative(root, join(docsDir, entry))} has no matching src/docs page.`);
  }
}

if (failures.length > 0) {
  console.error("[docs] Symlink check failed:");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log(`[docs] ${sourceFiles.length} src/docs pages are linked into docs/.`);
