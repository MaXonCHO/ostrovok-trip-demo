/** One-off local fixture migration. Keep former identity + decisions in backup. */
import {
  readdir,
  readFile,
  writeFile,
  mkdir,
  copyFile,
} from "node:fs/promises";
import { resolve } from "node:path";
import { newRevision } from "../src/domain/rules";
import type { Trip } from "../src/domain/models";
async function migrate() {
  const directory = resolve(process.env.TRIP_DATA_DIR || ".data");
  const backup = resolve(directory, "before-real-catalog");
  await mkdir(backup, { recursive: true });
  let changed = 0;
  for (const name of await readdir(directory)) {
    if (!/^trip-.*\.json$/.test(name)) continue;
    const path = resolve(directory, name);
    const trip = JSON.parse(await readFile(path, "utf8")) as Trip;
    if (trip.catalogVersion === 2) continue;
    await copyFile(path, resolve(backup, name));
    if (trip.candidates.length || trip.selected) {
      newRevision(
        trip,
        "Каталог заменён реальными отелями. Пожелания сохранены; предыдущие решения в истории. Выберите отель заново.",
      );
      trip.version++;
    }
    trip.catalogVersion = 2;
    await writeFile(path, JSON.stringify(trip, null, 2));
    changed++;
  }
  console.log(`Updated ${changed} local trips; originals in ${backup}`);
}
void migrate();
