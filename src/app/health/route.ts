import { searchEngine, e5Health } from "@/server/e5-client";
import { NextResponse } from "next/server";
import { database, catalogVersion } from "@/server/database";
import { finalCatalogImport } from "@/server/final-catalog";
export const dynamic = "force-dynamic";
export async function GET() {
  try {
    const row = database()
      .prepare("SELECT count(*) AS n FROM hotels")
      .get() as { n: number };
    const engine = searchEngine();
    const e5 = engine === "e5" ? await e5Health() : undefined;
    return NextResponse.json({
      status: "ok",
      mode: "demo-auth",
      database: "sqlite",
      hotels: row.n,
      catalogVersion,
      hasCurrentPrices: false,
      search: engine,
      ...(e5 ? { e5 } : {}),
      photographedHotels: finalCatalogImport.photographedHotels,
      readingPersonalization: true,
      agentConfigured: !!process.env.DEEPSEEK_API_KEY,
    });
  } catch {
    return NextResponse.json({ status: "error" }, { status: 503 });
  }
}
