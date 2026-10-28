import { test } from "node:test";
import assert from "node:assert/strict";
import {
  withDurableDatabase,
  type SnapshotStorage,
} from "../src/server/durable-database";
import { database } from "../src/server/database";
function memoryStorage(): SnapshotStorage {
  const files = new Map<string, { bytes: Buffer; etag: string }>();
  let version = 0;
  return {
    async read(path) {
      const file = files.get(path);
      return file ? { ...file, bytes: Buffer.from(file.bytes) } : null;
    },
    async write(path, bytes, etag) {
      const previous = files.get(path);
      if ((previous?.etag ?? null) !== etag) throw Error("Precondition failed");
      const next = String(++version);
      files.set(path, { bytes: Buffer.from(bytes), etag: next });
      return next;
    },
    async remove(path, etag) {
      if (files.get(path)?.etag !== etag) throw Error("Precondition failed");
      files.delete(path);
    },
  };
}
test("snapshots survive request-local database closure and preserve concurrent writes", async () => {
  const storage = memoryStorage();
  const options = { storage, path: "test.sqlite", write: true };
  await withDurableDatabase(() => {
    database().exec(
      "CREATE TABLE durable_counter(value INTEGER); INSERT INTO durable_counter VALUES(0)",
    );
  }, options);
  await Promise.all(
    Array.from({ length: 4 }, () =>
      withDurableDatabase(async () => {
        const db = database();
        const row = db.prepare("SELECT value FROM durable_counter").get() as {
          value: number;
        };
        await new Promise((resolve) => setTimeout(resolve, 10));
        db.prepare("UPDATE durable_counter SET value=?").run(row.value + 1);
      }, options),
    ),
  );
  await withDurableDatabase(
    () =>
      assert.equal(
        (
          database().prepare("SELECT value FROM durable_counter").get() as {
            value: number;
          }
        ).value,
        4,
      ),
    { ...options, write: false },
  );
  assert.equal(await storage.read("test.sqlite.lock"), null);
});
test("read-only scope cannot silently lose an unexpected write", async () => {
  const storage = memoryStorage();
  const options = { storage, path: "readonly.sqlite", write: true };
  await withDurableDatabase(
    () =>
      database().exec(
        "CREATE TABLE durable_counter(value INTEGER); INSERT INTO durable_counter VALUES(1)",
      ),
    options,
  );
  await assert.rejects(
    withDurableDatabase(
      () => database().exec("UPDATE durable_counter SET value=99"),
      { ...options, write: false },
    ),
    /Срок сохранения/,
  );
  await withDurableDatabase(
    () =>
      assert.equal(
        (
          database().prepare("SELECT value FROM durable_counter").get() as {
            value: number;
          }
        ).value,
        1,
      ),
    { ...options, write: false },
  );
});
test("expired lease is recovered and failed operation releases the lease", async () => {
  const storage = memoryStorage();
  const path = "recovery.sqlite";
  await storage.write(
    path + ".lock",
    Buffer.from(JSON.stringify({ expiresAt: Date.now() - 1 })),
    null,
  );
  await assert.rejects(
    withDurableDatabase(
      () => {
        throw Error("operation failed");
      },
      { storage, path, write: true },
    ),
    /operation failed/,
  );
  assert.equal(await storage.read(path + ".lock"), null);
});
