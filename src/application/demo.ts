import { randomUUID } from "node:crypto";
import { createTrip, participant } from "./trips";
import { providers } from "@/data/providers";
import { recordVote } from "@/domain/rules";
export async function createDemo(userId: string, kind: string) {
  const trip = await createTrip(userId, {
    name: "Артём",
    cityId: "sochi",
    group: kind !== "solo" && kind !== "geo",
    expectedParticipants: kind === "solo" || kind === "geo" ? 1 : 2,
    nights: 4,
    rooms: 1,
    prompt:
      "Хочу море, итальянскую кухню и гулять по городу. Бюджет до 10000 рублей за ночь.",
  });
  return providers().trips.applyCommand(trip.id, trip.version, async (t) => {
    t.isDemo = true;
    t.demoKind = kind;
    if (t.group) {
      const p = participant(randomUUID(), "Саша");
      p.status = "ready";
      p.preferences = [
        {
          id: randomUUID(),
          participantId: p.id,
          key: "interest:quiet",
          value: true,
          importance: "preferred",
          priority: 0.7,
          updatedAt: new Date().toISOString(),
        },
      ];
      t.participants.push(p);
    }
    t.scenarios = await providers().recommendations.getScenarios({ trip: t });
    t.stage = "scenarios";
    for (const p of t.participants) {
      p.status = "ready";
      p.scenariosConfirmed = true;
      for (const [index, s] of t.scenarios.entries())
        recordVote(t, {
          participantId: p.id,
          selectionRevision: t.selectionRevision,
          entityType: "scenario",
          entityId: s.id,
          decision:
            kind === "conflict"
              ? p.id === userId
                ? index === 0
                  ? "liked"
                  : "rejected"
                : index === 1
                  ? "liked"
                  : "rejected"
              : "liked",
          updatedAt: new Date().toISOString(),
        });
    }
    if (kind === "conflict") return;
    t.candidates = await providers().recommendations.getHotels({
      trip: t,
      scenarioIds: t.scenarios.map((s) => s.id),
    });
    t.stage = "hotels";
    if (kind === "group")
      for (const p of t.participants)
        for (const candidate of t.candidates.slice(0, 2))
          recordVote(t, {
            participantId: p.id,
            selectionRevision: t.selectionRevision,
            entityType: "hotel",
            entityId: candidate.hotelId,
            decision: "liked",
            updatedAt: new Date().toISOString(),
          });
  });
}
