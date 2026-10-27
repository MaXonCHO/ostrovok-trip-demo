import { NextResponse } from "next/server";
import { mkdir, access, constants } from "node:fs/promises";
import { dataDir } from "@/data/adapters/json-file";
import { providers } from "@/data/providers";
export const dynamic = "force-dynamic";
export async function GET() {
  try {
    const { agentMode } = providers();
    await mkdir(dataDir(), { recursive: true });
    await access(dataDir(), constants.W_OK);
    return NextResponse.json({
      status: "ok",
      catalog: "fixture",
      agent: agentMode,
      geo: "fixture",
      store: "json",
      mode: "demo",
    });
  } catch {
    return NextResponse.json({ status: "error" }, { status: 503 });
  }
}
