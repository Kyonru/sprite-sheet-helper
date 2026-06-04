import { readFile } from "fs/promises";
import { basename } from "path";
import type { Page } from "puppeteer";
import { waitForNextAnimationFrame } from "./page-utils.js";

// Self-contained formats work reliably: GLB, binary FBX, embedded GLTF.
// Multi-file formats (GLTF + external .bin, OBJ + .mtl) will load without their
// companion files — geometry comes through but external textures/materials won't.
export async function injectModel(
  page: Page,
  modelPath: string,
  options: { silent?: boolean } = {},
): Promise<string> {
  const bytes = await readFile(modelPath);
  const base64 = bytes.toString("base64");
  const fileName = basename(modelPath);

  const uuid = await page.evaluate(
    (b64: string, name: string) => {
      console.log(`[sprite-sheet-helper] Injecting model: ${name}`);
      const bridge = window.__SSH_BRIDGE__;

      const bytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
      const file = new File([bytes], name);

      const uuid = bridge.stores.entities.getState().addEntity("model", name);
      bridge.stores.transforms
        .getState()
        .initTransform(uuid, { position: [0, 0.8, 0] });

      void bridge.stores.models
        .getState()
        .loadFromFile(uuid, file)
        .then(() => {
          bridge.stores.entities.getState().selectEntity(uuid);
        })
        .catch((err: unknown) => {
          bridge.stores.models
            .getState()
            .setLoadState(
              uuid,
              "error",
              `loadFromFile failed: ${(err as Error)?.message ?? err}`,
            );
        });

      return uuid as string;
    },
    base64,
    fileName,
  );

  await page.waitForFunction(
    (id: string) => {
      const models = window.__SSH_BRIDGE__.stores.models.getState();
      if (models.models[id]?.loadState === "error") return true;
      return (
        models.models[id]?.loadState === "loaded" &&
        Object.prototype.hasOwnProperty.call(models.mixerRef, id) &&
        Object.prototype.hasOwnProperty.call(models.clips, id)
      );
    },
    { timeout: 120000 },
    uuid,
  );

  const loadError = await page.evaluate((id: string) => {
    const model = window.__SSH_BRIDGE__.stores.models.getState().models[id];
    return model?.loadState === "error"
      ? (model.errorMessage ?? "Model failed to load")
      : null;
  }, uuid);
  if (loadError) throw new Error(loadError);

  if (!options.silent) {
    console.log("[sprite-sheet-helper] Model injected");
  }

  // Extra frame to let the scene render with the model visible.
  await waitForNextAnimationFrame(page);

  return uuid;
}
