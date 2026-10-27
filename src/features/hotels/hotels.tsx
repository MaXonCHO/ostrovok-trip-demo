"use client";
import { Photo } from "@/components/ui/photo";
import { useState } from "react";
import {
  Check,
  ArrowRight,
  ArrowCounterClockwise,
  MapPin,
  Info,
  Footprints,
} from "@phosphor-icons/react";
import { useTrip } from "@/features/trips/context";
import {
  Button,
  ActionLink,
  EmptyState,
  Chip,
} from "@/components/ui/primitives";
import { SwipeControls } from "@/components/ui/swipe-controls";
import { useRouter } from "next/navigation";
import { GestureSurface } from "./gesture";
import type { Hotel, Trip, Decision } from "@/domain/models";
import { decisionFor } from "@/domain/rules";
export const money = (n: number | null) =>
  n === null ? "Цена уточняется" : n.toLocaleString("ru-RU") + " ₽";
export function Hotels() {
  const { trip, command, busy, setNotice } = useTrip();
  const [filter, setFilter] = useState("all");
  const [skipped, setSkipped] = useState<string[]>([]);
  const [photo, setPhoto] = useState(0);
  const router = useRouter();
  const [reason, setReason] = useState<string | null>(null);
  const [other, setOther] = useState("");
  const [undo, setUndo] = useState<{ id: string; decision: Decision } | null>(
    null,
  );
  const [review, setReview] = useState(false);
  if (!trip) return null;
  const root = `/trips/${trip.id}`;
  if (!trip.candidates.length)
    return (
      <EmptyState
        title={
          trip.stage === "hotels"
            ? "Под эти условия отелей не нашлось"
            : "Сначала найдём общий сценарий"
        }
        text={
          trip.stage === "hotels"
            ? "В демонстрационном каталоге нет отелей, подтверждающих все обязательные условия. Проверьте бюджет и допустимое время ходьбы."
            : "Каждый участник выбирает сценарии отдыха. После общего решения появится одна колода отелей для всех."
        }
      >
        <ActionLink
          href={root + (trip.stage === "hotels" ? "/chat" : "/scenarios")}
        >
          Уточнить выбор <ArrowRight size={18} />
        </ActionLink>
      </EmptyState>
    );
  const t = trip as unknown as Trip;
  const all = trip.candidates.filter(
    (c) => filter === "all" || c.scenarioIds.includes(filter),
  );
  const unseen = all.filter(
    (c) => decisionFor(t, trip.me.id, "hotel", c.hotelId) === "unseen",
  );
  const next = unseen.find((c) => !skipped.includes(c.hotelId));
  const hotel = trip.catalog.find((h) => h.id === next?.hotelId);
  const myCount = trip.candidates.filter(
    (c) => decisionFor(t, trip.me.id, "hotel", c.hotelId) !== "unseen",
  ).length;
  const last = trip.votes
    .filter(
      (v) =>
        v.selectionRevision === trip.selectionRevision &&
        v.participantId === trip.me.id &&
        v.entityType === "hotel" &&
        v.decision !== "unseen",
    )
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))[0];
  async function vote(h: Hotel, d: Decision) {
    const previous = decisionFor(t, trip!.me.id, "hotel", h.id);
    if (
      await command({
        type: "vote",
        entityType: "hotel",
        entityId: h.id,
        decision: d,
      })
    ) {
      setUndo({ id: h.id, decision: previous });
      setPhoto(0);
      if (d === "rejected") setReason(h.id);
    }
  }
  async function reasonVote(code: string, text?: string) {
    if (
      reason &&
      (await command({
        type: "vote",
        entityType: "hotel",
        entityId: reason,
        decision: "rejected",
        reason: { code, text },
      }))
    ) {
      setReason(null);
      setOther("");
      setNotice("Причина сохранена для следующего подбора");
    }
  }
  const canUndo =
    undo ??
    (last ? { id: last.entityId, decision: "unseen" as Decision } : null);
  return (
    <div className="choice-flow hotel-flow">
      <header className="choice-heading">
        <div>
          <span className="choice-eyebrow">
            <MapPin size={15} />
            Место для ваших планов
          </span>
          <h1>Ваше место для отдыха.</h1>
          <p>
            Отели по одному. Вправо, чтобы сохранить, влево, чтобы идти дальше.
          </p>
        </div>
        <span className="count-label">
          {myCount} / {trip.candidates.length}
        </span>
      </header>
      <div
        className="scenario-filters"
        role="group"
        aria-label="Сценарии отдыха"
      >
        <Chip selected={filter === "all"} onClick={() => setFilter("all")}>
          Все сценарии
        </Chip>
        {trip.scenarios
          .filter((s) => trip.scenarioIds.includes(s.id))
          .map((s) => (
            <Chip
              key={s.id}
              selected={filter === s.id}
              onClick={() => setFilter(s.id)}
            >
              {s.title}
            </Chip>
          ))}
      </div>
      {hotel && next ? (
        <div className="deck-composition">
          <div className="deck-column">
            <div className="deck-stack">
              <div className="deck-behind deck-behind-two" />
              <div className="deck-behind" />
              <GestureSurface
                key={hotel.id}
                enabled={!busy && !trip.selected}
                onSwipe={(d) => vote(hotel, d > 0 ? "liked" : "rejected")}
              >
                <article className="photo-deck-card hotel-photo-deck">
                  <Photo
                    src={hotel.gallery[photo % hotel.gallery.length].path}
                    alt={`${hotel.name}: ${hotel.gallery[photo % hotel.gallery.length].label}`}
                    fetchPriority="high"
                  />
                  <div className="deck-photo-shade" />
                  <div className="deck-photo-top">
                    <span>
                      Отель{" "}
                      {trip.candidates.findIndex(
                        (c) => c.hotelId === hotel.id,
                      ) + 1}{" "}
                      из {trip.candidates.length}
                    </span>
                    <button
                      aria-label="Открыть фотографии отеля"
                      onClick={() =>
                        setPhoto((photo + 1) % hotel.gallery.length)
                      }
                    >
                      <ArrowRight size={20} />
                    </button>
                  </div>
                  <div className="deck-photo-copy">
                    <div className="hotel-image-dots">
                      {hotel.gallery.map((m, i) => (
                        <button
                          key={m.id}
                          className={photo === i ? "active" : ""}
                          aria-label={`Фотография ${i + 1}`}
                          onClick={() => setPhoto(i)}
                        />
                      ))}
                    </div>
                    <span className="deck-area">
                      <MapPin size={15} />
                      {hotel.area}
                    </span>
                    <h2>{hotel.name}</h2>
                    <p>
                      {hotel.image.illustrative
                        ? "Демонстрационный объект"
                        : "Настоящий отель. Фотографии из официальной галереи."}
                    </p>
                    <div className="deck-tags">
                      {next.scenarioIds.map((id) => (
                        <span key={id}>
                          <Check size={12} />
                          <strong>
                            {trip.scenarios.find((s) => s.id === id)?.title}
                          </strong>
                        </span>
                      ))}
                    </div>
                    <span className="hotel-photo-label">
                      {hotel.gallery[photo % hotel.gallery.length].label}
                    </span>
                  </div>
                </article>
              </GestureSurface>
            </div>
            <SwipeControls
              disabled={busy || !!trip.selected}
              onReject={() => vote(hotel, "rejected")}
              onLike={() => vote(hotel, "liked")}
              canUndo={!!canUndo}
              onUndo={async () => {
                if (
                  canUndo &&
                  (await command({
                    type: "vote",
                    entityType: "hotel",
                    entityId: canUndo.id,
                    decision: canUndo.decision,
                  }))
                ) {
                  setSkipped((s) => s.filter((id) => id !== canUndo.id));
                  setUndo(null);
                  setReason(null);
                  setPhoto(0);
                }
              }}
              onDetails={() => router.push(`${root}/hotels/${hotel.id}`)}
            />
            <button
              className="deck-skip"
              disabled={busy}
              onClick={() => {
                setSkipped((v) => [...v, hotel.id]);
                setPhoto(0);
              }}
            >
              Оставить на потом
            </button>
          </div>
          <aside className="deck-side-story hotel-deck-story">
            <span className="story-kicker">Подходит под ваши планы</span>
            <h2>
              Место нашлось.
              <br />
              Как вам?
            </h2>
            <div className="hotel-price">
              <strong>{money(hotel.price)}</strong>
              <span>за ночь за номер · демо-цена</span>
              {hotel.price !== null && (
                <small>
                  {money(hotel.price * trip.nights * trip.rooms)} за{" "}
                  {trip.nights} ночи, {trip.rooms} номер
                  {trip.rooms > 1 ? "а" : ""}
                </small>
              )}
            </div>
            <div className="hotel-facts">
              <div>
                <MapPin size={20} />
                <p>
                  {hotel.area}
                  <small>Адрес из каталога объекта</small>
                </p>
              </div>
              <div>
                <Footprints size={20} />
                <p>
                  {trip.cityId === "sochi"
                    ? `${hotel.seaMinutes} минут до моря`
                    : `${hotel.walkMinutes} минут до прогулочных точек`}
                  <small>Пример маршрута. Время демонстрационное.</small>
                </p>
              </div>
            </div>
            <div className="story-fit">
              <span>
                <Check size={18} />
                Почему он в вашей подборке
              </span>
              {next.participantReasons[trip.me.id]?.map((r) => (
                <p key={r}>{r}</p>
              ))}
            </div>
            <p className="story-tradeoff">
              <Info size={17} />
              {hotel.tradeoff}
            </p>
            {next.needsClarification && (
              <p className="notice">
                Некоторые условия нужно уточнить перед общим выбором.
              </p>
            )}
            <ActionLink href={`${root}/hotels/${hotel.id}`} variant="secondary">
              Фото, план дня и источники <ArrowRight size={17} />
            </ActionLink>
          </aside>
        </div>
      ) : (
        <EmptyState
          title={
            unseen.length
              ? "Остались отложенные варианты"
              : "Вы рассмотрели эту подборку"
          }
          text={
            unseen.length
              ? "Пропуск сохраняет отель непросмотренным. Его можно оценить позже."
              : "Понравившиеся всем варианты появятся в общем списке. Непросмотренные отели не считаются отказом."
          }
        >
          {unseen.length > 0 && (
            <Button onClick={() => setSkipped([])}>
              Вернуться к отложенным <ArrowCounterClockwise size={19} />
            </Button>
          )}
          <ActionLink href={root + "/matches"}>
            К общему выбору <ArrowRight size={19} />
          </ActionLink>
        </EmptyState>
      )}
      {reason && (
        <details className="reason-disclosure" key={reason}>
          <summary>
            Помочь подбору: что не подошло? <span>Необязательно</span>
          </summary>
          <div className="reason-prompt">
            <div>
              <strong>Что не подошло?</strong>
              <span>Необязательно, поможет уточнить следующий подбор.</span>
            </div>
            <div className="reason-options">
              {[
                ["price", "Цена"],
                ["location", "Расположение"],
                ["room", "Номер"],
                ["atmosphere", "Атмосфера"],
              ].map(([code, label]) => (
                <Button
                  variant="secondary"
                  key={code}
                  disabled={busy}
                  onClick={() => reasonVote(code)}
                >
                  {label}
                </Button>
              ))}
              <Button variant="secondary" onClick={() => setOther(" ")}>
                Другое
              </Button>
              <Button
                variant="ghost"
                onClick={() => {
                  setReason(null);
                  setOther("");
                }}
              >
                Пропустить вопрос
              </Button>
            </div>
            {other && (
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  void reasonVote("other", other.trim());
                }}
                className="inline-form"
              >
                <input
                  aria-label="Своя причина отказа"
                  value={other}
                  maxLength={300}
                  onChange={(e) => setOther(e.target.value)}
                />
                <Button type="submit" disabled={busy || !other.trim()}>
                  Сохранить
                </Button>
              </form>
            )}
          </div>
        </details>
      )}
      <div className="deck-bottom">
        {!hotel && (
          <Button
            variant="ghost"
            disabled={busy || !canUndo || !!trip.selected}
            onClick={async () => {
              if (
                canUndo &&
                (await command({
                  type: "vote",
                  entityType: "hotel",
                  entityId: canUndo.id,
                  decision: canUndo.decision,
                }))
              ) {
                setSkipped((s) => s.filter((id) => id !== canUndo.id));
                setUndo(null);
                setReason(null);
              }
            }}
          >
            <ArrowCounterClockwise size={18} />
            Отменить последнее решение
          </Button>
        )}
        <Button variant="ghost" onClick={() => setReview(!review)}>
          {review ? "Скрыть" : "Мои решения"}
        </Button>
        <ActionLink href={root + "/matches"} variant="ghost">
          Общий список ({trip.matches.length}) <ArrowRight size={17} />
        </ActionLink>
      </div>
      {review && (
        <div className="reviewed-list">
          {trip.candidates.map((c) => {
            const h = trip.catalog.find((h) => h.id === c.hotelId)!;
            const d = decisionFor(t, trip.me.id, "hotel", h.id);
            return (
              <div key={h.id}>
                <Photo src={h.image.path} alt="" />
                <span>
                  {h.name}
                  <small>
                    {d === "liked"
                      ? "Подходит"
                      : d === "rejected"
                        ? "Не подходит"
                        : "Пока не рассмотрен"}
                  </small>
                </span>
                <ActionLink href={`${root}/hotels/${h.id}`} variant="ghost">
                  Подробнее
                </ActionLink>
                {d !== "unseen" && !trip.selected && (
                  <Button
                    variant="ghost"
                    disabled={busy}
                    onClick={() =>
                      command({
                        type: "vote",
                        entityType: "hotel",
                        entityId: h.id,
                        decision: "unseen",
                      })
                    }
                  >
                    Пересмотреть
                  </Button>
                )}
              </div>
            );
          })}
        </div>
      )}
      <div className="end-review">
        <p>
          Можно закончить раньше. Остальные отели сохранятся непросмотренными.
        </p>
        <Button
          variant="secondary"
          disabled={busy}
          onClick={async () => {
            if (await command({ type: "finishHotels" }))
              setNotice("Просмотр завершён. Общий список обновлён.");
          }}
        >
          Завершить мой просмотр
        </Button>
      </div>
      <p className="data-caption">
        <Footprints size={15} />
        Фото настоящих отелей. Цены, наличие и время в пути демонстрационные.
      </p>
    </div>
  );
}
