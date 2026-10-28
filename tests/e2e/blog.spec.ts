import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

test("homepage recommendation is the second content row and follows the entered wish", async ({
  page,
}) => {
  await page.goto("/");
  const feature = page.locator(".ov-blog-recommendation");
  await expect(feature).toBeVisible();
  const order = await page.evaluate(() => {
    const y = (selector: string) =>
      document.querySelector(selector)!.getBoundingClientRect().top;
    return (
      y(".ov-autumn") < y(".ov-blog-recommendation") &&
      y(".ov-blog-recommendation") < y(".ov-mystic")
    );
  });
  expect(order).toBe(true);
  await page
    .getByPlaceholder("Например: в Петербург, в тихий отель с завтраком…")
    .fill("Хочу кофе и лучшие кофейни Петербурга");
  await expect(feature.locator("article")).toHaveAttribute(
    "data-article",
    "luchshie-kofejni-peterburga",
  );
  const image = await feature.locator(".ov-blog-feature-image").boundingBox();
  const copy = await feature.locator(".ov-blog-feature-copy").boundingBox();
  expect(image!.x + image!.width).toBeLessThanOrEqual(copy!.x + 1);
  await feature.getByRole("link", { name: "Читать", exact: true }).click();
  await expect(page).toHaveURL(/\/blog\/luchshie-kofejni-peterburga$/);
  await expect(page.getByRole("heading", { level: 1 })).toContainText(
    /кофейн|кофе/i,
  );
  await expect(
    page.getByRole("link", { name: /Читать оригинал/ }),
  ).toHaveAttribute(
    "href",
    "https://blog.ostrovok.ru/luchshie-kofejni-peterburga/",
  );
  await expect(
    page.getByText("Пересказ статьи", { exact: true }),
  ).toBeVisible();
  expect(
    await page.locator(".ov-journal-body h2").count(),
  ).toBeGreaterThanOrEqual(5);
  expect(
    await page.locator(".ov-journal-body > p").count(),
  ).toBeGreaterThanOrEqual(4);
  expect(
    await page.locator(".ov-journal-body figure").count(),
  ).toBeGreaterThanOrEqual(1);
});

test("blog filters, search and empty-state reset work; missing articles return 404", async ({
  page,
}) => {
  await page.goto("/blog");
  await expect(page.getByRole("heading", { level: 1 })).toContainText(
    "от О!Блога",
  );
  await expect(
    page.locator(".ov-blog-masthead, .ov-blog-brand, .ov-blog-book"),
  ).toHaveCount(0);
  const searchBox = await page.locator(".ov-blog-hero-search").boundingBox();
  const rubricsBox = await page.locator(".ov-blog-rubrics").boundingBox();
  expect(rubricsBox!.y).toBeGreaterThan(searchBox!.y + searchBox!.height);
  await expect(
    page.locator(
      ".ov-journal-collection .ov-blog-feature, .ov-journal-collection .ov-journal-card",
    ),
  ).toHaveCount(25);
  await page
    .getByRole("button", { name: "О!ВПЕЧАТЛЕНИЯ", exact: true })
    .click();
  await expect(
    page.locator(
      ".ov-journal-collection .ov-blog-feature, .ov-journal-collection .ov-journal-card",
    ),
  ).toHaveCount(5);
  await page
    .getByRole("searchbox", { name: "Поиск по статьям" })
    .fill("кофейни");
  await expect(
    page.locator(
      ".ov-journal-collection .ov-blog-feature, .ov-journal-collection .ov-journal-card",
    ),
  ).toHaveCount(1);
  await page.getByRole("searchbox").fill("несуществующая тема xyz");
  await expect(
    page.getByRole("heading", { name: "Пока ничего не нашлось" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Показать все статьи" }).click();
  await expect(
    page.locator(
      ".ov-journal-collection .ov-blog-feature, .ov-journal-collection .ov-journal-card",
    ),
  ).toHaveCount(25);
  const a11y = await new AxeBuilder({ page })
    .include("main")
    .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
    .analyze();
  expect(
    a11y.violations.map((v) => ({
      id: v.id,
      targets: v.nodes.map((n) => n.target),
    })),
  ).toEqual([]);
  expect((await page.goto("/blog/not-an-article"))?.status()).toBe(404);
});

test("collections show one lead and an independent carousel with hidden end arrows", async ({
  page,
}) => {
  await page.goto("/blog?topic=places");
  const collection = page.locator(".ov-journal-collection");
  await expect(collection).toHaveCount(1);
  await expect(collection.locator(".ov-blog-feature")).toHaveCount(1);
  await expect(collection.locator(".ov-blog-feature")).toHaveAttribute(
    "data-article",
    "peterburg-na-vykhodnye",
  );
  const track = collection.locator(".ov-blog-article-track");
  await expect(track.locator(".ov-journal-card")).toHaveCount(5);
  await expect(collection.locator(".ov-blog-carousel-prev")).toHaveCount(0);
  await expect(collection.locator(".ov-blog-carousel-next")).toBeVisible();
  await collection.locator(".ov-blog-carousel-next").click();
  await expect
    .poll(() => track.evaluate((el) => el.scrollLeft))
    .toBeGreaterThan(100);
  await expect(collection.locator(".ov-blog-carousel-prev")).toBeVisible();
  await track.evaluate((el) =>
    el.scrollTo({ left: el.scrollWidth, behavior: "instant" }),
  );
  await expect(collection.locator(".ov-blog-carousel-next")).toHaveCount(0);
  await track.evaluate((el) => el.scrollTo({ left: 0, behavior: "instant" }));
  await expect(collection.locator(".ov-blog-carousel-prev")).toHaveCount(0);
  await page.screenshot({
    path: "test-results/blog-collections-desktop.png",
    fullPage: true,
  });
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(collection.locator(".ov-blog-carousel-next")).toBeVisible();
  await collection.locator(".ov-blog-carousel-next").click();
  await expect
    .poll(() => track.evaluate((el) => el.scrollLeft))
    .toBeGreaterThan(100);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
});

test("saved trip interests survive navigation, and articles work on a phone", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.addInitScript(() => {
    localStorage.setItem(
      "ostrovok-trip-conversation-v1",
      JSON.stringify({
        profile: { children: 2 },
        messages: [{ role: "user", content: "Семейная поездка в Петербург" }],
      }),
    );
  });
  await page.goto("/");
  const feature = page.locator(".ov-blog-recommendation");
  await expect(feature.locator("article")).toHaveAttribute(
    "data-article",
    "nedelya-v-sankt-peterburge-kuda-sxodit-s-detmi",
  );
  await feature.scrollIntoViewIfNeeded();
  await page.screenshot({ path: "test-results/blog-home-mobile.png" });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await feature.getByRole("link", { name: "Читать", exact: true }).click();
  await expect(page.getByRole("heading", { level: 1 })).toContainText(
    /дет|сем/i,
  );
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  const broken = await page
    .locator(".ov-journal-article img")
    .evaluateAll(
      (images) =>
        images.filter(
          (i) =>
            !(i as HTMLImageElement).getAttribute("loading") &&
            (i as HTMLImageElement).naturalWidth === 0,
        ).length,
    );
  expect(broken).toBe(0);
  await page.getByRole("link", { name: "Все статьи", exact: true }).click();
  await expect(
    page.locator(
      ".ov-journal-collection .ov-blog-feature, .ov-journal-collection .ov-journal-card",
    ),
  ).toHaveCount(25);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
});

test("photo sections fill the viewport, cards are compact and the closing invitation shares the same photo", async ({
  page,
}) => {
  await page.goto("/blog?topic=guides");
  const scene = page.locator(".ov-blog-related-scene").last();
  const box = await scene.boundingBox();
  expect(box!.x).toBe(0);
  expect(box!.width).toBe(await page.evaluate(() => innerWidth));
  await expect(scene.locator(".ov-journal-card p")).toHaveCount(0);
  await expect(scene.locator(".ov-blog-related-backdrop")).toHaveCount(1);
  const banner = scene.locator(".ov-blog-final-cta");
  await expect(banner).toBeVisible();
  await expect(banner.locator(".ov-final-cta-backdrop")).toHaveCount(0);
  await banner.scrollIntoViewIfNeeded();
  await page.screenshot({ path: "test-results/blog-shared-photo-cta.png" });
  await banner.getByRole("link", { name: "Начать мою поездку" }).click();
  await expect(page).toHaveURL(/\/#trip-request-heading$/);
  await expect(
    page.getByPlaceholder("Например: в Петербург, в тихий отель с завтраком…"),
  ).toBeFocused();
});
