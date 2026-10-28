"use client";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState, useId } from "react";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  ChatCircle,
  Copy,
  Heart,
  XCircle,
  MapPin,
  PaperPlaneTilt,
  PushPin,
  Users,
  SlidersHorizontal,
} from "@phosphor-icons/react";
import { useAccount, postPlanner } from "./account-provider";
import { plural } from "@/features/ostrovok/search-state";
import { ActionMenu } from "./action-menu";
import { RecommendationCard } from "./recommendation-card";
import { labels } from "./criteria";
import type {
  Criterion,
  CriterionKey,
  TripWorkspace,
  RankedHotel,
} from "./types";
export function TripProfile({ id }: { id: string }) {
  const auth = useAccount();
  const [trip, setTrip] = useState<TripWorkspace | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [editing, setEditing] = useState(false);
  const [copied, setCopied] = useState(false);
  const sequence = useRef(0);
  const mutating = useRef(false);
  const load = useCallback(async () => {
    if (mutating.current) return;
    const seq = ++sequence.current;
    try {
      const r = await fetch("/api/planner/trips/" + id, { cache: "no-store" });
      const d = await r.json();
      if (!r.ok) throw Error(d.error);
      if (seq === sequence.current) {
        setTrip(d);
        setError("");
      }
    } catch (e) {
      if (seq === sequence.current) setError((e as Error).message);
    }
  }, [id]);
  useEffect(() => {
    if (!auth.ready) return;
    void load();
    const timer = setInterval(() => {
      if (!document.hidden) void load();
    }, 2500);
    return () => {
      clearInterval(timer);
      // This ref is a request generation counter, not a DOM node.
      // eslint-disable-next-line react-hooks/exhaustive-deps
      sequence.current++;
    };
  }, [auth.ready, auth.user?.id, load]);
  async function command(body: Record<string, unknown>) {
    mutating.current = true;
    setBusy(true);
    setError("");
    const seq = ++sequence.current;
    try {
      const d = await postPlanner("trips/" + id, body);
      if (seq === sequence.current) setTrip(d);
      return true;
    } catch (e) {
      setError((e as Error).message);
      return false;
    } finally {
      mutating.current = false;
      setBusy(false);
    }
  }
  if (!trip)
    return (
      <div className="ov-container ov-profile-page">
        <Link href="/account" className="ov-back">
          <ArrowLeft size={18} />
          Мои поездки
        </Link>
        <h1>Профиль поездки</h1>
        {error ? (
          <div className="ov-planner-empty">
            <p role="alert">{error}</p>
            {!auth.user?.authenticated && (
              <button className="ov-button" onClick={auth.openLogin}>
                Войти по демо-коду
              </button>
            )}
            <button className="ov-inline-button" onClick={load}>
              Обновить
            </button>
          </div>
        ) : (
          <div className="ov-planner-skeleton" />
        )}
      </div>
    );
  const p = trip.profile;
  const candidates = [
    ...trip.selection.results,
    ...trip.selection.needsCheck,
  ].slice(0, 5);
  const owner = trip.myRole === "owner";
  const pinned = candidates.find((h) => h.hotel.id === trip.pinnedHotelId);
  return (
    <div className="ov-container ov-profile-page">
      <Link href="/account" className="ov-back">
        <ArrowLeft size={18} />
        Мои поездки
      </Link>
      <header className="ov-profile-heading">
        <div>
          <span className="ov-selection-caption">
            <MapPin size={16} />
            Санкт-Петербург
          </span>
          <h1>{trip.title}</h1>
          <p>
            {p.checkin && p.checkout
              ? `${p.checkin} → ${p.checkout}`
              : "Даты пока открыты"}{" "}
            · {p.adults ?? "Уточняем"}{" "}
            {plural(p.adults ?? 2, ["взрослый", "взрослых", "взрослых"])}
            {p.children
              ? `, ${p.children} ${plural(p.children, ["ребёнок", "ребёнка", "детей"])}`
              : ""}{" "}
            · {p.rooms ?? 1}{" "}
            {plural(p.rooms ?? 1, ["номер", "номера", "номеров"])}
          </p>
        </div>
        {owner && (
          <button
            className="ov-inline-button ov-profile-edit"
            onClick={() => setEditing(!editing)}
          >
            <SlidersHorizontal size={18} />
            {editing ? "Закрыть" : "Изменить планы"}
          </button>
        )}
      </header>
      {trip.notice && (
        <p className="ov-condition-notice" role="status">
          {trip.notice}
        </p>
      )}
      {error && (
        <p className="ov-planner-error" role="alert">
          {error}
        </p>
      )}
      {editing && (
        <ProfileEditor
          key={trip.version}
          trip={trip}
          busy={busy}
          onSave={async (body) => {
            if (await command({ ...body, type: "edit", version: trip.version }))
              setEditing(false);
          }}
        />
      )}
      <div className="ov-profile-columns">
        <aside className="ov-trip-passport">
          <h2>Ваши планы</h2>
          <dl>
            <div>
              <dt>Бюджет за номер за ночь</dt>
              <dd>
                {p.budgetMax !== null
                  ? `До ${p.budgetMax.toLocaleString("ru-RU")} ₽`
                  : p.budgetFlexible
                    ? "Без ограничения"
                    : "Ещё не указан"}
              </dd>
            </div>
            <div>
              <dt>Цель поездки</dt>
              <dd>
                {trip.expectations.purpose ||
                  p.tripType ||
                  "Уточняется в диалоге"}
              </dd>
            </div>
            <div>
              <dt>Номера и наличие</dt>
              <dd>Тарифы и наличие не загружены</dd>
            </div>
          </dl>
          <h3>Пожелания</h3>
          {trip.expectations.criteria.length ? (
            <ul className="ov-passport-criteria">
              {trip.expectations.criteria.map((c) => (
                <li key={c.key}>
                  <span>
                    {c.value ? "" : "Не хочется: "}
                    {c.label}
                    {c.detail ? " · " + c.detail : ""}
                  </span>
                  <small>
                    {c.importance === "required" ? "Обязательно" : "Пожелание"}
                  </small>
                </li>
              ))}
            </ul>
          ) : (
            <p>Пока нет дополнительных пожеланий.</p>
          )}
          {trip.expectations.brandNames.length > 0 && (
            <p>Бренды: {trip.expectations.brandNames.join(", ")}.</p>
          )}
          {owner && (
            <Link className="ov-inline-button" href={"/my-trip?trip=" + id}>
              Продолжить диалог <ArrowRight size={17} />
            </Link>
          )}
          <hr />
          <h3>
            <Users size={19} />
            Едем вместе
          </h3>
          <ul className="ov-member-list">
            {trip.members.map((m) => (
              <li key={m.id}>
                <span className="ov-member-avatar">
                  {m.name.slice(0, 1).toUpperCase()}
                </span>
                <span>
                  {m.name}
                  <small>
                    {m.role === "owner" ? "Организатор" : "Спутник"}
                  </small>
                </span>
              </li>
            ))}
          </ul>
          {owner && (
            <details className="ov-invite-details">
              <summary>
                Пригласить спутников <Users size={17} />
              </summary>
              {trip.inviteUrl ? (
                <div className="ov-invite-copy">
                  <label htmlFor="invite-url">Ссылка для спутников</label>
                  <input
                    id="invite-url"
                    readOnly
                    value={trip.inviteUrl}
                    onFocus={(e) => e.target.select()}
                  />
                  <button
                    className="ov-button ov-button-white"
                    onClick={async () => {
                      try {
                        await navigator.clipboard.writeText(trip.inviteUrl!);
                        setCopied(true);
                      } catch {
                        setCopied(false);
                      }
                    }}
                  >
                    <Copy size={17} />
                    {copied ? "Скопировано" : "Скопировать"}
                  </button>
                  <button
                    className="ov-inline-button"
                    disabled={busy}
                    onClick={() => command({ type: "invite" })}
                  >
                    Обновить ссылку
                  </button>
                  <small>
                    Новая ссылка отменяет предыдущую. Уже вступившие участники
                    сохраняют доступ.
                  </small>
                </div>
              ) : (
                <button
                  className="ov-button"
                  disabled={busy}
                  onClick={() => command({ type: "invite" })}
                >
                  Создать приглашение <Users size={18} />
                </button>
              )}
            </details>
          )}
        </aside>
        <section className="ov-profile-results">
          <div className="ov-live-heading">
            <div>
              <h2>Выбираем вместе</h2>
              <p>
                {candidates.length}{" "}
                {plural(candidates.length, ["отель", "отеля", "отелей"])} для
                вашей поездки. Выберите то, что понравится всем.
              </p>
            </div>
            <span className="ov-selection-caption">Версия {trip.revision}</span>
          </div>
          {pinned && (
            <div className="ov-pinned-hotel" role="status">
              <PushPin size={23} weight="fill" />
              <div>
                <strong>Выбрали вместе: {pinned.hotel.name}</strong>
                <p>
                  Все {trip.members.length} участников проголосовали за этот
                  вариант. Бронирование не оформлено.
                </p>
              </div>
            </div>
          )}
          {candidates.length ? (
            candidates.map((h) => (
              <SharedOption
                key={h.hotel.id}
                item={h}
                trip={trip}
                busy={busy}
                currentUser={auth.user?.id ?? ""}
                command={command}
              />
            ))
          ) : (
            <div className="ov-planner-empty">
              <h3>Подходящих вариантов пока нет</h3>
              <p>Измените пожелания, чтобы расширить подборку.</p>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
function SharedOption({
  item,
  trip,
  busy,
  currentUser,
  command,
}: {
  item: RankedHotel;
  trip: TripWorkspace;
  busy: boolean;
  currentUser: string;
  command: (body: Record<string, unknown>) => Promise<boolean>;
}) {
  const [text, setText] = useState("");
  const [discussionOpen, setDiscussionOpen] = useState(false);
  const discussionId = useId();
  const votes = trip.votes.filter((v) => v.hotelId === item.hotel.id);
  const liked = votes.filter((v) => v.liked);
  const mine = votes.find((v) => v.userId === currentUser);
  const comments = trip.comments.filter((c) => c.hotelId === item.hotel.id);
  const allLiked = trip.members.every((m) =>
    liked.some((v) => v.userId === m.id),
  );
  const extraActions =
    trip.myRole === "owner" ? (
      <ActionMenu label={"Действия с отелем «" + item.hotel.name + "»"}>
        {trip.myRole === "owner" && (
          <>
            <button
              type="button"
              disabled={
                busy || !allLiked || trip.pinnedHotelId === item.hotel.id
              }
              onClick={() =>
                command({
                  type: "pin",
                  revision: trip.revision,
                  hotelId: item.hotel.id,
                })
              }
            >
              <PushPin size={18} />
              {trip.pinnedHotelId === item.hotel.id
                ? "Закреплён"
                : "Закрепить общий выбор"}
            </button>
            {!allLiked && (
              <small>
                Закрепление доступно, когда отель понравится всем участникам.
              </small>
            )}
          </>
        )}
      </ActionMenu>
    ) : null;
  return (
    <RecommendationCard item={item} actions={extraActions}>
      <div className="ov-option-social">
        <div className="ov-vote-row">
          <button
            className={"ov-vote-button " + (mine?.liked ? "is-liked" : "")}
            aria-pressed={mine?.liked === true}
            disabled={busy}
            onClick={() =>
              command({
                type: "vote",
                revision: trip.revision,
                hotelId: item.hotel.id,
                liked: !mine?.liked,
              })
            }
          >
            <Heart size={19} weight={mine?.liked ? "fill" : "regular"} />
            Нравится <span>{liked.length}</span>
          </button>
          <button
            type="button"
            className={
              "ov-vote-button ov-reject-button " +
              (mine?.liked === false ? "is-rejected" : "")
            }
            aria-pressed={mine?.liked === false}
            disabled={busy}
            onClick={() =>
              command({
                type: "vote",
                revision: trip.revision,
                hotelId: item.hotel.id,
                liked: false,
              })
            }
          >
            <XCircle
              size={19}
              weight={mine?.liked === false ? "fill" : "regular"}
            />
            Не подходит
          </button>
          <button
            className="ov-discussion-toggle"
            aria-expanded={discussionOpen}
            aria-controls={discussionId}
            onClick={() => setDiscussionOpen(!discussionOpen)}
          >
            <ChatCircle size={19} />
            Обсуждение <span>{comments.length}</span>
          </button>
        </div>
        <p className="ov-voter-names">
          {liked.length
            ? `Нравится: ${liked.map((v) => v.name).join(", ")}`
            : "Пока никто не голосовал."}{" "}
          {allLiked
            ? "Можно закрепить общий выбор."
            : mine?.liked === false
              ? "Вы отметили, что вариант не подходит."
              : ""}
        </p>
        <div
          id={discussionId}
          className="ov-discussion"
          hidden={!discussionOpen}
        >
          <h4>
            <ChatCircle size={18} />
            Обсуждение ({comments.length})
          </h4>
          {comments.map((c) => (
            <article className="ov-trip-comment" key={c.id}>
              <header>
                <strong>{c.name}</strong>
                <time dateTime={c.createdAt}>
                  {new Date(c.createdAt).toLocaleString("ru-RU", {
                    day: "numeric",
                    month: "short",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </time>
              </header>
              <p>{c.text}</p>
            </article>
          ))}
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              if (
                await command({ type: "comment", hotelId: item.hotel.id, text })
              )
                setText("");
            }}
          >
            <label>
              <span>Комментарий к «{item.hotel.name}»</span>
              <textarea
                rows={2}
                maxLength={1500}
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder="Что думаете об этом варианте?"
                required
              />
            </label>
            <button
              className="ov-button ov-button-white"
              disabled={busy || !text.trim()}
            >
              <PaperPlaneTilt size={17} />
              Отправить
            </button>
          </form>
        </div>
      </div>
    </RecommendationCard>
  );
}
function ProfileEditor({
  trip,
  busy,
  onSave,
}: {
  trip: TripWorkspace;
  busy: boolean;
  onSave: (body: Record<string, unknown>) => Promise<void>;
}) {
  const [criteria, setCriteria] = useState<Criterion[]>(
    trip.expectations.criteria,
  );
  const [budgetOpen, setBudgetOpen] = useState(trip.profile.budgetFlexible);
  const [datesOpen, setDatesOpen] = useState(trip.profile.datesFlexible);
  const [extra, setExtra] = useState<CriterionKey>("restaurants");
  return (
    <form
      className="ov-profile-editor"
      onSubmit={(e) => {
        e.preventDefault();
        const f = new FormData(e.currentTarget);
        void onSave({
          budgetFlexible: budgetOpen,
          ...(!budgetOpen ? { budgetMax: Number(f.get("budget")) } : {}),
          datesFlexible: datesOpen,
          ...(!datesOpen
            ? { checkin: f.get("checkin"), checkout: f.get("checkout") }
            : {}),
          adults: Number(f.get("adults")),
          children: Number(f.get("children")),
          rooms: Number(f.get("rooms")),
          criteria,
        });
      }}
    >
      <h2>Изменить условия</h2>
      <p>
        После сохранения подбор пересчитается. Предыдущие голоса не применяются
        к новым условиям.
      </p>
      <div className="ov-profile-fields">
        <label>
          <span>Бюджет за номер за ночь, ₽</span>
          <input
            name="budget"
            type="number"
            min={1}
            max={1000000}
            disabled={budgetOpen}
            defaultValue={trip.profile.budgetMax ?? 10000}
            required={!budgetOpen}
          />
        </label>
        <label className="ov-checkbox-label">
          <input
            type="checkbox"
            checked={budgetOpen}
            onChange={(e) => setBudgetOpen(e.target.checked)}
          />
          Без ограничения бюджета
        </label>
        <label>
          <span>Заезд</span>
          <input
            name="checkin"
            type="date"
            disabled={datesOpen}
            defaultValue={trip.profile.checkin ?? ""}
            required={!datesOpen}
          />
        </label>
        <label>
          <span>Выезд</span>
          <input
            name="checkout"
            type="date"
            disabled={datesOpen}
            defaultValue={trip.profile.checkout ?? ""}
            required={!datesOpen}
          />
        </label>
        <label className="ov-checkbox-label">
          <input
            type="checkbox"
            checked={datesOpen}
            onChange={(e) => setDatesOpen(e.target.checked)}
          />
          Даты пока открыты
        </label>
        <label>
          <span>Взрослых</span>
          <input
            name="adults"
            type="number"
            min={1}
            max={12}
            defaultValue={trip.profile.adults ?? 2}
            required
          />
        </label>
        <label>
          <span>Детей</span>
          <input
            name="children"
            type="number"
            min={0}
            max={6}
            defaultValue={trip.profile.children ?? 0}
            required
          />
        </label>
        <label>
          <span>Номеров</span>
          <input
            name="rooms"
            type="number"
            min={1}
            max={8}
            defaultValue={trip.profile.rooms ?? 1}
            required
          />
        </label>
      </div>
      <div className="ov-edit-criteria">
        {criteria.map((c) => (
          <div key={c.key}>
            <span>
              {c.value ? "" : "Без: "}
              {c.label}
            </span>
            <select
              aria-label={"Важность: " + c.label}
              value={c.importance}
              onChange={(e) =>
                setCriteria((v) =>
                  v.map((x) =>
                    x.key === c.key
                      ? {
                          ...x,
                          importance: e.target.value as Criterion["importance"],
                        }
                      : x,
                  ),
                )
              }
            >
              <option value="preferred">Пожелание</option>
              <option value="required">Обязательно</option>
            </select>
            <button
              type="button"
              className="ov-inline-button"
              onClick={() =>
                setCriteria((v) => v.filter((x) => x.key !== c.key))
              }
            >
              Убрать
            </button>
          </div>
        ))}
        <div>
          <select
            aria-label="Добавить пожелание"
            value={extra}
            onChange={(e) => setExtra(e.target.value as CriterionKey)}
          >
            {Object.entries(labels).map(([key, label]) => (
              <option key={key} value={key}>
                {label}
              </option>
            ))}
          </select>
          <button
            type="button"
            className="ov-inline-button"
            disabled={criteria.some((c) => c.key === extra)}
            onClick={() =>
              setCriteria((v) => [
                ...v,
                {
                  key: extra,
                  label: labels[extra],
                  importance: "preferred",
                  value: true,
                },
              ])
            }
          >
            Добавить
          </button>
        </div>
      </div>
      <button className="ov-button" disabled={busy}>
        {busy ? "Пересчитываем…" : "Сохранить и пересчитать"}
        <Check size={18} />
      </button>
    </form>
  );
}
