import { durableRoute } from "@/server/durable-database";
import { NextResponse } from "next/server";
import { database, catalogVersion } from "@/server/database";
import { finalCatalogImport } from "@/server/final-catalog";
export const dynamic = "force-dynamic";
function handleGET() {
  try {
    const row = database()
      .prepare("SELECT count(*) AS n FROM hotels")
      .get() as { n: number };
    return NextResponse.json({
      status: "ok",
      mode: "demo-auth",
      database: process.env.BLOB_READ_WRITE_TOKEN
        ? "sqlite-private-blob"
        : "sqlite",
      hotels: row.n,
      catalogVersion,
      hasCurrentPrices: false,
      search: "tfidf+facts",
      photographedHotels: finalCatalogImport.photographedHotels,
      readingPersonalization: true,
      agentConfigured: !!process.env.DEEPSEEK_API_KEY,
    });
  } catch {
    return NextResponse.json({ status: "error" }, { status: 503 });
  }
}

export const GET = durableRoute(handleGET, false);
