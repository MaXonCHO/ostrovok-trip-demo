import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { randomUUID } from "node:crypto";
import { providers } from "@/data/providers";
import { session, requireSession, addSessionTrip } from "@/application/session";
import {
  createTrip,
  viewTrip,
  mutateTrip,
  invite,
  joinTrip,
  member,
} from "@/application/trips";
import { createDemo } from "@/application/demo";
import { baseUrl, errorResponse, originCheck } from "@/application/http";
import {
  AppError,
  readJson,
  atomicJson,
  serialized,
} from "@/data/adapters/json-file";
import { commandSchema, createTripSchema } from "@/data/contracts/commands";
import type { HostQuestion, Trip, Evidence } from "@/domain/models";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
async function actor(req: NextRequest, trip: Trip) {
  const s = await requireSession();
  member(trip, s.userId);
  const demo = req.headers.get("x-demo-persona");
  if (demo) {
    if (!trip.isDemo || trip.organizerId !== s.userId)
      throw new AppError(
        403,
        "Переключение участников доступно только в вашей демонстрации.",
      );
    member(trip, demo);
    return demo;
  }
  return s.userId;
}
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ path: string[] }> },
) {
  try {
    const { path } = await params;
    const { trips, geo } = providers();
    if (path[0] === "trips" && path.length === 1) {
      const s = await session();
      const list = s
        ? await Promise.all(s.tripIds.map((id) => trips.get(id)))
        : [];
      return NextResponse.json({
        trips: list
          .filter(
            (t): t is Trip =>
              !!t &&
              t.participants.some(
                (p) => p.id === s?.userId && p.status !== "left",
              ),
          )
          .map((t) => ({
            id: t.id,
            title: t.title,
            stage: t.stage,
            updatedAt: t.updatedAt,
            cityId: t.cityId,
            isDemo: t.isDemo,
          })),
      });
    }
    if (path[0] === "trips" && path[1]) {
      const t = await trips.get(path[1]);
      if (!t) throw new AppError(404, "Поездка не найдена");
      const userId = await actor(req, t);
      if (path[2] === "route") {
        const hotelId = req.nextUrl.searchParams.get("hotelId");
        const placeId = req.nextUrl.searchParams.get("placeId");
        if (
          !hotelId ||
          !placeId ||
          !t.candidates.some((c) => c.hotelId === hotelId)
        )
          throw new AppError(400, "Маршрут недоступен");
        return NextResponse.json(await geo.getRoute({ hotelId, placeId }));
      }
      return NextResponse.json(await viewTrip(t, userId, baseUrl(req)), {
        headers: { "Cache-Control": "no-store" },
      });
    }
    if (path[0] === "join" && path[1]) {
      const t = await invite(path[1]);
      const s = await session();
      return NextResponse.json({
        id: t.id,
        title: t.title,
        cityId: t.cityId,
        selected: !!t.selected,
        joined: t.participants.some(
          (p) => p.id === s?.userId && p.status !== "left",
        ),
        organizerName: t.participants.find((p) => p.id === t.organizerId)?.name,
      });
    }
    if (path[0] === "host") {
      const s = await requireSession();
      const questions = await readJson<HostQuestion[]>(
        "host-questions.json",
        [],
      );
      return NextResponse.json({
        questions: questions.filter((q) => q.createdBy === s.userId),
      });
    }
    throw new AppError(404, "Маршрут не найден");
  } catch (e) {
    return errorResponse(e);
  }
}
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ path: string[] }> },
) {
  try {
    originCheck(req);
    const { path } = await params;
    const body = await req.json();
    if (path[0] === "trips" && path.length === 1) {
      const input = createTripSchema.parse(body);
      const s = (await session(true))!;
      const trip = await createTrip(s.userId, input);
      await addSessionTrip(trip.id);
      return NextResponse.json({ id: trip.id }, { status: 201 });
    }
    if (path[0] === "trips" && path[1]) {
      const input = commandSchema.parse(body);
      const trip = await providers().trips.get(path[1]);
      if (!trip) throw new AppError(404, "Поездка не найдена");
      const userId = await actor(req, trip);
      const updated = await mutateTrip(
        trip.id,
        userId,
        input.version,
        input.commandId,
        input.command,
      );
      if (input.command.type === "leave")
        return NextResponse.json({ left: true, id: updated.id });
      return NextResponse.json(await viewTrip(updated, userId, baseUrl(req)));
    }
    if (path[0] === "join" && path[1]) {
      const input = z
        .object({ name: z.string().trim().min(1).max(40) })
        .parse(body);
      const s = (await session(true))!;
      const trip = await joinTrip(path[1], s.userId, input.name);
      await addSessionTrip(trip.id);
      return NextResponse.json({ id: trip.id });
    }
    if (path[0] === "demo") {
      const input = z
        .object({ kind: z.enum(["solo", "group", "conflict", "geo"]) })
        .parse(body);
      const s = (await session(true))!;
      const trip = await createDemo(s.userId, input.kind);
      await addSessionTrip(trip.id);
      return NextResponse.json({
        id: trip.id,
        route:
          input.kind === "conflict"
            ? "scenarios"
            : input.kind === "group"
              ? "matches"
              : input.kind === "geo"
                ? "geo"
                : "hotels",
      });
    }
    if (path[0] === "host") {
      const s = (await session(true))!;
      const input = z
        .discriminatedUnion("action", [
          z.object({
            action: z.literal("ask"),
            hotelId: z.string(),
            tripId: z.string().uuid(),
            question: z.string().min(1).max(1000),
          }),
          z.object({
            action: z.literal("answer"),
            id: z.string().uuid(),
            answer: z.string().trim().min(1).max(2000),
          }),
          z.object({ action: z.literal("confirm"), id: z.string().uuid() }),
        ])
        .parse(body);
      return await serialized("host", async () => {
        const questions = await readJson<HostQuestion[]>(
          "host-questions.json",
          [],
        );
        if (input.action === "ask") {
          const trip = await providers().trips.get(input.tripId);
          if (!trip) throw new AppError(404, "Поездка не найдена");
          member(trip, s.userId);
          const hotel = await providers().catalog.getHotel(input.hotelId);
          if (!hotel || hotel.cityId !== trip.cityId)
            throw new AppError(400, "Отель недоступен");
          questions.push({
            id: randomUUID(),
            hotelId: hotel.id,
            roomTypeId: hotel.room.id,
            question: input.question,
            status: "asked",
            createdBy: s.userId,
            createdAt: new Date().toISOString(),
          });
        } else {
          const q = questions.find(
            (q) => q.id === input.id && q.createdBy === s.userId,
          );
          if (!q) throw new AppError(404, "Вопрос не найден");
          if (q.status === "confirmed")
            throw new AppError(409, "Ответ уже подтверждён");
          if (input.action === "answer") {
            q.answer = input.answer;
            q.suggestion = undefined;
            q.status = "asked";
            if (/(?:окн|номер).{0,30}(?:двор)|во двор/i.test(input.answer))
              q.suggestion = {
                featureKey: "windowSide",
                value: "во двор",
                scope: "room",
              };
            else if (/окн.{0,30}(?:дорог|улиц)/i.test(input.answer))
              q.suggestion = {
                featureKey: "windowSide",
                value: "на улицу",
                scope: "room",
              };
            else if (/тихо|тихий|без шума/i.test(input.answer))
              q.suggestion = {
                featureKey: "quiet",
                value: true,
                scope: "hotel",
              };
            else if (/шумно|шумный/i.test(input.answer))
              q.suggestion = {
                featureKey: "quiet",
                value: false,
                scope: "hotel",
              };
            if (q.suggestion) q.status = "extracted";
          } else {
            if (!q.suggestion)
              throw new AppError(400, "Сначала нужен распознанный ответ.");
            const hotel = await providers().catalog.getHotel(q.hotelId);
            const old =
              hotel?.evidence.filter(
                (e) =>
                  e.featureKey === q.suggestion!.featureKey ||
                  e.featureKey === "quiet",
              ) ?? [];
            const e: Evidence = {
              id: randomUUID(),
              featureKey: q.suggestion.featureKey,
              scope: {
                hotelId: q.hotelId,
                ...(q.suggestion.scope === "room"
                  ? { roomTypeId: q.roomTypeId }
                  : {}),
              },
              value: q.suggestion.value,
              source: {
                kind: "host",
                name: "Демонстрационный ответ отельера",
                recordId: q.id,
              },
              isSynthetic: true,
              confidence: null,
              status: old.length ? "conflicting" : "demo",
              observedAt: new Date().toISOString(),
              conflictsWith: old.map((e) => e.id),
              method:
                "Ограниченное извлечение из свободного ответа с подтверждением",
            };
            await providers().catalog.addEvidence(q.hotelId, e);
            q.status = "confirmed";
          }
        }
        await atomicJson("host-questions.json", questions);
        return NextResponse.json({
          questions: questions.filter((q) => q.createdBy === s.userId),
        });
      });
    }
    throw new AppError(404, "Маршрут не найден");
  } catch (e) {
    return errorResponse(e);
  }
}
