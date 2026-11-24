// End-to-end smoke test: serves this repository locally, opens the page in headless Chromium at desktop
// and phone width, and checks that real data loads, counters tick, verdicts show, nothing scrolls sideways
// and no em or en dashes reach the page. Settings come from the "smoke" field in package.json.
//
//   npm run smoke                        uses the pinned clock-core release from jsDelivr
//   CLOCK_CORE_DIR=../clock-core npm run smoke   serves clock-core from a local checkout instead
//
// Needs Playwright with Chromium (CI installs it; see .github/workflows/ci.yml).
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { extname, join, resolve } from "node:path";

const require = createRequire(import.meta.url);
const { chromium } = require("playwright");
const pkg = JSON.parse(await readFile("package.json", "utf8"));
/** @type {{ ready?: string, ticking: string[], verdicts?: string[], hashes?: string[] }} */
const cfg = pkg.smoke;
const ROOT = resolve(".");
const CORE_DIR = process.env.CLOCK_CORE_DIR ? resolve(process.env.CLOCK_CORE_DIR) : null;
const TYPES = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".svg": "image/svg+xml", ".png": "image/png", ".json": "application/json" };

const server = createServer(async (req, res) => {
  const path = decodeURIComponent(new URL(req.url ?? "/", "http://x").pathname);
  const file = join(ROOT, path.endsWith("/") ? path + "index.html" : path);
  if (!file.startsWith(ROOT)) { res.writeHead(403).end(); return; }
  try {
    const body = await readFile(file);
    res.writeHead(200, { "content-type": TYPES[/** @type {keyof typeof TYPES} */ (extname(file))] ?? "application/octet-stream" }).end(body);
  } catch { res.writeHead(404).end("not found"); }
});
await new Promise((r) => server.listen(0, "127.0.0.1", () => r(undefined)));
const addr = server.address();
const base = `http://127.0.0.1:${typeof addr === "object" && addr ? addr.port : 0}/`;

const proxy = process.env.HTTPS_PROXY || process.env.https_proxy;
const browser = await chromium.launch(proxy ? { proxy: { server: proxy, bypass: "127.0.0.1,localhost" } } : {});
const failures = [];
const DASH = new RegExp("[" + String.fromCharCode(0x2013, 0x2014) + "]");

for (const hash of ["", ...(cfg.hashes ?? [])]) {
  for (const [w, h, label] of [[1280, 900, "desktop"], [375, 800, "phone"]]) {
    const name = `${label}${hash}`;
    const ctx = await browser.newContext({ viewport: { width: Number(w), height: Number(h) }, ignoreHTTPSErrors: true });
    const page = await ctx.newPage();
    const errors = [];
    page.on("pageerror", (e) => errors.push(e.message));
    page.on("console", (m) => { if (m.type() === "error") errors.push(m.text()); });
    if (CORE_DIR) {
      await page.route(/cdn\.jsdelivr\.net\/gh\/ramialbatal\/clock-core@[^/]+\/(.+)$/, async (route) => {
        const file = route.request().url().replace(/^.*clock-core@[^/]+\//, "");
        route.fulfill({ body: await readFile(join(CORE_DIR, file)), contentType: TYPES[/** @type {keyof typeof TYPES} */ (extname(file))] });
      });
    }
    await page.goto(base + hash);
    try {
      await page.waitForFunction(() => document.body.dataset.state === "ready", null, { timeout: 45000 });
    } catch {
      failures.push(`${name}: page never reached "ready" (state: ${await page.evaluate(() => document.body.dataset.state)}; ${await page.evaluate(() => document.getElementById("error-msg")?.textContent)})`);
      await ctx.close();
      continue;
    }
    await page.waitForTimeout(1500);
    const read = () => page.evaluate((sels) => sels.map((s) => document.querySelector(s)?.textContent ?? ""), cfg.ticking);
    const a = await read();
    await page.waitForTimeout(2500);
    const b = await read();
    cfg.ticking.forEach((s, i) => { if (a[i] === b[i]) failures.push(`${name}: ${s} did not tick (${a[i]})`); });
    for (const s of cfg.verdicts ?? []) {
      const v = await page.evaluate((sel) => document.querySelector(sel)?.textContent?.trim(), s);
      if (!v || v === "…") failures.push(`${name}: verdict ${s} is empty`);
    }
    const scrollW = await page.evaluate(() => document.documentElement.scrollWidth);
    if (scrollW > Number(w)) failures.push(`${name}: page is ${scrollW}px wide (horizontal scroll)`);
    const text = await page.evaluate(() => document.title + "\n" + document.body.innerText);
    if (DASH.test(text)) failures.push(`${name}: em or en dash in page text`);
    errors.forEach((e) => failures.push(`${name}: console error: ${e}`));
    console.log(`ok   ${name}`);
    await ctx.close();
  }
}
await browser.close();
server.close();
if (failures.length) {
  console.error("\nSmoke test failed:\n" + failures.map((f) => "  " + f).join("\n"));
  process.exit(1);
}
console.log("Smoke test passed.");
