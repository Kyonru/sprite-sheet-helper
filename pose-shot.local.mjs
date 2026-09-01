import puppeteer from "puppeteer";
import { readFileSync } from "node:fs";

const OUT = process.argv[2] ?? "pose.png";
const TAB = process.argv[3] ?? "";
const glb = readFileSync("./example_animation.glb").toString("base64");

const browser = await puppeteer.launch({
  headless: true,
  args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-web-security", "--use-gl=swiftshader", "--enable-unsafe-swiftshader"],
  protocolTimeout: 300000,
});
const page = await browser.newPage();
await page.setViewport({ width: 1600, height: 950, deviceScaleFactor: 1 });
page.on("pageerror", (e) => console.log("[pageerror]", e.message));
page.on("console", (m) => { if (m.type() === "error") console.log("[console]", m.text().slice(0, 200)); });
await page.goto("http://localhost:5199/", { waitUntil: "domcontentloaded", timeout: 90000 });
await new Promise((r) => setTimeout(r, 4000));
await page.waitForFunction(() => "__SSH_BRIDGE__" in window, { timeout: 90000 });

const uuid = await page.evaluate(async (b64) => {
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i += 1) bytes[i] = bin.charCodeAt(i);
  const file = new File([bytes], "example_animation.glb", { type: "model/gltf-binary" });
  const { entities, models, transforms } = window.__SSH_BRIDGE__.stores;
  const id = entities.getState().addEntity("model", "example_animation.glb");
  transforms.getState().initTransform(id, { position: [0, 0.8, 0] });
  await models.getState().loadFromFile(id, file);
  const deadline = Date.now() + 30000;
  while (Date.now() < deadline) {
    const m = models.getState().models[id];
    if (m?.loadState === "loaded") break;
    if (m?.loadState === "error") throw new Error(m.errorMessage ?? "load failed");
    await new Promise((r) => setTimeout(r, 50));
  }
  entities.getState().selectEntity(id);
  return id;
}, glb);
console.log("model", uuid);
await new Promise((r) => setTimeout(r, 2500));

const triggers = await page.$$('[data-slot="menubar-trigger"]');
for (const t of triggers) {
  const hit = await t.evaluate((el) => !!el.querySelector("svg[class*='person-standing']"));
  if (hit) { await t.click(); break; }
}
await new Promise((r) => setTimeout(r, 600));
console.log(await page.evaluate(() => {
  const items = [...document.querySelectorAll('[role="menuitem"]')];
  const item = items.find((i) => /open pose studio/i.test(i.textContent ?? ""));
  if (!item) return items.map((i) => i.textContent);
  item.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true }));
  item.dispatchEvent(new PointerEvent("pointerup", { bubbles: true }));
  item.click();
  return "clicked " + item.textContent;
}));
await new Promise((r) => setTimeout(r, 4000));

if (TAB) {
  await page.evaluate((tab) => {
    const btn = [...document.querySelectorAll('[role="dialog"] button')].find(
      (b) => (b.textContent ?? "").trim().toLowerCase() === tab,
    );
    btn?.click();
  }, TAB);
  await new Promise((r) => setTimeout(r, 900));
}

const dialog = await page.$('[role="dialog"]');
if (!dialog) { console.log("NO DIALOG"); await page.screenshot({ path: OUT }); }
else await dialog.screenshot({ path: OUT });
console.log("saved", OUT);
await browser.close();
