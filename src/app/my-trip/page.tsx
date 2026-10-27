import type { Metadata } from "next";
import { TripChat } from "@/features/ostrovok/trip-chat";
import type { Query } from "@/features/ostrovok/search-state";

export const metadata: Metadata = { title: "Моя поездка" };
export default async function MyTripPage({
  searchParams,
}: {
  searchParams: Promise<Query>;
}) {
  const query = await searchParams;
  return <TripChat key={JSON.stringify(query)} query={query} />;
}
