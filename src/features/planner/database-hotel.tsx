"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, ArrowRight, MapPin } from "@phosphor-icons/react";
import { Favorite } from "@/features/ostrovok/shared";
import type { Hotel } from "@/features/ostrovok/catalog";
import type { Query } from "@/features/ostrovok/search-state";
import type { CatalogRecord } from "./types";
import { HotelPhoto } from "./recommendation-card";
export function DatabaseHotel({ hotel }: { hotel: Hotel; query?: Query }) {
  const [record, setRecord] = useState<CatalogRecord | null>(null);
  useEffect(() => {
    let live = true;
    void fetch("/api/planner/catalog/" + hotel.id)
      .then((r) => r.json())
      .then((d) => {
        if (live) setRecord(d);
      })
      .catch(() => {});
    return () => {
      live = false;
    };
  }, [hotel.id]);
  return (
    <div className="ov-container ov-hotel-page ov-database-hotel">
      <Link href="/search?city=saint-petersburg" className="ov-back">
        <ArrowLeft size={18} />
        Все отели Петербурга
      </Link>
      <div className="ov-detail-heading">
        <div>
          <span className="ov-selection-caption">
            <MapPin size={16} />
            Санкт-Петербург
          </span>
          <h1>{hotel.name}</h1>
          <p>{hotel.address}</p>
        </div>
        <Favorite hotel={hotel} large />
      </div>
      <div className="ov-database-gallery">
        <HotelPhoto photos={hotel.photos} name={hotel.name} />
        {hotel.photos.slice(1).map((p, i) => (
          <img
            key={p}
            src={p}
            alt={`${hotel.name}: фотография ${i + 2}`}
            loading="lazy"
          />
        ))}
      </div>
      {hotel.photoEvidence?.sourceUrl && (
        <p className="ov-selection-caption">
          Фотографии:{" "}
          <a
            href={hotel.photoEvidence.sourceUrl}
            target="_blank"
            rel="noopener noreferrer"
          >
            источник изображений
          </a>
          {hotel.photoEvidence.matchStatus !== "matched"
            ? " · сопоставление по данным поставщика"
            : ""}
        </p>
      )}
      <div className="ov-profile-columns">
        <section>
          <h2>Об отеле</h2>
          <p>{hotel.description}</p>
          <p className="ov-selection-caption">Источник: {hotel.source}.</p>
          <h2>Удобства отеля</h2>
          <div className="ov-amenity-chips">
            {hotel.amenities.map((a) => (
              <span key={a}>{a}</span>
            ))}
          </div>
          {hotel.ratingSnapshot !== null &&
            hotel.ratingSnapshot !== undefined && (
              <p>Оценка гостей: {hotel.ratingSnapshot}/10.</p>
            )}
          <h2>Рядом с отелем</h2>
          {record && (
            <dl className="ov-source-metrics">
              {[
                ["food_within_500m", "Кафе и рестораны в 500 м"],
                ["culture_within_500m", "Культурные места в 500 м"],
                ["groceries_within_500m", "Продуктовые магазины в 500 м"],
                ["pharmacy_within_500m", "Аптеки в 500 м"],
                ["nightlife_within_500m", "Бары, пабы и клубы в 500 м"],
              ].map(([k, label]) => (
                <div key={k}>
                  <dt>{label}</dt>
                  <dd>{record.metrics[k] ?? "Нет данных"}</dd>
                </div>
              ))}
            </dl>
          )}
          <p className="ov-selection-caption">
            OSM, выгрузка 17.10.2026. Число ночных заведений не является
            измерением шума в номере.
          </p>
          <Link
            className="ov-inline-button"
            target="_blank"
            href={"/api/planner/catalog/" + hotel.id}
          >
            Исходная запись и источники <ArrowRight size={16} />
          </Link>
        </section>
        <aside className="ov-trip-passport">
          <h2>Условия размещения</h2>
          <p>
            Актуальная цена, наличие, категория номера, питание и правила отмены
            в загруженной базе отсутствуют.
          </p>
          <p>Обсудите пожелания к размещению в своей поездке.</p>
          <Link
            href={
              "/my-trip?wish=" +
              encodeURIComponent(
                "Рассматриваю " +
                  hotel.name +
                  ". Помоги уточнить, подходит ли он моим планам.",
              )
            }
            className="ov-button"
          >
            Обсудить в поездке <ArrowRight size={17} />
          </Link>
        </aside>
      </div>
    </div>
  );
}
