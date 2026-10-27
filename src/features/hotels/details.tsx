"use client";
import { Photo } from "@/components/ui/photo";
import { useState } from "react";
import {
  ArrowLeft,
  Check,
  MapPin,
  Star,
  ArrowRight,
  X,
} from "@phosphor-icons/react";
import { useTrip } from "@/features/trips/context";
import {
  SectionHeading,
  ActionLink,
  Button,
  Chip,
  EmptyState,
  Dialog,
} from "@/components/ui/primitives";
import { SourceDetails } from "@/features/evidence/sources";
import { RoutePreview } from "./route-preview";
import { money } from "./hotels";
export function HotelDetails({ id }: { id: string }) {
  const { trip, command, busy, setNotice } = useTrip();
  const [photo, setPhoto] = useState(0);
  const [gallery, setGallery] = useState(false);
  if (!trip) return null;
  const root = `/trips/${trip.id}`;
  const hotel = trip.catalog.find((h) => h.id === id);
  const candidate = trip.candidates.find((c) => c.hotelId === id);
  if (!hotel || !candidate)
    return (
      <EmptyState
        title="Отеля нет в текущей подборке"
        text="Возможно, изменились условия или версия поездки. Вернитесь к актуальным вариантам."
      >
        <ActionLink href={root + "/hotels"}>К отелям</ActionLink>
      </EmptyState>
    );
  const places = trip.places.slice(0, 3);
  return (
    <>
      <ActionLink href={root + "/hotels"} variant="ghost">
        <ArrowLeft size={18} />К той же подборке
      </ActionLink>
      <SectionHeading
        title={hotel.name}
        text={hotel.area}
        aside={
          hotel.rating !== null ? (
            <span className="hotel-rating">
              <Star size={18} weight="fill" />
              {hotel.rating.toFixed(1)}
              <small>Демо-оценка</small>
            </span>
          ) : undefined
        }
      />
      <div className="detail-gallery">
        <button
          className="detail-main-photo"
          onClick={() => setGallery(true)}
          aria-label="Открыть галерею"
        >
          <Photo
            src={hotel.gallery[photo].path}
            alt={hotel.gallery[photo].label}
          />
          <span>{hotel.gallery[photo].label}</span>
        </button>
        <div className="gallery-thumbs">
          {hotel.gallery.map((m, i) => (
            <button
              key={m.id}
              onClick={() => setPhoto(i)}
              className={photo === i ? "active" : ""}
              aria-label={`Фото ${i + 1}: ${m.label}`}
            >
              <Photo src={m.path} alt="" />
              <span>
                {m.kind === "room"
                  ? "Номер"
                  : m.kind === "exterior"
                    ? "Здание"
                    : "Галерея"}
              </span>
            </button>
          ))}
        </div>
      </div>
      <p className="data-caption">
        {hotel.image.illustrative
          ? "Демонстрационный объект. Фото иллюстрируют атмосферу."
          : "Настоящий отель и его официальные фотографии. Цены, наличие и маршруты демонстрационные."}
      </p>
      <div className="detail-summary">
        <div>
          <h2>Здесь удобно начать ваш отдых</h2>
          <div className="explanation-list">
            {trip.participants
              .filter((p) => p.status !== "left")
              .map((p) => (
                <div key={p.id}>
                  <strong>{p.name}</strong>
                  <p>
                    {candidate.participantReasons[p.id]?.join(". ") ||
                      "Нужно уточнить личные пожелания"}
                  </p>
                </div>
              ))}
          </div>
          <p className="tradeoff">
            <MapPin size={18} />
            {hotel.tradeoff}
          </p>
          <div className="scenario-filters">
            {candidate.scenarioIds.map((id) => (
              <Chip selected key={id}>
                {trip.scenarios.find((s) => s.id === id)?.title}
              </Chip>
            ))}
          </div>
        </div>
        <div className="room-summary">
          {hotel.room.images[0] && (
            <Photo
              src={hotel.room.images[0].path}
              alt={hotel.room.images[0].label}
            />
          )}
          <h3>{hotel.room.name}</h3>
          <p>
            В демо: до {hotel.room.capacity} гостей · категория и условия
            уточняются
          </p>
          <strong>{money(hotel.price)}</strong>
          <span>за ночь за номер · демо</span>
          {hotel.price !== null && (
            <p>
              {money(hotel.price * trip.nights * trip.rooms)} за всё проживание
            </p>
          )}
        </div>
      </div>
      {!trip.selected && (
        <div className="detail-decision">
          <Button
            variant="secondary"
            disabled={busy}
            onClick={async () => {
              if (
                await command({
                  type: "vote",
                  entityType: "hotel",
                  entityId: id,
                  decision: "rejected",
                })
              )
                setNotice("Отель отклонён, выбранный сценарий сохранён");
            }}
          >
            <X size={20} />
            Не подходит
          </Button>
          <Button
            disabled={busy}
            onClick={async () => {
              if (
                await command({
                  type: "vote",
                  entityType: "hotel",
                  entityId: id,
                  decision: "liked",
                })
              )
                setNotice("Ваш голос сохранён");
            }}
          >
            <Check size={20} />
            Этот отель подходит
          </Button>
          <ActionLink href={root + "/matches"} variant="ghost">
            Общий список <ArrowRight size={18} />
          </ActionLink>
        </div>
      )}
      <section className="detail-day">
        <h2>Как может пройти день</h2>
        <p className="muted">
          План связывает проживание с местами сценария. Время и расстояния
          демонстрационные.
        </p>
        <div className="detail-day-grid">
          <ol className="day-outline">
            {places.map((p, i) => (
              <li key={p.id}>
                <span>
                  {["10:00 · Утро", "14:00 · День", "19:00 · Вечер"][i]}
                </span>
                <strong>{p.name}</strong>
                <p>{p.description}</p>
                <Button
                  variant="ghost"
                  onClick={() => command({ type: "savePlace", placeId: p.id })}
                >
                  {trip.savedPlaces.includes(p.id)
                    ? "Убрать из плана"
                    : "Сохранить место"}
                </Button>
              </li>
            ))}
          </ol>
          {places[0] && (
            <RoutePreview
              hotelId={hotel.id}
              placeId={places[0].id}
              hotelName={hotel.name}
              destination={places[0].name}
            />
          )}
        </div>
      </section>
      <SourceDetails hotel={hotel} />
      <section className="review-section">
        <h2>Отзывы гостей</h2>
        {hotel.reviewExcerpts.length === 0 && (
          <p className="muted">
            Отзывы пока не подключены. Проверить их можно на сайте отеля.
          </p>
        )}
        {hotel.reviewExcerpts.map((r) => (
          <blockquote key={r.id}>
            <p>«{r.text}»</p>
            <footer>
              {r.source} · {r.date} · {r.rating}/{r.scale}
            </footer>
          </blockquote>
        ))}
        <p className="notice">
          Видео пока нет. Условия номера и возможность бронирования нужно
          подтвердить у отеля.
        </p>
      </section>
      <Dialog title="Галерея отеля" open={gallery} onOpenChange={setGallery}>
        <div className="stack">
          <Photo
            className="gallery-expanded"
            src={hotel.gallery[photo].path}
            alt={hotel.gallery[photo].label}
          />
          <p>
            {hotel.gallery[photo].label}.{" "}
            <a
              href={
                hotel.gallery[photo].source.startsWith("https://")
                  ? hotel.gallery[photo].source
                  : undefined
              }
              target="_blank"
              rel="noreferrer"
              className="text-link"
            >
              Источник фотографии
            </a>
          </p>
          <div className="button-row">
            <Button
              variant="secondary"
              onClick={() =>
                setPhoto(
                  (photo + hotel.gallery.length - 1) % hotel.gallery.length,
                )
              }
            >
              <ArrowLeft size={20} />
              Предыдущее
            </Button>
            <Button
              variant="secondary"
              onClick={() => setPhoto((photo + 1) % hotel.gallery.length)}
            >
              Следующее
              <ArrowRight size={20} />
            </Button>
          </div>
        </div>
      </Dialog>
    </>
  );
}
