import { afterEach, describe, expect, it } from "vitest";
import { access, readFile, writeFile } from "fs/promises";
import { join, resolve } from "path";
import { runCli } from "../helpers/cli";
import { createTempDir, removeTempDir } from "../helpers/temp";

const fixture = resolve("example.fbx");

async function expectFile(path: string) {
  await expect(access(path)).resolves.toBeUndefined();
}

async function expectNoFile(path: string) {
  await expect(access(path)).rejects.toThrow();
}

describe("CLI exports", () => {
  const tempDirs: string[] = [];

  afterEach(async () => {
    await Promise.all(tempDirs.splice(0).map((dir) => removeTempDir(dir)));
  });

  it("prints help and workflow lists", async () => {
    const help = await runCli(["--help"]);
    expect(help.code).toBe(0);
    expect(help.stdout).toContain("Usage: sprite-sheet-helper");

    const workflows = await runCli(["--list-workflows"]);
    expect(workflows.code).toBe(0);
    expect(workflows.stdout).toContain("topdown-1dir");
  });

  it("exports a default spritesheet without a normal atlas", async () => {
    const output = await createTempDir("ssh-cli-default-");
    tempDirs.push(output);

    const result = await runCli([
      fixture,
      "--format",
      "spritesheet",
      "--frames",
      "1",
      "--width",
      "32",
      "--height",
      "32",
      "--output",
      output,
      "--port",
      "4181",
    ]);

    expect(result.code).toBe(0);
    expect(result.stderr).toBe("");
    await expectFile(join(output, "spritesheet.png"));
    await expectFile(join(output, "spritesheet.json"));
    await expectNoFile(join(output, "spritesheet_normal.png"));
  });

  it("exports a normal atlas when normalMap is enabled", async () => {
    const output = await createTempDir("ssh-cli-normal-");
    tempDirs.push(output);

    const result = await runCli([
      fixture,
      "--format",
      "spritesheet",
      "--normalMap",
      "true",
      "--frames",
      "1",
      "--width",
      "32",
      "--height",
      "32",
      "--output",
      output,
      "--port",
      "4182",
    ]);

    expect(result.code).toBe(0);
    expect(result.stderr).toBe("");
    await expectFile(join(output, "spritesheet.png"));
    await expectFile(join(output, "spritesheet_normal.png"));

    const json = JSON.parse(
      await readFile(join(output, "spritesheet.json"), "utf8"),
    ) as { meta: { normalImage?: string } };
    expect(json.meta.normalImage).toBe("spritesheet_normal.png");
  });

  it("waits for a workflow before exporting", async () => {
    const output = await createTempDir("ssh-cli-workflow-");
    tempDirs.push(output);

    const result = await runCli([
      fixture,
      "--workflow",
      "topdown-1dir",
      "--format",
      "spritesheet",
      "--frames",
      "1",
      "--width",
      "32",
      "--height",
      "32",
      "--output",
      output,
      "--port",
      "4183",
    ]);

    expect(result.code).toBe(0);
    expect(result.stderr).toBe("");
    await expectFile(join(output, "spritesheet.png"));
    await expectFile(join(output, "spritesheet.json"));
    expect(result.stdout).toContain("Done");
  });

  it("runs a config job with workflow camera flags and json output", async () => {
    const tempDir = await createTempDir("ssh-cli-config-e2e-");
    tempDirs.push(tempDir);
    const output = join(tempDir, "out");
    const configPath = join(tempDir, "sprites.json");
    await writeFile(
      configPath,
      JSON.stringify({
        jobs: [
          {
            id: "hero",
            input: fixture,
            output,
            workflow: "topdown-1dir",
            format: "spritesheet",
            frames: 1,
            width: 32,
            height: 32,
          },
        ],
      }),
    );

    const result = await runCli([
      "--config",
      configPath,
      "--job",
      "hero",
      "--json",
      "--cameraAngle",
      "0",
      "--directionRotationOffset",
      "15",
      "--target",
      "0,0.8,0",
      "--port",
      "4184",
    ]);

    expect(result.code).toBe(0);
    expect(result.stderr).toBe("");
    const summary = JSON.parse(result.stdout) as {
      status: string;
      jobs: { id: string; files: string[] }[];
    };
    expect(summary.status).toBe("ok");
    expect(summary.jobs[0].id).toBe("hero");
    expect(summary.jobs[0].files).toContain(join(output, "spritesheet.png"));
    await expectFile(join(output, "spritesheet.png"));
    await expectFile(join(output, "spritesheet.json"));
  });
});
