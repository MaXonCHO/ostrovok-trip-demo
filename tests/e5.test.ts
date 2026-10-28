import test from "node:test";
import assert from "node:assert/strict";
import ids from "../data/final/hotel_embedding_ids.json";
import metadata from "../data/final/embedding_metadata.json";
import { validateE5Scores, e5Scores, E5_MODEL } from "../src/server/e5-client";
import { rankHotels } from "../src/server/recommendations";
import { catalogRecords } from "../src/server/database";
import { emptyTripChatProfile } from "../src/features/ostrovok/trip-chat-contract";
import { emptyExpectations } from "../src/features/planner/types";
process.env.DATABASE_PATH = ":memory:";
const packet = () => ({
  engine: "e5",
  model: E5_MODEL,
  dimension: 384,
  textSha256: metadata.text_file_sha256,
  count: ids.length,
  scores: ids.map((hotel_id, i) => ({ hotel_id, score: i / ids.length })),
});
test("E5 validates model, complete catalog IDs and source hash; row order is irrelevant", () => {
  const a = packet(),
    b = packet();
  b.scores.reverse();
  assert.deepEqual(
    [...validateE5Scores(a)].sort(),
    [...validateE5Scores(b)].sort(),
  );
  const broken = packet();
  broken.scores[0].hotel_id = broken.scores[1].hotel_id;
  assert.throws(() => validateE5Scores(broken));
  for (const bad of [
    { ...a, engine: "tfidf" },
    { ...a, model: "other" },
    { ...a, dimension: 768 },
    { ...a, textSha256: "wrong" },
    { ...a, scores: a.scores.slice(1) },
  ])
    assert.throws(() => validateE5Scores(bad));
  const unknown = packet();
  unknown.scores[0].hotel_id = "unknown";
  assert.throws(() => validateE5Scores(unknown));
  const nan = packet();
  nan.scores[0].score = NaN;
  assert.throws(() => validateE5Scores(nan));
});
test("E5 reranks by stable ID and preserves hard filtering and hotel identity", () => {
  const p = emptyTripChatProfile(),
    e = {
      ...emptyExpectations(),
      purpose: "Хочу тихий отель, не более 2 баров",
      criteria: [
        {
          key: "quiet" as const,
          label: "Тишина",
          importance: "required" as const,
          value: true,
          detail: "не более 2 баров",
        },
      ],
    };
  const records = catalogRecords(),
    scores = validateE5Scores(packet());
  const fallback = rankHotels(p, e, 1, records),
    semantic = rankHotels(p, e, 1, records, scores);
  const reverse = rankHotels(
    p,
    e,
    1,
    records,
    validateE5Scores({ ...packet(), scores: packet().scores.reverse() }),
  );
  assert.equal(semantic.engine, "e5");
  assert.equal(fallback.engine, "tfidf+facts");
  assert.equal(semantic.excludedCount, fallback.excludedCount);
  assert.deepEqual(semantic, reverse);
  for (const result of [...semantic.results, ...semantic.needsCheck]) {
    const record = records.find((r) => r.hotel_id === result.hotel.id)!;
    assert.equal(result.hotel.name, record.name);
    assert((record.metrics.nightlife_within_500m as number) <= 2);
  }
  assert.equal(semantic.matchingCount, fallback.matchingCount);
  assert.equal(semantic.unverifiedCount, fallback.unverifiedCount);
});
test("E5 failure never silently falls back to TF-IDF", async () => {
  const previous = process.env.E5_BASE_URL,
    original = globalThis.fetch;
  process.env.E5_BASE_URL = "http://127.0.0.1:19999/";
  try {
    globalThis.fetch = async () => Response.json({ engine: "tfidf" });
    await assert.rejects(
      e5Scores("test explicit failure"),
      /E5 сейчас недоступен/,
    );
  } finally {
    globalThis.fetch = original;
    if (previous === undefined) delete process.env.E5_BASE_URL;
    else process.env.E5_BASE_URL = previous;
  }
});
