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
  return <OstrovokSearch key={JSON.stringify(query)} query={query} />;
}
