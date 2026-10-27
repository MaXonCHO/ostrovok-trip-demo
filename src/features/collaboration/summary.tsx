"use client";
import { useState } from "react";
import {
  PencilSimple,
  Copy,
  UserPlus,
  Check,
  ArrowUpRight,
  CalendarBlank,
  Wallet,
  Footprints,
  MapPin,
  Users,
} from "@phosphor-icons/react";
import { useTrip } from "@/features/trips/context";
import {
  Button,
  Dialog,
  Input,
  Avatar,
  Chip,
} from "@/components/ui/primitives";
import { cities, interestLabels } from "@/data/fixtures/lexicon";
export function TripSummary() {
  const { trip, command, busy, setNotice } = useTrip();
  const [edit, setEdit] = useState(false);
  const [expanded, setExpanded] = useState(false);
  if (!trip) return null;
  const me = trip.me;
  const budget = me.preferences.find((p) => p.key === "budget");
  const basis = me.preferences.find((p) => p.key === "budgetBasis")?.value;
  const walking = me.preferences.find((p) => p.key === "maxWalk");
  const money = (n: number) => n.toLocaleString("ru-RU") + " ₽";
  const own = me.id === trip.organizerId;
  async function save(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const ok = await command({
      type: "context",
      ...(own
        ? {
            cityId: String(f.get("city")) as "sochi",
            nights: Number(f.get("nights")),
            rooms: Number(f.get("rooms")),
            start: String(f.get("start") || ""),
            end: String(f.get("end") || ""),
          }
        : {}),
      budget: f.get("budget") ? Number(f.get("budget")) : null,
      budgetBasis: String(f.get("basis")) as "room_night" | "stay",
      maxWalk: f.get("walk") ? Number(f.get("walk")) : null,
      required: f.get("required") === "on",
    });
    if (ok) {
      setEdit(false);
      setNotice("Условия сохранены");
    }
  }
  return (
    <section className="trip-summary" data-expanded={expanded}>
      <div className="sidebar-heading">
        <h2>
          <span className="desktop-summary-title">Контекст поездки</span>
          <button
            className="summary-toggle"
            aria-expanded={expanded}
            onClick={() => setExpanded(!expanded)}
          >
            Контекст поездки <span>{expanded ? "Свернуть" : "Раскрыть"}</span>
          </button>
        </h2>
        {!trip.selected && me.role !== "viewer" && (
          <button
            className="icon-button"
            onClick={() => setEdit(true)}
            aria-label="Изменить контекст"
          >
            <PencilSimple size={19} />
          </button>
        )}
      </div>
      <div className="summary-body">
        <div className="summary-facts">
          <div>
            <MapPin size={19} />
            <span>
              {cities.find((c) => c.id === trip.cityId)?.name ??
                "Выберем направление"}
            </span>
          </div>
          <div>
            <CalendarBlank size={19} />
            <span>
              {trip.nights} ночи · {trip.rooms} номер{trip.rooms > 1 ? "а" : ""}
              <small>
                {trip.dates ? "Даты указаны" : "Даты пока не определены"}
              </small>
            </span>
          </div>
          <div>
            <Wallet size={19} />
            <span>
              {budget ? money(Number(budget.value)) : "Бюджет обсудим"}
              <small>
                {budget
                  ? basis === "stay"
                    ? "За всё проживание"
                    : "За ночь за номер"
                  : "Цена в демо, без бронирования"}
              </small>
            </span>
          </div>
          {walking && (
            <div>
              <Footprints size={19} />
              <span>
                До {String(walking.value)} минут пешком
                <small>
                  {walking.importance === "required"
                    ? "Обязательное ограничение"
                    : "Комфортная длительность"}
                </small>
              </span>
            </div>
          )}
        </div>
        <div className="summary-interests">
          {me.preferences
            .filter((p) => p.key.startsWith("interest:") && p.value === true)
            .map((p) => (
              <Chip key={p.id} selected>
                {interestLabels[p.key.slice(9) as keyof typeof interestLabels]}
              </Chip>
            ))}
        </div>
        <div className="context-caption">
          Пожелания: {me.name}. Их можно уточнять в диалоге.
        </div>
      </div>
      <Dialog
        title="Условия и ваши пожелания"
        open={edit}
        onOpenChange={setEdit}
      >
        <form onSubmit={save} className="stack">
          {own && (
            <>
              <label className="field">
                <span>Направление</span>
                <select name="city" defaultValue={trip.cityId ?? "sochi"}>
                  {cities.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </label>
              <div className="form-row">
                <Input
                  name="nights"
                  type="number"
                  min={1}
                  max={60}
                  defaultValue={trip.nights}
                  label="Ночей"
                  required
                />
                <Input
                  name="rooms"
                  type="number"
                  min={1}
                  max={8}
                  defaultValue={trip.rooms}
                  label="Номеров"
                  required
                />
              </div>
              <div className="form-row">
                <Input
                  name="start"
                  type="date"
                  defaultValue={trip.dates?.start}
                  label="Заезд"
                />
                <Input
                  name="end"
                  type="date"
                  defaultValue={trip.dates?.end}
                  label="Выезд"
                />
              </div>
            </>
          )}
          <Input
            name="budget"
            type="number"
            min={1}
            max={10000000}
            defaultValue={budget ? Number(budget.value) : ""}
            label="Ваш бюджет, ₽"
          />
          <label className="field">
            <span>За что указана сумма</span>
            <select name="basis" defaultValue={String(basis ?? "room_night")}>
              <option value="room_night">За ночь за номер</option>
              <option value="stay">За всё проживание, все номера</option>
            </select>
          </label>
          <Input
            name="walk"
            type="number"
            min={1}
            max={180}
            defaultValue={walking ? Number(walking.value) : ""}
            label="Максимум минут пешком"
          />
          <label className="checkbox-row">
            <input
              name="required"
              type="checkbox"
              defaultChecked={
                budget?.importance === "required" ||
                walking?.importance === "required"
              }
            />
            Бюджет и время ходьбы обязательны
          </label>
          {trip.scenarios.length > 0 && (
            <p className="notice">
              Изменение условий создаст новую версию подбора. Старые решения
              останутся в истории.
            </p>
          )}
          <Button type="submit" disabled={busy}>
            Сохранить изменения
          </Button>
        </form>
      </Dialog>
    </section>
  );
}
export function Participants() {
  const { trip, command, busy, setNotice } = useTrip();
  const [invite, setInvite] = useState(false);
  const [remove, setRemove] = useState<string | null>(null);
  const [leave, setLeave] = useState(false);
  if (!trip) return null;
  const own = trip.me.id === trip.organizerId;
  async function copy() {
    try {
      await navigator.clipboard.writeText(trip!.inviteUrl!);
      setNotice("Ссылка скопирована");
    } catch {
      setNotice("Скопируйте ссылку из поля приглашения");
    }
  }
  return (
    <section className="participants-section">
      <div className="sidebar-heading">
        <h2>Участники</h2>
        <Users size={19} />
      </div>
      {trip.participants
        .filter((p) => p.status !== "left")
        .map((p, i) => (
          <div className="participant-row" key={p.id}>
            <Avatar name={p.name} index={i} />
            <div>
              <strong>
                {p.name}
                {p.id === trip.me.id ? " · вы" : ""}
              </strong>
              <span>
                {p.role === "viewer"
                  ? "Просматривает поездку"
                  : p.hotelsFinished
                    ? "Выбор отелей завершён"
                    : p.scenariosConfirmed
                      ? "Сценарии выбраны"
                      : p.status === "ready"
                        ? "Рассматривает варианты"
                        : "Собирает пожелания"}
              </span>
            </div>
            {p.scenariosConfirmed && <Check size={17} />}
          </div>
        ))}
      {trip.blocked && (
        <p className="context-caption">
          Ждём ещё{" "}
          {trip.expectedParticipants -
            trip.participants.filter(
              (p) => p.status !== "left" && p.role !== "viewer",
            ).length}{" "}
          участника. Можно изучать предварительные сценарии.
        </p>
      )}
      {own && (
        <Button
          variant="secondary"
          className="full-width"
          onClick={() => setInvite(true)}
        >
          <UserPlus size={18} />
          Пригласить спутника
        </Button>
      )}
      <Dialog
        title="Пригласить в поездку"
        open={invite}
        onOpenChange={setInvite}
      >
        <p>
          По этой ссылке спутник вступит в поездку со своей сессией и расскажет
          о пожеланиях.
        </p>
        {trip.inviteRevoked ? (
          <p className="notice">
            Ссылка отозвана. Новые участники не смогут вступить.
          </p>
        ) : (
          <div className="stack">
            <Input
              label="Ссылка приглашения"
              value={trip.inviteUrl ?? ""}
              readOnly
              onFocus={(e) => e.target.select()}
            />
            <Button onClick={copy}>
              <Copy size={19} />
              Скопировать ссылку
            </Button>
            {trip.inviteUrl?.includes("localhost") && (
              <p className="notice">
                Ссылка localhost работает на этом Mac. Для телефона откройте
                приложение по сетевому адресу Mac и скопируйте приглашение
                оттуда.
              </p>
            )}
            <Button
              variant="ghost"
              disabled={busy}
              onClick={async () => {
                if (await command({ type: "revokeInvite" }))
                  setNotice("Ссылка отозвана");
              }}
            >
              Отозвать эту ссылку
            </Button>
          </div>
        )}
        <hr />
        <h3>Состав поездки</h3>
        {trip.participants
          .filter((p) => p.id !== trip.organizerId && p.status !== "left")
          .map((p) => (
            <div className="participant-manage" key={p.id}>
              <span>{p.name}</span>
              <Button
                variant="ghost"
                onClick={() => {
                  setInvite(false);
                  setRemove(p.id);
                }}
              >
                Удалить из поездки
              </Button>
            </div>
          ))}
      </Dialog>
      <Dialog
        title="Изменить состав поездки?"
        open={!!remove}
        onOpenChange={(v) => {
          if (!v) setRemove(null);
        }}
      >
        <p>
          Участник потеряет доступ. Общий выбор потребуется пройти заново,
          предыдущее решение сохранится в истории.
        </p>
        <Button
          variant="danger"
          disabled={busy}
          onClick={async () => {
            if (
              remove &&
              (await command({
                type: "removeParticipant",
                participantId: remove,
              }))
            ) {
              setRemove(null);
              setNotice("Состав поездки обновлён");
            }
          }}
        >
          Подтвердить удаление
        </Button>
      </Dialog>
      {!own && (
        <>
          <Button variant="ghost" onClick={() => setLeave(true)}>
            Выйти из поездки
          </Button>
          <Dialog
            title="Выйти из поездки?"
            open={leave}
            onOpenChange={setLeave}
          >
            <p>
              Вы потеряете доступ к плану. Если подбор ещё идёт, у оставшихся
              участников начнётся новая версия выбора.
            </p>
            <Button
              variant="danger"
              disabled={busy}
              onClick={() => command({ type: "leave" })}
            >
              Подтвердить выход
            </Button>
          </Dialog>
        </>
      )}
      {trip.selected && (
        <a className="text-link" href={`/trips/${trip.id}`}>
          К плану поездки <ArrowUpRight size={16} />
        </a>
      )}
    </section>
  );
}
