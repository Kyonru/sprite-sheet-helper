import { afterEach, describe, expect, it } from "vitest";
import { join } from "path";
import { writeFile } from "fs/promises";
import {
  CliUsageError,
  parseCliCommand,
} from "../../cli/options";
import { createTempDir, removeTempDir } from "../helpers/temp";

describe("CLI option parsing", () => {
  const tempDirs: string[] = [];

  afterEach(async () => {
    await Promise.all(tempDirs.splice(0).map((dir) => removeTempDir(dir)));
  });

  it("returns help and list commands without requiring an input", async () => {
    await expect(parseCliCommand(["--help"])).resolves.toMatchObject({
      kind: "help",
    });
    await expect(parseCliCommand(["--list-workflows"])).resolves.toMatchObject({
      kind: "list-workflows",
    });
  });

  it("normalizes aliases, booleans, atlas settings, and phi=0", async () => {
    const command = await parseCliCommand(
      [
        "character.glb",
        "--format",
        "love2d",
        "--normalMap",
        "yes",
        "--multiPage",
        "1",
        "--atlasLayout",
        "packed",
        "--atlasPadding",
        "2",
        "--atlasBleed",
        "1",
        "--phi",
        "0",
      ],
      { validateInput: false },
    );

    expect(command.kind).toBe("run");
    if (command.kind !== "run") return;
    expect(command.jobs[0]).toMatchObject({
      format: "love2d-lua",
      normalMap: true,
      cameraAngle: 0,
      atlasOptions: {
        layout: "packed",
        padding: 2,
        extrude: 1,
        allowMultiPage: true,
      },
    });
  });

  it("normalizes summary and strict warning automation flags", async () => {
    const command = await parseCliCommand(
      [
        "character.glb",
        "--writeSummary",
        "reports/sprites.json",
        "--failOnWarnings",
      ],
      { cwd: "/workspace/game", validateInput: false },
    );

    expect(command.kind).toBe("run");
    if (command.kind !== "run") return;
    expect(command.writeSummary).toBe("/workspace/game/reports/sprites.json");
    expect(command.failOnWarnings).toBe(true);
  });

  it("parses target and repeatable direction overrides", async () => {
    const command = await parseCliCommand(
      [
        "character.fbx",
        "--workflow",
        "topdown-4dir",
        "--cameraAngle",
        "45",
        "--directionRotationOffset",
        "15",
        "--target",
        "0,0.8,0",
        "--directionOverride",
        "N:phi=50,theta=5,distance=3,target=0,1,0",
        "--directionOverride",
        "E:theta=100",
      ],
      { validateInput: false },
    );

    expect(command.kind).toBe("run");
    if (command.kind !== "run") return;
    expect(command.jobs[0].target).toEqual([0, 0.8, 0]);
    expect(command.jobs[0].directionRotationOffset).toBe(15);
    expect(command.jobs[0].directionOverrides).toEqual({
      N: { phi: 50, theta: 5, distance: 3, target: [0, 1, 0] },
      E: { theta: 100 },
    });
  });

  it("applies config precedence and job filtering", async () => {
    const tempDir = await createTempDir("ssh-cli-config-");
    tempDirs.push(tempDir);
    const configPath = join(tempDir, "sprites.json");
    await writeFile(
      configPath,
      JSON.stringify({
        defaults: {
          format: "spritesheet",
          frames: 4,
          output: "out-default",
          normalMap: false,
        },
        jobs: [
          {
            id: "hero",
            input: "hero.glb",
            output: "hero-out",
            workflow: "topdown-1dir",
          },
          { id: "enemy", input: "enemy.glb" },
        ],
      }),
    );

    const command = await parseCliCommand(
      [
        "--config",
        configPath,
        "--job",
        "hero",
        "--frames",
        "2",
        "--normalMap",
        "true",
        "--dryRun",
      ],
      { validateInput: false },
    );

    expect(command.kind).toBe("run");
    if (command.kind !== "run") return;
    expect(command.dryRun).toBe(true);
    expect(command.jobs).toHaveLength(1);
    expect(command.jobs[0]).toMatchObject({
      id: "hero",
      frames: 2,
      normalMap: true,
      workflow: "topdown-1dir",
      output: join(tempDir, "hero-out"),
      input: join(tempDir, "hero.glb"),
    });
  });

  it("rejects invalid values before runtime", async () => {
    await expect(
      parseCliCommand(["character.glb", "--frames", "0"], {
        validateInput: false,
      }),
    ).rejects.toThrow(CliUsageError);

    await expect(
      parseCliCommand(["character.glb", "--normalMap", "maybe"], {
        validateInput: false,
      }),
    ).rejects.toThrow("normalMap must be true or false");
  });
});
