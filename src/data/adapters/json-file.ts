import { mkdir, readFile, writeFile, rename } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import path from "node:path";
import type { Trip } from "@/domain/models";
import type { TripRepository } from "@/data/contracts";
export class AppError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}
const shared = globalThis as typeof globalThis & {
  __locks?: Map<string, Promise<unknown>>;
};
const locks = (shared.__locks ??= new Map());
export const dataDir = () =>
  path.resolve(
    /* turbopackIgnore: true */ process.env.TRIP_DATA_DIR ?? ".data",
  );
export async function serialized<T>(
  key: string,
  fn: () => Promise<T>,
): Promise<T> {
  const previous = locks.get(key) ?? Promise.resolve();
  const current = previous.catch(() => {}).then(fn);
  locks.set(key, current);
  try {
    return await current;
  } finally {
    if (locks.get(key) === current) locks.delete(key);
  }
}
export async function readJson<T>(name: string, fallback: T): Promise<T> {
  try {
    return JSON.parse(
      await readFile(
        /* turbopackIgnore: true */ path.join(
          /* turbopackIgnore: true */ dataDir(),
          name,
        ),
        "utf8",
      ),
    ) as T;
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code === "ENOENT") return fallback;
    throw e;
  }
}
export async function atomicJson(name: string, data: unknown) {
  await mkdir(dataDir(), { recursive: true });
  const target = path.join(/* turbopackIgnore: true */ dataDir(), name);
  const temp = target + "." + randomUUID() + ".tmp";
  await writeFile(temp, JSON.stringify(data), { mode: 0o600 });
  await rename(temp, target);
}
export class JsonFileTripRepository implements TripRepository {
  async get(id: string) {
    if (!/^[a-f\d-]{36}$/.test(id)) return null;
    return readJson<Trip | null>(`trip-${id}.json`, null);
  }
  async create(trip: Trip) {
    return serialized(trip.id, async () => {
      if (await this.get(trip.id))
        throw new AppError(409, "Такая поездка уже есть");
      await atomicJson(`trip-${trip.id}.json`, trip);
      return trip;
    });
  }
  async applyCommand(
    id: string,
    expectedVersion: number,
    command: (trip: Trip) => Promise<void> | void,
  ) {
    return serialized(id, async () => {
      const trip = await this.get(id);
      if (!trip) throw new AppError(404, "Поездка не найдена");
      if (trip.version !== expectedVersion)
        throw new AppError(
          409,
          "Поездка обновилась. Повторяем действие с актуальными данными.",
        );
      await command(trip);
      trip.version++;
      trip.updatedAt = new Date().toISOString();
      await atomicJson(`trip-${id}.json`, trip);
      return trip;
    });
  }
}
