import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getHotel } from "@/features/ostrovok/catalog";
import { OstrovokHotel } from "@/features/ostrovok/hotel";
import type { Query } from "@/features/ostrovok/search-state";
export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const hotel = getHotel((await params).slug);
  return { title: hotel?.name || "Отель не найден" };
}
export default async function Page({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<Query>;
}) {
  const hotel = getHotel((await params).slug);
  if (!hotel) notFound();
  const query = await searchParams;
  return (
    <OstrovokHotel
      key={hotel.slug + JSON.stringify(query)}
      hotel={hotel}
      query={query}
    />
  );
}
