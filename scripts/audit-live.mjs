import { createRequire } from "node:module";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

const require = createRequire(import.meta.url);
const { chromium } = require("playwright");

const session = process.argv[2];

if (!session) {
  throw new Error("Usage: node scripts/audit-live.mjs <SESSION>");
}

const routes = [
  "/dashboard",
  "/applications",
  "/resumes",
  "/settings",
  "/community/reviews",
  "/community/experiences",
  "/community/referrals",
  "/community/ask"
];

const outDir = path.join(process.cwd(), "audits", "naukriclear-live");
await mkdir(outDir, { recursive: true });

const browser = await chromium.launch({
  headless: true,
  executablePath: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
});
const context = await browser.newContext({
  viewport: { width: 1440, height: 1000 },
  deviceScaleFactor: 1
});

await context.addCookies([
  {
    name: "SESSION",
    value: session,
    domain: ".naukriclear.com",
    path: "/",
    httpOnly: true,
    secure: true,
    sameSite: "Lax"
  }
]);

const page = await context.newPage();
const report = [];

for (const route of routes) {
  const url = `https://naukriclear.com${route}`;
  await page.goto(url, { waitUntil: "networkidle", timeout: 45000 });

  const safeName = route === "/" ? "home" : route.slice(1).replaceAll("/", "__");
  const screenshotPath = path.join(outDir, `${safeName}.png`);
  await page.screenshot({ path: screenshotPath, fullPage: true });

  report.push({
    route,
    finalUrl: page.url(),
    title: await page.title(),
    bodyText: (await page.locator("body").innerText({ timeout: 10000 })).slice(0, 12000),
    screenshot: screenshotPath
  });
}

await writeFile(path.join(outDir, "report.json"), JSON.stringify(report, null, 2));
await browser.close();

console.log(JSON.stringify({ outDir, routes: report.map((item) => item.route) }, null, 2));
