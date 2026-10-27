import test, { before, after } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
import {
  createTrip,
  mutateTrip,
  participant,
  viewTrip,
} from "../src/application/trips";
import { providers } from "../src/data/providers";
import {
  collective,
  commonScenarios,
  recordVote,
  newRevision,
  matchedHotels,
  finalIsReady,
  decisionFor,
} from "../src/domain/rules";
import { externalHotelSchema } from "../src/data/adapters/catalog";
import { JsonFileTripRepository } from "../src/data/adapters/json-file";
import type { Trip, Decision } from "../src/domain/models";
let dir: string;
const original = process.env.TRIP_DATA_DIR;
before(async () => {
  dir = await mkdtemp(join(tmpdir(), "ostrovok-test-"));
  process.env.TRIP_DATA_DIR = dir;
});
after(async () => {
  await rm(dir, { recursive: true, force: true });
  if (original === undefined) delete process.env.TRIP_DATA_DIR;
  else process.env.TRIP_DATA_DIR = original;
});
const create = () =>
  createTrip(randomUUID(), {
    name: "Тест",
    cityId: "sochi",
    group: false,
    expectedParticipants: 1,
    nights: 4,
    rooms: 1,
  });
function vote(
  t: Trip,
  p: string,
  type: "scenario" | "hotel",
  id: string,
  d: Decision,
) {
  recordVote(t, {
    participantId: p,
    selectionRevision: t.selectionRevision,
    entityType: type,
    entityId: id,
    decision: d,
    updatedAt: new Date().toISOString(),
  });
}
async function scenarios(t: Trip) {
  t.scenarios = await providers().recommendations.getScenarios({ trip: t });
}
test("Scenario intersection supports one, two or three selections", async () => {
  for (const count of [1, 2, 3]) {
    const t = await create();
    await scenarios(t);
    t.participants[0].scenariosConfirmed = true;
    t.scenarios.forEach((s, i) =>
      vote(
        t,
        t.organizerId,
        "scenario",
        s.id,
        i < count ? "liked" : "rejected",
      ),
    );
    assert.equal(commonScenarios(t).length, count);
  }
});
test("Missing participant is waiting, one rejection excludes", async () => {
  const t = await create();
  t.group = true;
  t.expectedParticipants = 2;
  await scenarios(t);
  t.participants[0].scenariosConfirmed = true;
  vote(t, t.organizerId, "scenario", t.scenarios[0].id, "liked");
  assert.equal(collective(t, "scenario", t.scenarios[0].id), "waiting");
  const p = participant(randomUUID(), "Спутник");
  p.scenariosConfirmed = true;
  t.participants.push(p);
  vote(t, p.id, "scenario", t.scenarios[0].id, "rejected");
  assert.equal(collective(t, "scenario", t.scenarios[0].id), "rejected");
});
test("Hotel rejection and undo do not change scenario votes", async () => {
  const t = await create();
  await scenarios(t);
  vote(t, t.organizerId, "scenario", t.scenarios[0].id, "liked");
  vote(t, t.organizerId, "hotel", "h1", "rejected");
  assert.equal(
    decisionFor(t, t.organizerId, "scenario", t.scenarios[0].id),
    "liked",
  );
  vote(t, t.organizerId, "hotel", "h1", "unseen");
  assert.equal(collective(t, "hotel", "h1"), "waiting");
});
test("New revision preserves history and invalidates votes and confirmations", async () => {
  const t = await create();
  await scenarios(t);
  vote(t, t.organizerId, "hotel", "h1", "liked");
  t.proposal = {
    hotelId: "h1",
    roomTypeId: "x",
    price: 4000,
    selectionRevision: 1,
    confirmationIds: [t.organizerId],
    proposedBy: t.organizerId,
  };
  newRevision(t, "Changed budget");
  assert.equal(t.selectionRevision, 2);
  assert.equal(decisionFor(t, t.organizerId, "hotel", "h1"), "unseen");
  assert.equal(t.proposal, null);
  assert.equal(t.history[0].votes.length, 1);
});
test("Unknown mandatory quiet is not a confirmed match", async () => {
  const t = await create();
  await scenarios(t);
  t.participants[0].preferences = [
    {
      id: randomUUID(),
      participantId: t.organizerId,
      key: "interest:quiet",
      value: true,
      importance: "required",
      priority: 1,
      updatedAt: new Date().toISOString(),
    },
  ];
  const hs = await providers().recommendations.getHotels({
    trip: t,
    scenarioIds: t.scenarios.map((s) => s.id),
  });
  assert.ok(
    hs.every((c) => {
      const h = providers().catalog.getHotel(c.hotelId);
      return !!h;
    }),
  );
  const all = await providers().catalog.listHotels({ cityId: "sochi" });
  assert.ok(
    hs.every((c) => all.find((h) => h.id === c.hotelId)?.quiet !== false),
  );
  for (const c of hs.filter((c) => c.needsClarification)) {
    t.candidates.push(c);
    vote(t, t.organizerId, "hotel", c.hotelId, "liked");
    assert.ok(!matchedHotels(t).includes(c.hotelId));
  }
});
test("Final confirmation is separate from a unanimous like", async () => {
  const t = await create();
  t.candidates = [
    {
      hotelId: "h1",
      roomTypeId: "h1-standard",
      scenarioIds: [],
      price: {
        amount: 5000,
        currency: "RUB",
        basis: "room_night",
        isSynthetic: true,
      },
      participantReasons: {},
      tradeoffs: [],
      evidenceIds: [],
      needsClarification: false,
    },
  ];
  vote(t, t.organizerId, "hotel", "h1", "liked");
  assert.equal(finalIsReady(t), false);
  t.proposal = {
    hotelId: "h1",
    roomTypeId: "h1-standard",
    price: 5000,
    selectionRevision: 1,
    confirmationIds: [],
    proposedBy: t.organizerId,
  };
  assert.equal(finalIsReady(t), false);
  t.proposal.confirmationIds = [t.organizerId];
  assert.equal(finalIsReady(t), true);
});
test("Optimistic concurrency rejects stale writes without losing first write", async () => {
  const t = await create();
  const repo = providers().trips;
  const results = await Promise.allSettled([
    repo.applyCommand(t.id, 0, (v) => {
      v.title = "A";
    }),
    repo.applyCommand(t.id, 0, (v) => {
      v.nights = 8;
    }),
  ]);
  assert.equal(results.filter((r) => r.status === "fulfilled").length, 1);
  const r = await repo.get(t.id);
  assert.equal(r!.version, 1);
  assert.equal(r!.title, "A");
});
test("Idempotent command is applied once", async () => {
  const t = await create();
  const commandId = randomUUID();
  const first = await mutateTrip(t.id, t.organizerId, 0, commandId, {
    type: "message",
    text: "Хочу море",
  });
  const again = await mutateTrip(t.id, t.organizerId, 0, commandId, {
    type: "message",
    text: "Хочу море",
  });
  assert.equal(first.version, again.version);
  assert.equal(
    again.participants[0].messages.filter((m) => m.role === "user").length,
    1,
  );
});
test("View does not reveal private chats of other participants", async () => {
  const t = await create();
  const p = participant(randomUUID(), "Секрет");
  p.messages.push({
    id: "x",
    role: "user",
    text: "Private secret",
    createdAt: new Date().toISOString(),
  });
  t.participants.push(p);
  const view = await viewTrip(t, t.organizerId, "http://localhost:8080");
  assert.ok(!JSON.stringify(view).includes("Private secret"));
  await assert.rejects(() =>
    viewTrip(t, randomUUID(), "http://localhost:8080"),
  );
});
test("A fresh repository instance reads the same persisted data", async () => {
  const t = await create();
  const repo = new JsonFileTripRepository();
  assert.equal((await repo.get(t.id))!.organizerId, t.organizerId);
});
test("Budget basis uses all rooms and nights for stay price", async () => {
  const t = await create();
  t.rooms = 2;
  t.nights = 4;
  await scenarios(t);
  t.participants[0].preferences = [
    {
      id: "a",
      participantId: t.organizerId,
      key: "budget",
      value: 10000,
      importance: "required",
      priority: 1,
      updatedAt: "2026-10-27",
    },
    {
      id: "b",
      participantId: t.organizerId,
      key: "budgetBasis",
      value: "stay",
      importance: "preferred",
      priority: 1,
      updatedAt: "2026-10-27",
    },
  ];
  const hs = await providers().recommendations.getHotels({
    trip: t,
    scenarioIds: t.scenarios.map((s) => s.id),
  });
  assert.ok(
    hs.every((h) => h.price.amount === null || h.price.amount * 8 <= 10000),
  );
});
test("External mapping rejects currency and unit confusion", () => {
  const valid = {
    id: "h",
    cityId: "sochi",
    price: 5000,
    currency: "RUB",
    basis: "room_night",
    walkMinutes: 12,
    walkUnit: "minutes",
  };
  assert.equal(externalHotelSchema.safeParse(valid).success, true);
  assert.equal(
    externalHotelSchema.safeParse({ ...valid, currency: "USD" }).success,
    false,
  );
  assert.equal(
    externalHotelSchema.safeParse({ ...valid, walkUnit: "meters" }).success,
    false,
  );
});
test("Provider config fails explicitly for unimplemented API", () => {
  process.env.GEO_PROVIDER = "api";
  assert.throws(() => providers(), /пока не подключён/);
  delete process.env.GEO_PROVIDER;
});
test("Mock agent recognizes corrections and keeps visual rejection separate", async () => {
  const t = await create();
  const r = await providers().agent.reply({
    trip: t,
    participantId: t.organizerId,
    text: "Не хочу море, хочу тишину, бюджет до 7000 рублей за ночь",
  });
  assert.equal(r.updates.find((p) => p.key === "interest:sea")?.value, false);
  assert.equal(r.updates.find((p) => p.key === "interest:quiet")?.value, true);
  assert.equal(r.updates.find((p) => p.key === "budget")?.value, 7000);
});
test("All required interests are respected, capacity includes number of rooms", async () => {
  const t = await create();
  await scenarios(t);
  t.participants[0].preferences = [
    {
      id: "r",
      participantId: t.organizerId,
      key: "interest:sea",
      value: true,
      importance: "required",
      priority: 1,
      updatedAt: "2026-10-27",
    },
  ];
  const hs = await providers().recommendations.getHotels({
    trip: t,
    scenarioIds: t.scenarios.map((s) => s.id),
  });
  const catalog = await providers().catalog.listHotels({ cityId: "sochi" });
  assert.ok(
    hs.every((c) =>
      catalog.find((h) => h.id === c.hotelId)!.interests.includes("sea"),
    ),
  );
  t.expectedParticipants = 3;
  assert.equal(
    (
      await providers().recommendations.getHotels({
        trip: t,
        scenarioIds: t.scenarios.map((s) => s.id),
      })
    ).length,
    0,
  );
  t.rooms = 2;
  assert.ok(
    (
      await providers().recommendations.getHotels({
        trip: t,
        scenarioIds: t.scenarios.map((s) => s.id),
      })
    ).length > 0,
  );
});
test("Every supported city returns three scenarios from one city", async () => {
  const t = await create();
  for (const city of ["sochi", "spb", "kazan"]) {
    t.cityId = city;
    const ss = await providers().recommendations.getScenarios({ trip: t });
    assert.equal(ss.length, 3);
    assert.ok(ss.every((s) => s.cityId === city));
  }
});
test("Rejection reason influences the next ranking without changing scenario interest", async () => {
  const t = await create();
  await scenarios(t);
  const ids = t.scenarios.map((s) => s.id);
  const before = await providers().recommendations.getHotels({
    trip: t,
    scenarioIds: ids,
  });
  const id = before[0].hotelId;
  vote(t, t.organizerId, "hotel", id, "rejected");
  t.votes[0].rejectionReason = { code: "room" };
  const after = await providers().recommendations.getHotels({
    trip: t,
    scenarioIds: ids,
  });
  assert.notEqual(after[0].hotelId, id);
  assert.equal(t.scenarios.length, 3);
});
test("Repeating a wish cannot silently weaken its required importance", async () => {
  const t = await create();
  t.participants[0].preferences = [
    {
      id: "x",
      participantId: t.organizerId,
      key: "interest:quiet",
      value: true,
      importance: "required",
      priority: 1,
      updatedAt: "2026-10-27",
    },
  ];
  const r = await providers().agent.reply({
    trip: t,
    participantId: t.organizerId,
    text: "Хочу тишину и море",
  });
  assert.equal(
    r.updates.find((u) => u.key === "interest:quiet")!.importance,
    "required",
  );
  const soft = await providers().agent.reply({
    trip: t,
    participantId: t.organizerId,
    text: "Тишина необязательна",
  });
  assert.equal(
    soft.updates.find((u) => u.key === "interest:quiet")!.importance,
    "preferred",
  );
});
test("Changed catalog price resets proposal confirmations without accepting stale conditions", async () => {
  const t = await create();
  const { fixtureCatalog } = await import("../src/data/adapters/catalog");
  const hotel = fixtureCatalog.hotels.find((h) => h.id === "h1")!;
  const originalPrice = hotel.price;
  const repo = providers().trips;
  const ready = await repo.applyCommand(t.id, 0, (v) => {
    v.candidates = [
      {
        hotelId: hotel.id,
        roomTypeId: hotel.room.id,
        scenarioIds: [],
        price: {
          amount: hotel.price,
          currency: "RUB",
          basis: "room_night",
          isSynthetic: true,
        },
        participantReasons: {},
        tradeoffs: [],
        evidenceIds: [],
        needsClarification: false,
      },
    ];
    vote(v, v.organizerId, "hotel", hotel.id, "liked");
    v.proposal = {
      hotelId: hotel.id,
      roomTypeId: hotel.room.id,
      price: hotel.price,
      selectionRevision: 1,
      confirmationIds: [],
      proposedBy: v.organizerId,
    };
  });
  try {
    hotel.price = originalPrice! + 100;
    const after = await mutateTrip(
      t.id,
      t.organizerId,
      ready.version,
      randomUUID(),
      { type: "confirmFinal" },
    );
    assert.equal(after.proposal, null);
    assert.equal(after.selected, null);
    assert.match(after.lastChange!, /сброшены/);
  } finally {
    hotel.price = originalPrice;
  }
});

test("Real catalog keeps object photos, unknown ratings and no invented guest reviews", async () => {
  const catalog = providers().catalog;
  for (const cityId of ["sochi", "spb", "kazan"]) {
    const hotels = await catalog.listHotels({ cityId });
    assert.equal(hotels.length, cityId === "sochi" ? 12 : 3);
    for (const hotel of hotels) {
      assert.equal(hotel.rating, null);
      assert.equal(hotel.reviewExcerpts.length, 0);
      assert.equal(hotel.gallery.length, 3);
      assert.ok(
        hotel.evidence.some(
          (e) => e.featureKey === "identity" && !e.isSynthetic,
        ),
      );
      for (const photo of hotel.gallery) {
        assert.equal(photo.illustrative, false);
        assert.ok(photo.source.startsWith("https://"));
        assert.ok(photo.path.startsWith("/demo/real/"));
      }
      assert.ok(
        hotel.room.images.every(
          (p) => p.kind === "room" && hotel.gallery.some((a) => a.id === p.id),
        ),
      );
    }
  }
});
