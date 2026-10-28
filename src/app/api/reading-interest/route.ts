import { durableRoute } from "@/server/durable-database";
import { NextResponse } from "next/server";
import { account } from "@/server/auth";
import { failure, jsonBody } from "@/server/http";
import {
  deleteReadingNote,
  getArticleReadingInterest,
  getReadingInterests,
  inferredReadingExpectations,
  recordReadingInterest,
  saveReadingNote,
} from "@/server/reading-interests";
import { emptyExpectations } from "@/features/planner/types";
export const runtime = "nodejs";
async function handleGET(req: Request) {
  try {
    const user = await account(true);
    const slug = new URL(req.url).searchParams.get("slug");
    return NextResponse.json(
      slug
        ? getArticleReadingInterest(user!, slug)
        : {
            interests: getReadingInterests(user!),
            inferredExpectations: inferredReadingExpectations(
              user!,
              emptyExpectations(),
            ),
          },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    return failure(error);
  }
}
async function handlePOST(req: Request) {
  try {
    const input = await jsonBody(req);
    const user = await account(true);
    const result =
      "note" in input
        ? saveReadingNote(user!, input.slug, input.note)
        : "deleteNote" in input
          ? deleteReadingNote(user!, input.slug, input.deleteNote)
          : recordReadingInterest(user!, input);
    return NextResponse.json(result, {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    return failure(error);
  }
}

export const GET = durableRoute(handleGET, true);

export const POST = durableRoute(handlePOST, true);

export const maxDuration = 60;
