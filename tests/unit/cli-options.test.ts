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

  it("defaults to manual framing so existing runs are unchanged", async () => {
    const command = await parseCliCommand(["character.glb"], {
      validateInput: false,
    });

    expect(command).toMatchObject({
      kind: "run",
      jobs: [
        {
          fit: {
            mode: "manual",
            margin: 0,
            marginUnit: "px",
            scope: "all",
            samples: 12,
          },
        },
      ],
    });
  });

  it("parses the framing options", async () => {
    const command = await parseCliCommand([
      "character.glb",
      "--fit",
      "auto",
      "--margin",
      "4",
      "--marginUnit",
      "px",
      "--fitScope",
      "animation",
      "--fitSamples",
      "24",
      "--atlasSpriteMargin",
      "3",
    ], { validateInput: false });

    expect(command).toMatchObject({
      kind: "run",
      jobs: [
        {
          fit: {
            mode: "auto",
            margin: 4,
            marginUnit: "px",
            scope: "animation",
            samples: 24,
          },
          atlasOptions: { spriteMargin: 3 },
        },
      ],
    });
  });

  it("rejects unusable framing values", async () => {
    const reject = (args: string[]) =>
      expect(
        parseCliCommand(args, { validateInput: false }),
      ).rejects.toBeInstanceOf(CliUsageError);

    await reject(["character.glb", "--fit", "sometimes"]);
    await reject(["character.glb", "--fitScope", "sideways"]);
    await reject(["character.glb", "--marginUnit", "em"]);
    // parseArgs reads a bare "-2" as another flag, so negatives need "=".
    await reject(["character.glb", "--margin=-2"]);
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

  it("parses workflow action flags", async () => {
    const command = await parseCliCommand(
      [
        "character.fbx",
        "--workflow",
        "topdown-4dir",
        "--skipStepLabel",
        "walk_N",
        "--skipStepLabels",
        "walk_S,run_E",
        "--forceAnimationsInPlace",
        "true",
        "--captureNormalMaps",
        "true",
      ],
      { validateInput: false },
    );

    expect(command.kind).toBe("run");
    if (command.kind !== "run") return;

    expect(command.jobs[0]).toMatchObject({
      forceAnimationsInPlace: true,
      captureNormalMaps: true,
      skipStepLabels: ["walk_N", "walk_S", "run_E"],
    });
  });

  it("takes each sequence's frame count from its clip with --frames auto", async () => {
    const auto = await parseCliCommand(["character.glb", "--frames", "auto"], {
      validateInput: false,
    });
    const counted = await parseCliCommand(["character.glb", "--frames", "12"], {
      validateInput: false,
    });

    expect(auto).toMatchObject({
      jobs: [{ matchClipLength: true }],
    });
    expect(counted).toMatchObject({
      jobs: [{ matchClipLength: false, frames: 12 }],
    });
  });

  it("collects clip names from repeated and comma-separated flags", async () => {
    const command = await parseCliCommand(
      [
        "character.glb",
        "--clip",
        "walk",
        "--clip",
        "run",
        "--clips",
        "idle, jump",
      ],
      { validateInput: false },
    );

    expect(command).toMatchObject({
      jobs: [{ includeAnimations: ["walk", "run", "idle", "jump"] }],
    });
  });

  it("reads sheet assignments for everything or for one clip", async () => {
    const command = await parseCliCommand(
      ["character.glb", "--sheet", "hero", "--sheet", "chest=props"],
      { validateInput: false },
    );

    expect(command).toMatchObject({
      jobs: [{ sheets: { all: "hero", byAnimation: { chest: "props" } } }],
    });

    await expect(
      parseCliCommand(["character.glb", "--sheet", "chest="], {
        validateInput: false,
      }),
    ).rejects.toBeInstanceOf(CliUsageError);
  });

  it("reads per-clip capture settings from a config job", async () => {
    const dir = await createTempDir("ssh-cli-capture-settings-");
    tempDirs.push(dir);
    const configPath = join(dir, "jobs.json");
    await writeFile(
      configPath,
      JSON.stringify({
        jobs: [
          {
            id: "per-clip",
            input: "character.glb",
            captureSettings: {
              walk: { fps: 25, frames: 12 },
              idle: { matchClipLength: true },
            },
          },
        ],
      }),
    );

    const command = await parseCliCommand(["--config", configPath], {
      validateInput: false,
    });

    expect(command).toMatchObject({
      jobs: [
        {
          captureSettings: {
            walk: { frameCount: 12, frameIntervalMs: 40 },
            idle: { matchClipLength: true },
          },
        },
      ],
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
