import { chromium } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { mkdir, writeFile } from "node:fs/promises";
const out = "docs/verification-redesign";
await mkdir(out + "/screenshots", { recursive: true });
const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ baseURL: "http://localhost:8080" });
const page = await context.newPage();
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
const response = await context.request.post("/api/demo", {
  data: { kind: "group" },
});
const { id } = await response.json();
const view = await (await context.request.get("/api/trips/" + id)).json();
const hotelId = view.candidates[0].hotelId;
const routes = [
  ["home", "/"],
  ["new", "/trips/new"],
  ["chat", `/trips/${id}/chat`],
  ["scenarios", `/trips/${id}/scenarios`],
  ["hotels", `/trips/${id}/hotels`],
  ["details", `/trips/${id}/hotels/${hotelId}`],
  ["matches", `/trips/${id}/matches`],
  ["demo", "/demo"],
  ["host", "/host/demo"],
];
const results = [];
for (const theme of ["light"]) {
  await page.addInitScript((t) => {
    localStorage.setItem("ostrovok-theme", t);
  }, theme);
  for (const [name, url] of routes) {
    for (const width of [360, 390, 768, 1024, 1440]) {
      await page.setViewportSize({ width, height: 900 });
      await page.goto(url);
      if (url.includes("/trips/") && !url.endsWith("/new"))
        await page.waitForSelector(".trip-title", { state: "attached" });
      await page.evaluate(async () => {
        await document.fonts.ready;
        await Promise.all(
          [...document.images].map((i) =>
            i.complete
              ? Promise.resolve()
              : new Promise((r) => {
                  i.onload = r;
                  i.onerror = r;
                }),
          ),
        );
      });
      const metrics = await page.evaluate(() => ({
        scrollWidth: document.documentElement.scrollWidth,
        viewport: innerWidth,
        brokenImages: [...document.images]
          .filter((i) => !i.naturalWidth)
          .map((i) => i.src),
      }));
      const result = { name, theme, width, ...metrics };
      if ([390, 1440].includes(width)) {
        const report = await new AxeBuilder({ page })
          .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
          .analyze();
        result.violations = report.violations.map((v) => ({
          id: v.id,
          impact: v.impact,
          description: v.description,
          nodes: v.nodes.map((n) => ({
            target: n.target,
            summary: n.failureSummary,
          })),
        }));
        if (
          ["home", "scenarios", "hotels", "details", "matches"].includes(name)
        )
          await page.screenshot({
            path: `${out}/screenshots/${name}-${theme}-${width}.png`,
            fullPage: true,
          });
      }
      results.push(result);
    }
  }
}
await page.emulateMedia({ reducedMotion: "reduce" });
await page.goto(`/trips/${id}/hotels`);
await page.waitForSelector(".hotel-photo-deck");
const reduced = await page.evaluate(
  () => matchMedia("(prefers-reduced-motion: reduce)").matches,
);
console.log("Reduced motion", reduced);
await writeFile(
  out + "/visual-results.json",
  JSON.stringify({ date: "2026-10-27", errors, results }, null, 2),
);
console.log(
  JSON.stringify(
    {
      screens: results.length,
      overflow: results.filter((r) => r.scrollWidth > r.viewport),
      broken: results.filter((r) => r.brokenImages.length),
      axe: results
        .filter((r) => r.violations?.length)
        .map((r) => ({
          name: r.name,
          theme: r.theme,
          width: r.width,
          violations: r.violations,
        })),
      errors,
    },
    null,
    2,
  ),
);
await browser.close();
