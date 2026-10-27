import raw from "@/data/fixtures/catalog.json";
import type { Hotel, Place, Evidence } from "@/domain/models";
import type { CatalogRepository } from "@/data/contracts";
import { atomicJson, readJson, serialized } from "./json-file";
import { z } from "zod";
const numeric = z.number().nonnegative();
export const externalHotelSchema = z.object({
  id: z.string().min(1),
  cityId: z.string(),
  price: numeric.nullable(),
  currency: z.literal("RUB"),
  basis: z.literal("room_night"),
  walkMinutes: numeric,
  walkUnit: z.literal("minutes"),
});
export const fixtureCatalog = raw as unknown as {
  hotels: Hotel[];
  places: Place[];
  templates: {
    id: string;
    title: string;
    summary: string;
    image: string;
    area: string;
    interests: Hotel["interests"];
    day: string[];
    tradeoff: string;
  }[];
};
export class FixtureCatalogRepository implements CatalogRepository {
  async listHotels(query: { cityId: string }) {
    const extra = await readJson<Record<string, Evidence[]>>(
      "evidence.json",
      {},
    );
    return fixtureCatalog.hotels
      .filter((h) => h.cityId === query.cityId)
      .map((h) => ({
        ...h,
        evidence: [...h.evidence, ...(extra[h.id] ?? [])],
      }));
  }
  async getHotel(id: string) {
    const base = fixtureCatalog.hotels.find((h) => h.id === id);
    if (!base) return null;
    return (await this.listHotels({ cityId: base.cityId })).find(
      (h) => h.id === id,
    )!;
  }
  async listPlaces(query: { cityId: string }) {
    return fixtureCatalog.places.filter((p) => p.cityId === query.cityId);
  }
  async getEvidence(ids: string[]) {
    const extra = await readJson<Record<string, Evidence[]>>(
      "evidence.json",
      {},
    );
    return [
      ...fixtureCatalog.hotels.flatMap((h) => h.evidence),
      ...Object.values(extra).flat(),
    ].filter((e) => ids.includes(e.id));
  }
  async addEvidence(hotelId: string, evidence: Evidence) {
    await serialized("evidence", async () => {
      const all = await readJson<Record<string, Evidence[]>>(
        "evidence.json",
        {},
      );
      all[hotelId] = [...(all[hotelId] ?? []), evidence];
      await atomicJson("evidence.json", all);
    });
  }
}
