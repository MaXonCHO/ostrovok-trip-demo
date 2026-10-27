import type { Page } from "@playwright/test";

import { emptyTripChatProfile } from "../../src/features/ostrovok/trip-chat-contract";
import type {
  TripChatReply,
  TripChatRequest,
} from "../../src/features/ostrovok/trip-chat-contract";
import type { TripWeather } from "../../src/features/ostrovok/trip-weather";

export type ChatRequest = TripChatRequest;

export const weatherReply: TripWeather = {
  label: "Прогноз на 6–9 ноября",
  description: "Прохладно, возможен дождь. Возьмите непромокаемую куртку.",
  temperatureMin: 3,
  temperatureMax: 8,
  sourceUrl: "https://open-meteo.com/",
  kind: "forecast",
};

/** Prevent every dialogue test from reaching an external weather provider. */
export async function mockTripWeather(page: Page) {
  const requests: string[] = [];
  await page.route("**/api/trip-weather**", async (route) => {
    requests.push(route.request().url());
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(weatherReply),
    });
  });
  return requests;
}

/** Intercepts the application's API; E2E must never call the real LLM. */
export async function mockTripChat(page: Page) {
  await mockTripWeather(page);
  const requests: ChatRequest[] = [];
  await page.route("**/api/trip-chat", async (route) => {
    const request = route.request().postDataJSON() as ChatRequest;
    requests.push(request);
    const response: TripChatReply = {
      message: "Понял ваши пожелания. На какие даты планируете поездку?",
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
        checkin:
          request.context.source === "filters"
            ? request.context.search.checkin
            : null,
        checkout:
          request.context.source === "filters"
            ? request.context.search.checkout
            : null,
        tripType: null,
      },
    };
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(response),
    });
  });
  return requests;
}
