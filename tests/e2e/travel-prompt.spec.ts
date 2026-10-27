import { test, expect, type Page } from "@playwright/test";
import { mkdir, writeFile } from "node:fs/promises";
import { mockTripChat } from "./trip-chat-mock";

test.beforeEach(async ({ page }) => {
  await mockTripChat(page);
});

async function openHome(page: Page) {
  await page.goto("/");
  await expect(page.locator(".ov").first()).toHaveAttribute(
    "data-hydrated",
    "true",
  );
}
function submit(page: Page) {
  return page.locator(".ov-prompt-submit");
}
async function mockSpeech(page: Page, supported = true) {
  await page.addInitScript((supported) => {
    if (!supported) {
      Object.defineProperty(window, "SpeechRecognition", {
        configurable: true,
        value: undefined,
      });
      Object.defineProperty(window, "webkitSpeechRecognition", {
        configurable: true,
        value: undefined,
      });
      return;
    }
    const state = {
      starts: 0,
      stops: 0,
      aborts: 0,
      constructed: 0,
      lang: "",
      active: null as RecognitionMock | null,
    };
    class RecognitionMock {
      lang = "";
      continuous = false;
      interimResults = false;
      onstart: (() => void) | null = null;
      onend: (() => void) | null = null;
      onresult:
        | ((event: { results: Array<Array<{ transcript: string }>> }) => void)
        | null = null;
      onerror: ((event: { error: string }) => void) | null = null;
      constructor() {
        state.constructed++;
        state.active = this;
      }
      start() {
        state.starts++;
        state.lang = this.lang;
        this.onstart?.();
      }
      stop() {
        state.stops++;
        this.onend?.();
      }
      abort() {
        state.aborts++;
        this.onend?.();
      }
    }
    Object.defineProperty(window, "SpeechRecognition", {
      configurable: true,
      value: RecognitionMock,
    });
    Object.defineProperty(window, "webkitSpeechRecognition", {
      configurable: true,
      value: undefined,
    });
    Object.defineProperty(window, "__mockSpeech", {
      configurable: true,
      value: {
        stats: () => ({
          starts: state.starts,
          stops: state.stops,
          aborts: state.aborts,
          constructed: state.constructed,
          lang: state.lang,
        }),
        result: (text: string) =>
          state.active?.onresult?.({ results: [[{ transcript: text }]] }),
        fail: (error: string) => state.active?.onerror?.({ error }),
      },
    });
  }, supported);
}
type SpeechTestWindow = Window & {
  __mockSpeech: {
    stats(): {
      starts: number;
      stops: number;
      aborts: number;
      constructed: number;
      lang: string;
    };
    result(text: string): void;
    fail(error: string): void;
  };
};

test("typed wishes map to city, amenity and budget without becoming a hotel-name query", async ({
  page,
}) => {
  await openHome(page);
  const text = "Хочу в Петербург с бассейном до 8 тыс";
  await page.locator("#trip-request").fill(text);
  await submit(page).click();
  await expect(page).toHaveURL(/\/my-trip\?/);
  const params = new URL(page.url()).searchParams;
  expect(params.get("city")).toBe("saint-petersburg");
  expect(params.get("amenities")).toBe("Бассейн");
  expect(params.get("maxPrice")).toBe("8000");
  expect(params.get("wish")).toBe(text);
  expect(params.has("q")).toBe(false);
  expect(params.get("source")).toBe("wish");
});

test("inline filters persist changes, return focus and preserve explicit trip parameters", async ({
  page,
}) => {
  await openHome(page);
  await page
    .locator("#trip-request")
    .fill("Хочу в Петербург с бассейном до 8 тыс");
  const filters = page.getByRole("button", { name: "Фильтры", exact: true });
  await filters.click();
  const panel = page.getByRole("region", {
    name: "Фильтры поездки",
    exact: true,
  });
  await panel.getByRole("button", { name: /Город, отель или регион/ }).click();
  await panel
    .getByRole("button", { name: "Санкт-Петербург Россия", exact: true })
    .click();
  await panel.getByRole("button", { name: /Заезд — выезд/ }).click();
  await panel
    .getByRole("button", { name: "10 ноября 2026 г.", exact: true })
    .click();
  await panel
    .getByRole("button", { name: "14 ноября 2026 г.", exact: true })
    .click();
  await panel.getByRole("button", { name: "Готово", exact: true }).click();
  await panel.getByRole("button", { name: "1 номер 2 гостя" }).click();
  await panel.getByRole("button", { name: "Увеличить: Взрослые" }).click();
  await panel.getByRole("button", { name: "Увеличить: Дети" }).click();
  await panel.getByRole("button", { name: "Увеличить: Номера" }).click();
  await panel.getByRole("button", { name: "Готово", exact: true }).click();
  await page.getByRole("button", { name: "К пожеланиям", exact: true }).click();
  await expect(panel).not.toBeVisible();
  await expect(page.locator("#trip-request")).toBeFocused();
  await expect(page.locator("#trip-request")).toHaveValue(
    "Хочу в Петербург с бассейном до 8 тыс",
  );
  await expect(page.locator(".ov-prompt-summary")).toHaveCount(0);
  await filters.click();
  await expect(panel.locator(".ov-destination strong")).toContainText(
    "Санкт-Петербург",
  );
  await expect(panel.locator(".ov-original-date").first()).toContainText(
    "10 нояб. 2026",
  );
  await expect(panel.locator(".ov-original-date").last()).toContainText(
    "14 нояб. 2026",
  );
  await expect(panel.locator(".ov-guests")).toContainText("2 номера для");
  await expect(panel.locator(".ov-guests")).toContainText("4 гостя");
  await submit(page).click();
  await expect(page).toHaveURL(/\/my-trip\?/);
  await expect(page).toHaveURL(/city=saint-petersburg/);
  const params = new URL(page.url()).searchParams;
  expect(params.get("adults")).toBe("3");
  expect(params.get("children")).toBe("1");
  expect(params.get("rooms")).toBe("2");
  expect(params.get("checkin")).toBe("2026-11-10");
  expect(params.get("checkout")).toBe("2026-11-14");
  expect(params.has("q")).toBe(false);
  expect(params.get("source")).toBe("filters");
});

test("speech starts only after a click, uses Russian and returns to idle on stop or denial", async ({
  page,
}) => {
  await mockSpeech(page);
  await openHome(page);
  const input = page.locator("#trip-request");
  await input.fill("Хочу");
  expect(
    await page.evaluate(() =>
      (window as unknown as SpeechTestWindow).__mockSpeech.stats(),
    ),
  ).toEqual({ starts: 0, stops: 0, aborts: 0, constructed: 0, lang: "" });
  await page
    .getByRole("button", { name: "Ввести голосом", exact: true })
    .click();
  await expect(
    page.getByRole("button", {
      name: "Остановить голосовой ввод",
      exact: true,
    }),
  ).toBeVisible();
  await expect(input).toHaveAttribute("readonly", "");
  await expect(submit(page)).toBeDisabled();
  expect(
    await page.evaluate(
      () => (window as unknown as SpeechTestWindow).__mockSpeech.stats().lang,
    ),
  ).toBe("ru-RU");
  await page.evaluate(() =>
    (window as unknown as SpeechTestWindow).__mockSpeech.result(
      "в Петербург с бассейном",
    ),
  );
  await expect(input).toHaveValue("Хочу в Петербург с бассейном");
  await page
    .getByRole("button", { name: "Остановить голосовой ввод", exact: true })
    .click();
  await expect(input).toBeEditable();
  await expect(submit(page)).toBeEnabled();
  expect(
    await page.evaluate(
      () => (window as unknown as SpeechTestWindow).__mockSpeech.stats().stops,
    ),
  ).toBe(1);
  await page
    .getByRole("button", { name: "Ввести голосом", exact: true })
    .click();
  await page.evaluate(() =>
    (window as unknown as SpeechTestWindow).__mockSpeech.fail("not-allowed"),
  );
  await expect(page.locator("#voice-status")).toContainText(
    "Доступ к микрофону не разрешён",
  );
  await expect(input).toBeEditable();
  await expect(submit(page)).toBeEnabled();
  const stats = await page.evaluate(() =>
    (window as unknown as SpeechTestWindow).__mockSpeech.stats(),
  );
  expect(stats.starts).toBe(2);
  expect(stats.aborts).toBe(1);
  await input.fill("Продолжу текстом");
  await expect(page.locator("#voice-status")).toBeEmpty();
});

test("unsupported speech keeps text entry available and never asks for real audio", async ({
  page,
}) => {
  await mockSpeech(page, false);
  await openHome(page);
  await expect(page.locator("#voice-status")).toBeEmpty();
  await page
    .getByRole("button", { name: "Ввести голосом", exact: true })
    .click();
  await expect(page.locator("#voice-status")).toContainText(
    "не поддерживает голосовой ввод",
  );
  await expect(page.locator("#trip-request")).toBeEditable();
  await page.locator("#trip-request").fill("Петербург");
  await expect(submit(page)).toBeEnabled();
});

test("hero controls fit a single viewport and closing CTA focuses the request", async ({
  page,
}) => {
  await mkdir("test-results", { recursive: true });
  const measurements: unknown[] = [];
  for (const [width, height] of [
    [1440, 900],
    [390, 844],
    [320, 568],
  ]) {
    await page.setViewportSize({ width, height });
    await openHome(page);
    await page.evaluate(() => document.fonts.ready);
    const report = await page.evaluate(() => {
      const selectors = [
        ".ov-hero h1",
        "#trip-request",
        ".ov-prompt-filters",
        ".ov-prompt-submit",
      ];
      return {
        width: innerWidth,
        height: innerHeight,
        documentWidth: document.documentElement.scrollWidth,
        heroHeight: document.querySelector(".ov-hero")!.getBoundingClientRect()
          .height,
        controls: selectors.map((selector) => {
          const element = document.querySelector(selector)!,
            r = element.getBoundingClientRect();
          return {
            selector,
            left: r.left,
            right: r.right,
            top: r.top,
            bottom: r.bottom,
          };
        }),
      };
    });
    measurements.push(report);
    expect(report.documentWidth).toBeLessThanOrEqual(width);
    expect(report.heroHeight).toBeLessThanOrEqual(height + 1);
    for (const control of report.controls) {
      expect(control.top, control.selector).toBeGreaterThanOrEqual(0);
      expect(control.bottom, control.selector).toBeLessThanOrEqual(height);
      expect(control.left, control.selector).toBeGreaterThanOrEqual(0);
      expect(control.right, control.selector).toBeLessThanOrEqual(width);
    }
    await expect(page.locator("#trip-request")).toHaveAttribute("type", "text");
    await page.screenshot({
      path: `test-results/travel-prompt-hero-${width}.png`,
    });
    await page.mouse.move(width / 2, height / 2);
    await page.mouse.wheel(0, 280);
    await expect
      .poll(() => page.evaluate(() => window.scrollY))
      .toBeGreaterThan(0);
    await page.getByRole("button", { name: "Фильтры", exact: true }).click();
    await expect(page.locator(".ov-inline-filters")).toBeVisible();
    await expect(page.locator("#trip-request")).not.toBeVisible();
    expect(
      await page.evaluate(() =>
        document.body.hasAttribute("data-scroll-locked"),
      ),
    ).toBe(false);
    const cta = page.getByRole("button", {
      name: "Начать мою поездку",
      exact: true,
    });
    await cta.scrollIntoViewIfNeeded();
    await page
      .locator(".ov-final-cta")
      .screenshot({ path: `test-results/travel-prompt-footer-${width}.png` });
    await cta.click();
    await expect(page.locator("#trip-request")).toBeFocused();
    await expect(page.locator("#trip-request")).toBeInViewport();
  }
  await writeFile(
    "test-results/travel-prompt-layout.json",
    JSON.stringify(measurements, null, 2),
  );
});

test("mobile filter city, dates and guests remain reachable without horizontal clipping", async ({
  page,
}) => {
  await page.setViewportSize({ width: 320, height: 568 });
  await openHome(page);
  await page.getByRole("button", { name: "Фильтры", exact: true }).click();
  const panel = page.getByRole("region", {
    name: "Фильтры поездки",
    exact: true,
  });
  for (const [name, selector] of [
    [/Город, отель или регион/, ".ov-city-popover"],
    [/Заезд — выезд/, ".ov-calendar"],
    ["1 номер 2 гостя", ".ov-guests-popover"],
  ] as const) {
    await panel.getByRole("button", { name }).click();
    const popup = panel.locator(selector);
    await expect(popup).toBeVisible();
    const bounds = await popup.evaluate((el) => {
      const r = el.getBoundingClientRect();
      return {
        left: r.left,
        right: r.right,
      };
    });
    expect(bounds.left).toBeGreaterThanOrEqual(0);
    expect(bounds.right).toBeLessThanOrEqual(320);
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth),
    ).toBeLessThanOrEqual(320);
    if (selector === ".ov-city-popover")
      await panel
        .getByRole("button", { name: "Санкт-Петербург Россия", exact: true })
        .click();
    else
      await popup.getByRole("button", { name: "Готово", exact: true }).click();
  }
  await panel.screenshot({
    path: "test-results/travel-prompt-filters-320.png",
  });
  await page.getByRole("button", { name: "К пожеланиям", exact: true }).click();
  await expect(panel).not.toBeVisible();
});

test("wheel over hero scrolls the page in prompt and inline-filter modes", async ({
  page,
}) => {
  const checks: unknown[] = [];
  for (const [width, height] of [
    [1440, 900],
    [390, 844],
    [320, 568],
  ]) {
    await page.setViewportSize({ width, height });
    await openHome(page);
    await page.evaluate(() => document.fonts.ready);
    for (const mode of ["prompt", "filters"]) {
      await page.evaluate(() =>
        window.scrollTo({ top: 0, behavior: "instant" }),
      );
      if (mode === "filters") {
        await page
          .getByRole("button", { name: "Фильтры", exact: true })
          .click();
        await expect(page.locator(".ov-inline-filters")).toBeVisible();
        await page.evaluate(() =>
          window.scrollTo({ top: 0, behavior: "instant" }),
        );
      }
      const start = await page.evaluate(() => window.scrollY);
      await page.mouse.move(width / 2, height / 2);
      await page.mouse.wheel(0, 600);
      await expect
        .poll(() => page.evaluate(() => window.scrollY))
        .toBeGreaterThan(start);
      const result = await page.evaluate(() => ({
        y: window.scrollY,
        locked: document.body.hasAttribute("data-scroll-locked"),
        overflow: getComputedStyle(document.body).overflowY,
        heroOverflow: getComputedStyle(
          document.querySelector(".ov-hero-content")!,
        ).overflowY,
      }));
      expect(result.locked).toBe(false);
      expect(result.overflow).not.toBe("hidden");
      expect(result.heroOverflow).not.toBe("auto");
      checks.push({ width, height, mode, start, ...result });
    }
  }
  await writeFile(
    "test-results/travel-prompt-scroll.json",
    JSON.stringify(checks, null, 2),
  );
});

test("switching search modes preserves both headings and the shared primary action", async ({
  page,
}) => {
  for (const [width, height] of [
    [1440, 900],
    [1024, 768],
    [390, 844],
    [320, 568],
    [844, 390],
  ]) {
    await page.setViewportSize({ width, height });
    await openHome(page);
    await page.evaluate(() => document.fonts.ready);
    const elements = [
      page.locator(".ov-hero h1"),
      page.getByRole("heading", {
        name: "Расскажите, куда хотите отправиться",
        exact: true,
      }),
      submit(page),
    ];
    const before = await Promise.all(elements.map((el) => el.boundingBox()));
    await page.getByRole("button", { name: "Фильтры", exact: true }).click();
    await expect(
      page.getByRole("region", { name: "Фильтры поездки", exact: true }),
    ).toBeVisible();
    await expect(submit(page)).toHaveAccessibleName("Подобрать отели");
    const after = await Promise.all(elements.map((el) => el.boundingBox()));
    for (let i = 0; i < before.length; i++) {
      expect(before[i]).not.toBeNull();
      expect(after[i]).toEqual(before[i]);
      expect(after[i]!.y).toBeGreaterThanOrEqual(0);
      expect(after[i]!.y + after[i]!.height).toBeLessThanOrEqual(height);
    }
    await expect(
      page.locator(".ov-search-original .ov-search-submit"),
    ).toHaveCount(0);
    await page
      .getByRole("button", { name: "К пожеланиям", exact: true })
      .click();
    for (let i = 0; i < elements.length; i++)
      expect(await elements[i].boundingBox()).toEqual(before[i]);
  }
});

test("wish examples remain available on desktop and in a horizontal mobile row", async ({
  page,
}) => {
  for (const [width, height] of [
    [1440, 900],
    [390, 844],
    [320, 568],
  ]) {
    await page.setViewportSize({ width, height });
    await openHome(page);
    const examples = page.locator(".ov-prompt-examples");
    const chips = examples.getByRole("button");
    await expect(chips).toHaveCount(3);
    for (const chip of await chips.all()) await expect(chip).toBeVisible();
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth),
    ).toBeLessThanOrEqual(width);
    if (width < 600) {
      const layout = await examples.evaluate((element) => ({
        overflow: getComputedStyle(element).overflowX,
        left: element.getBoundingClientRect().left,
        right: element.getBoundingClientRect().right,
        lines: new Set(
          Array.from(
            element.children,
            (child) => child.getBoundingClientRect().top,
          ),
        ).size,
      }));
      expect(["auto", "scroll"]).toContain(layout.overflow);
      expect(layout.lines).toBe(1);
      expect(layout.left).toBeGreaterThanOrEqual(0);
      expect(layout.right).toBeLessThanOrEqual(width);
      await examples.evaluate((element) => {
        element.scrollLeft = element.scrollWidth;
      });
      await expect(chips.last()).toBeInViewport();
    }
    const wish = (await chips.last().innerText()).trim();
    await chips.last().click();
    await expect(page.locator("#trip-request")).toHaveValue(wish);
  }
});
