import { test, expect } from "@playwright/test";
import { mkdir, writeFile } from "node:fs/promises";
const phase = process.env.TYPOGRAPHY_PHASE || "after";
const strict = phase === "after";
const selectors = [
  ".ov-hero h1",
  ".ov-hero-content > p",
  ".ov-editorial-heading h2",
  ".ov-editorial-heading p",
  ".ov-autumn-hotel h3",
  ".ov-autumn-hotel p",
  ".ov-autumn-hotel strong",
  ".ov-guru-promo h3",
  ".ov-mystic-card h3",
  ".ov-food-caption h3",
  ".ov-blog-caption h3",
  ".ov-blog-souvenirs h3",
  ".ov-halloween-title",
  ".ov-halloween-hotel h3",
  ".ov-halloween-guru h3",
  ".ov-field-button small",
  ".ov-field-button strong",
  ".ov-search-submit",
  ".ov-search-under",
  ".ov-results-title h1",
  ".ov-hotel-name",
  ".ov-card-address",
  ".ov-distance",
  ".ov-amenity-chips > span",
  ".ov-card-source",
  ".ov-total",
  ".ov-card-price > small",
  ".ov-price-caption",
  ".ov-taxes",
  ".ov-cancel",
  ".ov-detail-heading h1",
  ".ov-detail-address",
  ".ov-detail-section h2",
  ".ov-room-description h3",
  ".ov-room-category",
  ".ov-room-description > span:not(.ov-room-category)",
  ".ov-room-rate > div:first-child > small",
  ".ov-detail-section > p",
  ".ov-detail-section .ov-muted",
  ".ov-footer-bottom",
  ".ov-footer-bottom > span:last-child",
];

test("rendered typography audit across desktop and narrow phones", async ({
  page,
}) => {
  test.setTimeout(90000);
  await mkdir("test-results", { recursive: true });
  const reports: unknown[] = [];
  for (const width of [1440, 390, 320]) {
    await page.setViewportSize({ width, height: width > 640 ? 1000 : 844 });
    for (const [name, path] of [
      ["home", "/"],
      ["search", "/search?city=sochi"],
      ["hotel", "/hotel/pullman-sochi-centre"],
    ]) {
      await page.goto(path);
      await expect(page.locator(".ov")).toHaveAttribute(
        "data-hydrated",
        "true",
      );
      await page.evaluate(() => document.fonts.ready);
      const report = await page.evaluate((selectors) => {
        const visible = (e: Element) =>
          e.getClientRects().length > 0 &&
          getComputedStyle(e).visibility !== "hidden" &&
          !e.closest("[aria-hidden='true'],svg");
        const path = (e: Element) =>
          e.tagName.toLowerCase() +
          (e.classList.length ? "." + Array.from(e.classList).join(".") : "");
        const records = selectors.flatMap((selector) =>
          Array.from(document.querySelectorAll(selector))
            .filter(visible)
            .slice(0, 8)
            .map((element) => {
              const style = getComputedStyle(element);
              const rect = element.getBoundingClientRect();
              return {
                selector,
                text: element.textContent?.trim().replace(/\s+/g, " "),
                size: parseFloat(style.fontSize),
                weight: style.fontWeight,
                numeric: style.fontVariantNumeric,
                features: style.fontFeatureSettings,
                family: style.fontFamily,
                lineHeight: style.lineHeight,
                wrap: style.textWrap,
                width: +rect.width.toFixed(1),
                height: +rect.height.toFixed(1),
                scrollHeight: element.scrollHeight,
                clientHeight: element.clientHeight,
                scrollWidth: element.scrollWidth,
                clientWidth: element.clientWidth,
              };
            }),
        );
        const texts = Array.from(
          document.querySelectorAll(".ov *, .ov-modal *"),
        )
          .filter(
            (e) =>
              visible(e) &&
              Array.from(e.childNodes).some(
                (n) => n.nodeType === Node.TEXT_NODE && n.textContent?.trim(),
              ),
          )
          .map((e) => ({
            element: path(e),
            text: e.textContent?.trim().replace(/\s+/g, " ").slice(0, 100),
            size: parseFloat(getComputedStyle(e).fontSize),
            weight: getComputedStyle(e).fontWeight,
          }));
        const inputs = Array.from(
          document.querySelectorAll(
            "input:not([type=checkbox]):not([type=range]),select,textarea",
          ),
        )
          .filter(visible)
          .map((e) => ({
            element: path(e),
            size: parseFloat(getComputedStyle(e).fontSize),
          }));
        const headings = Array.from(
          document.querySelectorAll(".ov h1,.ov h2,.ov h3"),
        )
          .filter(visible)
          .map((e) => ({
            level: e.tagName,
            text: e.textContent?.trim().slice(0, 90),
            size: parseFloat(getComputedStyle(e).fontSize),
            weight: getComputedStyle(e).fontWeight,
            family: getComputedStyle(e).fontFamily,
            lines: Math.round(
              e.getBoundingClientRect().height /
                parseFloat(getComputedStyle(e).lineHeight),
            ),
          }));
        const clipped = Array.from(
          document.querySelectorAll(
            ".ov h1,.ov h2,.ov h3,.ov-hotel-name,.ov-room-total,.ov-total",
          ),
        )
          .filter(visible)
          .filter((e) => !e.querySelector("button.ov-blog-title-button"))
          .filter((e) => {
            const style = getComputedStyle(e);
            return (
              ((["hidden", "clip"].includes(style.overflowY) ||
                style.webkitLineClamp !== "none") &&
                e.scrollHeight > e.clientHeight + 2) ||
              (["hidden", "clip"].includes(style.overflowX) &&
                e.scrollWidth > e.clientWidth + 2)
            );
          })
          .map((e) => ({
            element: path(e),
            text: e.textContent?.trim(),
            scrollHeight: e.scrollHeight,
            clientHeight: e.clientHeight,
            scrollWidth: e.scrollWidth,
            clientWidth: e.clientWidth,
          }));
        const fonts = Array.from(document.fonts).map((f) => ({
          family: f.family,
          weight: f.weight,
          status: f.status,
          features: f.featureSettings,
        }));
        return {
          width: innerWidth,
          documentWidth: document.documentElement.scrollWidth,
          records,
          smallest: texts.sort((a, b) => a.size - b.size).slice(0, 30),
          belowFloor: texts.filter(
            (t) => t.size > 0 && t.size < 12 && !/^[★\s]+$/.test(t.text || ""),
          ),
          inputs,
          headings,
          clipped,
          fonts,
        };
      }, selectors);
      if (strict && name === "home") {
        const sizeOf = (selector: string) =>
          report.records.find((record) => record.selector === selector)?.size;
        expect
          .soft(sizeOf(".ov-editorial-heading h2"))
          .toBe(width > 680 ? 36 : 24);
        expect
          .soft(sizeOf(".ov-editorial-heading p"))
          .toBe(width > 680 ? 24 : 16);
        expect.soft(sizeOf(".ov-autumn-hotel h3")).toBe(18);
        expect.soft(sizeOf(".ov-autumn-hotel p")).toBe(14);
        expect.soft(sizeOf(".ov-autumn-hotel strong")).toBe(24);
        expect.soft(sizeOf(".ov-guru-promo h3")).toBe(22);
        expect.soft(sizeOf(".ov-mystic-card h3")).toBe(width > 680 ? 32 : 20);
        expect.soft(sizeOf(".ov-food-caption h3")).toBe(width > 680 ? 24 : 20);
        expect
          .soft(sizeOf(".ov-blog-souvenirs h3"))
          .toBe(width > 680 ? 32 : 20);
        const spoof = report.fonts.find((face) =>
          face.family.includes("Ostrovok Spoof"),
        );
        expect.soft(spoof?.status).toBe("loaded");
        expect.soft(spoof?.features).toContain("ss06");
      }
      reports.push({ name, ...report });
      await page.screenshot({
        path: `test-results/typography-${phase}-${name}-${width}.png`,
        fullPage: true,
      });
      if (strict) {
        expect
          .soft(report.documentWidth, `${name}/${width}: document overflow`)
          .toBeLessThanOrEqual(width);
        expect
          .soft(report.belowFloor, `${name}/${width}: text below 12px`)
          .toEqual([]);
        expect
          .soft(report.clipped, `${name}/${width}: clipped headings or prices`)
          .toEqual([]);
        if (width <= 640)
          expect
            .soft(
              report.inputs.filter((i) => i.size < 16),
              `${name}/${width}: mobile inputs below16`,
            )
            .toEqual([]);
      }
    }
  }
  await writeFile(
    `test-results/typography-${phase}.json`,
    JSON.stringify(reports, null, 2),
  );
});

test("expanded controls keep readable text and stay inside phone viewports", async ({
  page,
}) => {
  test.setTimeout(90000);
  const rows: unknown[] = [];
  async function checkPanel(name: string, selector: string, width: number) {
    const panel = page.locator(selector).last();
    await expect(panel).toBeVisible();
    const result = await panel.evaluate((root) => {
      const items = Array.from(root.querySelectorAll("*"))
        .filter(
          (e) =>
            e.getClientRects().length > 0 &&
            getComputedStyle(e).visibility !== "hidden" &&
            !e.closest("svg,[aria-hidden=true]") &&
            Array.from(e.childNodes).some(
              (n) => n.nodeType === Node.TEXT_NODE && n.textContent?.trim(),
            ),
        )
        .map((e) => ({
          text: e.textContent?.trim().slice(0, 90),
          size: parseFloat(getComputedStyle(e).fontSize),
        }));
      const rect = root.getBoundingClientRect();
      return {
        small: items.filter((i) => i.size > 0 && i.size < 12),
        left: rect.left,
        right: rect.right,
        width: rect.width,
        inputs: Array.from(
          root.querySelectorAll(
            "input:not([type=checkbox]):not([type=range]),select,textarea",
          ),
        ).map((e) => parseFloat(getComputedStyle(e).fontSize)),
      };
    });
    rows.push({ name, viewport: width, ...result });
    expect.soft(result.small, `${name}/${width} text floor`).toEqual([]);
    expect.soft(result.left, `${name}/${width} left`).toBeGreaterThanOrEqual(0);
    expect
      .soft(result.right, `${name}/${width} right`)
      .toBeLessThanOrEqual(width);
    if (width <= 640)
      expect
        .soft(
          result.inputs.filter((size) => size < 16),
          `${name}/${width} input floor`,
        )
        .toEqual([]);
    await panel.screenshot({
      path: `test-results/typography-panel-${name}-${width}.png`,
    });
  }
  for (const width of [1440, 390, 320]) {
    await page.setViewportSize({ width, height: 1000 });
    await page.goto("/hotel/pullman-sochi-centre");
    await expect(page.locator(".ov")).toHaveAttribute("data-hydrated", "true");
    await page.getByRole("button", { name: /Город, отель или регион/ }).click();
    await checkPanel("city", ".ov-city-popover", width);
    await page.keyboard.press("Escape");
    await page.getByRole("button", { name: /Заезд — выезд/ }).click();
    await checkPanel("dates", ".ov-calendar", width);
    await page.keyboard.press("Escape");
    await page.getByRole("button", { name: "1 номер 2 гостя" }).click();
    await checkPanel("guests", ".ov-guests-popover", width);
    await page.keyboard.press("Escape");
    await page
      .getByRole("button", { name: "Выбрать", exact: true })
      .first()
      .click();
    await checkPanel("booking", ".ov-modal", width);
    await page.keyboard.press("Escape");
    if (width <= 640) {
      await page.goto("/search?city=sochi");
      await expect(page.locator(".ov")).toHaveAttribute(
        "data-hydrated",
        "true",
      );
      await page.getByRole("button", { name: "Фильтры", exact: true }).click();
      await checkPanel("filters", ".ov-modal", width);
      await page.keyboard.press("Escape");
    }
  }
  await writeFile(
    "test-results/typography-panels.json",
    JSON.stringify(rows, null, 2),
  );
});

test("blog titles expand and seasonal photography stays fixed behind the white page", async ({
  page,
}) => {
  const observations: unknown[] = [];
  for (const width of [1440, 390, 320]) {
    await page.setViewportSize({ width, height: 1000 });
    await page.goto("/");
    await expect(page.locator(".ov")).toHaveAttribute("data-hydrated", "true");
    const title =
      "План перестроен: как бесплатно отменить бронирование отеля на Островке";
    await page.getByRole("button", { name: title, exact: true }).click();
    await expect(
      page
        .getByRole("dialog")
        .getByRole("heading", { name: title, exact: true }),
    ).toBeVisible();
    const heading = page
      .getByRole("dialog")
      .getByRole("heading", { name: title, exact: true });
    const font = await heading.evaluate((e) => ({
      size: parseFloat(getComputedStyle(e).fontSize),
      height: e.clientHeight,
      scrollHeight: e.scrollHeight,
    }));
    expect(font.size).toBeGreaterThanOrEqual(22);
    expect(font.scrollHeight).toBeLessThanOrEqual(font.height + 2);
    await page.getByRole("dialog").screenshot({
      path: `test-results/typography-blog-expanded-${width}.png`,
    });
    await page.keyboard.press("Escape");
    await page.locator(".ov-halloween").scrollIntoViewIfNeeded();
    const read = () =>
      page.locator(".ov-halloween").evaluate((section) => {
        const backdrop = section.querySelector(".ov-halloween-backdrop")!;
        const bs = getComputedStyle(backdrop),
          rect = backdrop.getBoundingClientRect(),
          sr = section.getBoundingClientRect();
        return {
          position: bs.position,
          transform: bs.transform,
          backgroundImage: bs.backgroundImage,
          clip: getComputedStyle(section).clipPath,
          left: rect.left,
          right: rect.right,
          top: rect.top,
          bottom: rect.bottom,
          sectionTop: sr.top,
          sectionBottom: sr.bottom,
          viewportHeight: innerHeight,
        };
      });
    const before = await read();
    await page.evaluate(() =>
      window.scrollTo({ top: window.scrollY + 120, behavior: "instant" }),
    );
    await page.evaluate(
      () =>
        new Promise<void>((resolve) =>
          requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
        ),
    );
    const after = await read();
    expect(after.position).toBe("fixed");
    expect(after.top).toBe(before.top);
    expect(after.transform).toBe(before.transform);
    expect(after.sectionTop).toBeLessThan(before.sectionTop);
    expect(after.clip).not.toBe("none");
    expect(after.backgroundImage).toContain("halloween-web.jpg");
    expect(after.top).toBeLessThanOrEqual(Math.max(0, after.sectionTop));
    expect(after.bottom).toBeGreaterThanOrEqual(
      Math.min(after.viewportHeight, after.sectionBottom),
    );
    expect(after.left).toBeLessThanOrEqual(0);
    expect(after.right).toBeGreaterThanOrEqual(width);
    await page
      .locator(".ov-halloween")
      .screenshot({ path: `test-results/typography-halloween-${width}.png` });
    await page.emulateMedia({ reducedMotion: "reduce" });
    const reduced = await read();
    expect(reduced.position).toBe("absolute");
    observations.push({ width, before, after, reduced, font });
    await page.emulateMedia({ reducedMotion: "no-preference" });
  }
  await writeFile(
    "test-results/typography-fixed-window.json",
    JSON.stringify(observations, null, 2),
  );
});

test("photo hover zoom stays within its frame and respects touch and reduced motion", async ({
  page,
  browser,
}) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto("/");
  await expect(page.locator(".ov")).toHaveAttribute("data-hydrated", "true");
  const results: unknown[] = [];
  for (const selector of [
    ".ov-autumn-hotel .ov-image-window",
    ".ov-food-card",
  ]) {
    const frame = page.locator(selector).first(),
      photo = frame.locator("img").first();
    await frame.scrollIntoViewIfNeeded();
    await page.mouse.move(0, 0);
    const original = await frame.boundingBox();
    await frame.hover();
    const scale = () =>
      photo.evaluate(
        (image) => new DOMMatrixReadOnly(getComputedStyle(image).transform).a,
      );
    await expect.poll(scale).toBeGreaterThan(1.05);
    expect(await frame.boundingBox()).toEqual(original);
    expect(await frame.evaluate((e) => getComputedStyle(e).overflow)).toBe(
      "hidden",
    );
    results.push({ selector, scale: await scale(), frame: original });
    await frame.screenshot({
      path: `test-results/typography-hover-${selector.includes("autumn") ? "autumn" : "food"}.png`,
    });
    await page.emulateMedia({ reducedMotion: "reduce" });
    await expect.poll(scale).toBe(1);
    await page.emulateMedia({ reducedMotion: "no-preference" });
  }
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
  });
  const touchPage = await context.newPage();
  await touchPage.goto("http://127.0.0.1:8080/");
  await expect(touchPage.locator(".ov")).toHaveAttribute(
    "data-hydrated",
    "true",
  );
  const touchCard = touchPage.locator(".ov-food-card").first();
  await touchCard.hover();
  expect(
    await touchPage.evaluate(() => matchMedia("(hover: hover)").matches),
  ).toBe(false);
  const touchScale = await touchCard
    .locator("img")
    .evaluate(
      (image) => new DOMMatrixReadOnly(getComputedStyle(image).transform).a,
    );
  expect(touchScale).toBe(1);
  await context.close();
  await writeFile(
    "test-results/typography-hover.json",
    JSON.stringify({ desktop: results, touchScale }, null, 2),
  );
});

test("empty result heading stays subordinate to the page title", async ({
  page,
}) => {
  for (const width of [1440, 390, 320]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/search?city=sochi&q=zzzz");
    await expect(
      page.getByRole("heading", { name: "Не нашли подходящих отелей" }),
    ).toBeVisible();
    const sizes = await page.evaluate(() => ({
      page: parseFloat(
        getComputedStyle(document.querySelector(".ov-results-title h1")!)
          .fontSize,
      ),
      empty: parseFloat(
        getComputedStyle(document.querySelector(".ov-empty h2")!).fontSize,
      ),
    }));
    expect(sizes.empty).toBeLessThan(sizes.page);
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth),
    ).toBeLessThanOrEqual(width);
  }
});

test("full-screen home hero keeps expanded search controls unclipped", async ({
  page,
}) => {
  for (const width of [1440, 390, 320]) {
    await page.setViewportSize({ width, height: 1000 });
    await page.goto("/");
    await expect(page.locator(".ov")).toHaveAttribute("data-hydrated", "true");
    await page.getByRole("button", { name: "Фильтры", exact: true }).click();
    await expect(page.locator(".ov-inline-filters")).toBeVisible();
    for (const [button, popover] of [
      [/Город, отель или регион/, ".ov-city-popover"],
      [/Заезд — выезд/, ".ov-calendar"],
      ["1 номер 2 гостя", ".ov-guests-popover"],
    ] as const) {
      await page.getByRole("button", { name: button }).click();
      await expect(page.locator(popover)).toBeVisible();
      const clipped = await page.locator(popover).evaluate((el) => {
        const r = el.getBoundingClientRect(),
          bad = [];
        for (
          let p = el.parentElement;
          p && p !== document.body;
          p = p.parentElement
        ) {
          const s = getComputedStyle(p),
            b = p.getBoundingClientRect();
          if (
            (["hidden", "clip"].includes(s.overflowY) &&
              (r.top < b.top - 1 || r.bottom > b.bottom + 1)) ||
            (["hidden", "clip"].includes(s.overflowX) &&
              (r.left < b.left - 1 || r.right > b.right + 1))
          )
            bad.push(p.className);
        }
        return bad;
      });
      expect(clipped).toEqual([]);
      await page.locator(popover).screenshot({
        path: `test-results/typography-home-${popover.slice(1)}-${width}.png`,
      });
      await page.keyboard.press("Escape");
    }
    await page
      .getByRole("button", { name: "К пожеланиям", exact: true })
      .click();
    await expect(page.locator("#trip-request")).toHaveAttribute("type", "text");
    await page.screenshot({
      path: `test-results/typography-hero-${width}.png`,
    });
  }
});
