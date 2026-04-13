import * as THREE from "three";
import { useCallback, useEffect, useRef } from "react";
import { useThree } from "@react-three/fiber";
import JSZip from "jszip";
import { scheduleInterval } from "../../utils/time";
import { EventType, PubSub } from "../../lib/events";
import {
  createGif,
  createSpriteSheet,
  createSpritesheetJSON,
  downloadFile,
} from "../../utils/assets";
import { useSceneStore } from "@/components/panels/scene/store";
import { useSettingsStore } from "@/store/next/settings";
import { useImagesStore, type ExportRow } from "@/store/next/images";
import type { ExportFormat } from "@/types/file";
import {
  createAnim8Lua,
  createLuaExample,
  createVanillaLua,
} from "@/utils/exports/lua";
import { createTurboExample, createTurboRust } from "@/utils/exports/rust";
import { createRaylibExample, createRaylibH } from "@/utils/exports/c";
import { createPygameExample, createPygamePy } from "@/utils/exports/python";
import { createGodotExample, createGodotGD } from "@/utils/exports/godot";
import {
  createPhaserAtlasJSON,
  createPhaserExample,
  createPhaserTS,
} from "@/utils/exports/ts";
import { createUnityCS, createUnityExample } from "@/utils/exports/cs";

async function buildZip(
  populate: (zip: JSZip) => Promise<void> | void,
): Promise<string> {
  const zip = new JSZip();
  await populate(zip);
  return zip.generateAsync({ type: "base64" });
}

async function buildSpritesheetAssets(exportedImages: ExportRow[]) {
  const dataUrl = await createSpriteSheet(exportedImages);
  const json = createSpritesheetJSON(exportedImages);
  const base64PNG = dataUrl.split("base64,")[1];
  return { json, base64PNG };
}

export const useExport = () => {
  const images = useRef<{ name: string; dataURL: string }[]>([]);
  const intervalRef = useRef<NodeJS.Timeout>(null);

  const intervals = useImagesStore((state) => state.intervals);
  const iterations = useImagesStore((state) => state.iterations);
  const frameDelay = useImagesStore((state) => state.fps);

  const exportFormat = useSettingsStore((state) => state.mode);

  const { exportHeight, exportWidth } = useSettingsStore();
  const addImages = useImagesStore((state) => state.addImagesRow);
  const addImageToRow = useImagesStore((state) => state.addImageToRow);
  const createEmptyRow = useImagesStore((state) => state.createEmptyRow);
  const selectedRow = useImagesStore((state) => state.selectedRow);
  const exportedImages = useImagesStore((state) => state.images);

  const composer = useSceneStore((state) => state.composer);
  const { gl } = useThree();

  const captureScreenshotData = useCallback(() => {
    if (!gl || !composer) return;

    const originalSize = gl.getSize(new THREE.Vector2());
    const originalPixelRatio = gl.getPixelRatio();
    const originalTarget = gl.getRenderTarget();

    const target = new THREE.WebGLRenderTarget(exportWidth, exportHeight, {
      minFilter: THREE.NearestFilter,
      magFilter: THREE.NearestFilter,
      format: THREE.RGBAFormat,
      type: THREE.UnsignedByteType,
    });

    if (exportWidth && exportHeight) {
      gl.setSize(exportWidth, exportHeight, true);
    }
    gl.setRenderTarget(target);

    gl.setPixelRatio(1);
    composer.render();

    const base64Data = gl.domElement.toDataURL("image/png").split("base64,")[1];
    images.current.push({
      name: `image${images.current.length}.png`,
      dataURL: base64Data,
    });

    gl.setPixelRatio(originalPixelRatio);
    gl.setSize(originalSize.x, originalSize.y);
    gl.setRenderTarget(originalTarget);

    composer.render();
  }, [gl, exportWidth, composer, exportHeight]);

  const exportSpriteSheet = useCallback(
    async (format?: ExportFormat) => {
      const exportType = format ?? exportFormat;
      try {
        let zipData: string;

        switch (exportType) {
          case "zip": {
            zipData = await buildZip((zip) => {
              for (const row of exportedImages) {
                const folder = zip.folder(row.label)!;
                row.images.forEach((img, j) => {
                  folder.file(`${row.uuid}_${j}.png`, img, { base64: true });
                });
              }
            });
            downloadFile(
              "data:application/zip;base64," + zipData,
              "images.zip",
            );
            break;
          }

          case "gif": {
            zipData = await buildZip(async (zip) => {
              for (const row of exportedImages) {
                const gifUrl = await createGif(
                  row.images,
                  row.frameWidth,
                  row.frameHeight,
                  frameDelay,
                );
                const content = await (await fetch(gifUrl)).arrayBuffer();
                zip.file(`${row.label}.gif`, content);
              }
            });
            downloadFile("data:application/zip;base64," + zipData, "gif.zip");
            break;
          }

          case "spritesheet": {
            const { json, base64PNG } =
              await buildSpritesheetAssets(exportedImages);
            zipData = await buildZip((zip) => {
              zip.file("spritesheet.png", base64PNG, { base64: true });
              zip.file("spritesheet.json", JSON.stringify(json, null, 2));
            });
            downloadFile(
              "data:application/zip;base64," + zipData,
              "spritesheet.zip",
            );
            break;
          }

          case "lua": {
            const { json, base64PNG } =
              await buildSpritesheetAssets(exportedImages);
            zipData = await buildZip((zip) => {
              zip.file("spritesheet.png", base64PNG, { base64: true });
              zip.file("spritesheet.json", JSON.stringify(json, null, 2));
              zip.file(
                "spritesheet.lua",
                createVanillaLua(json, "spritesheet.png"),
              );
              zip.file(
                "spritesheet_anim8.lua",
                createAnim8Lua(json, "spritesheet.png"),
              );
              zip.file("main.lua", createLuaExample(json));
            });
            downloadFile(
              "data:application/zip;base64," + zipData,
              "animation.zip",
            );
            break;
          }

          case "turbo-rust": {
            const { json, base64PNG } =
              await buildSpritesheetAssets(exportedImages);
            zipData = await buildZip((zip) => {
              zip.file("spritesheet.png", base64PNG, { base64: true });
              zip.file("spritesheet.json", JSON.stringify(json, null, 2));
              zip.file(
                "spritesheet_turbo.rs",
                createTurboRust(json, "spritesheet.png"),
              );
              zip.file("example.rs", createTurboExample(json));
            });
            downloadFile(
              "data:application/zip;base64," + zipData,
              "animation.zip",
            );
            break;
          }

          case "phaser": {
            const { json, base64PNG } =
              await buildSpritesheetAssets(exportedImages);
            zipData = await buildZip((zip) => {
              zip.file("spritesheet.png", base64PNG, { base64: true });
              zip.file("spritesheet_atlas.json", createPhaserAtlasJSON(json));
              zip.file("spritesheet_phaser.ts", createPhaserTS(json));
              zip.file("example.ts", createPhaserExample(json));
            });
            downloadFile(
              "data:application/zip;base64," + zipData,
              "phaser.zip",
            );
            break;
          }

          case "godot": {
            const { json, base64PNG } =
              await buildSpritesheetAssets(exportedImages);
            zipData = await buildZip((zip) => {
              zip.file("spritesheet.png", base64PNG, { base64: true });
              zip.file("SpriteSheetHelper.gd", createGodotGD(json));
              zip.file("ExamplePlayer.gd", createGodotExample(json));
            });
            downloadFile("data:application/zip;base64," + zipData, "godot.zip");
            break;
          }

          case "pygame": {
            const { json, base64PNG } =
              await buildSpritesheetAssets(exportedImages);
            zipData = await buildZip((zip) => {
              zip.file("spritesheet.png", base64PNG, { base64: true });
              zip.file("spritesheet.py", createPygamePy(json));
              zip.file("main.py", createPygameExample(json));
            });
            downloadFile(
              "data:application/zip;base64," + zipData,
              "pygame.zip",
            );
            break;
          }

          case "raylib": {
            const { json, base64PNG } =
              await buildSpritesheetAssets(exportedImages);
            zipData = await buildZip((zip) => {
              zip.file("spritesheet.png", base64PNG, { base64: true });
              zip.file("spritesheet.h", createRaylibH(json));
              zip.file("main.c", createRaylibExample(json));
            });
            downloadFile(
              "data:application/zip;base64," + zipData,
              "raylib.zip",
            );
            break;
          }

          case "unity": {
            const { json, base64PNG } =
              await buildSpritesheetAssets(exportedImages);
            zipData = await buildZip((zip) => {
              zip.file("spritesheet.png", base64PNG, { base64: true });
              zip.file("SpriteSheetAnimator.cs", createUnityCS(json));
              zip.file("ExamplePlayer.cs", createUnityExample(json));
            });
            downloadFile("data:application/zip;base64," + zipData, "unity.zip");
            break;
          }
        }
      } catch (err) {
        console.error(err);
      } finally {
        PubSub.emit(EventType.STOP_EXPORT);
      }
    },
    [exportedImages, exportFormat, frameDelay],
  );

  const takeScreenshotSequence = useCallback(() => {
    if (!gl) return;
    if (intervalRef.current) clearInterval(intervalRef.current);

    images.current = [];

    intervalRef.current = scheduleInterval(
      captureScreenshotData,
      intervals,
      iterations,
      async () => {
        PubSub.emit(EventType.STOP_ASSETS_CREATION);

        const count = useImagesStore.getState().images.length;
        addImages(
          Date.now().toString(),
          `animation_${count + 1}`,
          images.current.map((img) => img.dataURL),
          exportWidth,
          exportHeight,
          Math.round(1000 / intervals),
        );
      },
    );
  }, [
    gl,
    intervals,
    iterations,
    addImages,
    captureScreenshotData,
    exportWidth,
    exportHeight,
  ]);

  const addScreenshot = useCallback(() => {
    if (!gl) return;

    images.current = [];

    captureScreenshotData();

    const row = useImagesStore.getState().images[selectedRow || 0];
    const width = row?.frameWidth || exportWidth;
    const height = row?.frameHeight || exportHeight;

    addImageToRow(
      selectedRow || 0,
      images.current[0].dataURL,
      width,
      height,
      Math.round(1000 / intervals),
    );
    images.current = [];
  }, [
    gl,
    intervals,
    selectedRow,
    exportWidth,
    exportHeight,
    addImageToRow,
    captureScreenshotData,
  ]);

  useEffect(() => {
    PubSub.on(EventType.TAKE_SINGLE_SCREENSHOT, addScreenshot);

    return () => {
      PubSub.off(EventType.TAKE_SINGLE_SCREENSHOT, addScreenshot);
    };
  }, [addScreenshot]);

  const onNewRow = useCallback(() => {
    createEmptyRow(exportWidth, exportHeight, Math.round(1000 / intervals));
  }, [createEmptyRow, exportWidth, exportHeight, intervals]);

  useEffect(() => {
    PubSub.on(EventType.NEW_SEQUENCE, onNewRow);

    return () => {
      PubSub.off(EventType.NEW_SEQUENCE, onNewRow);
    };
  }, [onNewRow]);

  useEffect(() => {
    PubSub.on(EventType.START_ASSETS_CREATION, takeScreenshotSequence);
    return () => {
      PubSub.off(EventType.START_ASSETS_CREATION, takeScreenshotSequence);
    };
  }, [takeScreenshotSequence]);

  useEffect(() => {
    PubSub.on(EventType.START_EXPORT, exportSpriteSheet);
    return () => {
      PubSub.off(EventType.START_EXPORT, exportSpriteSheet);
    };
  }, [exportSpriteSheet]);
};
