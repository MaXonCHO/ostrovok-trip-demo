import { catalogHotel, catalogRecords } from "./database";
import { finalRankingScores } from "./final-ranking";
import type {
  CatalogRecord,
  Criterion,
  CriterionKey,
  Expectations,
  RankedHotel,
  Selection,
  EvidenceItem,
} from "@/features/planner/types";
import type { TripChatProfile } from "@/features/ostrovok/trip-chat-contract";
import { labels } from "@/features/planner/criteria";
export { labels } from "@/features/planner/criteria";
const amenities: Partial<Record<CriterionKey, string[]>> = {
  wifi: ["Бесплатный Wi-Fi"],
  parking: ["Парковка", "Бесплатная общественная парковка поблизости"],
  breakfast: ["Завтрак", "Завтрак в номер"],
  children: ["Размещение подходит для семей/детей", "Семейные номера"],
};
const metricKeys: Partial<Record<CriterionKey, string>> = {
  restaurants: "food_within_500m",
  culture: "culture_within_500m",
  groceries: "groceries_within_500m",
  pharmacy: "pharmacy_within_500m",
  quiet: "nightlife_within_500m",
  walks: "culture_within_500m",
};
function terms(q: string) {
  return (
    q
      .toLowerCase()
      .replaceAll("ё", "е")
      .match(/[\p{L}\d]{3,}/gu)
      ?.map((s) => (s.length > 6 ? s.slice(0, -2) : s)) ?? []
  );
}
function numeric(h: CatalogRecord, key: string) {
  const n = h.metrics[key];
  return typeof n === "number" && Number.isFinite(n) ? n : null;
}
export function evidenceFor(
  h: CatalogRecord,
  expectations: Expectations,
): EvidenceItem[] {
  const wanted = new Set(
    expectations.criteria.filter((c) => c.value).map((c) => c.key),
  );
  const out: EvidenceItem[] = [];
  const add = (label: string, value: string) =>
    out.push({
      label,
      value,
      source: h.sources.neighborhood,
      date: "2026-10-17",
      status: h.identity_verified ? "snapshot" : "unverified",
      method: h.sources.distances,
    });
  if (wanted.has("restaurants")) {
    const n = numeric(h, "food_within_500m");
    if (n !== null)
      add(
        "Кафе и рестораны",
        `${n} отмеченных точек в радиусе 500 м по прямой`,
      );
  }
  if (wanted.has("culture") || wanted.has("walks")) {
    const n = numeric(h, "culture_within_500m");
    if (n !== null)
      add("Музеи и культурные места", `${n} точек в радиусе 500 м по прямой`);
  }
  if (wanted.has("children") || wanted.has("groceries")) {
    const n = numeric(h, "groceries_within_500m");
    if (n !== null)
      add("Продуктовые магазины", `${n} точек в радиусе 500 м по прямой`);
  }
  if (wanted.has("children") || wanted.has("pharmacy")) {
    const n = numeric(h, "nearest_pharmacy_m");
    if (n !== null)
      add(
        "Ближайшая отмеченная аптека",
        `${Math.round(n)} м по прямой, не пешком`,
      );
  }
  if (wanted.has("quiet")) {
    const n = numeric(h, "nightlife_within_500m");
    if (n !== null)
      add(
        "Ночная инфраструктура",
        `${n} баров, пабов и клубов в 500 м. Это не измерение шума в номере`,
      );
  }
  for (const key of [
    "shopping",
    "malls",
    "brands",
    "localShops",
    "playground",
    "beach",
  ] as const)
    if (wanted.has(key))
      out.push({
        label: labels[key],
        value:
          "Названия, состав магазинов и пешие маршруты в источнике отсутствуют",
        source: "Каталог ostrovok_embedding_mvp",
        date: null,
        status: "unknown",
        method: "Сведения об этом условии отсутствуют в каталоге",
      });
  return out.slice(0, 6);
}
interface Evaluation {
  known: boolean;
  matches: boolean;
  strength: number;
  reason?: string;
  unknown?: string;
  tradeoff?: string;
}
function evaluate(
  h: CatalogRecord,
  c: Criterion,
  records: CatalogRecord[],
): Evaluation {
  const supported = amenities[c.key];
  if (supported) {
    const present = supported.some((a) => h.amenities_snapshot.includes(a));
    if (present)
      return {
        known: true,
        matches: c.value,
        strength: c.value ? 1 : 0,
        reason: `${c.label}: указано в архивной карточке`,
        tradeoff: c.value
          ? undefined
          : `В карточке указано «${c.label}», а вы предпочитаете без этого`,
      };
    return {
      known: false,
      matches: false,
      strength: 0.25,
      unknown: `${c.label}: нет сведений в каталоге`,
    };
  }
  const metric = metricKeys[c.key];
  if (metric) {
    const n = numeric(h, metric);
    if (n === null)
      return {
        known: false,
        matches: false,
        strength: 0.2,
        unknown: `${c.label}: нет данных об окружении`,
      };
    const max = Math.max(1, ...records.map((r) => numeric(r, metric) ?? 0));
    const raw = Math.log1p(n) / Math.log1p(max);
    const strength = c.key === "quiet" ? 1 - raw : raw;
    return {
      known: false,
      matches: false,
      strength: c.value ? strength : 1 - strength,
      reason:
        c.key === "quiet"
          ? `В OSM отмечено ${n} ночных заведений в радиусе 500 м`
          : `${c.label}: ${n} отмеченных объектов в 500 м по прямой (OSM)`,
      unknown:
        c.importance === "required"
          ? `${c.label}: нет сведений о точном соответствии условию`
          : undefined,
      tradeoff:
        c.key === "quiet" && n > 15
          ? "В окружении есть ночные заведения. По этому числу нельзя определить шум в номере"
          : undefined,
    };
  }
  return {
    known: false,
    matches: false,
    strength: 0.2,
    unknown: `${c.label}${c.detail ? ": " + c.detail : ""}: нет сведений в каталоге`,
  };
}
export function rankHotels(
  profile: TripChatProfile,
  expectations: Expectations,
  revision = 1,
  records = catalogRecords(),
  semanticScores?: ReadonlyMap<string, number>,
  limit = 8,
): Selection {
  const criteria = expectations.criteria;
  const query = rankingQuery(expectations);
  const native =
    query.trim() || semanticScores
      ? finalRankingScores(query, records, criteria, {
          semanticScores,
          hardQuery: criteria
            .filter((c) => c.importance === "required")
            .map((c) => c.detail ?? "")
            .join(" "),
        })
      : new Map();
  const wanted = terms(
    [
      expectations.purpose,
      ...criteria
        .filter((c) => c.value)
        .map((c) => c.label + " " + (c.detail ?? "")),
    ].join(" "),
  );
  const evaluated: { result: RankedHotel; excluded: boolean }[] = records.map(
    (h) => {
      const reasons: string[] = [],
        unknowns: string[] = [],
        tradeoffs: string[] = [];
      let score = 0,
        weight = 0,
        excluded = false;
      const nativeScore = native.get(h.hotel_id);
      if (nativeScore?.excluded) excluded = true;
      for (const c of criteria) {
        const e = evaluate(h, c, records);
        const w = c.importance === "required" ? 3 : 1;
        score += e.strength * w;
        weight += w;
        if (e.reason) reasons.push(e.reason);
        if (c.detail?.startsWith("Из О!Блога:"))
          reasons.unshift(
            `Учтён интерес из чтения: ${c.detail.slice(12).trim()}`,
          );
        if (e.unknown) unknowns.push(e.unknown);
        if (e.tradeoff) tradeoffs.push(e.tradeoff);
        if (c.importance === "required") {
          if (e.known && !e.matches) excluded = true;
          else if (!e.known)
            unknowns.push(`${c.label}: нет сведений об обязательном условии`);
        }
      }
      // No offer prices exist in the source. A hard price cap cannot be verified.
      if (profile.budgetMax !== null)
        unknowns.push(
          `В каталоге нет цены для сопоставления с бюджетом ${profile.budgetMax.toLocaleString("ru-RU")} ₽ за номер за ночь`,
        );
      if (profile.city && profile.city !== "saint-petersburg") excluded = true;
      const document = terms(
        h.name +
          " " +
          h.description_snapshot +
          " " +
          h.amenities_snapshot.join(" "),
      );
      const set = new Set(document);
      const lexical = wanted.length
        ? wanted.filter((t) => set.has(t)).length / wanted.length
        : 0;
      if (!reasons.length)
        reasons.push(
          wanted.length
            ? "Описание сопоставлено с вашими пожеланиями"
            : "Отель из импортированного каталога Петербурга",
        );
      if (!h.amenities_snapshot.length)
        tradeoffs.push("В архивной карточке не указаны удобства");
      const uniqueUnknown = [...new Set(unknowns)];
      const result: RankedHotel = {
        hotel: catalogHotel(h),
        score: Number(
          (nativeScore
            ? nativeScore.score * 0.85 + (weight ? score / weight : 0.5) * 0.15
            : (weight ? score / weight : 0.5) * 0.8 + lexical * 0.2
          ).toFixed(5),
        ),
        status: uniqueUnknown.length ? "needs-check" : "matches",
        reasons: [...new Set(reasons)].slice(0, 4),
        unknowns: uniqueUnknown,
        tradeoffs: [...new Set(tradeoffs)],
        nearby: evidenceFor(h, expectations),
      };
      return { result, excluded };
    },
  );
  const eligible = evaluated
    .filter((x) => !x.excluded)
    .map((x) => x.result)
    .sort((a, b) => b.score - a.score || a.hotel.id.localeCompare(b.hotel.id));
  const matches = eligible.filter((h) => h.status === "matches"),
    needs = eligible.filter((h) => h.status === "needs-check");
  const suggestions = criteria
    .filter((c) => c.importance === "required")
    .map((c) => ({
      key: c.key,
      label: `Сделать «${c.label.toLowerCase()}» пожеланием`,
      impact: evaluated.filter((x) =>
        x.result.unknowns.some((s) => s.startsWith(c.label)),
      ).length,
    }))
    .filter((s) => s.impact > 0)
    .slice(0, 3);
  return {
    results: matches.slice(0, limit),
    needsCheck: needs.slice(0, limit),
    excludedCount: evaluated.filter((x) => x.excluded).length,
    total: records.length,
    matchingCount: matches.length,
    unverifiedCount: needs.length,
    applied: criteria,
    suggestions,
    engine: semanticScores ? "e5" : "tfidf+facts",
    revision,
  };
}
export function questionHints(expectations: Expectations) {
  const known = new Set(expectations.criteria.map((c) => c.key));
  return (Object.keys(amenities) as CriterionKey[])
    .filter((k) => !known.has(k))
    .map((key) => ({
      key,
      label: labels[key],
      present: catalogRecords().filter((h) =>
        amenities[key]!.some((a) => h.amenities_snapshot.includes(a)),
      ).length,
    }));
}

export function rankingQuery(expectations: Expectations): string {
  const criteria = expectations.criteria;
  return [
    expectations.purpose,
    ...criteria
      .filter((c) => c.value)
      .map((c) => `${c.label} ${c.detail ?? ""}`),
  ]
    .filter(Boolean)
    .join(" ");
}
