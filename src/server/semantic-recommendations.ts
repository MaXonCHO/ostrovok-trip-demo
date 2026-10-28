import type { TripChatProfile } from "@/features/ostrovok/trip-chat-contract";
import type { Expectations } from "@/features/planner/types";
import { rankHotels, rankingQuery } from "./recommendations";
import { e5Scores, searchEngine } from "./e5-client";
export async function rankHotelsForRequest(
  profile: TripChatProfile,
  expectations: Expectations,
  revision = 1,
  limit = 8,
) {
  if (searchEngine() !== "e5")
    return rankHotels(
      profile,
      expectations,
      revision,
      undefined,
      undefined,
      limit,
    );
  const scores = await e5Scores(
    rankingQuery(expectations) || "Отель для поездки в Санкт-Петербург",
  );
  return rankHotels(profile, expectations, revision, undefined, scores, limit);
}
