import { DatabaseSync } from "node:sqlite";
import { mkdirSync, chmodSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { createHash } from "node:crypto";
import source from "../../data/embedding/hotels_catalog.json";
import media from "@/data/fixtures/real-hotels.json";
import type { CatalogRecord } from "@/features/planner/types";
import type { Hotel } from "@/features/ostrovok/catalog";
const shared = globalThis as typeof globalThis & {
  __plannerDatabases?: Map<string, DatabaseSync>;
};
export const catalogVersion = createHash("sha256")
  .update(JSON.stringify(source))
  .digest("hex");
export function database() {
  const file =
    process.env.DATABASE_PATH ||
    resolve(process.cwd(), ".data", "ostrovok.sqlite");
  const connections = (shared.__plannerDatabases ??= new Map());
  const existing = connections.get(file);
  if (existing) return existing;
  if (file !== ":memory:") mkdirSync(dirname(file), { recursive: true });
  const db = new DatabaseSync(file);
  db.exec(`PRAGMA foreign_keys=ON; PRAGMA journal_mode=WAL; PRAGMA busy_timeout=5000;
 CREATE TABLE IF NOT EXISTS migrations(version INTEGER PRIMARY KEY,applied_at TEXT NOT NULL);
 CREATE TABLE IF NOT EXISTS catalog_meta(key TEXT PRIMARY KEY,value TEXT NOT NULL);
 CREATE TABLE IF NOT EXISTS hotels(id TEXT PRIMARY KEY,slug TEXT NOT NULL UNIQUE,name TEXT NOT NULL,record_json TEXT NOT NULL);
 CREATE TABLE IF NOT EXISTS users(id TEXT PRIMARY KEY,phone TEXT UNIQUE,name TEXT NOT NULL,created_at TEXT NOT NULL);
 CREATE TABLE IF NOT EXISTS sessions(token_hash TEXT PRIMARY KEY,user_id TEXT NOT NULL REFERENCES users(id),expires_at INTEGER NOT NULL);
 CREATE TABLE IF NOT EXISTS login_challenges(id TEXT PRIMARY KEY,phone TEXT NOT NULL,expires_at INTEGER NOT NULL,attempts INTEGER NOT NULL DEFAULT 0,used INTEGER NOT NULL DEFAULT 0,created_at INTEGER NOT NULL);
 CREATE TABLE IF NOT EXISTS trips(id TEXT PRIMARY KEY,owner_id TEXT NOT NULL REFERENCES users(id),title TEXT NOT NULL,context_json TEXT NOT NULL,profile_json TEXT NOT NULL,expectations_json TEXT NOT NULL,status TEXT NOT NULL DEFAULT 'draft',version INTEGER NOT NULL DEFAULT 0,revision INTEGER NOT NULL DEFAULT 1,include_unverified INTEGER NOT NULL DEFAULT 0,pinned_hotel_id TEXT REFERENCES hotels(id),invite_hash TEXT UNIQUE,invite_token TEXT,invite_expires_at INTEGER,notice TEXT,created_at TEXT NOT NULL,updated_at TEXT NOT NULL);
 CREATE TABLE IF NOT EXISTS trip_members(trip_id TEXT NOT NULL REFERENCES trips(id) ON DELETE CASCADE,user_id TEXT NOT NULL REFERENCES users(id),role TEXT NOT NULL CHECK(role IN ('owner','member')),joined_at TEXT NOT NULL,PRIMARY KEY(trip_id,user_id));
 CREATE TABLE IF NOT EXISTS trip_messages(id INTEGER PRIMARY KEY AUTOINCREMENT,trip_id TEXT NOT NULL REFERENCES trips(id) ON DELETE CASCADE,user_id TEXT NOT NULL REFERENCES users(id),role TEXT NOT NULL CHECK(role IN ('user','assistant')),content TEXT NOT NULL,created_at TEXT NOT NULL);
 CREATE TABLE IF NOT EXISTS trip_votes(trip_id TEXT NOT NULL REFERENCES trips(id) ON DELETE CASCADE,hotel_id TEXT NOT NULL REFERENCES hotels(id),user_id TEXT NOT NULL REFERENCES users(id),revision INTEGER NOT NULL,liked INTEGER NOT NULL CHECK(liked IN (0,1)),updated_at TEXT NOT NULL,PRIMARY KEY(trip_id,hotel_id,user_id,revision));
 CREATE TABLE IF NOT EXISTS trip_comments(id TEXT PRIMARY KEY,trip_id TEXT NOT NULL REFERENCES trips(id) ON DELETE CASCADE,hotel_id TEXT NOT NULL REFERENCES hotels(id),user_id TEXT NOT NULL REFERENCES users(id),text TEXT NOT NULL,created_at TEXT NOT NULL);
 CREATE TABLE IF NOT EXISTS user_favorites(user_id TEXT NOT NULL REFERENCES users(id),hotel_id TEXT NOT NULL REFERENCES hotels(id),PRIMARY KEY(user_id,hotel_id));
 CREATE TABLE IF NOT EXISTS chat_requests(id TEXT PRIMARY KEY,user_id TEXT NOT NULL REFERENCES users(id),trip_id TEXT REFERENCES trips(id),status TEXT NOT NULL,result_json TEXT,created_at INTEGER NOT NULL);
 CREATE INDEX IF NOT EXISTS session_expiry ON sessions(expires_at);
 CREATE INDEX IF NOT EXISTS member_user ON trip_members(user_id);
 CREATE INDEX IF NOT EXISTS message_trip ON trip_messages(trip_id,user_id,id);
 INSERT OR IGNORE INTO migrations VALUES(1,datetime('now'));`);
  const version = db
    .prepare("SELECT value FROM catalog_meta WHERE key='source_sha256'")
    .get() as { value: string } | undefined;
  if (version?.value !== catalogVersion) {
    db.exec("BEGIN IMMEDIATE");
    try {
      const insert = db.prepare(
        "INSERT INTO hotels(id,slug,name,record_json) VALUES(?,?,?,?) ON CONFLICT(id) DO UPDATE SET name=excluded.name,record_json=excluded.record_json",
      );
      const ids = new Set<string>();
      for (const h of source) {
        if (
          ids.has(h.hotel_id) ||
          !Array.isArray(h.amenities_snapshot) ||
          !Number.isFinite(h.lat) ||
          !Number.isFinite(h.lon)
        )
          throw Error("Invalid source catalog");
        ids.add(h.hotel_id);
        insert.run(
          h.hotel_id,
          h.hotel_id === "kaggle_1507"
            ? "helvetia-saint-petersburg"
            : h.hotel_id.replace("_", "-"),
          h.name,
          JSON.stringify(h),
        );
      }
      db.prepare(
        "INSERT INTO catalog_meta VALUES('source_sha256',?) ON CONFLICT(key) DO UPDATE SET value=excluded.value",
      ).run(catalogVersion);
      db.prepare(
        "INSERT INTO catalog_meta VALUES('source_name','ostrovok_embedding_mvp.zip') ON CONFLICT(key) DO UPDATE SET value=excluded.value",
      ).run();
      db.exec("COMMIT");
    } catch (e) {
      db.exec("ROLLBACK");
      db.close();
      throw e;
    }
  }
  if (file !== ":memory:") chmodSync(file, 0o600);
  connections.set(file, db);
  return db;
}
export function transaction<T>(fn: (db: DatabaseSync) => T) {
  const db = database();
  db.exec("BEGIN IMMEDIATE");
  try {
    const result = fn(db);
    db.exec("COMMIT");
    return result;
  } catch (e) {
    db.exec("ROLLBACK");
    throw e;
  }
}
export function catalogRecords(): CatalogRecord[] {
  return (
    database().prepare("SELECT record_json FROM hotels ORDER BY id").all() as {
      record_json: string;
    }[]
  ).map((r) => JSON.parse(r.record_json));
}
export function catalogHotel(record: CatalogRecord): Hotel {
  const photos =
    record.hotel_id === "kaggle_1507"
      ? (media.find((h) => h.id === "spb-0")?.assets.map((p) => p.path) ?? [])
      : [];
  return {
    id: record.hotel_id,
    slug:
      record.hotel_id === "kaggle_1507"
        ? "helvetia-saint-petersburg"
        : record.hotel_id.replace("_", "-"),
    name: record.name,
    city: "Санкт-Петербург",
    citySlug: "saint-petersburg",
    address: "Санкт-Петербург · адрес требует проверки",
    stars: 0,
    photos,
    price: null,
    distance: "Пешие маршруты не подтверждены",
    amenities: record.amenities_snapshot,
    description: record.description_snapshot,
    source: record.sources.hotel_listing,
    roomPhoto:
      record.hotel_id === "kaggle_1507"
        ? media
            .find((h) => h.id === "spb-0")
            ?.assets.find((p) => p.kind === "room")?.path
        : undefined,
    imported: true,
    ratingSnapshot: record.rating_snapshot,
    identityVerified: record.identity_verified,
    coordinates: { lat: record.lat, lon: record.lon },
  };
}
export function catalogHotels() {
  return catalogRecords().map(catalogHotel);
}
export function findCatalogHotel(slug: string) {
  const row = database()
    .prepare("SELECT record_json FROM hotels WHERE slug=? OR id=?")
    .get(slug, slug) as { record_json: string } | undefined;
  return row ? catalogHotel(JSON.parse(row.record_json)) : undefined;
}
