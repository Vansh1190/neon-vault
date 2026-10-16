import { chromium } from "playwright";

const url = process.env.NV_URL ?? "http://127.0.0.1:4173/";
const out = process.env.NV_OUT ?? "docs/capture.png";
const at = Number(process.env.NV_AT ?? 6000);

const browser = await chromium.launch({
  args: ["--enable-unsafe-swiftshader", "--use-gl=angle", "--use-angle=swiftshader"],
});
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
const errors = [];
page.on("console", (m) => {
  if (m.type() === "error") errors.push(m.text());
});
page.on("pageerror", (e) => errors.push(String(e)));

await page.goto(url, { waitUntil: "networkidle" });
await page.waitForTimeout(1200);
await page.keyboard.down("w");
await page.waitForTimeout(at);
const hud = await page.evaluate(() => ({
  stats: document.getElementById("stats")?.textContent,
  seed: document.getElementById("seed")?.textContent,
  district: document.getElementById("district")?.textContent,
  speed: document.getElementById("speed")?.textContent,
  hash: window.location.hash,
}));
await page.screenshot({ path: out });
await page.keyboard.up("w");
await browser.close();

console.log(JSON.stringify({ url, out, at, hud, errors }, null, 2));
if (errors.length > 0) process.exitCode = 1;
