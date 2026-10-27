import { randomUUID, randomBytes } from "node:crypto";
import type {
  Trip,
  Participant,
  TripView,
  FinalProposal,
} from "@/domain/models";
import {
  activeParticipants,
  commonScenarios,
  matchedHotels,
  collective,
  newRevision,
  recordVote,
  decisionFor,
  finalIsReady,
  sameProposal,
} from "@/domain/rules";
import { providers } from "@/data/providers";
import {
  AppError,
  atomicJson,
  readJson,
  serialized,
} from "@/data/adapters/json-file";
import { createTripSchema, type TripCommand } from "@/data/contracts/commands";
import { z } from "zod";
import { cities } from "@/data/fixtures/lexicon";
const now = () => new Date().toISOString();
export function participant(
  id: string,
  name: string,
  organizer = false,
): Participant {
  return {
    id,
    name,
    role: organizer ? "organizer" : "member",
    status: "collecting",
    preferences: [],
    messages: [
      {
        id: randomUUID(),
        role: "agent",
        text: "Как хочется провести эти дни? Расскажите о ритме отдыха и о том, без чего поездка не получится.",
        createdAt: now(),
      },
    ],
    scenariosConfirmed: false,
    hotelsFinished: false,
  };
}
export async function createTrip(
  userId: string,
  input: z.infer<typeof createTripSchema>,
): Promise<Trip> {
  const p = participant(userId, input.name, true);
  const id = randomUUID();
  const trip: Trip = {
    catalogVersion: 2,
    id,
    version: 0,
    selectionRevision: 1,
    title: input.cityId
      ? `Несколько дней: ${cities.find((c) => c.id === input.cityId)!.name}`
      : "Новая поездка",
    cityId: input.cityId,
    cityConfirmed: !!input.cityId,
    nights:
      input.start && input.end
        ? Math.ceil(
            (Date.parse(input.end) - Date.parse(input.start)) / 86400000,
          )
        : input.nights,
    rooms: input.rooms,
    dates:
      input.start && input.end ? { start: input.start, end: input.end } : null,
    organizerId: userId,
    group: input.group,
    expectedParticipants: input.group
      ? Math.max(2, input.expectedParticipants)
      : 1,
    participants: [p],
    stage: "chat",
    votes: [],
    scenarios: [],
    candidates: [],
    proposal: null,
    selected: null,
    history: [],
    materials: [],
    savedPlaces: [],
    customPlaces: [],
    inviteToken: randomBytes(24).toString("hex"),
    inviteRevoked: false,
    createdAt: now(),
    updatedAt: now(),
    isDemo: false,
    processedCommands: [],
  };
  if (input.prompt) await applyMessage(trip, p, input.prompt);
  await providers().trips.create(trip);
  await serialized("invites", async () => {
    const all = await readJson<Record<string, string>>("invites.json", {});
    all[trip.inviteToken] = id;
    await atomicJson("invites.json", all);
  });
  return trip;
}
export function member(trip: Trip, userId: string) {
  const me = trip.participants.find(
    (p) => p.id === userId && p.status !== "left",
  );
  if (!me)
    throw new AppError(
      403,
      "У вас нет доступа к этой поездке. Откройте приглашение организатора.",
    );
  return me;
}
async function applyMessage(trip: Trip, me: Participant, text: string) {
  const { agent } = providers();
  const message = {
    id: randomUUID(),
    role: "user" as const,
    text,
    createdAt: now(),
  };
  me.messages.push(message);
  const reply = await agent.reply({ trip, participantId: me.id, text });
  const changed = reply.updates.some((u) => {
    const old = me.preferences.find((p) => p.key === u.key);
    return old?.value !== u.value || old?.importance !== u.importance;
  });
  if (
    trip.scenarios.length &&
    (changed ||
      (reply.cityId &&
        reply.cityId !== trip.cityId &&
        trip.organizerId === me.id))
  )
    newRevision(
      trip,
      "Пожелания изменились. Сценарии и голоса относятся к новому подбору.",
    );
  for (const u of reply.updates) {
    const old = me.preferences.find((p) => p.key === u.key);
    if (old)
      Object.assign(old, u, { updatedAt: now(), sourceMessageId: message.id });
    else
      me.preferences.push({
        ...u,
        id: randomUUID(),
        participantId: me.id,
        sourceMessageId: message.id,
        updatedAt: now(),
      });
  }
  if (reply.cityId && !trip.selected) {
    if (trip.organizerId === me.id) {
      trip.cityId = reply.cityId;
      trip.cityConfirmed = true;
      trip.title = `Несколько дней: ${cities.find((c) => c.id === reply.cityId)!.name}`;
    } else
      reply.text +=
        " Направление поездки меняет организатор в общем контексте.";
  }
  me.messages.push({
    id: randomUUID(),
    role: "agent",
    text: reply.text,
    createdAt: now(),
  });
}
export async function viewTrip(
  trip: Trip,
  userId: string,
  baseUrl: string,
): Promise<TripView> {
  const me = member(trip, userId);
  const { catalog, agentMode } = providers();
  const { inviteToken, processedCommands, participants, ...publicTrip } = trip;
  const liveCatalog = trip.cityId
    ? await catalog.listHotels({ cityId: trip.cityId })
    : [];
  const candidates = trip.candidates.map((c) => {
    const h = liveCatalog.find((h) => h.id === c.hotelId);
    const latest = h?.evidence
      .filter((e) => e.source.kind === "host" && e.source.recordId)
      .at(-1);
    if (!latest) return c;
    const clarification =
      latest.featureKey === "windowSide"
        ? `Отельер уточнил окна категории «Стандарт»: ${String(latest.value)}. Демо-ответ; другие источники сохранены.`
        : `Отельер добавил уточнение. Проверьте область и конфликт в источниках.`;
    return {
      ...c,
      participantReasons: Object.fromEntries(
        Object.entries(c.participantReasons).map(([id, reasons]) => [
          id,
          [...reasons, clarification],
        ]),
      ),
    };
  });
  void processedCommands;
  return {
    ...publicTrip,
    candidates,
    participants: participants.map((p) => {
      const { messages, ...rest } = p;
      void messages;
      return rest;
    }),
    me,
    inviteUrl:
      trip.organizerId === userId
        ? `${baseUrl}/join/${inviteToken}`
        : undefined,
    scenarioIds: commonScenarios(trip),
    matches: matchedHotels(trip),
    waitingHotelIds: trip.candidates
      .filter((c) => collective(trip, "hotel", c.hotelId) === "waiting")
      .map((c) => c.hotelId),
    blocked: activeParticipants(trip).length < trip.expectedParticipants,
    agentMode,
    catalog: liveCatalog,
    places: trip.cityId
      ? await catalog.listPlaces({ cityId: trip.cityId })
      : [],
  };
}
export async function mutateTrip(
  id: string,
  userId: string,
  version: number,
  commandId: string,
  command: TripCommand,
) {
  const { trips, recommendations, catalog } = providers();
  const existing = await trips.get(id);
  if (!existing) throw new AppError(404, "Поездка не найдена");
  member(existing, userId);
  if (existing.processedCommands.includes(commandId)) return existing;
  return trips.applyCommand(id, version, async (trip) => {
    const me = member(trip, userId);
    const organizer = () => {
      if (me.id !== trip.organizerId)
        throw new AppError(403, "Это действие доступно организатору.");
    };
    if (
      me.role === "viewer" &&
      !["material", "savePlace", "customPlace", "leave"].includes(command.type)
    )
      throw new AppError(
        403,
        "Вы присоединились после выбора. Организатор может переоткрыть подбор.",
      );
    if (
      trip.selected &&
      [
        "message",
        "context",
        "preference",
        "generateScenarios",
        "vote",
        "confirmScenarios",
        "openHotels",
        "propose",
        "confirmFinal",
      ].includes(command.type)
    )
      throw new AppError(
        409,
        "Решение уже сохранено. Организатор может явно переоткрыть подбор.",
      );
    switch (command.type) {
      case "message":
        if (trip.selected)
          throw new AppError(
            409,
            "Для изменения пожеланий сначала переоткройте подбор.",
          );
        await applyMessage(trip, me, command.text);
        break;
      case "context": {
        if (trip.selected)
          throw new AppError(
            409,
            "Для изменения условий сначала переоткройте подбор.",
          );
        if (
          command.cityId ||
          command.nights ||
          command.rooms ||
          command.start ||
          command.end
        )
          organizer();
        if (trip.scenarios.length)
          newRevision(
            trip,
            "Условия поездки обновлены. Старые голоса сохранены в истории.",
          );
        if (command.cityId) {
          trip.cityId = command.cityId;
          trip.cityConfirmed = true;
          trip.title = `Несколько дней: ${cities.find((c) => c.id === command.cityId)!.name}`;
        }
        if (command.nights) trip.nights = command.nights;
        if (command.rooms) trip.rooms = command.rooms;
        if (!!command.start !== !!command.end)
          throw new AppError(
            400,
            "Укажите обе даты или оставьте их открытыми.",
          );
        if (command.start === "" && command.end === "") trip.dates = null;
        if (command.start && command.end) {
          if (
            command.end <= command.start ||
            (Date.parse(command.end) - Date.parse(command.start)) / 86400000 >
              60
          )
            throw new AppError(400, "Дата выезда должна быть позже заезда.");
          trip.dates = { start: command.start, end: command.end };
          trip.nights = Math.ceil(
            (Date.parse(command.end) - Date.parse(command.start)) / 86400000,
          );
        }
        for (const key of ["budget", "budgetBasis", "maxWalk"] as const)
          if (command[key] !== undefined) {
            me.preferences = me.preferences.filter((p) => p.key !== key);
            if (command[key] !== null)
              me.preferences.push({
                id: randomUUID(),
                participantId: userId,
                key,
                value: command[key],
                importance: command.required ? "required" : "preferred",
                priority: command.required ? 1 : 0.7,
                updatedAt: now(),
              });
          }
        break;
      }
      case "preference": {
        const p = me.preferences.find((p) => p.id === command.id);
        if (!p) throw new AppError(404, "Пожелание не найдено");
        if (trip.selected)
          throw new AppError(409, "Сначала переоткройте подбор.");
        if (trip.scenarios.length)
          newRevision(
            trip,
            "Изменилось пожелание участника. Подготовим новые сценарии.",
          );
        p.importance = command.importance;
        if (command.value !== undefined) p.value = command.value;
        p.updatedAt = now();
        break;
      }
      case "generateScenarios": {
        if (!trip.cityConfirmed)
          throw new AppError(400, "Сначала выберите направление.");
        if (trip.selected)
          throw new AppError(409, "Сначала переоткройте подбор.");
        if (!trip.scenarios.length)
          trip.scenarios = await recommendations.getScenarios({ trip });
        trip.stage = "scenarios";
        me.status = "ready";
        break;
      }
      case "vote": {
        if (trip.selected)
          throw new AppError(
            409,
            "Этот выбор уже сохранён. Переоткройте подбор для изменений.",
          );
        if (command.entityType === "scenario") {
          if (!trip.scenarios.some((s) => s.id === command.entityId))
            throw new AppError(400, "Сценарий не относится к этому подбору");
          if (trip.candidates.length)
            throw new AppError(
              409,
              "Сценарии уже подтверждены. Уточните пожелания для нового подбора.",
            );
          me.scenariosConfirmed = false;
        } else if (!trip.candidates.some((h) => h.hotelId === command.entityId))
          throw new AppError(400, "Отель не относится к этому подбору");
        recordVote(trip, {
          participantId: userId,
          selectionRevision: trip.selectionRevision,
          entityType: command.entityType,
          entityId: command.entityId,
          decision: command.decision,
          rejectionReason: command.reason,
          updatedAt: now(),
        });
        break;
      }
      case "confirmScenarios":
        if (
          !trip.scenarios.length ||
          trip.scenarios.some(
            (s) => decisionFor(trip, userId, "scenario", s.id) === "unseen",
          )
        )
          throw new AppError(400, "Сначала рассмотрите каждый сценарий.");
        me.scenariosConfirmed = true;
        me.status = "ready";
        break;
      case "openHotels": {
        const ids = commonScenarios(trip);
        if (!ids.length)
          throw new AppError(409, "Нужны подтверждённые общие сценарии.");
        if (!trip.candidates.length)
          trip.candidates = await recommendations.getHotels({
            trip,
            scenarioIds: ids,
          });
        trip.stage = "hotels";
        break;
      }
      case "finishHotels":
        me.hotelsFinished = true;
        break;
      case "propose": {
        if (!matchedHotels(trip).includes(command.hotelId))
          throw new AppError(
            409,
            "Этот отель ещё не одобрен всеми или требует уточнения.",
          );
        const h = await catalog.getHotel(command.hotelId);
        const candidate = trip.candidates.find(
          (c) => c.hotelId === command.hotelId,
        )!;
        if (
          !h ||
          h.price !== candidate.price.amount ||
          h.room.id !== candidate.roomTypeId
        )
          throw new AppError(409, "Условия отеля изменились. Обновите подбор.");
        trip.proposal = {
          hotelId: h.id,
          roomTypeId: h.room.id,
          price: h.price,
          selectionRevision: trip.selectionRevision,
          confirmationIds: [],
          proposedBy: userId,
        };
        break;
      }
      case "confirmFinal": {
        if (!trip.proposal)
          throw new AppError(409, "Сначала предложите общий вариант.");
        const h = await catalog.getHotel(trip.proposal.hotelId);
        const actual: FinalProposal = {
          ...trip.proposal,
          price: h?.price ?? null,
          roomTypeId: h?.room.id ?? "",
          selectionRevision: trip.selectionRevision,
        };
        if (!h || !sameProposal(actual, trip.proposal)) {
          trip.proposal = null;
          trip.lastChange =
            "Цена или категория номера изменились. Подтверждения сброшены, предложите актуальный вариант заново.";
          break;
        }
        if (!trip.proposal.confirmationIds.includes(userId))
          trip.proposal.confirmationIds.push(userId);
        if (finalIsReady(trip)) {
          trip.selected = structuredClone(trip.proposal);
          trip.stage = "selected";
          trip.savedPlaces = (
            await catalog.listPlaces({ cityId: trip.cityId! })
          )
            .slice(0, 4)
            .map((p) => p.id);
        }
        break;
      }
      case "reopen":
        organizer();
        newRevision(
          trip,
          "Организатор переоткрыл выбор. Предыдущее решение сохранено в истории.",
        );
        break;
      case "revokeInvite":
        organizer();
        trip.inviteRevoked = true;
        break;
      case "removeParticipant": {
        organizer();
        if (command.participantId === userId)
          throw new AppError(400, "Организатор не может удалить себя.");
        const p = trip.participants.find((p) => p.id === command.participantId);
        if (!p || p.status === "left")
          throw new AppError(404, "Участник не найден");
        if (!trip.selected)
          newRevision(
            trip,
            "Состав поездки изменён. Нужен новый совместный выбор.",
          );
        p.status = "left";
        trip.expectedParticipants = activeParticipants(trip).length;
        break;
      }
      case "leave": {
        if (me.id === trip.organizerId)
          throw new AppError(
            400,
            "Организатор не может выйти из своей поездки.",
          );
        if (!trip.selected)
          newRevision(
            trip,
            "Участник вышел. Сценарии нужно рассмотреть заново.",
          );
        me.status = "left";
        trip.expectedParticipants = activeParticipants(trip).length;
        break;
      }
      case "material":
        if (command.materialType !== "note" && !command.url)
          throw new AppError(400, "Добавьте ссылку.");
        trip.materials.push({
          id: randomUUID(),
          type: command.materialType,
          title: command.title,
          url: command.url,
          text: command.text,
          authorId: userId,
        });
        break;
      case "savePlace": {
        if (
          !(await catalog.listPlaces({ cityId: trip.cityId! })).some(
            (p) => p.id === command.placeId,
          )
        )
          throw new AppError(400, "Место не найдено");
        trip.savedPlaces = trip.savedPlaces.includes(command.placeId)
          ? trip.savedPlaces.filter((p) => p !== command.placeId)
          : [...trip.savedPlaces, command.placeId];
        break;
      }
      case "customPlace":
        trip.customPlaces.push({
          id: randomUUID(),
          name: command.name,
          note: command.note,
        });
        break;
    }
    trip.processedCommands = [...trip.processedCommands.slice(-199), commandId];
  });
}
export async function invite(token: string) {
  if (!/^[a-f\d]{48}$/.test(token))
    throw new AppError(404, "Приглашение не найдено");
  const id = (await readJson<Record<string, string>>("invites.json", {}))[
    token
  ];
  const trip = id ? await providers().trips.get(id) : null;
  if (!trip) throw new AppError(404, "Поездка недоступна");
  if (trip.inviteRevoked)
    throw new AppError(410, "Организатор отозвал ссылку приглашения.");
  return trip;
}
export async function joinTrip(token: string, userId: string, name: string) {
  const { trips } = providers();
  const initial = await invite(token);
  const existing = initial.participants.find(
    (p) => p.id === userId && p.status !== "left",
  );
  if (existing) return initial;
  return trips.applyCommand(initial.id, initial.version, (trip) => {
    if (trip.inviteRevoked) throw new AppError(410, "Ссылка отозвана");
    if (trip.participants.filter((p) => p.status !== "left").length >= 12)
      throw new AppError(400, "В демо не более 12 участников.");
    const me = participant(userId, name);
    if (trip.selected) me.role = "viewer";
    else if (trip.scenarios.length)
      newRevision(
        trip,
        "Присоединился новый участник. Общие результаты нужно подтвердить заново.",
      );
    trip.participants = trip.participants.filter((p) => p.id !== userId);
    trip.participants.push(me);
    trip.group = true;
    trip.expectedParticipants = Math.max(
      trip.expectedParticipants,
      activeParticipants(trip).length,
    );
  });
}
