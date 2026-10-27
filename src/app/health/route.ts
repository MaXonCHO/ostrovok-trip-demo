import { NextResponse } from "next/server";
import { hotels } from "@/features/ostrovok/catalog";

export function GET() {
  return NextResponse.json({
    status: "ok",
    mode: "demo",
    hotels: hotels.length,
  });
}
