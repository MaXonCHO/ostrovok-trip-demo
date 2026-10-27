import type { Decision, Trip, Vote, FinalProposal } from "./models";
export const activeParticipants = (trip: Trip) =>
  trip.participants.filter((p) => p.status !== "left" && p.role !== "viewer");
export function decisionFor(
  trip: Trip,
  participantId: string,
  type: "scenario" | "hotel",
  id: string,
): Decision {
  return (
    trip.votes.find(
      (v) =>
        v.selectionRevision === trip.selectionRevision &&
        v.participantId === participantId &&
        v.entityType === type &&
        v.entityId === id,
    )?.decision ?? "unseen"
  );
}
export function collective(
  trip: Trip,
  type: "scenario" | "hotel",
  id: string,
): "matched" | "rejected" | "waiting" {
  const ps = activeParticipants(trip);
  const ds = ps.map((p) => decisionFor(trip, p.id, type, id));
  if (ds.includes("rejected")) return "rejected";
  if (
    ps.length === 0 ||
    ps.length < trip.expectedParticipants ||
    ds.includes("unseen")
  )
    return "waiting";
  if (type === "scenario" && ps.some((p) => !p.scenariosConfirmed))
    return "waiting";
  return "matched";
}
export const commonScenarios = (trip: Trip) =>
  trip.scenarios
    .filter((s) => collective(trip, "scenario", s.id) === "matched")
    .map((s) => s.id);
export const matchedHotels = (trip: Trip) =>
  trip.candidates
    .filter(
      (h) =>
        collective(trip, "hotel", h.hotelId) === "matched" &&
        !h.needsClarification,
    )
    .map((h) => h.hotelId);
export function recordVote(trip: Trip, vote: Vote) {
  trip.votes = trip.votes.filter(
    (v) =>
      !(
        v.participantId === vote.participantId &&
        v.selectionRevision === vote.selectionRevision &&
        v.entityType === vote.entityType &&
        v.entityId === vote.entityId
      ),
  );
  trip.votes.push(vote);
  if (
    vote.entityType === "hotel" &&
    vote.decision !== "liked" &&
    trip.proposal?.hotelId === vote.entityId
  )
    trip.proposal = null;
}
export function newRevision(trip: Trip, reason: string) {
  trip.history.push({
    revision: trip.selectionRevision,
    reason,
    selected: trip.selected,
    votes: trip.votes.filter(
      (v) => v.selectionRevision === trip.selectionRevision,
    ),
  });
  trip.selectionRevision++;
  trip.selected = null;
  trip.proposal = null;
  trip.candidates = [];
  trip.scenarios = [];
  trip.stage = "chat";
  trip.participants.forEach((p) => {
    p.scenariosConfirmed = false;
    p.hotelsFinished = false;
    if (p.role === "viewer") p.role = "member";
  });
  trip.expectedParticipants = Math.max(
    trip.expectedParticipants,
    activeParticipants(trip).length,
  );
  trip.lastChange = reason;
}
export function sameProposal(a: FinalProposal, b: FinalProposal) {
  return (
    a.hotelId === b.hotelId &&
    a.roomTypeId === b.roomTypeId &&
    a.price === b.price &&
    a.selectionRevision === b.selectionRevision
  );
}
export function finalIsReady(trip: Trip) {
  const proposal = trip.proposal;
  return (
    !!proposal &&
    activeParticipants(trip).length >= trip.expectedParticipants &&
    activeParticipants(trip).every((p) =>
      proposal.confirmationIds.includes(p.id),
    ) &&
    matchedHotels(trip).includes(proposal.hotelId)
  );
}
