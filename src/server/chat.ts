import { randomUUID } from "node:crypto";
import { database, transaction } from "./database";
import { createWorkspace, tripRow } from "./workspaces";
import { rankHotels } from "./recommendations";
import { plannerAgent } from "./planner-agent";
import { HttpError } from "./http";
import { inferredReadingExpectations } from "./reading-interests";
import type {
  Account,
  Expectations,
  PlannerReply,
} from "@/features/planner/types";
import {
  parseTripChatRequest,
  type TripChatMessage,
  type TripChatProfile,
} from "@/features/ostrovok/trip-chat-contract";
export async function chatCommand(
  input: Record<string, unknown>,
  user: Account,
  signal?: AbortSignal,
): Promise<PlannerReply> {
  const { tripId, tripVersion, requestId, ...raw } = input;
  const request = parseTripChatRequest(raw);
  if (typeof requestId !== "string" || !/^[\da-f-]{36}$/i.test(requestId))
    throw new HttpError(400, "Запросу нужен идентификатор.");
  const db = database();
  const existing = db
    .prepare("SELECT * FROM chat_requests WHERE id=?")
    .get(requestId) as
    | {
        user_id: string;
        trip_id: string | null;
        status: string;
        result_json: string | null;
        created_at: number;
      }
    | undefined;
  if (existing) {
    if (existing.user_id !== user.id)
      throw new HttpError(403, "Нет доступа к запросу.");
    if (existing.trip_id) tripRow(existing.trip_id, user);
    if (existing.status === "done" && existing.result_json)
      return JSON.parse(existing.result_json);
    if (
      existing.status === "running" &&
      existing.created_at > Date.now() - 60000
    )
      throw new HttpError(
        409,
        "Предыдущее сообщение ещё обрабатывается. Повторите через несколько секунд.",
      );
  }
  const row =
    typeof tripId === "string"
      ? tripRow(tripId, user)
      : existing?.trip_id
        ? tripRow(existing.trip_id, user)
        : createWorkspace(user, request.context);
  if (row.owner_id !== user.id)
    throw new HttpError(
      403,
      "Диалог и общие параметры меняет организатор. Вы можете обсудить варианты в профиле.",
    );
  if (typeof tripId === "string" && tripVersion !== row.version)
    throw new HttpError(
      409,
      "Поездка обновилась. Откройте её заново из аккаунта.",
    );
  const stored = db
    .prepare(
      "SELECT role,content FROM trip_messages WHERE trip_id=? AND user_id=? ORDER BY id",
    )
    .all(row.id, user.id) as unknown as TripChatMessage[];
  const current = request.messages.at(-1)!;
  const messages = stored.length ? [...stored, current] : request.messages;
  db.prepare(
    "INSERT INTO chat_requests VALUES(?,?,?,'running',NULL,?) ON CONFLICT(id) DO UPDATE SET status='running',created_at=excluded.created_at",
  ).run(requestId, user.id, row.id, Date.now());
  try {
    const profile = JSON.parse(row.profile_json) as TripChatProfile;
    const expectations = JSON.parse(row.expectations_json) as Expectations;
    const result = await plannerAgent(
      messages,
      profile,
      expectations,
      rankHotels(
        profile,
        inferredReadingExpectations(user, expectations),
        row.revision,
      ),
      signal,
    );
    const changed =
      JSON.stringify(profile) !== JSON.stringify(result.reply.profile) ||
      JSON.stringify(expectations) !== JSON.stringify(result.expectations);
    const revision = row.revision + (changed ? 1 : 0);
    const response: PlannerReply = {
      ...result,
      tripId: row.id,
      tripVersion: row.version + 1,
      selection: rankHotels(
        result.reply.profile,
        inferredReadingExpectations(user, result.expectations),
        revision,
      ),
    };
    transaction(() => {
      const update = db
        .prepare(
          "UPDATE trips SET profile_json=?,expectations_json=?,version=version+1,revision=?,pinned_hotel_id=CASE WHEN ? THEN NULL ELSE pinned_hotel_id END,notice=CASE WHEN ? THEN ? ELSE notice END,updated_at=? WHERE id=? AND version=? AND owner_id=?",
        )
        .run(
          JSON.stringify(result.reply.profile),
          JSON.stringify(result.expectations),
          revision,
          changed ? 1 : 0,
          changed && row.status === "profile" ? 1 : 0,
          "Пожелания изменились. Подбор пересчитан, предыдущий общий выбор требует подтверждения.",
          new Date().toISOString(),
          row.id,
          row.version,
          user.id,
        );
      if (!update.changes)
        throw new HttpError(
          409,
          "Параметры изменились во время ответа. Повторите сообщение.",
        );
      const insert = db.prepare(
        "INSERT INTO trip_messages(trip_id,user_id,role,content,created_at) VALUES(?,?,?,?,?)",
      );
      for (const message of stored.length ? [current] : request.messages)
        insert.run(
          row.id,
          user.id,
          message.role,
          message.content,
          new Date().toISOString(),
        );
      insert.run(
        row.id,
        user.id,
        "assistant",
        result.reply.message,
        new Date().toISOString(),
      );
      db.prepare(
        "UPDATE chat_requests SET status='done',result_json=? WHERE id=?",
      ).run(JSON.stringify(response), requestId);
    });
    return response;
  } catch (e) {
    db.prepare("UPDATE chat_requests SET status='failed' WHERE id=?").run(
      requestId,
    );
    throw e;
  }
}
export const newRequestId = () => randomUUID();
