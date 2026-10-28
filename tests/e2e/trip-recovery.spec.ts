import { test, expect } from "@playwright/test";
import { emptyTripChatProfile } from "../../src/features/ostrovok/trip-chat-contract";
import { mockTripWeather } from "./trip-chat-mock";

const answer = {
  message: "На какие даты планируете поездку?",
  suggestions: ["Даты пока не выбраны"],
  hotelSlugs: [],
  candidateHotelSlugs: ["helvetia-saint-petersburg"],
  collectionIds: ["spb-weekend"],
  ready: false,
  stage: "basics",
  profile: { ...emptyTripChatProfile(), city: "saint-petersburg" },
};
const storage = "ostrovok-trip-conversation-v1";

test("starting selection recovers a missing workspace once without losing the wish", async ({
  page,
}) => {
  await mockTripWeather(page);
  const requests: Record<string, unknown>[] = [];
  await page.route("**/api/trip-chat", async (route) => {
    requests.push(route.request().postDataJSON());
    await route.fulfill({
      status: requests.length === 1 ? 404 : 200,
      contentType: "application/json",
      body: JSON.stringify(
        requests.length === 1
          ? { error: "Поездка не найдена или у вас нет доступа." }
          : answer,
      ),
    });
  });
  await page.goto("/");
  await page.locator("#trip-request").fill("Хочу выходные в Петербурге");
  await page
    .getByRole("button", { name: "Подобрать отели", exact: true })
    .click();
  await expect(page.locator(".ov-ai-text .ov-sr-only")).toHaveText(
    answer.message,
  );
  expect(requests).toHaveLength(2);
  expect(requests[0].requestId).not.toBe(requests[1].requestId);
  expect(requests[1].messages).toEqual(requests[0].messages);
  expect(requests[1].tripId).toBeUndefined();
  await expect(page.locator(".ov-chat-error")).toHaveCount(0);
  await expect(page.locator(".ov-selection-tabs")).toHaveCount(0);
  await expect(
    page.getByText(/требуют проверки|Подходят по данным|Нужно уточнить \(/),
  ).toHaveCount(0);
  await page.reload();
  await expect(page.locator(".ov-ai-text .ov-sr-only")).toHaveText(
    answer.message,
  );
  expect(requests).toHaveLength(2);
});

test("an unavailable saved draft and its old error are replaced automatically", async ({
  page,
}) => {
  await mockTripWeather(page);
  let calls = 0;
  await page.route("**/api/trip-chat", async (route) => {
    calls++;
    expect(route.request().postDataJSON().tripId).toBeUndefined();
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(answer),
    });
  });
  await page.goto("/my-trip?wish=Петербург");
  await expect(page.locator(".ov-ai-text .ov-sr-only")).toHaveText(
    answer.message,
  );
  await page.evaluate((key) => {
    const draft = JSON.parse(localStorage.getItem(key)!);
    draft.tripId = "unavailable-trip";
    draft.tripVersion = 1;
    draft.error = "Поездка не найдена или у вас нет доступа.";
    draft.messages = draft.messages.slice(0, 1);
    localStorage.setItem(key, JSON.stringify(draft));
  }, storage);
  await page.route("**/api/planner/trips/unavailable-trip", (route) =>
    route.fulfill({
      status: 404,
      contentType: "application/json",
      body: JSON.stringify({
        error: "Поездка не найдена или у вас нет доступа.",
      }),
    }),
  );
  await page.reload();
  await expect(page.locator(".ov-ai-text .ov-sr-only")).toHaveText(
    answer.message,
  );
  expect(calls).toBe(2);
  await expect(page.locator(".ov-chat-error")).toHaveCount(0);
});

test("an explicit inaccessible shared trip keeps its access error and is not restarted", async ({
  page,
}) => {
  let calls = 0;
  await page.route("**/api/trip-chat", async (route) => {
    calls++;
    await route.abort();
  });
  await page.route("**/api/planner/trips/private-trip", (route) =>
    route.fulfill({
      status: 404,
      contentType: "application/json",
      body: JSON.stringify({
        error: "Поездка не найдена или у вас нет доступа.",
      }),
    }),
  );
  await page.goto("/my-trip?trip=private-trip");
  await expect(page.locator(".ov-chat-error")).toContainText(
    "Поездка не найдена",
  );
  expect(calls).toBe(0);
});
