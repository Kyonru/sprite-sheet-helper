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

  const uuid = await page.evaluate(
    async (b64: string, name: string) => {
      console.log(`[sprite-sheet-helper] Injecting model: ${name}`);
      const bridge = window.__SSH_BRIDGE__;

      const bytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
      const file = new File([bytes], name);

      const uuid = bridge.stores.entities.getState().addEntity("model", name);
      bridge.stores.transforms
        .getState()
        .initTransform(uuid, { position: [0, 0.8, 0] });

      // const label = name ?? file.name ?? "Model";
      // const uuid = addEntity("model", label);

      // const transform: Partial<Transform> = {
      //   position: [0, 0.8, 0],
      // };

      // initTransform(uuid, transform);
      // await loadModel(uuid, file);

      // if (select) {
      //   selectEntity(uuid);
      // }

      // const entity = structuredClone(
      //   useEntitiesStore.getState().entities[uuid],
      // );

      try {
        await bridge.stores.models.getState().loadFromFile(uuid, file);
        bridge.stores.entities.getState().selectEntity(uuid);
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

  // Wait for the React component to emit MODEL_READY event
  await page.evaluate((id: string) => {
    return new Promise<void>((resolve) => {
      const handler = (payload: { uuid: string }) => {
        if (payload.uuid === id) {
          window.__SSH_BRIDGE__.PubSub.off(
            window.__SSH_BRIDGE__.PubSub.EVENT_TYPE.MODEL_READY,
            handler,
          );
          resolve();
        }
      };
      window.__SSH_BRIDGE__.PubSub.once(
        window.__SSH_BRIDGE__.PubSub.EVENT_TYPE.MODEL_READY,
        handler,
      );
    });
  }, uuid);

  console.log(`[sprite-sheet-helper] Model injected`);

  // Extra frame to let the scene render with the model visible
  await page.evaluate(
    () => new Promise<void>((r) => requestAnimationFrame(() => r())),
  );

  return uuid;
}
