import test from "node:test";
import assert from "node:assert/strict";
import { finalRankingScores } from "../src/server/final-ranking";
import type { CatalogRecord, Criterion } from "../src/features/planner/types";

function hotel(
  id: string,
  description: string,
  metrics: Record<string, number | null> = {},
): CatalogRecord {
  return {
    hotel_id: id,
    name: "",
    description_snapshot: description,
    amenities_snapshot: [],
    metrics,
    lat: 59.9,
    lon: 30.3,
    rating_snapshot: null,
    reviews_snapshot: 0,
    identity_verified: false,
    geocode_status: "unverified",
    sources: {},
  };
}
const criterion = (key: Criterion["key"], value: boolean): Criterion => ({
  key,
  value,
  importance: "preferred",
  label: key,
});
const close = (actual: number, expected: number) =>
  assert.ok(Math.abs(actual - expected) < 1e-12, `${actual} != ${expected}`);

test("character TF-IDF uses 3..5-grams, smooth IDF, sublinear term counts and L2 cosine", () => {
  const records = [hotel("a", "aaaa"), hotel("b", "aaab"), hotel("z", "zzzz")];
  const scores = finalRankingScores("aaaa", records);
  // Fallback documents have one leading/trailing space: ' aaaa ', etc.
  // aaa, ' aa' and ' aaa' occur in two documents; other grams are unique.
  const common = 1 + Math.log(4 / 3),
    rare = 1 + Math.log(4 / 2),
    repeated = 1 + Math.log(2);
  const queryNorm = Math.sqrt((repeated * common) ** 2 + rare ** 2);
  const firstNorm = Math.sqrt(
    (2 + repeated ** 2) * common ** 2 + 5 * rare ** 2,
  );
  const secondNorm = Math.sqrt(3 * common ** 2 + 6 * rare ** 2);
  close(scores.get("a")!.textScore, queryNorm / firstNorm);
  close(
    scores.get("b")!.textScore,
    (repeated * common ** 2) / (queryNorm * secondNorm),
  );
  close(scores.get("z")!.textScore, 0);
  close(scores.get("a")!.score, 1);
  close(scores.get("b")!.score, 0.5);
  close(scores.get("z")!.score, 0);
});

test("OSM scale uses interpolated p10/p90, median missing fill and ordinary 68/32 mix", () => {
  const values = [0, 10, null, 20, 30];
  const records = values.map((value, i) =>
    hotel(`scale-${i}`, "xyz", { food_within_500m: value }),
  );
  const scores = finalRankingScores("рестораны", records);
  const features = [0, 6 / 22, 0.5, 16 / 22, 1];
  records.forEach((h, i) => {
    close(scores.get(h.hotel_id)!.featureScore, features[i]);
    close(scores.get(h.hotel_id)!.score, 0.68 * (i / 4) + 0.32 * features[i]);
  });
});

test("quiet reverses nightlife only, weights it by four and switches the score mix to 40/60", () => {
  const records = [0, 10, 20, 30].map((value, i) =>
    hotel(`quiet-${i}`, "xyz", {
      nightlife_within_500m: value,
      food_within_500m: value,
    }),
  );
  const scores = finalRankingScores("тихий отель с ресторанами", records);
  const scales = [0, 7 / 24, 17 / 24, 1];
  records.forEach((h, i) => {
    const expectedFeature = (4 * (1 - scales[i]) + scales[i]) / 5;
    close(scores.get(h.hotel_id)!.featureScore, expectedFeature);
    close(scores.get(h.hotel_id)!.score, (0.4 * i) / 3 + 0.6 * expectedFeature);
  });
  const quietOnly = finalRankingScores("тихий отель", records);
  assert.ok(quietOnly.get("quiet-0")!.score > quietOnly.get("quiet-3")!.score);
});

test("changing the query changes character-text correspondence without using E5 vectors", () => {
  const records = [
    hotel("culture", "Музей, картины, выставка, искусство"),
    hotel("food", "Ресторан, блюда, повар, вкусная еда"),
  ];
  const culture = finalRankingScores("музей картины", records);
  const food = finalRankingScores("ресторан блюда", records);
  assert.ok(culture.get("culture")!.textScore > culture.get("food")!.textScore);
  assert.ok(food.get("food")!.textScore > food.get("culture")!.textScore);
  assert.ok(culture.get("culture")!.score > culture.get("food")!.score);
  assert.ok(food.get("food")!.score > food.get("culture")!.score);
});

test("explicit negative criteria disable auto-inferred quiet and restaurant preferences", () => {
  const records = [0, 10, 20].map((value, i) =>
    hotel(`negative-${i}`, "xyz", {
      nightlife_within_500m: value,
      food_within_500m: value,
    }),
  );
  const scores = finalRankingScores("тихий отель с ресторанами", records, [
    criterion("quiet", false),
    criterion("restaurants", false),
  ]);
  records.forEach((h, i) => {
    close(scores.get(h.hotel_id)!.featureScore, 0.5);
    close(scores.get(h.hotel_id)!.score, i / 2);
  });
});

test("only a literal nightlife bound excludes; soft quiet does not exclude unknown facts", () => {
  const records = [0, 5, 6, null].map((value, i) =>
    hotel(`limit-${i}`, "xyz", {
      nightlife_within_500m: value,
      groceries_within_500m: 1000,
    }),
  );
  const scores = finalRankingScores("не больше 5 баров", records);
  assert.deepEqual(
    records.map((h) => scores.get(h.hotel_id)!.excluded),
    [false, false, true, true],
  );
  const soft = finalRankingScores("подальше от баров, хочу тишины", records);
  assert.ok([...soft.values()].every((s) => !s.excluded));
});

test("bars, groceries and named-brand shopping remain distinct signals", () => {
  const records = [
    hotel("low-bars", "xyz", {
      nightlife_within_500m: 1,
      groceries_within_500m: 100,
    }),
    hotel("many-bars", "xyz", {
      nightlife_within_500m: 100,
      groceries_within_500m: 1,
    }),
  ];
  const bars = finalRankingScores("бары", records);
  const groceries = finalRankingScores("магазины", records);
  close(bars.get("low-bars")!.featureScore, 0);
  close(bars.get("many-bars")!.featureScore, 1);
  close(groceries.get("low-bars")!.featureScore, 1);
  close(groceries.get("many-bars")!.featureScore, 0);
  const brands = finalRankingScores("магазины конкретных брендов", records, [
    criterion("brands", true),
  ]);
  assert.ok([...brands.values()].every((s) => s.featureScore === 0.5));
  const explicitGroceries = finalRankingScores(
    "магазины конкретных брендов",
    records,
    [criterion("brands", true), criterion("groceries", true)],
  );
  close(explicitGroceries.get("low-bars")!.featureScore, 1);
});

test("unknown/constant metrics are neutral and nearest pharmacy reverses distance", () => {
  const records = [0, 10, 20].map((value, i) =>
    hotel(`pharmacy-${i}`, "xyz", {
      nearest_pharmacy_m: value,
      culture_within_500m: null,
    }),
  );
  const unknown = finalRankingScores("музей", records);
  assert.ok([...unknown.values()].every((s) => s.featureScore === 0.5));
  const pharmacy = finalRankingScores("аптека", records);
  close(pharmacy.get("pharmacy-0")!.featureScore, 1);
  close(pharmacy.get("pharmacy-1")!.featureScore, 0.5);
  close(pharmacy.get("pharmacy-2")!.featureScore, 0);
});

test("hashed cache changes with corpus text, and empty corpora/queries are safe", () => {
  const records = [
    hotel("cache-a", "Музей картины"),
    hotel("cache-b", "Ресторан блюда"),
  ];
  const before = finalRankingScores("музей", records);
  const after = finalRankingScores("музей", [
    { ...records[0], description_snapshot: "Ресторан блюда" },
    { ...records[1], description_snapshot: "Музей картины" },
  ]);
  assert.ok(
    before.get("cache-a")!.textScore > before.get("cache-b")!.textScore,
  );
  assert.ok(after.get("cache-a")!.textScore < after.get("cache-b")!.textScore);
  assert.equal(finalRankingScores("", []).size, 0);
  assert.ok(
    [...finalRankingScores("", records).values()].every(
      (s) => Number.isFinite(s.score) && s.textScore === 0,
    ),
  );
});
