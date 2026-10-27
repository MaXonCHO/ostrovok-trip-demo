import type {
  RecommendationProvider,
  CatalogRepository,
} from "@/data/contracts";
import type { Trip, Scenario, HotelCandidate, Hotel } from "@/domain/models";
import { activeParticipants } from "@/domain/rules";
import { fixtureCatalog } from "./catalog";
import { interestLabels } from "@/data/fixtures/lexicon";
export class DeterministicRecommendationProvider
  implements RecommendationProvider
{
  constructor(private catalog: CatalogRepository) {}
  async getScenarios({ trip }: { trip: Trip }): Promise<Scenario[]> {
    const ps = activeParticipants(trip);
    const count = (interests: string[]) =>
      ps.reduce(
        (sum, p) =>
          sum +
          p.preferences.filter(
            (pr) =>
              pr.key.startsWith("interest:") &&
              pr.value === true &&
              interests.includes(pr.key.slice(9)),
          ).length,
        0,
      );
    const available = fixtureCatalog.templates.filter(
      (t) => trip.cityId === "sochi" || !["sea", "slow"].includes(t.id),
    );
    const ranked = [...available].sort(
      (a, b) => count(b.interests) - count(a.interests),
    );
    const first = ranked[0];
    const unique = [
      first,
      ...["center", "sea", "quiet"]
        .filter((a) => a !== first.area)
        .map((a) => ranked.find((t) => t.area === a))
        .filter((t): t is typeof first => !!t),
      ...ranked,
    ];
    const distinct = unique
      .filter((t, i) => unique.findIndex((v) => v.id === t.id) === i)
      .slice(0, 3);
    return distinct.map((t) => ({
      id: `r${trip.selectionRevision}-${t.id}`,
      templateId: t.id,
      selectionRevision: trip.selectionRevision,
      cityId: trip.cityId!,
      title: t.title,
      summary: t.summary,
      imageAssetId: t.image,
      interests: t.interests,
      suggestedAreaIds: [t.area],
      dayOutline: t.day,
      tradeoffs: [t.tradeoff],
      participantReasons: Object.fromEntries(
        ps.map((p) => [
          p.id,
          p.preferences
            .filter(
              (pr) =>
                pr.key.startsWith("interest:") &&
                pr.value &&
                t.interests.includes(
                  pr.key.slice(9) as Hotel["interests"][number],
                ),
            )
            .map(
              (pr) =>
                `Учитывает: ${interestLabels[pr.key.slice(9) as keyof typeof interestLabels]}`,
            ),
        ]),
      ),
      origin: "curated_demo",
    }));
  }
  async getHotels({
    trip,
    scenarioIds,
  }: {
    trip: Trip;
    scenarioIds: string[];
  }): Promise<HotelCandidate[]> {
    const ps = activeParticipants(trip);
    const ss = trip.scenarios.filter((s) => scenarioIds.includes(s.id));
    const hotels = await this.catalog.listHotels({ cityId: trip.cityId! });
    const rejectionPenalty = (h: Hotel, id: string) =>
      trip.votes
        .filter(
          (v) =>
            v.participantId === id &&
            v.entityType === "hotel" &&
            v.entityId === h.id &&
            v.decision === "rejected" &&
            v.rejectionReason,
        )
        .reduce(
          (n, v) =>
            n +
            (["room", "atmosphere"].includes(v.rejectionReason!.code)
              ? 0.5
              : 0.25),
          0,
        );
    const score = (h: Hotel, p: (typeof ps)[number]) =>
      p.preferences
        .filter(
          (pr) =>
            pr.key.startsWith("interest:") &&
            pr.value &&
            h.interests.includes(pr.key.slice(9) as Hotel["interests"][number]),
        )
        .reduce((n, pr) => n + pr.priority, 0) - rejectionPenalty(h, p.id);
    return hotels
      .filter((h) => h.room.capacity * trip.rooms >= trip.expectedParticipants)
      .filter((h) => ss.some((s) => s.suggestedAreaIds.includes(h.areaId)))
      .filter((h) =>
        ps.every((p) =>
          p.preferences.every((pr) => {
            if (pr.importance !== "required") return true;
            if (pr.key === "budget" && typeof pr.value === "number") {
              const basis = p.preferences.find(
                (v) => v.key === "budgetBasis",
              )?.value;
              return (
                h.price === null ||
                h.price * (basis === "stay" ? trip.nights * trip.rooms : 1) <=
                  pr.value
              );
            }
            if (pr.key === "maxWalk" && typeof pr.value === "number")
              return h.seaMinutes <= pr.value;
            if (pr.key === "interest:quiet" && pr.value === true)
              return h.quiet !== false;
            if (pr.key.startsWith("interest:") && pr.value === true)
              return h.interests.includes(
                pr.key.slice(9) as Hotel["interests"][number],
              );
            return true;
          }),
        ),
      )
      .sort((a, b) => {
        const scoresA = ps.map((p) => score(a, p)),
          scoresB = ps.map((p) => score(b, p));
        return (
          Math.min(...scoresB) - Math.min(...scoresA) ||
          scoresB.reduce((n, x) => n + x, 0) -
            scoresA.reduce((n, x) => n + x, 0) ||
          (a.price ?? Infinity) - (b.price ?? Infinity) ||
          a.id.localeCompare(b.id)
        );
      })
      .map((h) => ({
        hotelId: h.id,
        roomTypeId: h.room.id,
        scenarioIds: ss
          .filter((s) => s.suggestedAreaIds.includes(h.areaId))
          .map((s) => s.id),
        price: {
          amount: h.price,
          currency: "RUB",
          basis: "room_night",
          nights: trip.nights,
          isSynthetic: true,
        },
        participantReasons: Object.fromEntries(
          ps.map((p) => [
            p.id,
            [
              ...p.preferences
                .filter(
                  (pr) =>
                    pr.key.startsWith("interest:") &&
                    pr.value &&
                    h.interests.includes(
                      pr.key.slice(9) as Hotel["interests"][number],
                    ),
                )
                .map(
                  (pr) =>
                    `Для вас: ${interestLabels[pr.key.slice(9) as keyof typeof interestLabels]}`,
                ),
              `До прогулочных точек около ${h.walkMinutes} мин пешком (демо)`,
            ],
          ]),
        ),
        tradeoffs: [h.tradeoff],
        evidenceIds: h.evidence.map((e) => e.id),
        needsClarification:
          h.price === null ||
          ps.some(
            (p) =>
              p.preferences.some(
                (pr) =>
                  pr.key === "interest:quiet" &&
                  pr.value === true &&
                  pr.importance === "required",
              ) && h.quiet === null,
          ),
      }));
  }
}
