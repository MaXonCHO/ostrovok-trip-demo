import type { Metadata } from "next";
import { OstrovokSearch } from "@/features/ostrovok/search";
import type { Query } from "@/features/ostrovok/search-state";
export const metadata: Metadata = { title: "Избранные отели" };
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<Query>;
}) {
  return <OstrovokSearch query={await searchParams} favoritesOnly />;
}
