"use client";
import Link from "next/link";
import { MapPin } from "@phosphor-icons/react";
import type { Hotel } from "./catalog";
import { money } from "./search-state";
export function DemoMap({
  hotels,
  query = "",
  mini = false,
  onOpen,
}: {
  hotels: Hotel[];
  query?: string;
  mini?: boolean;
  onOpen?: () => void;
}) {
  if (hotels.some((h) => h.imported))
    return (
      <div className={`ov-map ov-source-map ${mini ? "ov-map-mini" : ""}`}>
        <MapPin size={32} />
        {mini ? (
          <button onClick={onOpen}>
            <MapPin size={19} />
            Показать на карте
          </button>
        ) : (
          <>
            <h3>Расположение отелей</h3>
            <p>Откройте расположение выбранного отеля на карте.</p>
            <div>
              {hotels.slice(0, 8).map(
                (h) =>
                  h.coordinates && (
                    <a
                      key={h.id}
                      target="_blank"
                      rel="noreferrer"
                      href={`https://www.openstreetmap.org/?mlat=${h.coordinates.lat}&mlon=${h.coordinates.lon}#map=17/${h.coordinates.lat}/${h.coordinates.lon}`}
                    >
                      {h.name} ↗
                    </a>
                  ),
              )}
            </div>
          </>
        )}
        <span className="ov-map-caption">Источник: OpenStreetMap</span>
      </div>
    );
  return (
    <div className={`ov-map ${mini ? "ov-map-mini" : ""}`}>
      <svg
        viewBox="0 0 800 560"
        preserveAspectRatio="xMidYMid slice"
        aria-hidden="true"
      >
        <rect width="800" height="560" fill="#e8e7e1" />
        <path
          d="M0 0H178L142 90 198 176 115 267 158 356 80 458 115 560H0Z"
          fill="#b4dce8"
        />
        <path
          d="M259 0L224 113 310 188 268 285 342 395 271 560H800V0Z"
          fill="#eef0e4"
        />
        <g fill="#c9dfb9">
          <path d="M540 30h135l-25 96-114-12z" />
          <path d="M289 255l77-22 50 58-41 70-82-28z" />
          <path d="M560 370h132l-3 107-148-12z" />
        </g>
        <g stroke="#fff" strokeWidth="11" fill="none">
          <path d="M189-30L250 100 193 245 312 400 290 590" />
          <path d="M345-30L327 125 431 302 403 590" />
          <path d="M520-30L485 157 581 315 532 590" />
          <path d="M720-30L650 120 702 315 656 590" />
          <path d="M120 90L840 165" />
          <path d="M130 212L800 280" />
          <path d="M160 380L800 415" />
          <path d="M110 495L800 510" />
        </g>
        <g stroke="#ffd492" strokeWidth="7" fill="none">
          <path d="M229-20L262 142 223 277 348 450 332 580" />
          <path d="M181 320L400 345 820 209" />
        </g>
        <g fill="#838981" fontSize="13" fontFamily="Arial">
          <text x="384" y="210">
            Центральный район
          </text>
          <text x="562" y="89">
            Парк
          </text>
          <text x="530" y="458">
            Сквер
          </text>
          <text x="63" y="277" transform="rotate(-80 63 277)">
            Набережная
          </text>
        </g>
      </svg>
      {!mini &&
        hotels.slice(0, 12).map((hotel, i) => (
          <Link
            className="ov-map-price"
            key={hotel.id}
            href={`/hotel/${hotel.slug}?${query}`}
            style={{
              left: `${27 + ((i * 19) % 59)}%`,
              top: `${13 + ((i * 23) % 70)}%`,
            }}
          >
            {money(hotel.price)}
          </Link>
        ))}
      {mini && (
        <button onClick={onOpen}>
          <MapPin size={19} />
          Показать на карте
        </button>
      )}
      <span className="ov-map-caption">Демо-схема · расположение условное</span>
    </div>
  );
}
