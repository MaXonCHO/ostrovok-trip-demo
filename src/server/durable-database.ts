import { get, put, del } from "@vercel/blob";
import { mkdtemp, writeFile, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
import { database, databaseScope, closeScopedDatabase } from "./database";
import { HttpError, failure } from "./http";

// Snapshot persistence for the hackathon deployment. Private objects + uncached
// reads + an exclusive lease + conditional writes protect independent instances.
// The filesystem is only a request-local working copy, never durable storage.
export interface SnapshotStorage {
  read(path: string): Promise<{ bytes: Buffer; etag: string } | null>;
  write(path: string, bytes: Buffer, etag: string | null): Promise<string>;
  remove(path: string, etag: string): Promise<void>;
}
const blobStorage: SnapshotStorage = {
  async read(path) {
    const result = await get(path, {
      access: "private",
      useCache: false,
      abortSignal: AbortSignal.timeout(15000),
    });
    if (!result) return null;
    if (result.statusCode !== 200) throw Error("Unexpected snapshot response");
    if (result.blob.size > 25 * 1024 * 1024)
      throw new HttpError(
        503,
        "База демо достигла ограничения. Нужен перенос на серверную СУБД.",
      );
    return {
      bytes: Buffer.from(await new Response(result.stream).arrayBuffer()),
      etag: result.blob.etag,
    };
  },
  async write(path, bytes, etag) {
    const result = await put(path, bytes, {
      access: "private",
      addRandomSuffix: false,
      allowOverwrite: etag !== null,
      ...(etag ? { ifMatch: etag } : {}),
      contentType: "application/octet-stream",
      abortSignal: AbortSignal.timeout(15000),
    });
    return result.etag;
  },
  async remove(path, etag) {
    await del(path, { ifMatch: etag });
  },
};
export function durableDatabasePath() {
  return (
    process.env.OSTROVOK_BLOB_DATABASE_PATH ||
    `${process.env.VERCEL_ENV === "production" ? "production" : "preview"}/ostrovok.sqlite`
  );
}
const sleep = (ms: number) =>
  new Promise<void>((resolve) => setTimeout(resolve, ms));
async function acquire(
  storage: SnapshotStorage,
  path: string,
  maxWait: number,
) {
  const lockPath = path + ".lock",
    deadline = Date.now() + maxWait;
  while (true) {
    const expiresAt = Date.now() + 90000;
    try {
      const etag = await storage.write(
        lockPath,
        Buffer.from(JSON.stringify({ owner: randomUUID(), expiresAt })),
        null,
      );
      return { etag, expiresAt, path: lockPath };
    } catch {
      const existing = await storage.read(lockPath);
      if (existing) {
        const lease = JSON.parse(existing.bytes.toString()) as {
          expiresAt: number;
        };
        if (Number.isFinite(lease.expiresAt) && lease.expiresAt < Date.now()) {
          try {
            await storage.remove(lockPath, existing.etag);
          } catch {
            /* Another instance replaced the expired lease. */
          }
        }
      }
      if (Date.now() >= deadline)
        throw new HttpError(
          409,
          "Сейчас сохраняется другое изменение поездки. Повторите через несколько секунд.",
        );
      await sleep(180 + Math.random() * 120);
    }
  }
}
export async function withDurableDatabase<T>(
  operation: () => Promise<T> | T,
  options: {
    write?: boolean;
    storage?: SnapshotStorage;
    path?: string;
    maxWait?: number;
  } = {},
): Promise<T> {
  if (!options.storage && !process.env.BLOB_READ_WRITE_TOKEN) {
    if (process.env.VERCEL)
      throw new HttpError(503, "Постоянное хранилище базы ещё не подключено.");
    return operation();
  }
  const storage = options.storage || blobStorage,
    path = options.path || durableDatabasePath();
  const lease = options.write
    ? await acquire(storage, path, options.maxWait ?? 20000)
    : null;
  let folder: string | undefined;
  try {
    const snapshot = await storage.read(path);
    folder = await mkdtemp(join(tmpdir(), "ostrovok-request-"));
    const file = join(folder, "state.sqlite");
    if (snapshot) await writeFile(file, snapshot.bytes, { mode: 0o600 });
    return await databaseScope.run({ file }, async () => {
      const db = database();
      const changes = () =>
        (db.prepare("SELECT total_changes() AS n").get() as { n: number }).n;
      const schema = () =>
        (
          db.prepare("PRAGMA schema_version").get() as {
            schema_version: number;
          }
        ).schema_version;
      const before = changes(),
        schemaBefore = schema();
      try {
        const result = await operation();
        const changed = changes() !== before || schema() !== schemaBefore;
        db.exec("PRAGMA wal_checkpoint(TRUNCATE)");
        closeScopedDatabase(file);
        if (changed) {
          if (!lease || lease.expiresAt <= Date.now())
            throw new HttpError(
              409,
              "Срок сохранения истёк. Обновите страницу и повторите действие.",
            );
          await storage.write(
            path,
            await readFile(file),
            snapshot?.etag ?? null,
          );
        }
        return result;
      } finally {
        closeScopedDatabase(file);
      }
    });
  } finally {
    if (folder) await rm(folder, { recursive: true, force: true });
    if (lease) {
      try {
        await storage.remove(lease.path, lease.etag);
      } catch {
        /* Lease expiry recovers an interrupted release. */
      }
    }
  }
}
export function durableRoute<Args extends [Request, ...unknown[]]>(
  handler: (...args: Args) => Promise<Response> | Response,
  isWrite: boolean | ((request: Request) => boolean) = true,
) {
  return async (...args: Args): Promise<Response> => {
    try {
      return await withDurableDatabase(() => handler(...args), {
        write: typeof isWrite === "function" ? isWrite(args[0]) : isWrite,
      });
    } catch (error) {
      return failure(error);
    }
  };
}
