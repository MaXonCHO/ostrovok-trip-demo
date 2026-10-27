import { test, expect, type APIRequestContext } from "@playwright/test";
import type { TripView } from "../../src/domain/models";
async function command(api: APIRequestContext, id: string, cmd: unknown) {
  for (let i = 0; i < 5; i++) {
    const r = await api.get(`/api/trips/${id}`);
    const v = await r.json();
    const response = await api.post(`/api/trips/${id}`, {
      data: {
        version: v.version,
        commandId: crypto.randomUUID(),
        command: cmd,
      },
    });
    if (response.status() === 409) continue;
    expect(response.status(), await response.text()).toBe(200);
    return (await response.json()) as TripView;
  }
  throw new Error("Concurrency retry exhausted");
}
async function make(api: APIRequestContext, group = false) {
  const r = await api.post("/api/trips", {
    data: {
      name: "Артём",
      cityId: "sochi",
      group,
      expectedParticipants: group ? 2 : 1,
      nights: 4,
      rooms: 1,
      prompt: "Море и прогулки, итальянская кухня",
    },
  });
  expect(r.status()).toBe(201);
  return (await r.json()).id as string;
}
test("Solo UI: scenarios before hotels, choice, refresh, materials", async ({
  page,
}) => {
  await page.goto("/trips/new");
  await page.getByRole("textbox", { name: "Как вас зовут?" }).fill("Артём");
  await page
    .getByRole("textbox", { name: "Что хочется от отдыха?" })
    .fill("Хочу море и итальянскую кухню");
  await page.getByRole("button", { name: "Перейти к пожеланиям" }).click();
  await page.waitForURL("**/chat");
  await page.getByRole("button", { name: "Посмотреть сценарии" }).click();
  await expect(page.locator(".scenario-card")).toHaveCount(1);
  await expect(page.locator(".hotel-photo-deck")).toHaveCount(0);
  for (let i = 0; i < 3; i++) {
    await page.getByRole("button", { name: "Подходит", exact: true }).click();
    await expect(page.locator(".count-label")).toContainText(`${i + 1} / 3`);
  }
  await page
    .getByRole("button", { name: "Подтвердить выбор", exact: true })
    .click();
  await page.getByRole("button", { name: "Рассмотреть отели" }).click();
  await expect(page.locator(".hotel-photo-deck")).toBeVisible();
  await page.getByRole("button", { name: "Подходит", exact: true }).click();
  const url = page.url();
  await page.reload();
  await expect(
    page.locator(".count-label").filter({ hasText: "1 /" }),
  ).toBeVisible();
  await page.goto(url.replace("/hotels", "/matches"));
  await page
    .getByRole("button", { name: "Предложить", exact: false })
    .first()
    .click();
  await page.getByRole("button", { name: "Подтвердить этот отель" }).click();
  await page
    .getByRole("link", { name: "Открыть поездку", exact: false })
    .click();
  await expect(page.getByText("Ваш общий выбор сохранён")).toBeVisible();
  await page.getByRole("button", { name: "Материалы", exact: true }).click();
  await page
    .getByRole("button", { name: "Добавить материал", exact: true })
    .click();
  await page
    .getByRole("textbox", { name: "Название", exact: true })
    .fill("Встреча");
  await page
    .getByRole("textbox", { name: "Заметка", exact: true })
    .fill("У вокзала в 12:00");
  await page.getByRole("button", { name: "Сохранить материал" }).click();
  await expect(page.getByRole("heading", { name: "Встреча" })).toBeVisible();
});
test("Two independent sessions, invitation, privacy, concurrent votes and unanimity", async ({
  browser,
}) => {
  const a = await browser.newContext(),
    b = await browser.newContext(),
    outsider = await browser.newContext();
  const id = await make(a.request, true);
  let va = (await (await a.request.get(`/api/trips/${id}`)).json()) as TripView;
  const token = va.inviteUrl!.split("/").pop();
  expect((await outsider.request.get(`/api/trips/${id}`)).status()).toBe(401);
  const join = await b.request.post("/api/join/" + token, {
    data: { name: "Саша" },
  });
  expect(join.status()).toBe(200);
  va = await command(a.request, id, {
    type: "message",
    text: "Только мой личный секрет: прогулки",
  });
  const vb = (await (
    await b.request.get(`/api/trips/${id}`)
  ).json()) as TripView;
  expect(vb.me.id).not.toBe(va.me.id);
  expect(JSON.stringify(vb)).not.toContain("Только мой личный секрет");
  va = await command(a.request, id, { type: "generateScenarios" });
  for (const api of [a.request, b.request]) {
    for (const s of va.scenarios)
      await command(api, id, {
        type: "vote",
        entityType: "scenario",
        entityId: s.id,
        decision: "liked",
      });
    await command(api, id, { type: "confirmScenarios" });
  }
  va = await command(a.request, id, { type: "openHotels" });
  const h = va.candidates.find((c) => !c.needsClarification)!;
  const base = va.version;
  const [r1, r2] = await Promise.all([
    a.request.post(`/api/trips/${id}`, {
      data: {
        version: base,
        commandId: crypto.randomUUID(),
        command: {
          type: "vote",
          entityType: "hotel",
          entityId: h.hotelId,
          decision: "liked",
        },
      },
    }),
    b.request.post(`/api/trips/${id}`, {
      data: {
        version: base,
        commandId: crypto.randomUUID(),
        command: {
          type: "vote",
          entityType: "hotel",
          entityId: h.hotelId,
          decision: "liked",
        },
      },
    }),
  ]);
  expect([r1.status(), r2.status()].sort()).toEqual([200, 409]);
  await command(r1.status() === 409 ? a.request : b.request, id, {
    type: "vote",
    entityType: "hotel",
    entityId: h.hotelId,
    decision: "liked",
  });
  va = await (await a.request.get(`/api/trips/${id}`)).json();
  expect(va.matches).toContain(h.hotelId);
  await command(b.request, id, {
    type: "vote",
    entityType: "hotel",
    entityId: h.hotelId,
    decision: "rejected",
  });
  va = await (await a.request.get(`/api/trips/${id}`)).json();
  expect(va.matches).not.toContain(h.hotelId);
  expect(va.scenarioIds).toHaveLength(3);
  await command(b.request, id, {
    type: "vote",
    entityType: "hotel",
    entityId: h.hotelId,
    decision: "liked",
  });
  await command(a.request, id, { type: "propose", hotelId: h.hotelId });
  va = await command(a.request, id, { type: "confirmFinal" });
  expect(va.selected).toBeNull();
  va = await command(b.request, id, { type: "confirmFinal" });
  expect(va.selected?.hotelId).toBe(h.hotelId);
  await a.close();
  await b.close();
  await outsider.close();
});
test("No overlap is real, pending is not no matches", async ({ page }) => {
  const r = await page.request.post("/api/demo", {
    data: { kind: "conflict" },
  });
  const d = await r.json();
  await page.goto(`/trips/${d.id}/scenarios`);
  await expect(
    page.getByRole("heading", { name: "Пока выбрали разный отдых" }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Рассмотреть отели" }),
  ).toHaveCount(0);
});
test("Unknown direction and no preferences can reach a supported city", async ({
  page,
}) => {
  const r = await page.request.post("/api/trips", {
    data: {
      name: "Гость",
      cityId: null,
      group: false,
      expectedParticipants: 1,
      nights: 3,
      rooms: 1,
      prompt: "Пока не знаю",
    },
  });
  const { id } = await r.json();
  await page.goto(`/trips/${id}/chat`);
  await page.getByRole("button", { name: /Сочи Море/ }).click();
  await page.getByRole("button", { name: "Посмотреть сценарии" }).click();
  await expect(page.locator(".scenario-card")).toHaveCount(1);
});
test("Host free response, confirmation and conflict stays in evidence", async ({
  page,
}) => {
  const r = await page.request.post("/api/demo", { data: { kind: "solo" } });
  const d = await r.json();
  const v = (await (
    await page.request.get(`/api/trips/${d.id}`)
  ).json()) as TripView;
  const h = v.candidates.find((c) => c.hotelId === "h1") ?? v.candidates[0];
  await page.goto(`/trips/${d.id}/hotels/${h.hotelId}`);
  await page
    .getByRole("button", { name: "Задать вопрос", exact: true })
    .click();
  await page
    .getByRole("link", { name: "Открыть демонстрацию отельера" })
    .click();
  await page
    .getByRole("textbox", { name: "Свободный ответ отельера" })
    .fill("Окна стандартных номеров выходят во двор.");
  await page.getByRole("button", { name: "Извлечь характеристику" }).click();
  await expect(
    page.getByRole("heading", { name: "Сторона окон: во двор" }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Подтвердить и сохранить источник" })
    .click();
  const after = (await (
    await page.request.get(`/api/trips/${d.id}`)
  ).json()) as TripView;
  expect(
    after.catalog
      .find((c) => c.id === h.hotelId)!
      .evidence.some((e) => e.source.kind === "host" && e.value === "во двор"),
  ).toBe(true);
});
test("Geography story switches synthetic before and after", async ({
  page,
}) => {
  const r = await page.request.post("/api/demo", { data: { kind: "geo" } });
  const d = await r.json();
  await page.goto(`/trips/${d.id}/geo`);
  await expect(page.getByText("420 м", { exact: true })).toBeVisible();
  await page
    .getByRole("button", { name: "Показать уточнение маршрута" })
    .click();
  await expect(
    page.getByRole("heading", { name: "Обход меняет обычный день" }),
  ).toBeVisible();
  await expect(page.getByText(/около 27 минут пешком/)).toBeVisible();
});
test("Revoked invitation and membership enforcement", async ({ browser }) => {
  const a = await browser.newContext(),
    b = await browser.newContext();
  const id = await make(a.request, true);
  const v = (await (
    await a.request.get(`/api/trips/${id}`)
  ).json()) as TripView;
  const token = v.inviteUrl!.split("/").pop();
  await command(a.request, id, { type: "revokeInvite" });
  expect((await b.request.get("/api/join/" + token)).status()).toBe(410);
  expect(
    (
      await b.request.post("/api/join/" + token, { data: { name: "Чужой" } })
    ).status(),
  ).toBe(410);
  await a.close();
  await b.close();
});

test("Conflict is resolved by an author, context change resets only the new revision", async ({
  page,
}) => {
  const r = await page.request.post("/api/demo", {
    data: { kind: "conflict" },
  });
  const d = await r.json();
  await page.goto(`/trips/${d.id}/scenarios`);
  await expect(
    page.getByRole("heading", { name: "Пока выбрали разный отдых" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Пересмотреть свой выбор" }).click();
  await page.getByRole("button", { name: "Не подходит", exact: true }).click();
  await page.getByRole("button", { name: "Подходит", exact: true }).click();
  await page.getByRole("button", { name: "Не подходит", exact: true }).click();
  await page
    .getByRole("button", { name: "Подтвердить выбор", exact: true })
    .click();
  await page.getByRole("button", { name: "Рассмотреть отели" }).click();
  await expect(page.locator(".hotel-photo-deck")).toBeVisible();
  const before = (await (
    await page.request.get(`/api/trips/${d.id}`)
  ).json()) as TripView;
  const after = await command(page.request, d.id, {
    type: "context",
    budget: 5000,
    budgetBasis: "room_night",
    required: true,
  });
  expect(after.selectionRevision).toBe(before.selectionRevision + 1);
  expect(after.candidates).toHaveLength(0);
  expect(after.scenarioIds).toHaveLength(0);
  expect(after.history.at(-1)?.votes.length).toBeGreaterThan(0);
});
test("Three participants obey unanimity; late joiner views saved choice until explicit reopen", async ({
  browser,
}) => {
  const contexts = await Promise.all([
    browser.newContext(),
    browser.newContext(),
    browser.newContext(),
    browser.newContext(),
  ]);
  const [a, b, c, d] = contexts;
  const id = await make(a.request, true);
  let v = (await (await a.request.get(`/api/trips/${id}`)).json()) as TripView;
  const token = v.inviteUrl!.split("/").pop();
  await b.request.post("/api/join/" + token, { data: { name: "Б" } });
  await c.request.post("/api/join/" + token, { data: { name: "В" } });
  v = await command(a.request, id, { type: "context", rooms: 2 });
  v = await command(a.request, id, { type: "generateScenarios" });
  for (const p of [a, b, c]) {
    for (const s of v.scenarios)
      await command(p.request, id, {
        type: "vote",
        entityType: "scenario",
        entityId: s.id,
        decision: "liked",
      });
    await command(p.request, id, { type: "confirmScenarios" });
  }
  v = await command(a.request, id, { type: "openHotels" });
  const h = v.candidates.find((h) => !h.needsClarification)!;
  for (const p of [a, b, c])
    await command(p.request, id, {
      type: "vote",
      entityType: "hotel",
      entityId: h.hotelId,
      decision: "liked",
    });
  await command(a.request, id, { type: "propose", hotelId: h.hotelId });
  await command(a.request, id, { type: "confirmFinal" });
  await command(b.request, id, { type: "confirmFinal" });
  v = await command(c.request, id, { type: "confirmFinal" });
  expect(v.selected).not.toBeNull();
  await d.request.post("/api/join/" + token, { data: { name: "Позже" } });
  const late = (await (
    await d.request.get(`/api/trips/${id}`)
  ).json()) as TripView;
  expect(late.me.role).toBe("viewer");
  expect(late.selected?.hotelId).toBe(h.hotelId);
  const rejected = await d.request.post(`/api/trips/${id}`, {
    data: {
      version: late.version,
      commandId: crypto.randomUUID(),
      command: {
        type: "vote",
        entityType: "hotel",
        entityId: h.hotelId,
        decision: "liked",
      },
    },
  });
  expect(rejected.status()).toBe(403);
  v = await command(a.request, id, { type: "reopen" });
  expect(v.selected).toBeNull();
  expect(v.participants.filter((p) => p.role !== "viewer")).toHaveLength(4);
  expect(v.history.at(-1)?.selected?.hotelId).toBe(h.hotelId);
  for (const context of contexts) await context.close();
});
test("All declined scenarios and missing price are honest states", async ({
  page,
}) => {
  const id = await make(page.request);
  let v = await command(page.request, id, { type: "generateScenarios" });
  for (const s of v.scenarios)
    await command(page.request, id, {
      type: "vote",
      entityType: "scenario",
      entityId: s.id,
      decision: "rejected",
    });
  await command(page.request, id, { type: "confirmScenarios" });
  await page.goto(`/trips/${id}/scenarios`);
  await expect(page.getByText(/Значит, ищем другое настроение/)).toBeVisible();
  expect(
    (
      await page.request.post(`/api/trips/${id}`, {
        data: {
          version: (await (await page.request.get(`/api/trips/${id}`)).json())
            .version,
          commandId: crypto.randomUUID(),
          command: { type: "openHotels" },
        },
      })
    ).status(),
  ).toBe(409);
  v = await command(page.request, id, { type: "context", budget: 20000 });
  v = await command(page.request, id, { type: "generateScenarios" });
  for (const s of v.scenarios)
    await command(page.request, id, {
      type: "vote",
      entityType: "scenario",
      entityId: s.id,
      decision: "liked",
    });
  await command(page.request, id, { type: "confirmScenarios" });
  v = await command(page.request, id, { type: "openHotels" });
  expect(
    v.candidates.some((c) => c.hotelId === "h12" && c.needsClarification),
  ).toBe(true);
  v = await command(page.request, id, {
    type: "vote",
    entityType: "hotel",
    entityId: "h12",
    decision: "liked",
  });
  expect(v.matches).not.toContain("h12");
});
test("Member can leave and loses read access; spoofed demo identity is rejected", async ({
  browser,
}) => {
  const a = await browser.newContext(),
    b = await browser.newContext();
  const id = await make(a.request, true);
  const v = (await (
    await a.request.get(`/api/trips/${id}`)
  ).json()) as TripView;
  const token = v.inviteUrl!.split("/").pop();
  await b.request.post("/api/join/" + token, { data: { name: "Саша" } });
  expect(
    (
      await a.request.get(`/api/trips/${id}`, {
        headers: { "x-demo-persona": v.me.id },
      })
    ).status(),
  ).toBe(403);
  await command(b.request, id, { type: "leave" });
  expect((await b.request.get(`/api/trips/${id}`)).status()).toBe(403);
  await a.close();
  await b.close();
});

test("Photo gestures record one vote, vertical movement does not vote, dialogs return keyboard focus", async ({
  page,
}) => {
  const r = await page.request.post("/api/demo", { data: { kind: "solo" } });
  const d = await r.json();
  await page.goto(`/trips/${d.id}/hotels`);
  const photo = page.locator(".hotel-photo-deck");
  await photo.scrollIntoViewIfNeeded();
  const box = (await photo.boundingBox())!;
  const x = box.x + box.width * 0.25,
    y = box.y + box.height * 0.3;
  await page.mouse.move(x, y);
  await page.mouse.down();
  await page.mouse.move(x + 330, y + 3, { steps: 14 });
  await page.mouse.up();
  await expect(page.locator(".count-label")).toContainText("1 /");
  await page
    .getByRole("button", { name: "Отменить последнее решение" })
    .first()
    .click();
  await expect(page.locator(".count-label")).toContainText("0 /");
  await photo.scrollIntoViewIfNeeded();
  const next = (await photo.boundingBox())!;
  await page.mouse.move(next.x + 70, next.y + 60);
  await page.mouse.down();
  await page.mouse.move(next.x + 73, next.y + 190, { steps: 10 });
  await page.mouse.up();
  await expect(page.locator(".count-label")).toContainText("0 /");
  await page.getByRole("link", { name: "Фото, план дня и источники" }).click();
  const source = page.locator(".evidence-row").first();
  await source.click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(source).toBeFocused();
});

test("Landing preserves company and inspiration in the new trip form", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: /Пока планирую один/ }).click();
  await page.getByRole("button", { name: /Побыть в тишине/ }).click();
  await page.waitForURL("**/trips/new?**");
  await expect(
    page.getByRole("button", { name: "Вместе", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  await expect(
    page.getByRole("textbox", { name: /Что хочется от отдыха/ }),
  ).toHaveValue("Хочу тишину, природу и неспешные прогулки");
  await expect(page.getByLabel("Куда хочется поехать?")).toHaveValue("sochi");
});

test("Mobile touch swipes advance a single scenario and vertical scroll leaves votes intact", async ({
  browser,
}) => {
  const context = await browser.newContext({
    baseURL: "http://127.0.0.1:8080",
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
  });
  const page = await context.newPage();
  const id = await make(context.request);
  await command(context.request, id, { type: "generateScenarios" });
  await page.goto(`/trips/${id}/scenarios`);
  const card = page.locator(".scenario-card");
  await expect(card).toHaveCount(1);
  await card.scrollIntoViewIfNeeded();
  const box = (await card.boundingBox())!;
  const client = await context.newCDPSession(page);
  const x = box.x + box.width * 0.25,
    y = box.y + 100;
  await client.send("Input.dispatchTouchEvent", {
    type: "touchStart",
    touchPoints: [{ x, y }],
  });
  for (let i = 1; i <= 12; i++)
    await client.send("Input.dispatchTouchEvent", {
      type: "touchMove",
      touchPoints: [{ x: x + i * 16, y: y + 2 }],
    });
  await client.send("Input.dispatchTouchEvent", {
    type: "touchEnd",
    touchPoints: [],
  });
  await expect(page.locator(".count-label")).toHaveText("1 / 3");
  await expect(card).toHaveCount(1);
  await page
    .getByRole("button", { name: "Отменить последнее решение" })
    .click();
  await expect(page.locator(".count-label")).toHaveText("0 / 3");
  await card.scrollIntoViewIfNeeded();
  const next = (await card.boundingBox())!;
  const vx = next.x + 100,
    vy = next.y + 150;
  await client.send("Input.dispatchTouchEvent", {
    type: "touchStart",
    touchPoints: [{ x: vx, y: vy }],
  });
  for (let i = 1; i <= 8; i++)
    await client.send("Input.dispatchTouchEvent", {
      type: "touchMove",
      touchPoints: [{ x: vx + 2, y: vy - i * 15 }],
    });
  await client.send("Input.dispatchTouchEvent", {
    type: "touchEnd",
    touchPoints: [],
  });
  const view = await (await context.request.get(`/api/trips/${id}`)).json();
  expect(
    view.votes.filter(
      (v: { entityType: string; decision: string }) =>
        v.entityType === "scenario" && v.decision !== "unseen",
    ),
  ).toHaveLength(0);
  await context.close();
});
