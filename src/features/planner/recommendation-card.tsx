"use client";
import Link from "next/link";
import {
  Buildings,
  CaretDown,
  Check,
  Info,
  MapPin,
} from "@phosphor-icons/react";
import type { RankedHotel } from "./types";
export function HotelPhoto({
  photos,
  name,
}: {
  photos: string[];
  name: string;
}) {
  return photos.length ? (
    <img src={photos[0]} alt={name} loading="lazy" />
  ) : (
    <div
      className="ov-planner-no-photo"
      role="img"
      aria-label={`Фото «${name}» отсутствует в источнике`}
    >
      <Buildings size={40} weight="light" />
      <span>Фотография пока не добавлена</span>
    </div>
  );
}
export function RecommendationCard({
  item,
  children,
  actions,
}: {
  item: RankedHotel;
  children?: React.ReactNode;
  actions?: React.ReactNode;
}) {
  const h = item.hotel;
  return (
    <article
      className={`ov-recommendation ${h.photos.length ? "has-photo" : "without-photo"}`}
      data-hotel-id={h.id}
    >
      {actions && <div className="ov-card-actions">{actions}</div>}
      <div className="ov-recommendation-main">
        <Link
          href={"/hotel/" + h.slug}
          className="ov-recommendation-photo"
          aria-label={"Открыть " + h.name}
        >
          <HotelPhoto photos={h.photos} name={h.name} />
        </Link>
        <div className="ov-recommendation-copy">
          <span className="ov-recommendation-location">
            <MapPin size={14} />
            Санкт-Петербург
          </span>
          <h3>
            <Link href={"/hotel/" + h.slug}>{h.name}</Link>
          </h3>
          <ul className="ov-reasons">
            {item.reasons.slice(0, 2).map((r) => (
              <li key={r}>
                <Check size={15} />
                <span>{r}</span>
              </li>
            ))}
          </ul>
          <p className="ov-price-unknown">Цена и наличие уточняются у отеля</p>
        </div>
      </div>
      <details className="ov-recommendation-evidence">
        <summary>
          Почему этот отель
          <CaretDown size={17} />
        </summary>
        <div>
          {item.reasons.length > 2 && (
            <ul className="ov-reasons">
              {item.reasons.slice(2).map((r) => (
                <li key={r}>
                  <Check size={15} />
                  <span>{r}</span>
                </li>
              ))}
            </ul>
          )}
          {item.nearby.length ? (
            item.nearby.map((p, i) => (
              <div className="ov-evidence-item" key={p.label + i}>
                <strong>{p.label}</strong>
                <p>{p.value}</p>
              </div>
            ))
          ) : (
            <p>
              Уточните в диалоге, какие места вам нужны рядом. По ним покажем
              доступные сведения.
            </p>
          )}
          {item.tradeoffs.map((t) => (
            <p className="ov-tradeoff" key={t}>
              <Info size={16} />
              {t}
            </p>
          ))}
        </div>
      </details>
      {children}
    </article>
  );
}
