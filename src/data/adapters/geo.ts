import type { GeoProvider } from "@/data/contracts";
import type { Route, Evidence } from "@/domain/models";
export class FixtureGeoProvider implements GeoProvider {
  async getRoute({
    hotelId,
    placeId,
  }: {
    hotelId: string;
    placeId: string;
  }): Promise<Route> {
    const n = Number(hotelId.replace(/\D/g, "")) || 2;
    const minutes = hotelId === "h1" ? 27 : 8 + n * 2;
    return {
      id: `${hotelId}-${placeId}`,
      origin: hotelId,
      destination: placeId,
      mode: "walk",
      meters:
        hotelId === "h1"
          ? 1900
          : hotelId === "h2"
            ? 850
            : Math.round(minutes * 70),
      minutes,
      straightMeters: hotelId === "h1" ? 420 : Math.round(minutes * 43),
      geometry: [
        [40, 160],
        [95, 160],
        [95, 85],
        [205, 85],
        [205, 135],
        [310, 135],
        [350, 60],
      ],
      source: "Подготовленная демонстрационная геометрия",
      isSynthetic: true,
      warning:
        hotelId === "h1"
          ? "Прямой проход перекрыт. Путь идёт в обход."
          : undefined,
    };
  }
  async evaluateFeature({
    hotelId,
    featureKey,
  }: {
    hotelId: string;
    featureKey: string;
  }): Promise<Evidence> {
    const r = await this.getRoute({ hotelId, placeId: "p1" });
    return {
      id: `geo-${hotelId}`,
      featureKey,
      scope: { hotelId },
      value: r.minutes,
      source: { kind: "fixture", name: r.source },
      isSynthetic: true,
      confidence: null,
      status: "demo",
      observedAt: "2026-10-27T00:00:00Z",
    };
  }
}
