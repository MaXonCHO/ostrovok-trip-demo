import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { database } from "../src/server/database";
import { emptyTripChatProfile } from "../src/features/ostrovok/trip-chat-contract";
import { emptyExpectations, type Account } from "../src/features/planner/types";
import {
  recordReadingInterest,
  inferredReadingExpectations,
} from "../src/server/reading-interests";
import { rankHotels } from "../src/server/recommendations";
process.env.DATABASE_PATH = ":memory:";
test("liking a food article changes real hotel ranking, preserves explicit conditions and unlike removes the signal", () => {
  const user: Account = {
    id: randomUUID(),
    name: "Читатель",
    phone: null,
    authenticated: false,
  };
  database()
    .prepare("INSERT INTO users VALUES(?,?,?,?)")
    .run(user.id, null, user.name, new Date().toISOString());
  const profile = emptyTripChatProfile();
  const explicit = emptyExpectations();
  const before = rankHotels(profile, explicit);
  recordReadingInterest(user, {
    slug: "chto-poprobovat-v-peterburge",
    progress: 0.8,
    activeSeconds: 2,
    liked: true,
  });
  const inferred = inferredReadingExpectations(user, explicit);
  assert.ok(
    inferred.criteria.some(
      (c) => c.key === "restaurants" && c.importance === "preferred",
    ),
  );
  assert.deepEqual(explicit.criteria, []);
  const after = rankHotels(profile, inferred);
  assert.notDeepEqual(
    after.results.map((h) => h.hotel.id),
    before.results.map((h) => h.hotel.id),
  );
  assert.ok(
    after.results.some((h) => h.reasons.some((r) => r.includes("из чтения"))),
  );
  const negative = {
    ...explicit,
    criteria: [
      {
        key: "restaurants" as const,
        label: "Рестораны",
        value: false,
        importance: "required" as const,
      },
    ],
  };
  assert.deepEqual(
    inferredReadingExpectations(user, negative).criteria,
    negative.criteria,
  );
  assert.equal(inferredReadingExpectations(user, negative).purpose, null);
  recordReadingInterest(user, {
    slug: "chto-poprobovat-v-peterburge",
    progress: 0.8,
    activeSeconds: 2,
    liked: false,
  });
  assert.deepEqual(inferredReadingExpectations(user, explicit).criteria, []);
});
