import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import bodies from "../src/data/blog-bodies.json";
import { database } from "../src/server/database";
import {
  deleteReadingNote,
  getReadingInterests,
  getArticleReadingInterest,
  inferredReadingExpectations,
  mergeReadingInterests,
  recordReadingInterest,
  saveReadingNote,
} from "../src/server/reading-interests";
import { emptyExpectations, type Account } from "../src/features/planner/types";
import { POST } from "../src/app/api/reading-interest/route";

process.env.DATABASE_PATH = ":memory:";
const coffee = "luchshie-kofejni-peterburga";
const culture = "10-neobychnyx-muzeev-sankt-peterburga";
const food = "chto-poprobovat-v-peterburge";
function user(): Account {
  const id = randomUUID();
  database()
    .prepare("INSERT INTO users VALUES(?,?,?,?)")
    .run(id, null, "Тест читателя", new Date().toISOString());
  return { id, name: "Тест читателя", phone: null, authenticated: false };
}
function metrics(slug: string, progress = 0, activeSeconds = 0) {
  return { slug, progress, activeSeconds };
}
const paragraph = (
  bodies[food].blocks as { type: string; text?: string }[]
).find(
  (block) => block.type === "paragraph" && block.text?.includes("Пышечные"),
)!.text!;

test("reading stores bounded monotonic metrics with server-owned metadata, never submitted tags", () => {
  const u = user();
  const state = recordReadingInterest(u, {
    ...metrics(coffee, 4, 99999),
    title: "invented",
    tags: ["музеи"],
  });
  assert.equal(state.progress, 1);
  assert.equal(state.activeSeconds, 3600);
  assert.notEqual(state.article.title, "invented");
  assert.ok(!state.article.tags.includes("музеи"));
  const repeated = recordReadingInterest(u, metrics(coffee, 0.2, 2));
  assert.equal(repeated.progress, 1);
  assert.equal(repeated.activeSeconds, 3600);
  for (const input of [
    metrics("unknown"),
    metrics(coffee, NaN),
    metrics(coffee, 0.8, Infinity),
    { ...metrics(coffee), liked: "yes" },
  ])
    assert.throws(() => recordReadingInterest(u, input));
});
test("opening or quickly scrolling an article creates no inferred preference", () => {
  const u = user();
  recordReadingInterest(u, metrics(culture, 1, 29));
  recordReadingInterest(u, metrics(coffee, 0.64, 100));
  assert.equal(
    inferredReadingExpectations(u, emptyExpectations()).criteria.length,
    0,
  );
  recordReadingInterest(u, metrics(coffee, 0.65, 100));
  assert.equal(
    inferredReadingExpectations(u, emptyExpectations()).criteria[0].key,
    "restaurants",
  );
  recordReadingInterest(u, metrics(culture, 1, 30));
  assert.ok(
    inferredReadingExpectations(u, emptyExpectations()).criteria.some(
      (c) => c.key === "culture",
    ),
  );
});
test("likes are explicit strong signals, persist through metric updates and can be undone", () => {
  const u = user();
  recordReadingInterest(u, { ...metrics(coffee), liked: true });
  recordReadingInterest(u, metrics(coffee, 0.1, 3));
  assert.equal(getArticleReadingInterest(u, coffee).liked, true);
  const inferred = inferredReadingExpectations(u, emptyExpectations());
  assert.equal(inferred.criteria[0].importance, "preferred");
  assert.match(inferred.criteria[0].detail!, /Кофейни и кофе/);
  assert.match(inferred.purpose!, /Кофейни/);
  recordReadingInterest(u, { ...metrics(coffee), liked: false });
  assert.equal(
    inferredReadingExpectations(u, emptyExpectations()).criteria.length,
    0,
  );
});
test("explicit negative or required preferences and purpose are never overwritten by reading", () => {
  const u = user();
  recordReadingInterest(u, { ...metrics(coffee), liked: true });
  const explicit = {
    ...emptyExpectations(),
    purpose: "Деловая поездка",
    brandNames: ["Явный бренд"],
    criteria: [
      {
        key: "restaurants" as const,
        label: "Рестораны",
        value: false,
        importance: "required" as const,
        detail: "Рестораны не нужны",
      },
    ],
  };
  assert.deepEqual(inferredReadingExpectations(u, explicit), explicit);
  assert.deepEqual(
    inferredReadingExpectations(u, { ...explicit, purpose: null }).purpose,
    null,
  );
  assert.equal(explicit.criteria.length, 1);
});
test("notes require a canonical selected fragment, deduplicate and remain private", () => {
  const a = user(),
    b = user();
  const note = saveReadingNote(a, food, paragraph.slice(0, 160));
  assert.equal(note.notes.length, 1);
  assert.equal(
    saveReadingNote(a, food, paragraph.slice(0, 160)).notes.length,
    1,
  );
  assert.equal(getArticleReadingInterest(b, food).notes.length, 0);
  assert.throws(() => saveReadingNote(a, coffee, paragraph));
  assert.throws(() => saveReadingNote(a, food, "пышки"));
  assert.throws(() =>
    saveReadingNote(
      a,
      food,
      "Придуманный посторонний фрагмент, которого нет в исходном материале.",
    ),
  );
  assert.throws(() => deleteReadingNote(b, food, note.notes[0].id));
  const inferred = inferredReadingExpectations(a, emptyExpectations());
  assert.match(
    inferred.criteria.find((c) => c.key === "restaurants")!.detail!,
    /Пышки/,
  );
  assert.equal(deleteReadingNote(a, food, note.notes[0].id).notes.length, 0);
  assert.equal(
    inferredReadingExpectations(a, emptyExpectations()).criteria.length,
    0,
  );
});
test("a saved note outweighs passive reading when building a preferred interest description", () => {
  const u = user();
  recordReadingInterest(u, metrics(culture, 1, 90));
  saveReadingNote(u, food, paragraph.slice(0, 160));
  const inferred = inferredReadingExpectations(u, emptyExpectations());
  assert.equal(inferred.criteria[0].key, "restaurants");
  assert.ok(inferred.criteria.every((c) => c.importance === "preferred"));
  assert.ok(!("budgetMax" in inferred) && !("checkin" in inferred));
});
test("guest activity merges into an account without losing likes or duplicating notes", () => {
  const guest = user(),
    account = user();
  recordReadingInterest(guest, { ...metrics(coffee, 0.8, 35), liked: true });
  recordReadingInterest(account, metrics(coffee, 1, 50));
  saveReadingNote(guest, food, paragraph.slice(0, 160));
  saveReadingNote(account, food, paragraph.slice(0, 160));
  mergeReadingInterests(guest.id, account.id);
  const merged = getArticleReadingInterest(account, coffee);
  assert.equal(merged.liked, true);
  assert.equal(merged.activeSeconds, 50);
  assert.equal(merged.progress, 1);
  assert.equal(getArticleReadingInterest(account, food).notes.length, 1);
  assert.equal(getReadingInterests(guest).length, 0);
});
test("reading API rejects a foreign origin before creating or looking up an account", async () => {
  const response = await POST(
    new Request("http://localhost:8080/api/reading-interest", {
      method: "POST",
      headers: {
        host: "localhost:8080",
        origin: "https://other.example",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ ...metrics(coffee), liked: true }),
    }),
  );
  assert.equal(response.status, 403);
});
