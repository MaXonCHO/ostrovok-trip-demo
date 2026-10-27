import { getTripChatReply } from "@/features/ostrovok/trip-chat-service";
import {
  parseTripChatRequest,
  readTripChatJson,
  TripChatError,
} from "@/features/ostrovok/trip-chat-contract";

export const runtime = "nodejs";
export const maxDuration = 30;

export async function POST(request: Request) {
  const headers = { "Cache-Control": "no-store" };
  try {
    if (
      !request.headers
        .get("content-type")
        ?.toLowerCase()
        .includes("application/json")
    )
      throw new TripChatError(400, "Отправьте сообщение в формате JSON.");
    const input = parseTripChatRequest(await readTripChatJson(request));
    return Response.json(
      await getTripChatReply(input, { signal: request.signal }),
      { headers },
    );
  } catch (error) {
    if (error instanceof TripChatError)
      return Response.json(
        { error: error.message },
        { status: error.status, headers },
      );
    return Response.json(
      { error: "Не удалось обработать сообщение. Попробуйте ещё раз." },
      { status: 500, headers },
    );
  }
}
