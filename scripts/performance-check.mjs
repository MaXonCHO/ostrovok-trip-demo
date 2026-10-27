import { chromium } from "@playwright/test";
import { writeFile } from "node:fs/promises";
const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({
  viewport: { width: 1440, height: 900 },
});
const page = await context.newPage();
await page.addInitScript(() => {
  window.__measurement = { lcp: null, cls: 0 };
  new PerformanceObserver((list) => {
    for (const e of list.getEntries()) window.__measurement.lcp = e.startTime;
  }).observe({ type: "largest-contentful-paint", buffered: true });
  new PerformanceObserver((list) => {
    for (const e of list.getEntries())
      if (!e.hadRecentInput) window.__measurement.cls += e.value;
  }).observe({ type: "layout-shift", buffered: true });
});
await page.goto("http://localhost:8080/");
await page.evaluate(async () => {
  await document.fonts.ready;
  await Promise.all(
    [...document.images].map((i) => i.decode().catch(() => {})),
  );
});
await page.waitForTimeout(400);
const result = await page.evaluate(() => ({
  ...window.__measurement,
  navigationDuration: performance.getEntriesByType("navigation")[0].duration,
}));
const report = {
  date: "2026-10-27",
  environment:
    "Local Mac ARM64, Chromium headless, 1440x900, production standalone, no CPU/network throttling",
  ...result,
  INP: "Not measured; no field data",
  limitations:
    "One lab navigation, not a claim of field Core Web Vitals compliance",
};
await writeFile(
  "docs/verification/performance-results.json",
  JSON.stringify(report, null, 2),
);
console.log(report);
await browser.close();
