import { randomUUID, randomBytes, createHash } from "node:crypto";
import { database, transaction } from "./database";
import { rankHotels, labels } from "./recommendations";
import { inferredReadingExpectations } from "./reading-interests";
import { HttpError } from "./http";
import type {
  Account,
  Expectations,
  TripWorkspace,
  Selection,
  CriterionKey,
} from "@/features/planner/types";
import { emptyExpectations } from "@/features/planner/types";
import {
  emptyTripChatProfile,
  type TripChatContext,
  type TripChatMessage,
  type TripChatProfile,
} from "@/features/ostrovok/trip-chat-contract";
const timestamp = () => new Date().toISOString();
const digest = (x: string) => createHash("sha256").update(x).digest("hex");
export interface TripRow {
  id: string;
  owner_id: string;
  title: string;
  context_json: string;
  profile_json: string;
  expectations_json: string;
  status: "draft" | "profile";
  version: number;
  revision: number;
  include_unverified: number;
  pinned_hotel_id: string | null;
  invite_token: string | null;
  invite_expires_at: number | null;
  notice: string | null;
  updated_at: string;
}
export function tripRow(id: string, user: Account) {
  const row = database()
    .prepare(
      "SELECT trips.* FROM trips JOIN trip_members ON trips.id=trip_members.trip_id WHERE trips.id=? AND trip_members.user_id=?",
    )
    .get(id, user.id) as unknown as TripRow | undefined;
  if (!row)
    throw new HttpError(404, "Поездка не найдена или у вас нет доступа.");
  return row;
}
export function createWorkspace(user: Account, context: TripChatContext) {
  const id = randomUUID();
  const now = timestamp();
  transaction((db) => {
    db.prepare(
      "INSERT INTO trips(id,owner_id,title,context_json,profile_json,expectations_json,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?)",
    ).run(
      id,
      user.id,
      "Поездка в Петербург",
      JSON.stringify(context),
      JSON.stringify(emptyTripChatProfile()),
      JSON.stringify(emptyExpectations()),
      now,
      now,
    );
    db.prepare("INSERT INTO trip_members VALUES(?,?,?,?)").run(
      id,
      user.id,
      "owner",
      now,
    );
  });
  return tripRow(id, user);
}
export function workspace(
  row: TripRow,
  user: Account,
  origin: string,
): TripWorkspace {
  const db = database();
  const profile = JSON.parse(row.profile_json) as TripChatProfile;
  const expectations = JSON.parse(row.expectations_json) as Expectations;
  return {
    id: row.id,
    title: row.title,
    ownerId: row.owner_id,
    myRole: row.owner_id === user.id ? "owner" : "member",
    version: row.version,
    revision: row.revision,
    status: row.status,
    context: JSON.parse(row.context_json),
    profile,
    expectations,
    selection: rankHotels(
      profile,
      row.status === "draft"
        ? inferredReadingExpectations(
            { ...user, id: row.owner_id },
            expectations,
          )
        : expectations,
      row.revision,
    ),
    messages: db
      .prepare(
        "SELECT role,content FROM trip_messages WHERE trip_id=? AND user_id=? ORDER BY id",
      )
      .all(row.id, user.id) as unknown as TripChatMessage[],
    includeUnverified: true,
    members: db
      .prepare(
        "SELECT users.id,users.name,trip_members.role FROM trip_members JOIN users ON users.id=trip_members.user_id WHERE trip_id=? ORDER BY joined_at",
      )
      .all(row.id) as unknown as TripWorkspace["members"],
    votes: (
      db
        .prepare(
          "SELECT hotel_id AS hotelId,user_id AS userId,users.name,liked FROM trip_votes JOIN users ON users.id=user_id WHERE trip_id=? AND revision=?",
        )
        .all(row.id, row.revision) as unknown as {
        hotelId: string;
        userId: string;
        name: string;
        liked: number;
      }[]
    ).map((v) => ({ ...v, liked: !!v.liked })),
    comments: db
      .prepare(
        "SELECT trip_comments.id,hotel_id AS hotelId,user_id AS userId,users.name,text,trip_comments.created_at AS createdAt FROM trip_comments JOIN users ON users.id=user_id WHERE trip_id=? ORDER BY trip_comments.created_at",
      )
      .all(row.id) as unknown as TripWorkspace["comments"],
    pinnedHotelId: row.pinned_hotel_id,
    updatedAt: row.updated_at,
    notice: row.notice,
    ...(row.owner_id === user.id &&
    row.invite_token &&
    row.invite_expires_at! > Date.now()
      ? { inviteUrl: origin + "/invite/" + row.invite_token }
      : {}),
  };
}
export function listWorkspaces(user: Account) {
  return database()
    .prepare(
      "SELECT trips.id,title,status,updated_at AS updatedAt,pinned_hotel_id AS pinnedHotelId FROM trips JOIN trip_members ON trips.id=trip_id WHERE user_id=? ORDER BY updated_at DESC",
    )
    .all(user.id);
}
export function selectedOptions(row: TripRow, selection?: Selection) {
  const s =
    selection ??
    rankHotels(
      JSON.parse(row.profile_json),
      JSON.parse(row.expectations_json),
      row.revision,
    );
  return [...s.results, ...s.needsCheck].slice(0, 5);
}
export function mutateWorkspace(
  id: string,
  user: Account,
  command: Record<string, unknown>,
  origin: string,
) {
  return transaction((db) => {
    const row = tripRow(id, user);
    const owner = row.owner_id === user.id;
    const type = command.type;
    if (
      ["finalize", "edit", "relax", "invite", "pin"].includes(String(type)) &&
      !owner
    )
      throw new HttpError(
        403,
        "Параметры поездки меняет организатор. Вы можете обсуждать и голосовать.",
      );
    if (type === "finalize") {
      if (!user.authenticated)
        throw new HttpError(401, "Войдите, чтобы сохранить профиль поездки.");
      if (command.version !== row.version)
        throw new HttpError(409, "Параметры изменились. Обновите поездку.");
      const p = JSON.parse(row.profile_json) as TripChatProfile;
      if (
        !p.city ||
        p.adults === null ||
        (!p.checkin && !p.datesFlexible) ||
        (p.budgetMax === null && !p.budgetFlexible)
      )
        throw new HttpError(
          400,
          "Сначала уточните город, даты, бюджет и состав участников.",
        );
      db.prepare(
        "UPDATE trips SET status='profile',expectations_json=?,include_unverified=?,updated_at=? WHERE id=?",
      ).run(
        JSON.stringify(
          inferredReadingExpectations(user, JSON.parse(row.expectations_json)),
        ),
        1,
        timestamp(),
        id,
      );
    } else if (type === "invite") {
      if (!user.authenticated)
        throw new HttpError(401, "Войдите для приглашения спутников.");
      const token = randomBytes(24).toString("hex");
      db.prepare(
        "UPDATE trips SET invite_hash=?,invite_token=?,invite_expires_at=? WHERE id=?",
      ).run(digest(token), token, Date.now() + 30 * 86400000, id);
    } else if (type === "vote" || type === "comment" || type === "pin") {
      if (!user.authenticated)
        throw new HttpError(401, "Войдите для совместного выбора.");
      if (
        typeof command.hotelId !== "string" ||
        !selectedOptions(row).some((h) => h.hotel.id === command.hotelId)
      )
        throw new HttpError(400, "Отель не входит в текущий список поездки.");
      if (
        (type === "vote" || type === "pin") &&
        command.revision !== row.revision
      )
        throw new HttpError(
          409,
          "Подбор изменился. Обновите список перед голосованием.",
        );
      if (type === "vote") {
        if (typeof command.liked !== "boolean")
          throw new HttpError(400, "Проверьте голос.");
        db.prepare(
          "INSERT INTO trip_votes VALUES(?,?,?,?,?,?) ON CONFLICT(trip_id,hotel_id,user_id,revision) DO UPDATE SET liked=excluded.liked,updated_at=excluded.updated_at",
        ).run(
          id,
          command.hotelId,
          user.id,
          row.revision,
          command.liked ? 1 : 0,
          timestamp(),
        );
        if (!command.liked && row.pinned_hotel_id === command.hotelId)
          db.prepare(
            "UPDATE trips SET pinned_hotel_id=NULL,notice=? WHERE id=?",
          ).run(
            "Один из участников изменил мнение. Обсудите выбор заново.",
            id,
          );
      } else if (type === "comment") {
        if (
          typeof command.text !== "string" ||
          !command.text.trim() ||
          command.text.length > 1500
        )
          throw new HttpError(
            400,
            "Комментарий должен содержать от 1 до 1500 символов.",
          );
        db.prepare("INSERT INTO trip_comments VALUES(?,?,?,?,?,?)").run(
          randomUUID(),
          id,
          command.hotelId,
          user.id,
          command.text.trim(),
          timestamp(),
        );
      } else {
        const members = db
          .prepare("SELECT user_id FROM trip_members WHERE trip_id=?")
          .all(id) as { user_id: string }[];
        const votes = db
          .prepare(
            "SELECT user_id FROM trip_votes WHERE trip_id=? AND hotel_id=? AND revision=? AND liked=1",
          )
          .all(id, command.hotelId, row.revision) as { user_id: string }[];
        if (!members.every((m) => votes.some((v) => v.user_id === m.user_id)))
          throw new HttpError(
            409,
            "Сначала все участники должны проголосовать за этот отель.",
          );
        db.prepare(
          "UPDATE trips SET pinned_hotel_id=?,notice=NULL WHERE id=?",
        ).run(command.hotelId, id);
      }
    } else if (type === "edit" || type === "relax") {
      if (command.version !== row.version)
        throw new HttpError(409, "Поездка уже обновлена. Повторите действие.");
      const profile = JSON.parse(row.profile_json) as TripChatProfile;
      const expectations = JSON.parse(row.expectations_json) as Expectations;
      if (type === "relax") {
        if (
          typeof command.key !== "string" ||
          !Object.hasOwn(labels, command.key)
        )
          throw new HttpError(400, "Неизвестное условие.");
        expectations.criteria = expectations.criteria.map((c) =>
          c.key === command.key ? { ...c, importance: "preferred" } : c,
        );
      } else {
        if (
          typeof command.budgetMax === "number" &&
          Number.isFinite(command.budgetMax) &&
          command.budgetMax > 0 &&
          command.budgetMax <= 1000000
        ) {
          profile.budgetMax = command.budgetMax;
          profile.budgetFlexible = false;
        } else if (command.budgetFlexible === true) {
          profile.budgetMax = null;
          profile.budgetFlexible = true;
        } else if (command.budgetMax !== undefined)
          throw new HttpError(400, "Проверьте бюджет.");
        for (const key of ["adults", "children", "rooms"] as const)
          if (command[key] !== undefined) {
            const max = key === "adults" ? 12 : key === "rooms" ? 8 : 6;
            const min = key === "children" ? 0 : 1;
            if (
              !Number.isInteger(command[key]) ||
              Number(command[key]) < min ||
              Number(command[key]) > max
            )
              throw new HttpError(400, "Проверьте состав участников.");
            profile[key] = Number(command[key]);
          }
        if (command.datesFlexible === true) {
          profile.checkin = null;
          profile.checkout = null;
          profile.datesFlexible = true;
        } else if (
          command.checkin !== undefined ||
          command.checkout !== undefined
        ) {
          if (
            typeof command.checkin !== "string" ||
            typeof command.checkout !== "string" ||
            !/^\d{4}-\d{2}-\d{2}$/.test(command.checkin) ||
            !/^\d{4}-\d{2}-\d{2}$/.test(command.checkout) ||
            !Number.isFinite(Date.parse(command.checkin)) ||
            !Number.isFinite(Date.parse(command.checkout)) ||
            new Date(command.checkin).toISOString().slice(0, 10) !==
              command.checkin ||
            new Date(command.checkout).toISOString().slice(0, 10) !==
              command.checkout ||
            command.checkout <= command.checkin ||
            Date.parse(command.checkout) - Date.parse(command.checkin) >
              60 * 86400000
          )
            throw new HttpError(400, "Проверьте даты: от 1 до 60 ночей.");
          profile.checkin = command.checkin;
          profile.checkout = command.checkout;
          profile.datesFlexible = false;
        }
        if (Array.isArray(command.criteria)) {
          if (command.criteria.length > 20)
            throw new HttpError(400, "Слишком много условий.");
          if (
            new Set(command.criteria.map((c) => c?.key)).size !==
            command.criteria.length
          )
            throw new HttpError(400, "Условия не должны повторяться.");
          for (const c of command.criteria) {
            if (
              !c ||
              typeof c !== "object" ||
              !Object.hasOwn(labels, c.key) ||
              !["required", "preferred"].includes(c.importance) ||
              typeof c.value !== "boolean"
            )
              throw new HttpError(400, "Проверьте пожелания.");
          }
          expectations.criteria = command.criteria.map((c) => ({
            key: c.key as CriterionKey,
            label: labels[c.key as CriterionKey],
            value: c.value,
            importance: c.importance,
            detail:
              typeof c.detail === "string" ? c.detail.slice(0, 150) : undefined,
          }));
        }
      }
      db.prepare(
        "UPDATE trips SET profile_json=?,expectations_json=?,version=version+1,revision=revision+1,pinned_hotel_id=NULL,notice=?,updated_at=? WHERE id=?",
      ).run(
        JSON.stringify(profile),
        JSON.stringify(expectations),
        "Условия изменились. Подбор пересчитан, голоса относятся к новой версии.",
        timestamp(),
        id,
      );
    } else throw new HttpError(400, "Неизвестное действие.");
    return workspace(tripRow(id, user), user, origin);
  });
}
export function invitePreview(token: string) {
  if (!/^[a-f0-9]{48}$/.test(token))
    throw new HttpError(404, "Приглашение не найдено.");
  const row = database()
    .prepare(
      "SELECT id,title,profile_json,invite_expires_at FROM trips WHERE invite_hash=?",
    )
    .get(digest(token)) as
    | {
        id: string;
        title: string;
        profile_json: string;
        invite_expires_at: number;
      }
    | undefined;
  if (!row || row.invite_expires_at < Date.now())
    throw new HttpError(404, "Приглашение истекло или отозвано.");
  return {
    id: row.id,
    title: row.title,
    profile: JSON.parse(row.profile_json) as TripChatProfile,
  };
}
export function joinWorkspace(token: string, user: Account) {
  if (!user.authenticated)
    throw new HttpError(401, "Войдите для участия в поездке.");
  return transaction((db) => {
    const invite = invitePreview(token);
    const added = db
      .prepare("INSERT OR IGNORE INTO trip_members VALUES(?,?,?,?)")
      .run(invite.id, user.id, "member", timestamp());
    if (added.changes)
      db.prepare(
        "UPDATE trips SET pinned_hotel_id=NULL,notice=? WHERE id=?",
      ).run(
        "К поездке присоединился новый участник. Подтвердите общий выбор вместе.",
        invite.id,
      );
    return { id: invite.id };
  });
}
