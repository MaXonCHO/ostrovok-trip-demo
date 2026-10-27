"use client";
import { Photo } from "@/components/ui/photo";
import { useState } from "react";
import {
  Check,
  ArrowRight,
  Users,
  Scales,
  Clock,
  Info,
} from "@phosphor-icons/react";
import { useTrip } from "@/features/trips/context";
import {
  SectionHeading,
  Button,
  ActionLink,
  EmptyState,
  Avatar,
  Dialog,
} from "@/components/ui/primitives";
import { money } from "@/features/hotels/hotels";
export function Matches() {
  const { trip, command, busy } = useTrip();
  const [compare, setCompare] = useState<string[]>([]);
  const [open, setOpen] = useState(false);
  if (!trip) return null;
  const root = `/trips/${trip.id}`;
  const hotels = trip.catalog.filter((h) => trip.matches.includes(h.id));
  const active = trip.participants.filter(
    (p) => p.status !== "left" && p.role !== "viewer",
  );
  const finished = !trip.blocked && active.every((p) => p.hotelsFinished);
  const selected = trip.catalog.find((h) => h.id === trip.selected?.hotelId);
  const proposal = trip.catalog.find((h) => h.id === trip.proposal?.hotelId);
  return (
    <>
      <SectionHeading
        title={trip.group ? "Хорошо вместе" : "Ваши подходящие варианты"}
        text={
          trip.group
            ? "Здесь отели, понравившиеся каждому участнику. Дальше нужно подтвердить один вариант."
            : "Лайк сохраняет подходящий вариант. Отдельное подтверждение завершит выбор."
        }
      />
      {selected ? (
        <div className="common-panel">
          <div>
            <span className="small-label">
              <Check size={18} />
              Решение принято
            </span>
            <h2>{selected.name}</h2>
            <p>Вариант сохранён в поездке. Номер ещё не забронирован.</p>
          </div>
          <ActionLink href={root}>
            Открыть поездку <ArrowRight size={20} />
          </ActionLink>
        </div>
      ) : proposal && trip.proposal ? (
        <div className="proposal-panel">
          <Photo src={proposal.image.path} alt="Иллюстрация территории" />
          <div>
            <span className="small-label">Предложен для поездки</span>
            <h2>{proposal.name}</h2>
            <p>
              {proposal.room.name} · {money(trip.proposal.price)} за ночь за
              номер
            </p>
            <p>
              {trip.nights} ночи · {trip.rooms} номер{trip.rooms > 1 ? "а" : ""}{" "}
              · демо-условия
            </p>
            <div className="proposal-confirmations">
              {active.map((p, i) => (
                <div key={p.id}>
                  <Avatar name={p.name} index={i} />
                  <span>{p.name}</span>
                  {trip.proposal!.confirmationIds.includes(p.id) ? (
                    <Check size={19} />
                  ) : (
                    <Clock size={19} />
                  )}
                </div>
              ))}
            </div>
            <Button
              disabled={
                busy || trip.proposal.confirmationIds.includes(trip.me.id)
              }
              onClick={() => command({ type: "confirmFinal" })}
            >
              {trip.proposal.confirmationIds.includes(trip.me.id)
                ? "Вы подтвердили этот вариант"
                : "Подтвердить этот отель"}
              <Check size={19} />
            </Button>
            <small>
              Подтверждение сохраняет решение, без оплаты и бронирования.
            </small>
          </div>
        </div>
      ) : null}
      {hotels.length > 0 ? (
        <>
          <div className="matches-toolbar">
            <span className="match-count">
              <Check size={20} />
              {hotels.length}{" "}
              {trip.group ? "общих варианта" : "подходящих варианта"}
            </span>
            <Button
              variant="secondary"
              disabled={compare.length < 2}
              onClick={() => setOpen(true)}
            >
              <Scales size={19} />
              Сравнить {compare.length > 0 ? `(${compare.length}/3)` : ""}
            </Button>
          </div>
          <div className="match-grid">
            {hotels.map((h) => (
              <article className="match-card" key={h.id}>
                <a href={`${root}/hotels/${h.id}`}>
                  <Photo
                    src={h.image.path}
                    alt={`Иллюстрация отеля «${h.name}»`}
                  />
                </a>
                <div>
                  <span className="hotel-location">{h.area}</span>
                  <h2>{h.name}</h2>
                  <p>{h.tradeoff}</p>
                  <strong>
                    {money(h.price)} <small>за ночь за номер</small>
                  </strong>
                  <label className="checkbox-row">
                    <input
                      type="checkbox"
                      checked={compare.includes(h.id)}
                      disabled={!compare.includes(h.id) && compare.length === 3}
                      onChange={(e) =>
                        setCompare((v) =>
                          e.target.checked
                            ? [...v, h.id]
                            : v.filter((id) => id !== h.id),
                        )
                      }
                    />
                    Добавить к сравнению
                  </label>
                  <div className="button-row">
                    <ActionLink
                      href={`${root}/hotels/${h.id}`}
                      variant="secondary"
                    >
                      Подробнее
                    </ActionLink>
                    <Button
                      disabled={busy || !!trip.selected}
                      onClick={() =>
                        command({ type: "propose", hotelId: h.id })
                      }
                    >
                      Предложить <ArrowRight size={18} />
                    </Button>
                  </div>
                </div>
              </article>
            ))}
          </div>
        </>
      ) : (
        <EmptyState
          title={
            !finished ? "Общий список ещё собирается" : "Пока нет общего отеля"
          }
          text={
            !finished
              ? "Не все участники закончили просмотр. Пропуск и отсутствие ответа не считаются отказом. Продолжайте выбирать или дождитесь спутника."
              : "Все завершили просмотр, но каждый отель получил отказ хотя бы одного участника. Посмотрите причины и обсудите, что можно изменить."
          }
        >
          <ActionLink href={root + (finished ? "/chat" : "/hotels")}>
            {finished ? "Уточнить пожелания" : "Продолжить просмотр"}
            <ArrowRight size={18} />
          </ActionLink>
        </EmptyState>
      )}
      {trip.waitingHotelIds.length > 0 && !trip.selected && (
        <div className="waiting-panel">
          <Users size={28} />
          <div>
            <h3>{trip.waitingHotelIds.length} вариантов ожидают решения</h3>
            <p>По ним пока нет отказов, но ещё не все ответили.</p>
          </div>
        </div>
      )}
      {finished && !hotels.length && (
        <div className="compromise-options">
          <h3>О чём можно договориться</h3>
          {trip.votes
            .filter(
              (v) =>
                v.selectionRevision === trip.selectionRevision &&
                v.entityType === "hotel" &&
                v.rejectionReason,
            )
            .map((v) => (
              <p key={v.participantId + v.entityId}>
                <strong>
                  {
                    trip.participants.find((p) => p.id === v.participantId)
                      ?.name
                  }
                  :{" "}
                </strong>
                {trip.catalog.find((h) => h.id === v.entityId)?.name},{" "}
                {(
                  {
                    price: "цена",
                    location: "расположение",
                    room: "номер",
                    atmosphere: "атмосфера",
                  } as Record<string, string>
                )[v.rejectionReason!.code] ??
                  v.rejectionReason!.text ??
                  "другая причина"}
              </p>
            ))}
          <p>
            <Info size={18} />
            Изменить обязательное пожелание может только его автор.
          </p>
        </div>
      )}
      <Dialog
        title="Сравнить для вашей поездки"
        open={open}
        onOpenChange={setOpen}
      >
        <div className="comparison-scroll">
          <table className="comparison-table">
            <thead>
              <tr>
                <th>Что имеет значение</th>
                {compare.map((id) => (
                  <th key={id}>
                    {trip.catalog.find((h) => h.id === id)?.name}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {[
                "Номер",
                "Бюджет за ночь",
                "Всё проживание",
                "До интересных мест",
                "Компромисс",
              ].map((label, i) => (
                <tr key={label}>
                  <th>{label}</th>
                  {compare.map((id) => {
                    const h = trip.catalog.find((h) => h.id === id)!;
                    return (
                      <td key={id}>
                        {
                          [
                            h.room.name,
                            money(h.price),
                            h.price === null
                              ? "Уточняется"
                              : money(h.price * trip.nights * trip.rooms),
                            `Около ${h.walkMinutes} мин пешком, демо`,
                            h.tradeoff,
                          ][i]
                        }
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="data-caption">
          Сравнение демонстрационных условий. Цены и маршруты не проверены по
          реальному каталогу.
        </p>
      </Dialog>
    </>
  );
}
