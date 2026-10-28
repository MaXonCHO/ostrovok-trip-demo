import type { Metadata } from "next";
import { BlogCatalog } from "@/features/blog/catalog";
export const metadata: Metadata = {
  title: "О!Блог — вдохновение для путешествий",
  description:
    "Места, еда, прогулки и отдых с детьми: идеи О!Блога для вашей следующей поездки.",
};
export default async function BlogPage({
  searchParams,
}: {
  searchParams: Promise<{ topic?: string }>;
}) {
  return <BlogCatalog initialTopic={(await searchParams).topic} />;
}
