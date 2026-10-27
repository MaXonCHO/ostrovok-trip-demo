import { test, expect, type APIRequestContext } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { createWorkspace } from "../../src/server/workspaces";
import { database } from "../../src/server/database";
import { emptyTripChatProfile } from "../../src/features/ostrovok/trip-chat-contract";
import { readSearch } from "../../src/features/ostrovok/search-state";
import type { Account, TripWorkspace } from "../../src/features/planner/types";
import { resolve } from "node:path";
process.env.DATABASE_PATH =
  process.env.PLANNER_E2E_DATABASE || resolve(".data/ostrovok.sqlite");
const complete = {
  ...emptyTripChatProfile(),
  city: "saint-petersburg" as const,
  datesFlexible: true,
  budgetFlexible: true,
  adults: 2,
  children: 0,
  rooms: 1,
};
async function post(api: APIRequestContext, path: string, data: unknown) {
  return api.post("/api/planner/" + path, { data });
}
async function login(api: APIRequestContext, phone: string, name: string) {
  const challenge = await (await post(api, "auth/request", { phone })).json();
  const wrong = await post(api, "auth/verify", {
    challengeId: challenge.challengeId,
    code: "1234",
    name,
  });
  expect(wrong.status()).toBe(400);
  const verified = await post(api, "auth/verify", {
    challengeId: challenge.challengeId,
    code: "0000",
    name,
  });
  expect(verified.status()).toBe(200);
  const replay = await post(api, "auth/verify", {
    challengeId: challenge.challengeId,
    code: "0000",
    name,
  });
  expect(replay.status()).toBe(400);
  return (await verified.json()).user as Account;
}
test("demo login claims draft, shared choices respect membership and unanimous votes", async ({
  page,
  browser,
  baseURL,
}) => {
  const guest = (
    await (await page.request.get("/api/planner/auth/session")).json()
  ).user as Account;
  const row = createWorkspace(guest, {
    search: readSearch({}),
    wish: "Тест совместной поездки",
    amenities: [],
    apartmentsOnly: false,
    source: "wish",
  });
  database()
    .prepare("UPDATE trips SET profile_json=? WHERE id=?")
    .run(JSON.stringify(complete), row.id);
  database()
    .prepare(
      "INSERT INTO trip_messages(trip_id,user_id,role,content,created_at) VALUES(?,?,'user','Мои планы',datetime('now'))",
    )
    .run(row.id, guest.id);
  database()
    .prepare(
      "INSERT INTO trip_messages(trip_id,user_id,role,content,created_at) VALUES(?,?,'assistant','Пожелания сохранены',datetime('now'))",
    )
    .run(row.id, guest.id);
  let chatRequests = 0;
  await page.route("**/api/trip-chat", async (route) => {
    chatRequests++;
    await route.fulfill({
      status: 503,
      contentType: "application/json",
      body: JSON.stringify({ error: "E2E does not call provider" }),
    });
  });
  await page.goto("/my-trip?trip=" + row.id);
  await expect(
    page.getByRole("button", { name: "Создать профиль поездки" }),
  ).toBeEnabled();
  await page.goto("/my-trip");
  await expect(
    page.getByRole("button", { name: "Создать профиль поездки" }),
  ).toBeEnabled();
  expect(chatRequests).toBe(0);
  await page.goto("/account");
  await page.getByRole("button", { name: "Войти в демо-аккаунт" }).click();
  const phone = "+7999" + String(Date.now()).slice(-7);
  await page.getByLabel("Телефон", { exact: true }).fill(phone);
  await page.getByLabel("Как вас зовут?").fill("Организатор E2E");
  await page.getByRole("button", { name: "Получить демо-код" }).click();
  await page.getByLabel("Демо-код").fill("0000");
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Войти", exact: true })
    .click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  const owner = (
    await (await page.request.get("/api/planner/auth/session")).json()
  ).user as Account;
  expect(owner.authenticated).toBe(true);
  const claimed = await page.request.get("/api/planner/trips/" + row.id);
  expect(claimed.status()).toBe(200);
  expect((await claimed.json()).ownerId).toBe(owner.id);
  expect(
    (
      await post(page.request, "trips/" + row.id, {
        type: "finalize",
        version: 0,
      })
    ).ok(),
  ).toBe(true);
  await page.goto("/trips/" + row.id);
  await expect(
    page.getByRole("heading", { name: "Выбираем вместе" }),
  ).toBeVisible();
  const other = await browser.newContext({ baseURL });
  const member = await login(
    other.request,
    "+7998" + String(Date.now()).slice(-7),
    "Спутник E2E",
  );
  expect(
    (await other.request.get("/api/planner/trips/" + row.id)).status(),
  ).toBe(404);
  const invite = (await (
    await post(page.request, "trips/" + row.id, { type: "invite" })
  ).json()) as TripWorkspace;
  const token = new URL(invite.inviteUrl!).pathname.split("/").at(-1)!;
  expect((await post(other.request, "invite/" + token, {})).ok()).toBe(true);
  expect(
    (
      await post(other.request, "trips/" + row.id, {
        type: "edit",
        version: 0,
        adults: 4,
      })
    ).status(),
  ).toBe(403);
  const hotelId = invite.selection.results[0].hotel.id;
  expect(
    (
      await post(page.request, "trips/" + row.id, {
        type: "vote",
        revision: 1,
        hotelId,
        liked: true,
      })
    ).ok(),
  ).toBe(true);
  expect(
    (
      await post(page.request, "trips/" + row.id, {
        type: "pin",
        revision: 1,
        hotelId,
      })
    ).status(),
  ).toBe(409);
  const injection = "<script>window.hacked=true</script>";
  expect(
    (
      await post(other.request, "trips/" + row.id, {
        type: "comment",
        hotelId,
        text: injection,
      })
    ).ok(),
  ).toBe(true);
  expect(
    (
      await post(other.request, "trips/" + row.id, {
        type: "vote",
        revision: 1,
        hotelId,
        liked: true,
      })
    ).ok(),
  ).toBe(true);
  const pinned = await (
    await post(page.request, "trips/" + row.id, {
      type: "pin",
      revision: 1,
      hotelId,
    })
  ).json();
  expect(pinned.pinnedHotelId).toBe(hotelId);
  expect(pinned.votes.map((v: { userId: string }) => v.userId)).toContain(
    member.id,
  );
  await page.reload();
  await expect(page.getByText(injection, { exact: true })).toBeVisible();
  expect(await page.evaluate(() => "hacked" in window)).toBe(false);
  await page.screenshot({
    path: "test-results/planner-desktop.png",
    fullPage: true,
  });
  const a11y = await new AxeBuilder({ page })
    .include("main")
    .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
    .analyze();
  expect(
    a11y.violations.map((v) => ({
      id: v.id,
      nodes: v.nodes.map((n) => n.target),
    })),
  ).toEqual([]);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({
    path: "test-results/planner-mobile.png",
    fullPage: true,
  });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth > innerWidth,
    ),
  ).toBe(false);
  const changed = await (
    await post(page.request, "trips/" + row.id, {
      type: "edit",
      version: 0,
      adults: 3,
    })
  ).json();
  expect(changed.pinnedHotelId).toBe(null);
  expect(changed.votes).toHaveLength(0);
  expect(changed.comments).toHaveLength(1);
  expect(
    (
      await post(page.request, "trips/" + row.id, {
        type: "edit",
        version: 0,
        adults: 2,
      })
    ).status(),
  ).toBe(409);
  const csrf = await page.request.post("/api/planner/trips/" + row.id, {
    headers: { Origin: "https://evil.example" },
    data: { type: "invite" },
  });
  expect(csrf.status()).toBe(403);
  await other.close();
});
