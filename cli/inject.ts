import { readFile } from "fs/promises";
import { basename } from "path";
import type { Page } from "puppeteer";

// Self-contained formats work reliably: GLB, binary FBX, embedded GLTF.
// Multi-file formats (GLTF + external .bin, OBJ + .mtl) will load without their
// companion files — geometry comes through but external textures/materials won't.
export async function injectModel(
  page: Page,
  modelPath: string,
): Promise<string> {
  const bytes = await readFile(modelPath);
  const base64 = bytes.toString("base64");
  const fileName = basename(modelPath);
  console.log(`[sprite-sheet-helper] File name: ${fileName}`);

  const uuid = await page.evaluate(
    async (b64: string, name: string) => {
      console.log(`[sprite-sheet-helper] Injecting model: ${name}`);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const bridge = (window as any).__SSH_BRIDGE__;

      const bytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
      const file = new File([bytes], name);

      const uuid = bridge.stores.entities.getState().addEntity("model", name);
      bridge.stores.transforms
        .getState()
        .initTransform(uuid, { position: [0, 0.8, 0] });
      bridge.stores.entities.getState().selectEntity(uuid);

      try {
        await bridge.stores.models.getState().loadFromFile(uuid, file);
      } catch (err) {
        throw new Error(
          `loadFromFile failed: ${(err as Error)?.message ?? err}`,
        );
      }

      return uuid as string;
    },
    base64,
    fileName,
  );

  console.log(`[sprite-sheet-helper] uuid: ${uuid}`);

  // Wait for the React component to finish parsing (mixerRef is set after parseModel)
  await page.waitForFunction(
    (id: string) => {
      const { mixerRef } =
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (window as any).__SSH_BRIDGE__.stores.models.getState();
      return Object.prototype.hasOwnProperty.call(mixerRef, id);
    },
    { timeout: 15000 },
    uuid,
  );

  console.log(`[sprite-sheet-helper] Model injected`);

  // Extra frame to let the scene render with the model visible
  await page.evaluate(
    () => new Promise<void>((r) => requestAnimationFrame(() => r())),
  );

  return uuid;
}
