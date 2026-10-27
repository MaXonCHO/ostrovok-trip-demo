import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

test("hero drifts without zoom or uncovered edges and keeps its controls stationary", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto("/");
  await expect(page.locator(".ov")).toHaveAttribute("data-hydrated", "true");
  await page.evaluate(() => document.fonts.ready);
  const hero = page.locator(".ov-hero");
  const image = page.locator(".ov-hero-cover");
  const content = page.locator(".ov-hero-content");
  const initialContent = await content.boundingBox();
  expect((await hero.boundingBox())!.height).toBeGreaterThanOrEqual(1000);
  expect((await hero.boundingBox())!.y).toBe(0);
  for (const point of [
    { x: 1430, y: 150 },
    { x: 10, y: 950 },
    { x: 1430, y: 950 },
    { x: 10, y: 150 },
  ]) {
    await page.mouse.move(point.x, point.y);
    await expect
      .poll(async () =>
        image.evaluate((el) => {
          const m = new DOMMatrix(getComputedStyle(el).transform);
          return Math.abs(m.e) + Math.abs(m.f);
        }),
      )
      .toBeGreaterThan(1);
    const geometry = await image.evaluate((el) => {
      const image = el.getBoundingClientRect();
      const frame = el.closest(".ov-hero-media")!.getBoundingClientRect();
      const matrix = new DOMMatrix(getComputedStyle(el).transform);
      return {
        covers:
          image.left <= frame.left &&
          image.right >= frame.right &&
          image.top <= frame.top &&
          image.bottom >= frame.bottom,
        scaleX: matrix.a,
        scaleY: matrix.d,
      };
    });
    expect(geometry).toEqual({ covers: true, scaleX: 1, scaleY: 1 });
    expect(await content.boundingBox()).toEqual(initialContent);
  }
  await page.screenshot({ path: "test-results/home-motion-desktop.png" });
  const audit = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa"])
    .analyze();
  expect(
    audit.violations.map((v) => ({
      id: v.id,
      nodes: v.nodes.map((n) => n.target),
    })),
  ).toEqual([]);
  await page.emulateMedia({ reducedMotion: "reduce" });
  await expect(image).toHaveCSS("transform", "none");
});

test("touch hero has no drifting, keeps full image coverage and no horizontal overflow", async ({
  browser,
  baseURL,
}) => {
  const context = await browser.newContext({
    baseURL,
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
  });
  const page = await context.newPage();
  await page.goto("/");
  await expect(page.locator(".ov")).toHaveAttribute("data-hydrated", "true");
  await expect(page.locator(".ov-hero-cover")).toHaveCSS("transform", "none");
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(
    390,
  );
  await page.screenshot({
    path: "test-results/home-motion-mobile.png",
    fullPage: true,
  });
  await context.close();
});
