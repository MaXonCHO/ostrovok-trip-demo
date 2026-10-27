import { NextResponse } from "next/server";
import { database, catalogVersion } from "@/server/database";
export const dynamic = "force-dynamic";
export function GET() {
  try {
    const row = database()
      .prepare("SELECT count(*) AS n FROM hotels")
      .get() as { n: number };
    return NextResponse.json({
      status: "ok",
      mode: "demo-auth",
      database: "sqlite",
      hotels: row.n,
      catalogVersion,
      hasCurrentPrices: false,
      search: "lexical+facts",
      agentConfigured: !!process.env.DEEPSEEK_API_KEY,
    });
  } catch {
    return NextResponse.json({ status: "error" }, { status: 503 });
  }
}
