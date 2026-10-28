import { randomUUID } from "node:crypto";
import bodies from "@/data/blog-bodies.json";
import { articleBySlug } from "@/features/blog/articles";
import type {
  Account,
  Criterion,
  CriterionKey,
  Expectations,
} from "@/features/planner/types";
import { labels } from "@/features/planner/criteria";
import { database } from "./database";
import { HttpError } from "./http";

export interface ReadingNote {
  id: string;
  text: string;
  createdAt: string;
}
interface ReadingRow {
  article_slug: string;
  progress: number;
  active_seconds: number;
  liked: number;
  updated_at: string;
}
export interface ReadingInterest {
  article: { slug: string; title: string; category: string; tags: string[] };
  progress: number;
  activeSeconds: number;
  liked: boolean;
  engaged: boolean;
  notes: ReadingNote[];
}
function storage() {
  const db = database();
  db.exec(`CREATE TABLE IF NOT EXISTS reading_interests (
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    article_slug TEXT NOT NULL, progress REAL NOT NULL DEFAULT 0,
    active_seconds REAL NOT NULL DEFAULT 0, liked INTEGER NOT NULL DEFAULT 0,
    updated_at TEXT NOT NULL, PRIMARY KEY(user_id,article_slug));
    CREATE TABLE IF NOT EXISTS reading_notes (
    id TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    article_slug TEXT NOT NULL, text TEXT NOT NULL, created_at TEXT NOT NULL,
    UNIQUE(user_id,article_slug,text));
    CREATE INDEX IF NOT EXISTS reading_note_owner ON reading_notes(user_id,article_slug);`);
  return db;
}
function canonicalArticle(slug: unknown) {
  const article = typeof slug === "string" ? articleBySlug(slug) : undefined;
  if (!article) throw new HttpError(400, "Материал не найден.");
  return article;
}
export function getReadingInterests(user: Account): ReadingInterest[] {
  const db = storage();
  const rows = db
    .prepare(
      "SELECT article_slug,progress,active_seconds,liked,updated_at FROM reading_interests WHERE user_id=? ORDER BY updated_at DESC",
    )
    .all(user.id) as unknown as ReadingRow[];
  return rows.flatMap((row) => {
    const article = articleBySlug(row.article_slug);
    if (!article) return [];
    const notes = db
      .prepare(
        "SELECT id,text,created_at AS createdAt FROM reading_notes WHERE user_id=? AND article_slug=? ORDER BY created_at DESC",
      )
      .all(user.id, article.slug) as unknown as ReadingNote[];
    return [
      {
        article: {
          slug: article.slug,
          title: article.title,
          category: article.category,
          tags: article.tags,
        },
        progress: row.progress,
        activeSeconds: row.active_seconds,
        liked: !!row.liked,
        engaged:
          !!row.liked ||
          notes.length > 0 ||
          (row.active_seconds >= 30 && row.progress >= 0.65),
        notes,
      },
    ];
  });
}
export function getArticleReadingInterest(
  user: Account,
  slug: unknown,
): ReadingInterest {
  const article = canonicalArticle(slug);
  return (
    getReadingInterests(user).find(
      (row) => row.article.slug === article.slug,
    ) ?? {
      article: {
        slug: article.slug,
        title: article.title,
        category: article.category,
        tags: article.tags,
      },
      progress: 0,
      activeSeconds: 0,
      liked: false,
      engaged: false,
      notes: [],
    }
  );
}
function bounded(value: unknown, max: number) {
  if (typeof value !== "number" || !Number.isFinite(value))
    throw new HttpError(400, "Некорректные данные чтения.");
  return Math.min(max, Math.max(0, value));
}
export function recordReadingInterest(user: Account, input: unknown) {
  if (!input || typeof input !== "object" || Array.isArray(input))
    throw new HttpError(400, "Некорректные данные чтения.");
  const data = input as Record<string, unknown>;
  const article = canonicalArticle(data.slug);
  const progress = bounded(data.progress, 1);
  const activeSeconds = bounded(data.activeSeconds, 3600);
  if (data.liked !== undefined && typeof data.liked !== "boolean")
    throw new HttpError(400, "Некорректная отметка статьи.");
  const db = storage();
  db.prepare(
    `INSERT INTO reading_interests VALUES(?,?,?,?,?,?) ON CONFLICT(user_id,article_slug) DO UPDATE SET
    progress=MAX(reading_interests.progress,excluded.progress),active_seconds=MAX(reading_interests.active_seconds,excluded.active_seconds),
    liked=CASE WHEN ? THEN excluded.liked ELSE reading_interests.liked END,updated_at=excluded.updated_at`,
  ).run(
    user.id,
    article.slug,
    progress,
    activeSeconds,
    data.liked === true ? 1 : 0,
    new Date().toISOString(),
    data.liked === undefined ? 0 : 1,
  );
  return getArticleReadingInterest(user, article.slug);
}
const normalize = (value: string) => value.replace(/\s+/g, " ").trim();
function canonicalText(slug: string) {
  const body = (
    bodies as Record<
      string,
      { title: string; blocks: { text?: string; items?: string[] }[] }
    >
  )[slug];
  const article = canonicalArticle(slug);
  return normalize(
    [
      article.title,
      article.summary,
      body?.title ?? "",
      ...(body?.blocks ?? []).flatMap((block) => [
        block.text ?? "",
        ...(block.items ?? []),
      ]),
    ].join(" "),
  );
}
export function saveReadingNote(
  user: Account,
  slug: unknown,
  selected: unknown,
) {
  const article = canonicalArticle(slug);
  if (typeof selected !== "string")
    throw new HttpError(400, "Выделите фрагмент статьи.");
  const text = normalize(selected);
  if (
    text.length < 20 ||
    text.length > 1000 ||
    !canonicalText(article.slug).includes(text)
  )
    throw new HttpError(
      400,
      "Сохранить можно выделенный фрагмент этой статьи длиной от 20 до 1000 символов.",
    );
  const db = storage();
  const existing = db
    .prepare(
      "SELECT id FROM reading_notes WHERE user_id=? AND article_slug=? AND text=?",
    )
    .get(user.id, article.slug, text);
  if (existing) return getArticleReadingInterest(user, article.slug);
  const count = db
    .prepare(
      "SELECT count(*) AS n FROM reading_notes WHERE user_id=? AND article_slug=?",
    )
    .get(user.id, article.slug) as { n: number };
  if (count.n >= 20)
    throw new HttpError(400, "В этой статье уже сохранено 20 заметок.");
  recordReadingInterest(user, {
    slug: article.slug,
    progress: 0,
    activeSeconds: 0,
  });
  db.prepare("INSERT OR IGNORE INTO reading_notes VALUES(?,?,?,?,?)").run(
    randomUUID(),
    user.id,
    article.slug,
    text,
    new Date().toISOString(),
  );
  return getArticleReadingInterest(user, article.slug);
}
export function deleteReadingNote(user: Account, slug: unknown, id: unknown) {
  const article = canonicalArticle(slug);
  if (typeof id !== "string" || !/^[\da-f-]{36}$/i.test(id))
    throw new HttpError(400, "Заметка не найдена.");
  const result = storage()
    .prepare(
      "DELETE FROM reading_notes WHERE id=? AND user_id=? AND article_slug=?",
    )
    .run(id, user.id, article.slug);
  if (!result.changes) throw new HttpError(404, "Заметка не найдена.");
  return getArticleReadingInterest(user, article.slug);
}

export function inferredReadingExpectations(
  user: Account,
  explicit: Expectations,
): Expectations {
  const signals = getReadingInterests(user).filter((row) => row.engaged);
  const inferred = new Map<
    CriterionKey,
    { score: number; details: Set<string> }
  >();
  const add = (key: CriterionKey, score: number, detail: string) => {
    if (
      explicit.criteria.some(
        (criterion) => criterion.key === key && criterion.value === false,
      )
    )
      return;
    const old = inferred.get(key) ?? { score: 0, details: new Set<string>() };
    old.score += score;
    old.details.add(detail);
    inferred.set(key, old);
  };
  for (const row of signals) {
    // There are only 25 canonical articles: an explicit reaction outranks
    // any accumulation of passive reading signals across this catalogue.
    const score = row.notes.length ? 120 : row.liked ? 100 : 1;
    const words = [
      row.article.title,
      ...row.article.tags,
      ...row.notes.map((n) => n.text),
    ]
      .join(" ")
      .toLowerCase()
      .replaceAll("ё", "е");
    if (
      ["unusual"].includes(row.article.category) ||
      /музе|искусств|культур|архитектур|дворц/.test(words)
    )
      add("culture", score, "Музеи и архитектура");
    if (
      ["routes", "nature", "seasonal"].includes(row.article.category) ||
      /прогул|экотроп|набережн/.test(words)
    )
      add("walks", score, "Городские прогулки");
    if (
      row.article.category === "food" ||
      /кофе|пышк|ресторан|гастроном|блюд|выпеч/.test(words)
    )
      add(
        "restaurants",
        score,
        /пышк/.test(words)
          ? "Пышки и местная выпечка"
          : /кофе/.test(words)
            ? "Кофейни и кофе"
            : "Местная кухня и рестораны",
      );
    if (
      row.article.category === "family" ||
      /с детьми|семейн|ребен/.test(words)
    )
      add("children", score, "Отдых с детьми");
    if (/сувенир|покупк|шоппинг|подарк/.test(words))
      add("shopping", score, "Местные сувениры и покупки");
  }
  // Explicit answers, including negative preferences, always win. Reading only
  // supplies soft interests; it never changes dates, budget or trip composition.
  const criteria: Criterion[] = explicit.criteria.map((criterion) => ({
    ...criterion,
  }));
  for (const [key, value] of [...inferred.entries()].sort(
    (a, b) => b[1].score - a[1].score,
  )) {
    if (criteria.some((criterion) => criterion.key === key)) continue;
    criteria.push({
      key,
      label: labels[key],
      value: true,
      importance: "preferred",
      detail: `Из О!Блога: ${[...value.details].join(", ")}`.slice(0, 150),
    });
  }
  const interests = [...inferred.entries()]
    .filter(
      ([key]) =>
        !explicit.criteria.some(
          (criterion) => criterion.key === key && !criterion.value,
        ),
    )
    .sort((a, b) => b[1].score - a[1].score)
    .flatMap(([, value]) => [...value.details]);
  return {
    ...explicit,
    criteria,
    brandNames: [...explicit.brandNames],
    purpose:
      explicit.purpose ||
      (interests.length
        ? `Интересы из О!Блога: ${[...new Set(interests)].join(", ")}`.slice(
            0,
            150,
          )
        : null),
  };
}

export function mergeReadingInterests(fromUserId: string, toUserId: string) {
  if (fromUserId === toUserId) return;
  const db = storage();
  db.prepare(
    `INSERT INTO reading_interests(user_id,article_slug,progress,active_seconds,liked,updated_at)
    SELECT ?,article_slug,progress,active_seconds,liked,updated_at FROM reading_interests WHERE user_id=?
    ON CONFLICT(user_id,article_slug) DO UPDATE SET progress=MAX(reading_interests.progress,excluded.progress),
    active_seconds=MAX(reading_interests.active_seconds,excluded.active_seconds),liked=MAX(reading_interests.liked,excluded.liked),
    updated_at=MAX(reading_interests.updated_at,excluded.updated_at)`,
  ).run(toUserId, fromUserId);
  db.prepare(
    "UPDATE OR IGNORE reading_notes SET user_id=? WHERE user_id=?",
  ).run(toUserId, fromUserId);
  db.prepare("DELETE FROM reading_notes WHERE user_id=?").run(fromUserId);
  db.prepare("DELETE FROM reading_interests WHERE user_id=?").run(fromUserId);
}
