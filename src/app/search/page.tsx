import { rankHotelsForRequest } from "@/server/semantic-recommendations";
import { searchEngine } from "@/server/e5-client";
import { emptyTripChatProfile } from "@/features/ostrovok/trip-chat-contract";
import { emptyExpectations } from "@/features/planner/types";
import { param } from "@/features/ostrovok/search-state";
import type { Metadata } from "next";
import { OstrovokSearch } from "@/features/ostrovok/search";
import type { Query } from "@/features/ostrovok/search-state";
export const metadata: Metadata = { title: "Поиск отелей" };
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<Query>;
}) {
  const query = await searchParams;
  const selection =
    searchEngine() === "e5"
      ? await rankHotelsForRequest(
          emptyTripChatProfile(),
          {
            ...emptyExpectations(),
            purpose:
              param(query, "wish").slice(0, 3000) ||
              param(query, "q").slice(0, 3000),
          },
          1,
          300,
        )
      : null;
  const recommendationIds = selection
    ? [...selection.results, ...selection.needsCheck].map(
        (result) => result.hotel.id,
      )
    : undefined;
  return (
    <OstrovokSearch
      key={JSON.stringify(query)}
      query={query}
      recommendationIds={recommendationIds}
    />
  );
}
