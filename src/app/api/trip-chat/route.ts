import { durableRoute } from "@/server/durable-database";
import { NextResponse } from "next/server";
import { account } from "@/server/auth";
import { chatCommand } from "@/server/chat";
import { failure, jsonBody } from "@/server/http";
import {
  TripChatError,
  parseTripChatRequest,
} from "@/features/ostrovok/trip-chat-contract";
export const runtime = "nodejs";
export const maxDuration = 60;
async function handlePOST(req: Request) {
  try {
    const input = await jsonBody(req);
    const core = { messages: input.messages, context: input.context };
    parseTripChatRequest(core);
    const user = await account(true);
    const packet = await chatCommand(input, user!, req.signal);
    return NextResponse.json(
      {
        ...packet.reply,
        tripId: packet.tripId,
        tripVersion: packet.tripVersion,
        selection: packet.selection,
        expectations: packet.expectations,
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (e) {
    if (e instanceof TripChatError)
      return NextResponse.json(
        { error: e.message },
        { status: e.status, headers: { "Cache-Control": "no-store" } },
      );
    return failure(e);
  }
}

export const POST = durableRoute(handlePOST, true);
