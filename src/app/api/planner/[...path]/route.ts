import { NextRequest, NextResponse } from "next/server";
import {
  account,
  logout,
  requestCode,
  requireAccount,
  verifyCode,
} from "@/server/auth";
import {
  database,
  catalogHotels,
  findCatalogHotel,
  catalogVersion,
  catalogRecords,
} from "@/server/database";
import { failure, HttpError, jsonBody } from "@/server/http";
import {
  invitePreview,
  joinWorkspace,
  listWorkspaces,
  mutateWorkspace,
  tripRow,
  workspace,
} from "@/server/workspaces";
import { emptyTripChatProfile } from "@/features/ostrovok/trip-chat-contract";
import { emptyExpectations } from "@/features/planner/types";
import { rankHotels } from "@/server/recommendations";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const result = (data: unknown) =>
  NextResponse.json(data, { headers: { "Cache-Control": "no-store" } });
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ path: string[] }> },
) {
  try {
    const { path } = await params;
    if (path.join("/") === "auth/session") {
      const user = await account(true);
      return result({
        user,
        favorites: database()
          .prepare("SELECT hotel_id FROM user_favorites WHERE user_id=?")
          .all(user!.id)
          .map((r: Record<string, unknown>) => r.hotel_id),
        demo: true,
      });
    }
    if (path.join("/") === "catalog")
      return result({
        hotels: catalogHotels(),
        count: 300,
        sourceHash: catalogVersion,
        hasPrices: false,
      });
    if (path.join("/") === "catalog/search")
      return result(rankHotels(emptyTripChatProfile(), emptyExpectations()));
    if (path[0] === "catalog" && path[1]) {
      const h = catalogRecords().find((h) => h.hotel_id === path[1]);
      if (!h) throw new HttpError(404, "Отель не найден.");
      return result(h);
    }
    if (path[0] === "invite" && path[1]) return result(invitePreview(path[1]));
    const user = await account();
    if (!user) throw new HttpError(401, "Войдите, чтобы открыть поездку.");
    if (path[0] === "trips" && !path[1])
      return result({ trips: listWorkspaces(user) });
    if (path[0] === "trips" && path[1])
      return result(
        workspace(tripRow(path[1], user), user, new URL(req.url).origin),
      );
    throw new HttpError(404, "Страница API не найдена.");
  } catch (e) {
    return failure(e);
  }
}
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ path: string[] }> },
) {
  try {
    const { path } = await params;
    const body = await jsonBody(req);
    if (path.join("/") === "auth/request")
      return result(requestCode(body.phone));
    if (path.join("/") === "auth/verify")
      return result({
        user: await verifyCode(body.challengeId, body.code, body.name),
      });
    if (path.join("/") === "auth/logout") {
      await logout();
      return result({ ok: true });
    }
    const user = await requireAccount();
    if (path.join("/") === "favorites") {
      if (
        typeof body.hotelId !== "string" ||
        typeof body.saved !== "boolean" ||
        !findCatalogHotel(body.hotelId)
      )
        throw new HttpError(400, "Проверьте отель.");
      const hotelId = findCatalogHotel(body.hotelId)!.id;
      if (body.saved)
        database()
          .prepare("INSERT OR IGNORE INTO user_favorites VALUES(?,?)")
          .run(user.id, hotelId);
      else
        database()
          .prepare("DELETE FROM user_favorites WHERE user_id=? AND hotel_id=?")
          .run(user.id, hotelId);
      return result({ ok: true });
    }
    if (path[0] === "invite" && path[1])
      return result(joinWorkspace(path[1], user));
    if (path[0] === "trips" && path[1])
      return result(
        mutateWorkspace(path[1], user, body, new URL(req.url).origin),
      );
    throw new HttpError(404, "Действие не найдено.");
  } catch (e) {
    return failure(e);
  }
}
