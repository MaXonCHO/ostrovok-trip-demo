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
          <span
            className={`ov-match-status ${item.status === "needs-check" ? "is-unverified" : ""}`}
          >
            {item.status === "needs-check" ? (
              <Info size={15} />
            ) : (
              <Check size={15} />
            )}{" "}
            {item.status === "needs-check"
              ? "Нужна проверка условий"
              : "Подходит по данным архива"}
          </span>
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
          {item.unknowns.length ? " · есть вопросы к условиям" : ""}{" "}
          <CaretDown size={17} />
        </summary>
        <div>
          {item.unknowns.length > 0 && (
            <div className="ov-condition-notice">
              <strong>Что нужно подтвердить</strong>
              <ul>
                {item.unknowns.map((u) => (
                  <li key={u}>{u}</li>
                ))}
              </ul>
            </div>
          )}
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
                <small>
                  {p.status === "unknown"
                    ? "Не подтверждено"
                    : p.status === "unverified"
                      ? "Геоточка требует проверки"
                      : "Архивное наблюдение"}{" "}
                  · {p.source}
                  {p.date ? " · " + p.date : ""}
                </small>
                <small>{p.method}</small>
              </div>
            ))
          ) : (
            <p>
              Уточните в диалоге, какие места вам нужны рядом. По ним покажем
              доступные сведения.
            </p>
          )}
          <div className="ov-evidence-item">
            <strong>Источник карточки</strong>
            <p>{h.source}. Исторический снимок, условия могли измениться.</p>
            <Link href={"/api/planner/catalog/" + h.id} target="_blank">
              Посмотреть исходную запись
            </Link>
          </div>
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
