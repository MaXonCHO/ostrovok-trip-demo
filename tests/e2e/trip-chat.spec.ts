import { test, expect, type Page } from "@playwright/test";
import { emptyTripChatProfile } from "../../src/features/ostrovok/trip-chat-contract";
import type {
  TripChatReply,
  TripChatRequest,
} from "../../src/features/ostrovok/trip-chat-contract";
import { petersburgCollections } from "../../src/features/ostrovok/petersburg-collections";
import { getHotel } from "../../src/features/ostrovok/catalog";
import { mockTripWeather, weatherReply } from "./trip-chat-mock";

const firstReply: TripChatReply = {
  message: "На какие даты планируете поездку в Петербург?",
  suggestions: ["6–9 ноября", "Даты пока не выбраны"],
  hotelSlugs: [],
  candidateHotelSlugs: [
    "helvetia-saint-petersburg",
    "domina-saint-petersburg",
    "ambassador-saint-petersburg",
  ],
  collectionIds: ["spb-romance", "spb-walks"],
  ready: false,
  stage: "basics",
  profile: {
    ...emptyTripChatProfile(),
    city: "saint-petersburg",
    checkin: null,
    checkout: null,
    tripType: null,
  },
};
const hotelReply: TripChatReply = {
  message: "Подобрал два отеля из каталога для вашей поездки.",
  suggestions: ["Хочу ближе к Неве"],
  hotelSlugs: ["helvetia-saint-petersburg", "domina-saint-petersburg"],
  candidateHotelSlugs: ["helvetia-saint-petersburg", "domina-saint-petersburg"],
  collectionIds: ["spb-walks"],
  ready: true,
  stage: "details",
  profile: {
    ...emptyTripChatProfile(),
    city: "saint-petersburg",
    checkin: "2026-11-06",
    checkout: "2026-11-09",
    tripType: "отдых",
  },
};
const themedReply: TripChatReply = {
  ...firstReply,
  stage: "details",
  profile: {
    ...emptyTripChatProfile(),
    city: "saint-petersburg",
    checkin: "2026-11-06",
    checkout: "2026-11-09",
    budgetFlexible: true,
    adults: 2,
    tripTypeIds: ["spb-romance", "spb-walks"],
    tripType: "Романтика и прогулки",
  },
};

async function interceptChat(
  page: Page,
  answer: (
    request: TripChatRequest,
    index: number,
  ) => TripChatReply | "error" = (request) =>
    request.messages.length === 1 ? firstReply : hotelReply,
) {
  const requests: TripChatRequest[] = [];
  await mockTripWeather(page);
  await page.route("**/api/trip-chat", async (route) => {
    const body = route.request().postDataJSON() as TripChatRequest;
    const index = requests.push(body) - 1;
    const response = answer(body, index);
    await route.fulfill({
      status: response === "error" ? 503 : 200,
      contentType: "application/json",
      body: JSON.stringify(
        response === "error"
          ? { error: "Сервис временно недоступен. Попробуйте ещё раз." }
          : response,
      ),
    });
  });
  return requests;
}
async function openHome(page: Page) {
  await page.goto("/");
  await expect(page.locator(".ov").first()).toHaveAttribute(
    "data-hydrated",
    "true",
  );
}
async function startWish(page: Page, wish = "Хочу в Петербург на выходные") {
  await openHome(page);
  await page.locator("#trip-request").fill(wish);
  await page
    .getByRole("button", { name: "Подобрать отели", exact: true })
    .click();
  await expect(page).toHaveURL(/\/my-trip\?/);
}

async function expectReply(page: Page, message: string) {
  const reply = page.locator(".ov-ai-text").filter({ hasText: message });
  await expect(reply.locator(".ov-sr-only")).toHaveText(message);
  await expect(reply.locator(".ov-ai-text-visible")).toHaveText(message);
  await expect(reply.locator(".ov-ai-text-visible")).toBeVisible();
}

// All API calls are intercepted: no DeepSeek or real microphone is used here.
test("homepage wish starts the dialogue with the parsed context", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  const requests = await interceptChat(page);
  const wish = "Хочу в Петербург с бассейном до 8 тыс";
  await startWish(page, wish);
  await expectReply(page, firstReply.message);
  expect(requests).toHaveLength(1);
  expect(requests[0].context).toMatchObject({
    search: { city: "saint-petersburg", adults: 2, children: 0, rooms: 1 },
    wish,
    amenities: ["Бассейн"],
    maxPrice: 8000,
    apartmentsOnly: false,
    source: "wish",
  });
  expect(requests[0].messages).toEqual([{ role: "user", content: wish }]);
  await expect(
    page
      .getByRole("log", { name: "Сообщения диалога" })
      .getByText(wish, { exact: true }),
  ).toBeVisible();
  await expect(page.locator(".ov-trip-summary-card")).toHaveCount(0);
  await expect(
    page.getByRole("link", { name: "Посмотреть все отели", exact: true }),
  ).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "Новый диалог", exact: true }),
  ).toHaveCount(0);
  await page.screenshot({
    path: "test-results/trip-chat-desktop.png",
    animations: "disabled",
    fullPage: true,
  });
});

test("trip navigation highlights the current page and restores the conversation without another LLM request", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  const requests = await interceptChat(page);
  const wish = "Хочу спокойно отдохнуть в Петербурге";
  await startWish(page, wish);
  await expectReply(page, firstReply.message);
  const navigation = page.getByRole("navigation", {
    name: "Основная навигация",
    exact: true,
  });
  const trip = navigation.getByRole("link", {
    name: "Моя поездка",
    exact: true,
  });
  const home = navigation.getByRole("link", { name: "Отели", exact: true });
  await expect(trip).toHaveAttribute("href", "/my-trip");
  await expect(trip).toHaveAttribute("aria-current", "page");
  await expect(home).toHaveAttribute("href", "/");
  await expect(home).not.toHaveAttribute("aria-current", "page");
  await home.click();
  await expect(page).toHaveURL("/");
  await expect(page.locator("#trip-request")).toBeVisible();
  await expect(home).toHaveAttribute("aria-current", "page");
  await trip.click();
  await expect(page).toHaveURL(/\/my-trip$/);
  await expectReply(page, firstReply.message);
  await expect(
    page
      .getByRole("log", { name: "Сообщения диалога" })
      .getByText(wish, { exact: true }),
  ).toBeVisible();
  expect(requests).toHaveLength(1);
  await expect(trip).toHaveAttribute("aria-current", "page");
});

test("confirmed city changes the backdrop and confirmed dates alone load trip weather", async ({
  page,
}) => {
  const requests = await interceptChat(page);
  const weatherRequests = await mockTripWeather(page);
  await startWish(page, "Петербург, хочу отдохнуть");
  await expectReply(page, firstReply.message);
  expect(weatherRequests).toHaveLength(0);
  await expect(
    page.getByLabel("Погода на даты поездки", { exact: true }),
  ).toHaveCount(0);
  await expect
    .poll(() =>
      page
        .locator(".ov-trip-backdrop")
        .evaluate((element) => getComputedStyle(element).backgroundImage),
    )
    .toContain("/ostrovok/petersburg-background.jpg");
  await page.getByRole("button", { name: "6–9 ноября", exact: true }).click();
  await expectReply(page, hotelReply.message);
  const weather = page.getByLabel("Погода на даты поездки", { exact: true });
  await expect(weather).toBeVisible();
  const badge = weather.locator(".ov-weather-badge");
  const tooltip = page.locator("#trip-weather-details");
  await expect(badge).toContainText("+3…+8°");
  await expect(tooltip).not.toBeVisible();
  await badge.hover();
  await expect(tooltip).toBeVisible();
  await expect(tooltip).toContainText(weatherReply.label);
  await expect(tooltip).toContainText(weatherReply.description);
  await page.mouse.move(5, 5);
  await expect(tooltip).not.toBeVisible();
  await badge.focus();
  await expect(tooltip).toBeVisible();
  await page.getByRole("textbox", { name: "Сообщение", exact: true }).focus();
  await expect(tooltip).not.toBeVisible();
  await badge.click();
  await expect(weather).toHaveAttribute("data-open", "true");
  await expect(tooltip).toBeVisible();
  await expect.poll(() => weatherRequests.length).toBe(1);
  const query = new URL(weatherRequests[0]).searchParams;
  expect(query.get("city")).toBe("saint-petersburg");
  expect(query.get("checkin")).toBe("2026-11-06");
  expect(query.get("checkout")).toBe("2026-11-09");
  expect(requests).toHaveLength(2);
});

test("hotel carousel arrows reflect actual overflow at start, end and after a resize", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await interceptChat(page, () => themedReply);
  await startWish(page, "Петербург на романтические выходные");
  await expectReply(page, themedReply.message);
  const section = page.locator('[data-collection-id="spb-romance"]');
  const track = section.locator(".ov-trip-hotel-track");
  const back = section.getByRole("button", {
    name: "Назад: Петербург для двоих",
    exact: true,
  });
  const next = section.getByRole("button", {
    name: "Дальше: Петербург для двоих",
    exact: true,
  });
  await section.scrollIntoViewIfNeeded();
  await expect(track.locator(".ov-trip-hotel-card")).toHaveCount(3);
  await expect(back).toHaveCount(0);
  await expect(next).toHaveCount(0);
  await page.setViewportSize({ width: 900, height: 900 });
  await expect(next).toBeVisible();
  await expect(back).toHaveCount(0);
  await next.click();
  await expect
    .poll(() => track.evaluate((element) => element.scrollLeft))
    .toBeGreaterThan(0);
  await expect(back).toBeVisible();
  await track.evaluate((element) =>
    element.scrollTo({ left: element.scrollWidth, behavior: "instant" }),
  );
  await expect(next).toHaveCount(0);
  await expect(back).toBeVisible();
  const end = await track.evaluate((element) => element.scrollLeft);
  await back.click();
  await expect
    .poll(() => track.evaluate((element) => element.scrollLeft))
    .toBeLessThan(end);
  await expect(next).toBeVisible();
  await page.setViewportSize({ width: 1440, height: 900 });
  await expect(back).toHaveCount(0);
  await expect(next).toHaveCount(0);
  await expect
    .poll(() => track.evaluate((element) => element.scrollLeft))
    .toBe(0);
});

test("composer and user bubbles stay compact and the footer remains above the page backdrop", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await interceptChat(page);
  await startWish(page, "Петербург на выходные");
  await expectReply(page, firstReply.message);
  const composer = page.getByRole("textbox", {
    name: "Сообщение",
    exact: true,
  });
  await expect(composer).toHaveAttribute("rows", "1");
  const input = await composer.evaluate((element) => ({
    height: element.getBoundingClientRect().height,
    width: element.getBoundingClientRect().width,
  }));
  expect(input.height).toBeGreaterThanOrEqual(47);
  expect(input.height).toBeLessThanOrEqual(49);
  expect(input.width).toBeGreaterThan(300);
  const user = await page
    .locator(".ov-chat-message.is-user")
    .first()
    .evaluate((element) => {
      const style = getComputedStyle(element);
      return {
        top: style.paddingTop,
        bottom: style.paddingBottom,
        left: style.paddingLeft,
        right: style.paddingRight,
        font: getComputedStyle(element.querySelector("p")!).fontSize,
      };
    });
  expect(user).toEqual({
    top: "10px",
    bottom: "10px",
    left: "14px",
    right: "14px",
    font: "16px",
  });
  const footer = page.getByRole("contentinfo");
  await footer.scrollIntoViewIfNeeded();
  await expect(footer).toBeInViewport();
  const uncovered = await footer.evaluate((element) => {
    const bounds = element.getBoundingClientRect();
    const y =
      (Math.max(0, bounds.top) + Math.min(innerHeight, bounds.bottom)) / 2;
    return !!document.elementFromPoint(innerWidth / 2, y)?.closest("footer");
  });
  expect(uncovered).toBe(true);
});

test("inline filters carry selected dates, guests and property into the dialogue", async ({
  page,
}) => {
  const requests = await interceptChat(page);
  await openHome(page);
  await page.getByRole("button", { name: "Фильтры", exact: true }).click();
  const filters = page.getByRole("region", {
    name: "Фильтры поездки",
    exact: true,
  });
  await filters
    .getByRole("button", { name: /Город, отель или регион/ })
    .click();
  await filters
    .getByRole("button", { name: "Санкт-Петербург Россия", exact: true })
    .click();
  await filters.getByRole("button", { name: /Заезд — выезд/ }).click();
  await filters
    .getByRole("button", { name: "10 ноября 2026 г.", exact: true })
    .click();
  await filters
    .getByRole("button", { name: "14 ноября 2026 г.", exact: true })
    .click();
  await filters.getByRole("button", { name: "Готово", exact: true }).click();
  await filters
    .getByRole("button", { name: "1 номер 2 гостя", exact: true })
    .click();
  await filters
    .getByRole("button", { name: "Увеличить: Взрослые", exact: true })
    .click();
  await filters
    .getByRole("button", { name: "Увеличить: Дети", exact: true })
    .click();
  await filters
    .getByRole("button", { name: "Увеличить: Номера", exact: true })
    .click();
  await filters.getByRole("button", { name: "Готово", exact: true }).click();
  await filters.getByText("Только квартиры", { exact: true }).click();
  await page
    .getByRole("button", { name: "Подобрать отели", exact: true })
    .click();
  await expect(page).toHaveURL(/\/my-trip\?/);
  await expectReply(page, firstReply.message);
  expect(requests).toHaveLength(1);
  expect(requests[0].context).toMatchObject({
    search: {
      city: "saint-petersburg",
      checkin: "2026-11-10",
      checkout: "2026-11-14",
      adults: 3,
      children: 1,
      rooms: 2,
    },
    wish: "",
    apartmentsOnly: true,
    source: "filters",
  });
  expect(requests[0].messages.at(-1)?.role).toBe("user");
  expect(requests[0].messages.at(-1)?.content.trim().length).toBeGreaterThan(0);
});

test("reply and suggestion narrow themed hotel carousels and preserve the dialogue", async ({
  page,
}) => {
  const requests = await interceptChat(page, (request) =>
    request.messages.length === 1 ? themedReply : hotelReply,
  );
  const wish = "Хочу в Петербург на выходные";
  await startWish(page, wish);
  const collections = page.locator(".ov-trip-collections");
  await expect(collections).toHaveAttribute(
    "aria-label",
    "Подборки по вашему запросу",
  );
  await expect(collections.locator(".ov-trip-collection")).toHaveCount(2);
  for (const id of firstReply.collectionIds) {
    const collection = petersburgCollections.find((item) => item.id === id)!;
    const section = collections.locator(`[data-collection-id="${id}"]`);
    await expect(
      section.getByRole("heading", { name: collection.title, exact: true }),
    ).toBeVisible();
    await expect(section).toContainText(collection.description);
    await expect(section.locator(".ov-trip-hotel-card")).toHaveCount(3);
    for (const slug of firstReply.candidateHotelSlugs) {
      const hotel = getHotel(slug)!;
      const card = section.locator(
        `.ov-trip-hotel-card[href*="/hotel/${slug}?"]`,
      );
      await expect(card).toContainText(hotel.name);
      await expect(card.locator("img")).toHaveAttribute("src", hotel.photos[0]);
    }
  }
  await page.getByRole("button", { name: "6–9 ноября", exact: true }).click();
  await expectReply(page, hotelReply.message);
  await expect(collections.locator(".ov-trip-collection")).toHaveCount(1);
  await expect(
    collections.getByRole("heading", {
      name: "Прогулки по Петербургу",
      exact: true,
    }),
  ).toBeVisible();
  await expect(
    collections.getByRole("heading", {
      name: "Петербург для двоих",
      exact: true,
    }),
  ).toHaveCount(0);
  await expect(collections.locator(".ov-trip-hotel-card")).toHaveCount(2);
  await expect(
    collections.locator(
      '.ov-trip-hotel-card[href*="ambassador-saint-petersburg"]',
    ),
  ).toHaveCount(0);
  expect(requests).toHaveLength(2);
  expect(requests[1].messages).toEqual([
    { role: "user", content: wish },
    { role: "assistant", content: firstReply.message },
    { role: "user", content: "6–9 ноября" },
  ]);
  expect(requests[1].context).toEqual(requests[0].context);
  await expect(
    page
      .locator(".ov-trip-collections")
      .getByRole("link", { name: /Отель «Гельвеция»/ })
      .first(),
  ).toBeVisible();
  await expect(
    page
      .locator(".ov-trip-collections")
      .getByRole("link", { name: /Domina St. Petersburg/ })
      .first(),
  ).toBeVisible();
  await page
    .getByRole("textbox", { name: "Сообщение", exact: true })
    .fill("Хочу ближе к Неве");
  await page.getByRole("button", { name: "Отправить", exact: true }).click();
  await expect.poll(() => requests.length).toBe(3);
  expect(requests[2].messages.at(-1)).toEqual({
    role: "user",
    content: "Хочу ближе к Неве",
  });
  expect(
    requests[2].messages.filter((message) => message.role === "user"),
  ).toHaveLength(3);
});

test("basics lead to multiple trip-type cards before extra questions and themed hotel carousels", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.emulateMedia({ reducedMotion: "reduce" });
  const withDates = {
    ...emptyTripChatProfile(),
    city: "saint-petersburg" as const,
    checkin: "2026-11-06",
    checkout: "2026-11-09",
  };
  const withBudget = { ...withDates, budgetMax: 10000 };
  const basics = { ...withBudget, adults: 2 };
  const candidates = ["domina-saint-petersburg", "ambassador-saint-petersburg"];
  const answers: TripChatReply[] = [
    firstReply,
    {
      ...firstReply,
      message: "Какой бюджет за номер за ночь рассматриваете?",
      suggestions: ["До 10 000 ₽ за ночь", "Бюджет не ограничен"],
      profile: withDates,
    },
    {
      ...firstReply,
      message: "Сколько взрослых поедет?",
      suggestions: ["Двое взрослых", "Еду один"],
      profile: withBudget,
      candidateHotelSlugs: candidates,
    },
    {
      ...firstReply,
      message: "Выберите, какой отдых вам ближе.",
      suggestions: [],
      stage: "trip-types",
      profile: basics,
      candidateHotelSlugs: candidates,
    },
    {
      ...firstReply,
      message: "Для романтики и прогулок уточним, что особенно важно в отеле?",
      suggestions: ["Хочется тишины"],
      stage: "details",
      profile: {
        ...basics,
        tripTypeIds: ["spb-romance", "spb-walks"],
        tripType: "Романтика и прогулки",
      },
      candidateHotelSlugs: candidates,
    },
  ];
  const requests = await interceptChat(
    page,
    (_, index) => answers[index] ?? answers.at(-1)!,
  );
  await startWish(page, "Хочу отдохнуть в Петербурге");
  await expectReply(page, answers[0].message);
  await expect(
    page.getByRole("region", { name: "Тип отдыха", exact: true }),
  ).toHaveCount(0);
  const collections = page.getByRole("region", {
    name: "Подборки по вашему запросу",
    exact: true,
  });
  await expect(collections).toBeVisible();
  await expect(collections.locator(".ov-trip-collection")).toHaveCount(2);
  await expect(collections.locator(".ov-trip-hotel-card")).toHaveCount(6);
  await page.getByRole("button", { name: "6–9 ноября", exact: true }).click();
  await expectReply(page, answers[1].message);
  await page
    .getByRole("button", { name: "До 10 000 ₽ за ночь", exact: true })
    .click();
  await expectReply(page, answers[2].message);
  await page
    .getByRole("button", { name: "Двое взрослых", exact: true })
    .click();
  await expectReply(page, answers[3].message);
  const types = page.getByRole("region", { name: "Тип отдыха", exact: true });
  await expect(types).toBeVisible();
  await expect(types.locator(".ov-trip-type-card")).toHaveCount(8);
  await expect(collections.locator(".ov-trip-collection")).toHaveCount(2);
  await expect(collections.locator(".ov-trip-hotel-card")).toHaveCount(4);
  for (const width of [1440, 320]) {
    await page.setViewportSize({ width, height: width === 1440 ? 900 : 568 });
    for (const image of await types.locator("img").all()) {
      await image.scrollIntoViewIfNeeded();
      await expect
        .poll(() =>
          image.evaluate(
            (element) =>
              element instanceof HTMLImageElement &&
              element.complete &&
              element.naturalWidth > 0,
          ),
        )
        .toBe(true);
    }
    await types
      .getByRole("heading", { name: "Какой отдых вам ближе?", exact: true })
      .scrollIntoViewIfNeeded();
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth),
    ).toBeLessThanOrEqual(width);
    // Chrome full-element captures can paint fixed offscreen skip links in the
    // expanded clip. Keep the keyboard-focused link visible in screenshots.
    const captureStyle =
      ".skip-link:not(:focus-visible){visibility:hidden!important}";
    await page.screenshot({
      path: `test-results/trip-types-viewport-${width}.png`,
      animations: "disabled",
      style: captureStyle,
    });
    await types.screenshot({
      style: captureStyle,
      path: `test-results/trip-types-${width}.png`,
      animations: "disabled",
    });
    await page.locator(".ov-storefront-footer").screenshot({
      path: `test-results/trip-footer-${width}.png`,
      style: captureStyle,
      animations: "disabled",
    });
  }
  await page.setViewportSize({ width: 1440, height: 900 });
  await types.scrollIntoViewIfNeeded();
  const next = types.getByRole("button", { name: "Продолжить", exact: true });
  await expect(next).toBeDisabled();
  const romance = types.locator('[data-type-id="spb-romance"]');
  const walks = types.locator('[data-type-id="spb-walks"]');
  const food = types.locator('[data-type-id="spb-food"]');
  await romance.click();
  await walks.click();
  await food.click();
  await food.click();
  await expect(romance).toHaveAttribute("aria-pressed", "true");
  await expect(walks).toHaveAttribute("aria-pressed", "true");
  await expect(food).toHaveAttribute("aria-pressed", "false");
  await expect(types.locator(".ov-trip-types-count")).toHaveText("Выбрано: 2");
  await expect(next).toBeEnabled();
  expect(requests).toHaveLength(4);
  await next.click();
  await expectReply(page, answers[4].message);
  await expect(types).toHaveCount(0);
  await expect(page.locator(".ov-trip-collection")).toHaveCount(2);
  await expect(page.locator(".ov-trip-hotel-card")).toHaveCount(4);
  expect(requests).toHaveLength(5);
  expect(requests[4].messages.at(-1)).toEqual({
    role: "user",
    content: "Выбираю тип отдыха: Петербург для двоих, Прогулки по Петербургу.",
  });
  await page.reload();
  await expectReply(page, answers[4].message);
  expect(requests).toHaveLength(5);
  await expect(page.locator(".ov-trip-collection")).toHaveCount(2);
});

test("composer keeps its vertical position after long answers and three versus one suggestions", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.emulateMedia({ reducedMotion: "reduce" });
  const first =
    "Первый длинный ответ. " +
    "В Петербурге можно сочетать прогулки, музеи и отдых, а детали поездки уточнять постепенно. ".repeat(
      13,
    );
  const second =
    "Второй длинный ответ. " +
    "Точные даты можно выбрать позже; сейчас продолжим с основными пожеланиями, сохранив уже известные ответы. ".repeat(
      13,
    );
  await interceptChat(page, (_, index) => ({
    ...firstReply,
    message: index === 0 ? first : second,
    suggestions:
      index === 0
        ? ["Даты пока не выбраны", "6–9 ноября", "На следующих выходных"]
        : ["Бюджет не ограничен"],
  }));
  await startWish(page, "Хочу спокойно отдохнуть в Петербурге");
  await expectReply(page, first);
  const composer = page.locator(".ov-chat-composer");
  const suggestions = page.locator(".ov-chat-suggestions");
  await expect(suggestions.getByRole("button")).toHaveCount(3);
  const before = await composer.boundingBox();
  expect(before).not.toBeNull();
  await page
    .getByRole("button", { name: "Даты пока не выбраны", exact: true })
    .click();
  await expectReply(page, second);
  await expect(suggestions.getByRole("button")).toHaveCount(1);
  const after = await composer.boundingBox();
  expect(after).not.toBeNull();
  expect(after!.y).toBeCloseTo(before!.y, 0);
  const log = await page
    .getByRole("log", { name: "Сообщения диалога" })
    .evaluate((element) => ({
      height: element.clientHeight,
      total: element.scrollHeight,
      overflow: getComputedStyle(element).overflowY,
    }));
  expect(log.total).toBeGreaterThan(log.height);
  expect(log.overflow).toBe("auto");
  await expect(
    page.getByRole("button", { name: "Отправить", exact: true }),
  ).toBeInViewport();
  await expect(
    page.getByRole("textbox", { name: "Сообщение", exact: true }),
  ).toBeInViewport();
});

test("failed request can be retried without duplicating the user message", async ({
  page,
}) => {
  const requests = await interceptChat(page, (_, index) =>
    index === 0 ? "error" : firstReply,
  );
  const wish = "Хочу в Петербург на выходные";
  await startWish(page, wish);
  await expect(
    page.getByRole("log", { name: "Сообщения диалога" }).getByRole("alert"),
  ).toContainText("Сервис временно недоступен");
  await page.getByRole("button", { name: /Повторить/, exact: false }).click();
  await expectReply(page, firstReply.message);
  expect(requests).toHaveLength(2);
  expect(requests[1]).toEqual(requests[0]);
  await expect(
    page
      .getByRole("log", { name: "Сообщения диалога" })
      .getByText(wish, { exact: true }),
  ).toHaveCount(1);
  await expect(
    page.getByRole("log", { name: "Сообщения диалога" }).getByRole("alert"),
  ).toHaveCount(0);
});

test("mobile dialogue survives refresh and keeps composer and hotel links usable", async ({
  page,
}) => {
  const requests = await interceptChat(page);
  for (const [width, height] of [
    [390, 844],
    [320, 568],
  ]) {
    await page.setViewportSize({ width, height });
    await startWish(page, `Хочу в Петербург на выходные ${width}`);
    await expectReply(page, firstReply.message);
    await page.getByRole("button", { name: "6–9 ноября", exact: true }).click();
    await expectReply(page, hotelReply.message);
    const beforeRefresh = requests.length;
    await page.reload();
    await expectReply(page, hotelReply.message);
    await expect(
      page
        .getByRole("log", { name: "Сообщения диалога" })
        .getByText(`Хочу в Петербург на выходные ${width}`, { exact: true }),
    ).toBeVisible();
    expect(requests).toHaveLength(beforeRefresh);
    const background = await page
      .locator(".ov-trip-backdrop")
      .evaluate((element) => ({
        image: getComputedStyle(element).backgroundImage,
        position: getComputedStyle(element).position,
        top: element.getBoundingClientRect().top,
        height: element.getBoundingClientRect().height,
      }));
    expect(background.image).toContain("/ostrovok/petersburg-background.jpg");
    expect(background.position).toBe("fixed");
    expect(background.top).toBe(0);
    expect(background.height).toBe(height);
    await page.evaluate(() =>
      window.scrollTo({ top: 200, behavior: "instant" }),
    );
    expect(
      await page
        .locator(".ov-trip-backdrop")
        .evaluate((element) => element.getBoundingClientRect().top),
    ).toBe(0);
    await page.screenshot({
      path: `test-results/trip-chat-background-${width}.png`,
      animations: "disabled",
    });
    const collections = page.locator(".ov-trip-collections");
    const curtain = await collections.evaluate((element) => ({
      background: getComputedStyle(element).backgroundColor,
      radius: parseFloat(getComputedStyle(element).borderTopLeftRadius),
    }));
    expect(curtain.background).toBe("rgb(255, 255, 255)");
    expect(curtain.radius).toBeGreaterThanOrEqual(24);
    const track = collections.locator(".ov-trip-hotel-track").first();
    await track.scrollIntoViewIfNeeded();
    const scroll = await track.evaluate((element) => ({
      client: element.clientWidth,
      total: element.scrollWidth,
      overflow: getComputedStyle(element).overflowX,
    }));
    expect(scroll.total).toBeGreaterThan(scroll.client);
    expect(scroll.overflow).toBe("auto");
    await track.evaluate((element) => {
      element.scrollLeft = element.scrollWidth;
    });
    await expect(track.locator(".ov-trip-hotel-card").last()).toBeInViewport();
    expect(
      await track.evaluate((element) => element.scrollLeft),
    ).toBeGreaterThan(0);
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth),
    ).toBeLessThanOrEqual(width);
    await expect(
      page.getByRole("textbox", { name: "Сообщение", exact: true }),
    ).toBeEditable();
    await page.screenshot({
      path: `test-results/trip-chat-${width}.png`,
      animations: "disabled",
      fullPage: true,
    });
    await page
      .locator(".ov-trip-collections")
      .getByRole("link", { name: /Отель «Гельвеция»/ })
      .first()
      .click();
    await expect(page).toHaveURL(/\/hotel\/helvetia-saint-petersburg\?/);
    await expect(
      page.getByRole("heading", { level: 1, name: "Отель «Гельвеция»" }),
    ).toBeVisible();
  }
});

test("new assistant reply types letters while its complete text is accessible and refresh does not replay it", async ({
  page,
}) => {
  const message =
    "Для спокойных выходных в Санкт-Петербурге можно выбрать прогулки по набережным, небольшие музеи и уютные кафе. Уточните, пожалуйста, что из этого вам ближе и сколько времени вы хотите провести в городе.";
  const requests = await interceptChat(page, () => ({
    ...firstReply,
    message,
  }));
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await startWish(page, "Хочу спокойно погулять по Петербургу");
  const reply = page.locator(".ov-ai-text").last();
  await expect(reply).toHaveAttribute("data-typing", "true");
  await expect(reply.locator(".ov-sr-only")).toHaveText(message);
  await expect(reply.locator(".ov-ai-text-space")).toHaveAttribute(
    "aria-hidden",
    "true",
  );
  expect((await reply.ariaSnapshot()).split(message)).toHaveLength(2);
  const visual = reply.locator(".ov-ai-text-visible");
  await expect(visual).toHaveAttribute("aria-hidden", "true");
  const prefix = await visual.innerText();
  expect(message.startsWith(prefix)).toBe(true);
  expect(prefix.length).toBeLessThan(message.length);
  await expect
    .poll(async () => (await visual.innerText()).length)
    .toBeGreaterThan(prefix.length);
  await expect(visual).toHaveText(message, { timeout: 10000 });
  await expect(reply).toHaveAttribute("data-typing", "false");
  const surfaces = await page.locator(".ov-chat").evaluate((chat) => ({
    chat: getComputedStyle(chat).backgroundColor,
    assistant: getComputedStyle(chat.querySelector(".is-assistant")!)
      .backgroundColor,
    user: getComputedStyle(chat.querySelector(".is-user")!).backgroundColor,
  }));
  expect(surfaces.chat).toBe("rgba(0, 0, 0, 0)");
  expect(surfaces.assistant).toBe("rgba(0, 0, 0, 0)");
  expect(surfaces.user).not.toBe("rgba(0, 0, 0, 0)");
  await page.reload();
  await expectReply(page, message);
  await expect(page.locator(".ov-ai-text")).toHaveAttribute(
    "data-typing",
    "false",
  );
  expect(requests).toHaveLength(1);

  await page.emulateMedia({ reducedMotion: "reduce" });
  await startWish(page, "Петербург без анимации");
  await expectReply(page, message);
  await expect(page.locator(".ov-ai-text")).toHaveAttribute(
    "data-typing",
    "false",
  );
  expect(requests).toHaveLength(2);
});

test("homepage-to-dialogue navigation works with native view transitions and without the API", async ({
  context,
}) => {
  for (const native of [true, false]) {
    const page = await context.newPage();
    await page.emulateMedia({ reducedMotion: "no-preference" });
    const requests = await interceptChat(page);
    await page.addInitScript((native) => {
      const original = document.startViewTransition?.bind(document);
      const state = { supported: !!original, calls: 0 };
      Object.defineProperty(window, "__tripTransition", { value: state });
      Object.defineProperty(document, "startViewTransition", {
        configurable: true,
        value:
          native && original
            ? new Proxy(original, {
                apply(target, thisArg, args) {
                  state.calls++;
                  return Reflect.apply(target, thisArg, args);
                },
              })
            : undefined,
      });
    }, native);
    await startWish(
      page,
      `Хочу в Петербург ${native ? "с переходом" : "без API переходов"}`,
    );
    await expectReply(page, firstReply.message);
    expect(requests).toHaveLength(1);
    const transition = await page.evaluate(
      () =>
        Reflect.get(window, "__tripTransition") as {
          supported: boolean;
          calls: number;
        },
    );
    if (native) {
      expect(transition.supported).toBe(true);
      expect(transition.calls).toBe(1);
    } else expect(transition.calls).toBe(0);
    await expect(
      page.getByRole("textbox", { name: "Сообщение", exact: true }),
    ).toBeEditable();
    await page.close();
  }
});

test("hotel collections preview survives initial loading and empty recommendation IDs without inventing candidates", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await mockTripWeather(page);
  let release!: () => void;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.route("**/api/trip-chat", async (route) => {
    await gate;
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        ...firstReply,
        candidateHotelSlugs: [],
        collectionIds: [],
      }),
    });
  });
  await startWish(page, "Хочу в Петербург");
  const collections = page.getByRole("region", {
    name: "Подборки по вашему запросу",
    exact: true,
  });
  await expect(page.locator(".ov-chat-loading")).toBeVisible();
  await expect(collections).toBeVisible();
  await expect(collections.locator(".ov-trip-collection")).toHaveCount(2);
  await expect(collections.locator(".ov-trip-hotel-card")).toHaveCount(6);
  release();
  await expectReply(page, firstReply.message);
  await expect(collections).toBeVisible();
  await expect(collections.locator(".ov-trip-collection")).toHaveCount(2);
  await expect(collections.locator(".ov-trip-hotel-card")).toHaveCount(0);
});
