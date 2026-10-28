/** Archive ranking: supplied E5 cosines, or explicit character TF-IDF fallback.
 * Mirrors search_engine.py's sklearn analyzer='char', ngram_range=(3,5),
 * sublinear_tf=True, smooth_idf=True, norm='l2' and percentile metric mix.
 */
import { createHash } from "node:crypto";
import type { CatalogRecord, Criterion } from "@/features/planner/types";
import { finalSearchText } from "./final-catalog";

export interface FinalRankingScore {
  score: number;
  /** Raw character TF-IDF cosine, not the subsequent ordinal rank. */
  textScore: number;
  featureScore: number;
  excluded: boolean;
}
interface Corpus {
  idf: Map<string, number>;
  vectors: Map<string, number>[];
}
interface Preferences {
  nightlifeLow?: boolean;
  nightlifeHigh?: boolean;
  foodHigh?: boolean;
  cultureHigh?: boolean;
  groceriesHigh?: boolean;
  pharmacyNear?: boolean;
  maxNightlife?: number;
}
const shared = globalThis as typeof globalThis & {
  __finalRankingCorpora?: Map<string, Corpus>;
};

function ngrams(value: string): Map<string, number> {
  // sklearn's char analyzer lowercases then collapses whitespace runs.
  const valueLower = value.toLowerCase().replace(/\s{2,}/gu, " ");
  const points = Array.from(valueLower);
  const counts = new Map<string, number>();
  for (let size = 3; size <= 5; size++) {
    for (let index = 0; index + size <= points.length; index++) {
      const gram = points.slice(index, index + size).join("");
      counts.set(gram, (counts.get(gram) ?? 0) + 1);
    }
  }
  return counts;
}
function corpusFor(records: CatalogRecord[]): Corpus {
  const texts = records.map(
    (record) =>
      finalSearchText(record.hotel_id) ||
      [
        record.name,
        record.description_snapshot,
        record.amenities_snapshot.join(" "),
      ].join(" "),
  );
  const hash = createHash("sha256");
  for (let i = 0; i < records.length; i++) {
    hash.update(records[i].hotel_id).update("\0").update(texts[i]).update("\0");
  }
  const key = hash.digest("hex");
  const cache = (shared.__finalRankingCorpora ??= new Map());
  const found = cache.get(key);
  if (found) return found;
  const vectors = texts.map(ngrams);
  const df = new Map<string, number>();
  for (const vector of vectors)
    for (const gram of vector.keys()) df.set(gram, (df.get(gram) ?? 0) + 1);
  const idf = new Map<string, number>();
  for (const [gram, count] of df)
    idf.set(gram, Math.log((1 + records.length) / (1 + count)) + 1);
  for (const vector of vectors) {
    let squared = 0;
    for (const [gram, count] of vector) {
      const weight = (1 + Math.log(count)) * idf.get(gram)!;
      vector.set(gram, weight);
      squared += weight * weight;
    }
    const norm = Math.sqrt(squared);
    if (norm)
      for (const [gram, value] of vector) vector.set(gram, value / norm);
  }
  const corpus = { idf, vectors };
  if (cache.size >= 3) cache.delete(cache.keys().next().value!);
  cache.set(key, corpus);
  return corpus;
}
function cosineScores(query: string, corpus: Corpus): number[] {
  const vector = ngrams(query);
  let squared = 0;
  for (const [gram, count] of vector) {
    const idf = corpus.idf.get(gram);
    if (idf === undefined) {
      vector.delete(gram);
      continue;
    }
    const weight = (1 + Math.log(count)) * idf;
    vector.set(gram, weight);
    squared += weight * weight;
  }
  const norm = Math.sqrt(squared);
  if (!norm) return corpus.vectors.map(() => 0);
  for (const [gram, value] of vector) vector.set(gram, value / norm);
  return corpus.vectors.map((document) => {
    let score = 0;
    for (const [gram, weight] of vector)
      score += weight * (document.get(gram) ?? 0);
    return Math.max(0, Math.min(1, score));
  });
}
function preferences(query: string, explicit: Criterion[]): Preferences {
  const q = query.toLowerCase();
  const has = (parts: string[]) => parts.some((part) => q.includes(part));
  const result: Preferences = {
    nightlifeLow: has([
      "тих",
      "спокойн",
      "выспаться",
      "без шума",
      "подальше от бар",
      "подальше от ночн",
      "без клубов",
      "не хочу бар",
    ]),
    foodHigh: has(["рестора", "кафе", "поесть", "гастроном", "вкусно"]),
    cultureHigh: has(["музе", "достопримеч", "галере", "культур", "выставк"]),
    groceriesHigh: has(["магазин", "продукт", "супермаркет"]),
    pharmacyNear: q.includes("аптек"),
  };
  result.nightlifeHigh =
    !result.nightlifeLow &&
    has(["бар", "клубы", "вечеринк", "ночная жизнь", "ночных заведений"]);
  const limit =
    /(?:не более|не больше|максимум|до)\s+(\d+)\s+(?:баров|бара|бар|ночных клубов|клубов)/u.exec(
      q,
    );
  if (limit && Number.isSafeInteger(Number(limit[1])))
    result.maxNightlife = Number(limit[1]);
  const keys = {
    quiet: "nightlifeLow",
    restaurants: "foodHigh",
    culture: "cultureHigh",
    groceries: "groceriesHigh",
    pharmacy: "pharmacyNear",
  } as const;
  for (const criterion of explicit) {
    const key = keys[criterion.key as keyof typeof keys];
    if (key) result[key] = criterion.value;
    if (criterion.key === "quiet" && criterion.value)
      result.nightlifeHigh = false;
  }
  // Named-brand shopping is not evidence for nearby food shops. An explicit
  // groceries choice still wins; no center/walk-distance feature is fabricated.
  if (
    explicit.some(
      (c) =>
        ["shopping", "malls", "brands", "localShops"].includes(c.key) &&
        c.value,
    ) &&
    !explicit.some((c) => c.key === "groceries")
  )
    result.groceriesHigh = false;
  return result;
}
function percentile(sorted: number[], fraction: number): number {
  const position = (sorted.length - 1) * fraction;
  const lower = Math.floor(position),
    upper = Math.ceil(position);
  return sorted[lower] + (sorted[upper] - sorted[lower]) * (position - lower);
}
function metricScale(
  records: CatalogRecord[],
  key: string,
  reverse = false,
): number[] {
  const values = records.map((record) => record.metrics[key]);
  const known = values
    .filter(
      (value): value is number =>
        typeof value === "number" && Number.isFinite(value),
    )
    .sort((a, b) => a - b);
  if (!known.length) return records.map(() => 0.5);
  const median = percentile(known, 0.5);
  const filled = values.map((value) =>
    typeof value === "number" && Number.isFinite(value) ? value : median,
  );
  const sorted = [...filled].sort((a, b) => a - b);
  const lo = percentile(sorted, 0.1),
    hi = percentile(sorted, 0.9);
  return filled.map((value) => {
    const scaled =
      hi <= lo ? 0.5 : Math.max(0, Math.min(1, (value - lo) / (hi - lo)));
    return reverse ? 1 - scaled : scaled;
  });
}

export function finalRankingScores(
  query: string,
  records: CatalogRecord[],
  explicitCriteria: Criterion[] = [],
  options?: {
    hardQuery?: string;
    semanticScores?: ReadonlyMap<string, number>;
  },
): Map<string, FinalRankingScore> {
  if (!records.length) return new Map();
  const rawText = options?.semanticScores
    ? records.map((record) => {
        const score = options.semanticScores!.get(record.hotel_id);
        if (score === undefined) throw Error("Missing E5 hotel ID");
        return score;
      })
    : cosineScores(query, corpusFor(records));
  const prefs = preferences(query, explicitCriteria);
  if (options?.hardQuery !== undefined)
    prefs.maxNightlife = preferences(options.hardQuery, []).maxNightlife;
  const features: { values: number[]; weight: number }[] = [];
  const add = (metric: string, reverse = false, weight = 1) =>
    features.push({ values: metricScale(records, metric, reverse), weight });
  if (prefs.foodHigh) add("food_within_500m");
  if (prefs.nightlifeLow) add("nightlife_within_500m", true, 4);
  if (prefs.nightlifeHigh) add("nightlife_within_500m");
  if (prefs.cultureHigh) add("culture_within_500m");
  if (prefs.groceriesHigh) add("groceries_within_500m");
  if (prefs.pharmacyNear) add("nearest_pharmacy_m", true);
  // numpy's double argsort assigns ordinal ranks. Equal scores use stable input
  // order here so ties do not depend on the runtime's sorting implementation.
  const order = rawText
    .map((score, index) => ({ score, index }))
    .sort((a, b) => a.score - b.score || a.index - b.index);
  const ranks = records.map(() => 0);
  order.forEach(({ index }, rank) => {
    ranks[index] = rank / Math.max(records.length - 1, 1);
  });
  const featureWeight = features.reduce(
    (sum, feature) => sum + feature.weight,
    0,
  );
  return new Map(
    records.map((record, index) => {
      const featureScore = featureWeight
        ? features.reduce(
            (sum, feature) => sum + feature.values[index] * feature.weight,
            0,
          ) / featureWeight
        : 0.5;
      const score = !features.length
        ? ranks[index]
        : prefs.nightlifeLow
          ? 0.4 * ranks[index] + 0.6 * featureScore
          : 0.68 * ranks[index] + 0.32 * featureScore;
      const nightlife = record.metrics.nightlife_within_500m;
      const excluded =
        prefs.maxNightlife !== undefined &&
        (typeof nightlife !== "number" ||
          !Number.isFinite(nightlife) ||
          nightlife > prefs.maxNightlife);
      return [
        record.hotel_id,
        { score, textScore: rawText[index], featureScore, excluded },
      ];
    }),
  );
}
