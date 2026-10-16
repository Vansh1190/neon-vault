import { chromium } from "playwright";

const url = process.env.NV_URL ?? "http://127.0.0.1:4173/";
const out = process.env.NV_OUT ?? "docs/capture.png";

const browser = await chromium.launch({ args: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader"] });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
const errors = [];
page.on("console", (m) => {
  if (m.type() === "error") errors.push(m.text());
});
page.on("pageerror", (e) => errors.push(String(e)));

await page.goto(url, { waitUntil: "networkidle" });
await page.waitForTimeout(5000);
await page.screenshot({ path: out });
const hud = await page.textContent("#stats");
const seed = await page.textContent("#seed");
const canvas = await page.evaluate(() => {
  const c = document.getElementById("viewport");
  const gl = c?.getContext("webgl2");
  const debug = gl?.getExtension("WEBGL_debug_renderer_info");
  return {
    width: c?.width,
    height: c?.height,
    renderer: debug ? gl.getParameter(debug.UNMASKED_RENDERER_WEBGL) : "unknown",
  };
});
await browser.close();

console.log(JSON.stringify({ url, out, hud, seed, canvas, errors }, null, 2));
if (errors.length > 0) process.exitCode = 1;
