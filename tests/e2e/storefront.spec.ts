import { test, expect, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { mockTripChat } from "./trip-chat-mock";

test.beforeEach(async ({ page }) => {
  await mockTripChat(page);
});

async function openPage(page: Page, url: string) {
  await page.goto(url);
  await expect(page.locator(".ov")).toHaveAttribute("data-hydrated", "true");
}

async function openCatalogFromTrip(page: Page) {
  const url = new URL(page.url());
  expect(url.pathname).toBe("/my-trip");
  url.pathname = "/search";
  url.searchParams.delete("source");
  await openPage(page, url.toString());
}

test("home search carries dates and guests through to hotel and saved choice", async ({
  page,
}) => {
  await openPage(page, "/");
  await expect(page.getByRole("heading", { level: 1 })).toContainText(
    "Отели, в которых",
  );
  await page.getByRole("button", { name: "Фильтры", exact: true }).click();
  await page.getByRole("button", { name: "1 номер 2 гостя" }).click();
  await page.getByRole("button", { name: "Увеличить: Взрослые" }).click();
  await page.getByRole("button", { name: "Готово", exact: true }).click();
  await page.getByRole("button", { name: /Заезд — выезд/ }).click();
  await page
    .getByRole("button", { name: "10 ноября 2026 г.", exact: true })
    .click();
  await page
    .getByRole("button", { name: "14 ноября 2026 г.", exact: true })
    .click();
  await page.getByRole("button", { name: "Готово", exact: true }).click();
  await page
    .getByRole("button", { name: "Подобрать отели", exact: true })
    .click();
  await expect(page).toHaveURL(/\/my-trip\?/);
  await expect(page.locator(".ov-chat-message.is-assistant")).toHaveCount(1);
  await openCatalogFromTrip(page);
  await expect(page).toHaveURL(/\/search\?/);
  await expect(page).toHaveURL(/adults=3/);
  await expect(page).toHaveURL(/checkin=2026-11-10/);
  await expect(page).toHaveURL(/checkout=2026-11-14/);
  await expect(page.locator(".ov-hotel-card")).toHaveCount(3);
  // Legacy catalogue stays available; use its Sochi fixture for room-price coverage.
  const legacyCatalog = new URL(page.url());
  legacyCatalog.searchParams.set("city", "sochi");
  await openPage(page, legacyCatalog.toString());
  await expect(page.locator(".ov-hotel-card")).toHaveCount(12);
  await page
    .locator(".ov-hotel-card")
    .first()
    .getByRole("link", { name: "Выбрать номер", exact: true })
    .click();
  await expect(page).toHaveURL(/\/hotel\/pullman-sochi-centre\?/);
  await expect(
    page.getByRole("heading", { name: "Pullman Сочи Центр", level: 1 }),
  ).toBeVisible();
  await expect(page.locator(".ov-trip-summary")).toContainText("3 взрослых");
  await expect(page.locator(".ov-room-total").first()).toContainText("50 400");
  await page
    .getByRole("button", { name: "Выбрать", exact: true })
    .first()
    .click();
  await expect(page.getByRole("dialog")).toContainText("50 400");
  await page.getByRole("button", { name: "Сохранить выбор" }).click();
  await expect(page.getByRole("dialog")).toContainText("Вариант сохранён");
  await page.getByRole("link", { name: "Открыть избранное" }).click();
  await expect(page.locator(".ov-hotel-card")).toHaveCount(1);
  await page.reload();
  await expect(page.locator(".ov")).toHaveAttribute("data-hydrated", "true");
  await expect(page.locator(".ov-hotel-card")).toHaveCount(1);
});

test("filters, sort and history preserve the requested result set", async ({
  page,
}) => {
  await openPage(page, "/search?city=sochi&adults=2&rooms=1");
  await page.getByRole("checkbox", { name: "Бассейн", exact: true }).check();
  await expect
    .poll(() => page.locator(".ov-hotel-card").count())
    .toBeGreaterThan(0);
  await expect
    .poll(() => page.locator(".ov-hotel-card").count())
    .toBeLessThan(12);
  await page
    .getByRole("combobox", { name: "Сортировка отелей" })
    .selectOption("price");
  const prices = await page.locator(".ov-total").allTextContents();
  const values = prices.map((value) => Number(value.replace(/[^0-9]/g, "")));
  expect(values).toEqual([...values].sort((a, b) => a - b));
  await page
    .locator(".ov-hotel-card")
    .first()
    .getByRole("link", { name: "Выбрать номер", exact: true })
    .click();
  await page
    .getByRole("link", { name: "Все отели в Сочи", exact: true })
    .click();
  await expect(
    page.getByRole("checkbox", { name: "Бассейн", exact: true }),
  ).toBeChecked();
  await expect(
    page.getByRole("combobox", { name: "Сортировка отелей" }),
  ).toHaveValue("price");
  await page
    .getByRole("textbox", { name: "Название отеля" })
    .fill("отель которого нет");
  await expect(
    page.getByRole("heading", { name: "Не нашли подходящих отелей" }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Сбросить фильтры", exact: true })
    .click();
  await expect(page.locator(".ov-hotel-card")).toHaveCount(12);
});

test("gallery, maps and breakfast change are functional", async ({ page }) => {
  await openPage(
    page,
    "/hotel/pullman-sochi-centre?city=sochi&checkin=2026-11-06&checkout=2026-11-09&adults=2&rooms=1",
  );
  await page.getByRole("button", { name: "Открыть фотографии отеля" }).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog.locator(".ov-gallery-thumbs")).toContainText("1 / 3");
  await dialog
    .getByRole("button", { name: "Следующее фото", exact: true })
    .click();
  await expect(dialog.locator(".ov-gallery-thumbs")).toContainText("2 / 3");
  await page.keyboard.press("Escape");
  await expect(dialog).not.toBeVisible();
  await expect(
    page.getByRole("button", { name: "Открыть фотографии отеля" }),
  ).toBeFocused();
  await page
    .getByRole("checkbox", { name: "С завтраком", exact: true })
    .check();
  await expect(page.locator(".ov-room-total").first()).toContainText("44 400");
  await page
    .getByRole("button", { name: "Показать на карте", exact: true })
    .click();
  await expect(page.getByRole("dialog")).toContainText(
    "демонстрационная схема",
  );
});

test("city selection and favorite removal", async ({ page }) => {
  await openPage(page, "/");
  await page.getByRole("button", { name: "Фильтры", exact: true }).click();
  await page.getByRole("button", { name: /Город, отель или регион/ }).click();
  await page.getByRole("button", { name: "Санкт-Петербург Россия" }).click();
  await page
    .getByRole("button", { name: "Подобрать отели", exact: true })
    .click();
  await expect(page).toHaveURL(/\/my-trip\?/);
  await expect(page.locator(".ov-chat-message.is-assistant")).toHaveCount(1);
  await openCatalogFromTrip(page);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(
    "Отели в Санкт-Петербурге",
  );
  await expect(page.locator(".ov-hotel-card")).toHaveCount(3);
  await page
    .locator(".ov-hotel-card")
    .first()
    .getByRole("button", { name: /В избранное:/ })
    .click();
  await page.getByRole("link", { name: "Избранное: 1" }).click();
  await expect(page.locator(".ov-hotel-card")).toHaveCount(1);
  await page.getByRole("button", { name: /Убрать из избранного:/ }).click();
  await expect(
    page.getByRole("heading", { name: "Здесь будут ваши любимые отели" }),
  ).toBeVisible();
});

test("mobile layout has no horizontal overflow and exposes filters", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  for (const path of [
    "/",
    "/search?city=sochi",
    "/hotel/pullman-sochi-centre",
  ]) {
    await openPage(page, path);
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    ).toBe(true);
  }
  await openPage(page, "/search?city=sochi");
  await page.getByRole("button", { name: "Фильтры", exact: true }).click();
  await page
    .getByRole("dialog")
    .getByRole("checkbox", { name: "Бассейн", exact: true })
    .check();
  await page.getByRole("button", { name: /Показать \d+ вариантов/ }).click();
  await expect(page.getByRole("dialog")).not.toBeVisible();
  await page.screenshot({
    path: "test-results/ostrovok-mobile-search.png",
    fullPage: true,
  });
});

test("representative pages pass accessibility and capture desktop previews", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  for (const [name, path] of [
    ["home", "/"],
    ["search", "/search?city=sochi"],
    ["hotel", "/hotel/pullman-sochi-centre"],
  ]) {
    await page.setViewportSize({ width: 1440, height: 1000 });
    await openPage(page, path);
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    await page.evaluate(() => document.fonts.ready);
    const audit = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa"])
      .analyze();
    await page.screenshot({
      path: `test-results/ostrovok-${name}.png`,
      fullPage: true,
    });
    expect
      .soft(
        audit.violations.map((v) => ({
          id: v.id,
          nodes: v.nodes.map((n) => n.target),
        })),
      )
      .toEqual([]);
  }
  expect(errors).toEqual([]);
});

// Keep the unsupported-property boundary with the storefront regressions.
test("apartment-only inline search is an honest empty catalog and can return to hotels", async ({
  page,
}) => {
  await page.goto("/");
  await expect(page.locator(".ov")).toHaveAttribute("data-hydrated", "true");
  await page.getByRole("button", { name: "Фильтры", exact: true }).click();
  const filters = page.getByRole("region", {
    name: "Фильтры поездки",
    exact: true,
  });
  await filters.getByText("Только квартиры", { exact: true }).click();
  await expect(
    filters.getByRole("switch", { name: "Только квартиры" }),
  ).toBeChecked();
  await page
    .getByRole("button", { name: "Подобрать отели", exact: true })
    .click();
  await expect(page).toHaveURL(/\/my-trip\?/);
  await expect(page).toHaveURL(/property=apartments/);
  await expect(page.locator(".ov-chat-message.is-assistant")).toHaveCount(1);
  await openCatalogFromTrip(page);
  await expect(
    page.getByRole("heading", {
      name: "В каталоге пока нет квартир",
      exact: true,
    }),
  ).toBeVisible();
  await expect(page.locator(".ov-hotel-card")).toHaveCount(0);
  await page
    .getByRole("button", { name: "Показать отели", exact: true })
    .click();
  await expect(page.locator(".ov-hotel-card")).toHaveCount(3);
  await expect(page).not.toHaveURL(/property=apartments/);
});
