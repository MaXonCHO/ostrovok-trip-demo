import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import {
  database,
  catalogRecords,
  catalogHotels,
} from "../src/server/database";
import {
  createWorkspace,
  tripRow,
  workspace,
  mutateWorkspace,
  joinWorkspace,
  selectedOptions,
} from "../src/server/workspaces";
import { rankHotels } from "../src/server/recommendations";
import { validateAgentResult } from "../src/server/planner-agent";
import { chatCommand } from "../src/server/chat";
import { parseTripChatReply } from "../src/features/ostrovok/trip-chat-contract";
import { normalizePhone } from "../src/server/auth";
import { emptyExpectations, type Account } from "../src/features/planner/types";
import { emptyTripChatProfile } from "../src/features/ostrovok/trip-chat-contract";
import { readSearch } from "../src/features/ostrovok/search-state";
const directory = mkdtempSync(join(tmpdir(), "ostrovok-test-"));
process.env.DATABASE_PATH = join(directory, "planner.sqlite");
const context = {
  search: readSearch({}),
  wish: "Петербург",
  amenities: [],
  apartmentsOnly: false,
  source: "wish" as const,
};
const origin = "http://localhost:8081";
const profile = {
  ...emptyTripChatProfile(),
  city: "saint-petersburg" as const,
  datesFlexible: true,
  budgetFlexible: true,
  adults: 2,
  children: 0,
  rooms: 1,
};
function user(name: string): Account {
  const id = randomUUID(),
    phone = "+7" + String(Math.floor(Math.random() * 9e9 + 1e9));
  database()
    .prepare("INSERT INTO users VALUES(?,?,?,?)")
    .run(id, phone, name, new Date().toISOString());
  return { id, name, phone, authenticated: true };
}
test("import is idempotent, preserves source uncertainty and survives reopening the file", () => {
  assert.equal(catalogRecords().length, 300);
  assert.equal(
    database().prepare("SELECT count(*) AS n FROM hotels").get()!.n,
    300,
  );
  const hotels = catalogHotels();
  assert.ok(hotels.every((h) => h.price === null && !h.identityVerified));
  assert.equal(hotels.filter((h) => h.photos.length).length, 1);
  const other = new DatabaseSync(process.env.DATABASE_PATH!);
  assert.equal(other.prepare("SELECT count(*) AS n FROM hotels").get()!.n, 300);
  other.close();
});
test("hard missing amenities do not pass, soft preferences never silently remove hotels", () => {
  const e = emptyExpectations();
  e.criteria = [
    { key: "wifi", label: "Wi-Fi", value: true, importance: "required" },
  ];
  const hard = rankHotels(profile, e);
  assert.ok(hard.matchingCount > 0);
  assert.ok(
    hard.results.every((h) => h.hotel.amenities.includes("Бесплатный Wi-Fi")),
  );
  assert.equal(
    hard.matchingCount + hard.unverifiedCount + hard.excludedCount,
    300,
  );
  const absent = rankHotels(profile, {
    ...e,
    criteria: [{ ...e.criteria[0], value: false }],
  });
  assert.ok(absent.excludedCount > 0);
  const soft = rankHotels(profile, {
    ...e,
    criteria: [{ ...e.criteria[0], importance: "preferred" }],
  });
  assert.equal(soft.excludedCount, 0);
  assert.equal(soft.matchingCount + soft.unverifiedCount, 300);
  assert.ok(soft.results[0].hotel.amenities.includes("Бесплатный Wi-Fi"));
});
test("unknown prices, brand names and unverified geography are never offered as verified conditions", () => {
  const e = emptyExpectations();
  e.criteria = [
    { key: "shopping", label: "Шоппинг", value: true, importance: "required" },
    { key: "pharmacy", label: "Аптека", value: true, importance: "required" },
  ];
  const s = rankHotels(
    { ...profile, budgetMax: 5000, budgetFlexible: false },
    e,
  );
  assert.equal(s.matchingCount, 0);
  assert.ok(s.needsCheck.every((h) => h.unknowns.length > 0));
  assert.ok(
    s.needsCheck.flatMap((h) => h.nearby).every((p) => p.status !== "snapshot"),
  );
  assert.ok(
    s.needsCheck
      .flatMap((h) => h.nearby)
      .some((p) => p.method.includes("не восстанавливаются")),
  );
  assert.equal(s.engine, "lexical+facts");
});
test("model cannot silently relax a hard requirement, and malformed dates or invented criteria fail", () => {
  const previous = emptyExpectations();
  previous.criteria = [
    { key: "wifi", label: "Wi-Fi", value: true, importance: "required" },
  ];
  const input = {
    message: "Понятно. Что ещё важно?",
    profile,
    suggestions: [],
    criteriaUpdates: [{ key: "wifi", value: true, importance: "preferred" }],
  };
  assert.equal(
    validateAgentResult(input, previous, "Хочу гулять").expectations.criteria[0]
      .importance,
    "required",
  );
  assert.equal(
    validateAgentResult(
      {
        ...input,
        criteriaUpdates: [
          {
            ...input.criteriaUpdates[0],
            relaxationQuote: "Wi-Fi не обязателен",
          },
        ],
      },
      previous,
      "Wi-Fi не обязателен",
    ).expectations.criteria[0].importance,
    "preferred",
  );
  assert.throws(() =>
    validateAgentResult({
      ...input,
      profile: { ...profile, checkin: "2026-02-31" },
    }),
  );
  assert.throws(() =>
    validateAgentResult({
      ...input,
      criteriaUpdates: [
        { key: "__proto__", value: true, importance: "required" },
      ],
    }),
  );
});
test("private shared workspace: authorization, comments, consensus, invite rotation and revision invalidation", () => {
  const owner = user("Организатор"),
    member = user("Спутник"),
    outsider = user("Посторонний");
  const row = createWorkspace(owner, context);
  database()
    .prepare("UPDATE trips SET profile_json=? WHERE id=?")
    .run(JSON.stringify(profile), row.id);
  assert.throws(() => tripRow(row.id, outsider));
  let current = mutateWorkspace(
    row.id,
    owner,
    { type: "finalize", version: 0 },
    origin,
  );
  assert.equal(current.status, "profile");
  current = mutateWorkspace(row.id, owner, { type: "invite" }, origin);
  const token = new URL(current.inviteUrl!).pathname.split("/").at(-1)!;
  joinWorkspace(token, member);
  assert.throws(() =>
    mutateWorkspace(
      row.id,
      member,
      { type: "edit", version: 0, budgetFlexible: true },
      origin,
    ),
  );
  const hotelId = selectedOptions(tripRow(row.id, owner))[0].hotel.id;
  mutateWorkspace(
    row.id,
    owner,
    { type: "vote", revision: 1, hotelId, liked: true },
    origin,
  );
  assert.throws(() =>
    mutateWorkspace(
      row.id,
      owner,
      { type: "pin", revision: 1, hotelId },
      origin,
    ),
  );
  mutateWorkspace(
    row.id,
    member,
    { type: "comment", hotelId, text: "<script>alert(1)</script>" },
    origin,
  );
  current = mutateWorkspace(
    row.id,
    member,
    { type: "vote", revision: 1, hotelId, liked: true },
    origin,
  );
  assert.equal(current.comments[0].text, "<script>alert(1)</script>");
  assert.equal(current.votes.length, 2);
  current = mutateWorkspace(
    row.id,
    owner,
    { type: "pin", revision: 1, hotelId },
    origin,
  );
  assert.equal(current.pinnedHotelId, hotelId);
  current = mutateWorkspace(
    row.id,
    member,
    { type: "vote", revision: 1, hotelId, liked: false },
    origin,
  );
  assert.equal(current.pinnedHotelId, null);
  current = mutateWorkspace(
    row.id,
    owner,
    { type: "edit", version: 0, adults: 3 },
    origin,
  );
  assert.equal(current.revision, 2);
  assert.equal(current.votes.length, 0);
  assert.throws(() =>
    mutateWorkspace(
      row.id,
      owner,
      { type: "edit", version: 0, adults: 2 },
      origin,
    ),
  );
  assert.throws(() =>
    mutateWorkspace(
      row.id,
      owner,
      {
        type: "edit",
        version: 1,
        checkin: "2026-02-31",
        checkout: "2026-03-05",
      },
      origin,
    ),
  );
  mutateWorkspace(row.id, owner, { type: "invite" }, origin);
  assert.throws(() => joinWorkspace(token, outsider));
  database()
    .prepare(
      "INSERT INTO trip_messages(trip_id,user_id,role,content,created_at) VALUES(?,?,'user','private message',datetime('now'))",
    )
    .run(row.id, owner.id);
  assert.equal(
    workspace(tripRow(row.id, member), member, origin).messages.length,
    0,
  );
  assert.equal(
    workspace(tripRow(row.id, owner), owner, origin).messages.length,
    1,
  );
});
test("phone parser accepts formatting but rejects malformed numbers", () => {
  assert.equal(normalizePhone("8 (999) 123-45-67"), "+79991234567");
  assert.equal(normalizePhone("+44 7700 900123"), "+447700900123");
  for (const phone of ["123", "+0000000000", "7999123abc", "79991234567123456"])
    assert.throws(() => normalizePhone(phone));
});
test("chat request replay is idempotent, results persist, dynamic replies do not require legacy hotel IDs", async () => {
  const owner = user("Диалог");
  const previousFetch = globalThis.fetch;
  const previousKey = process.env.DEEPSEEK_API_KEY;
  process.env.DEEPSEEK_API_KEY = "test-only-not-a-real-credential";
  let calls = 0;
  globalThis.fetch = async () => {
    calls++;
    return Response.json({
      choices: [
        {
          finish_reason: "stop",
          message: {
            content: JSON.stringify({
              message: "Пожелания понятны. Что для вас важнее?",
              profile,
              suggestions: [],
              criteriaUpdates: [
                { key: "wifi", value: true, importance: "required" },
              ],
            }),
          },
        },
      ],
    });
  };
  try {
    const request = {
      context,
      messages: [{ role: "user", content: "Wi-Fi обязателен" }],
      requestId: randomUUID(),
    };
    const first = await chatCommand(request, owner);
    const second = await chatCommand(request, owner);
    assert.deepEqual(second, JSON.parse(JSON.stringify(first)));
    assert.equal(calls, 1);
    assert.equal(
      workspace(tripRow(first.tripId, owner), owner, origin).messages.length,
      2,
    );
    assert.equal(
      parseTripChatReply(first.reply, { dynamicSelection: true }).ready,
      true,
    );
    await assert.rejects(() =>
      chatCommand(
        {
          ...request,
          requestId: randomUUID(),
          tripId: first.tripId,
          tripVersion: 0,
        },
        owner,
      ),
    );
    assert.equal(calls, 1);
  } finally {
    globalThis.fetch = previousFetch;
    if (previousKey === undefined) delete process.env.DEEPSEEK_API_KEY;
    else process.env.DEEPSEEK_API_KEY = previousKey;
  }
});
test.after(() => {
  rmSync(directory, { recursive: true, force: true });
});
