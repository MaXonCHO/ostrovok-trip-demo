import metadata from "../../data/final/embedding_metadata.json";
import hotelIds from "../../data/final/hotel_embedding_ids.json";
import { HttpError } from "./http";
export const E5_MODEL = "intfloat/multilingual-e5-small";
export function searchEngine(): "e5" | "tfidf+facts" {
  const mode = process.env.HOTEL_SEARCH_ENGINE || "tfidf";
  if (mode === "e5") return "e5";
  if (mode === "tfidf") return "tfidf+facts";
  throw new HttpError(
    503,
    "Неизвестный движок поиска. Проверьте HOTEL_SEARCH_ENGINE.",
  );
}
export function validateE5Scores(
  packet: unknown,
  expectedIds: readonly string[] = hotelIds,
): ReadonlyMap<string, number> {
  if (!packet || typeof packet !== "object") throw Error("Invalid E5 response");
  const p = packet as Record<string, unknown>;
  if (
    p.engine !== "e5" ||
    p.model !== E5_MODEL ||
    p.dimension !== 384 ||
    p.textSha256 !== metadata.text_file_sha256 ||
    p.count !== expectedIds.length ||
    !Array.isArray(p.scores) ||
    p.scores.length !== expectedIds.length
  )
    throw Error("E5 model, source hash or count mismatch");
  const ids = new Set(expectedIds),
    scores = new Map<string, number>();
  if (ids.size !== expectedIds.length) throw Error("Duplicate catalog ID");
  for (const row of p.scores) {
    if (
      !row ||
      typeof row.hotel_id !== "string" ||
      !ids.has(row.hotel_id) ||
      scores.has(row.hotel_id) ||
      typeof row.score !== "number" ||
      !Number.isFinite(row.score) ||
      Math.abs(row.score) > 1.001
    )
      throw Error("E5 hotel ID or score mismatch");
    scores.set(row.hotel_id, row.score);
  }
  return scores;
}
const cache = new Map<
  string,
  { expires: number; scores: ReadonlyMap<string, number> }
>();
const inflight = new Map<string, Promise<ReadonlyMap<string, number>>>();
export async function e5Scores(
  query: string,
): Promise<ReadonlyMap<string, number>> {
  const base = process.env.E5_BASE_URL;
  if (!base)
    throw new HttpError(
      503,
      "Поиск E5 выбран, но адрес E5-бэкенда не настроен.",
    );
  const key = base + "\0" + query;
  const found = cache.get(key);
  if (found && found.expires > Date.now()) return found.scores;
  const pending = inflight.get(key);
  if (pending) return pending;
  const task = (async () => {
    try {
      const response = await fetch(
        new URL("api/semantic-scores", base.replace(/\/?$/, "/")),
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ query }),
          signal: AbortSignal.timeout(15000),
          cache: "no-store",
        },
      );
      if (!response.ok) throw Error("E5 service rejected request");
      const scores = validateE5Scores(await response.json());
      if (cache.size >= 64) cache.delete(cache.keys().next().value!);
      cache.set(key, { scores, expires: Date.now() + 600000 });
      return scores;
    } catch {
      throw new HttpError(
        503,
        "E5 сейчас недоступен или каталог не совпадает. Подбор не пересчитан. Попробуйте ещё раз.",
      );
    }
  })();
  inflight.set(key, task);
  try {
    return await task;
  } finally {
    inflight.delete(key);
  }
}

export async function e5Health() {
  const base = process.env.E5_BASE_URL;
  if (!base) throw new Error("E5_BASE_URL missing");
  const response = await fetch(
    new URL("api/health", base.replace(/\/?$/, "/")),
    { signal: AbortSignal.timeout(5000), cache: "no-store" },
  );
  if (!response.ok) throw new Error("E5 unhealthy");
  const result = await response.json();
  if (
    result.status !== "ok" ||
    result.engine !== "e5" ||
    result.model !== E5_MODEL ||
    result.count !== hotelIds.length ||
    result.textSha256 !== metadata.text_file_sha256
  )
    throw new Error("E5 health metadata mismatch");
  return { model: result.model, ready: true };
}
