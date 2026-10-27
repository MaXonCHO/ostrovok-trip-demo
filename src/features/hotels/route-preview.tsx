"use client";
import { useEffect, useState } from "react";
import { Footprints, Info } from "@phosphor-icons/react";
import type { Route } from "@/domain/models";
import { useTrip } from "@/features/trips/context";
import { ErrorNotice } from "@/components/ui/primitives";
export function RoutePreview({
  hotelId,
  placeId,
  hotelName,
  destination,
}: {
  hotelId: string;
  placeId: string;
  hotelName: string;
  destination: string;
}) {
  const { trip, persona } = useTrip();
  const [route, setRoute] = useState<Route | null>(null);
  const [error, setError] = useState("");
  const [reload, setReload] = useState(0);
  const tripId = trip?.id;
  useEffect(() => {
    if (!tripId) return;
    fetch(`/api/trips/${tripId}/route?hotelId=${hotelId}&placeId=${placeId}`, {
      headers: persona ? { "x-demo-persona": persona } : {},
    })
      .then(async (r) => {
        const d = await r.json();
        if (!r.ok) throw new Error(d.error);
        setRoute(d);
        setError("");
      })
      .catch((e) => setError(e.message));
  }, [tripId, hotelId, placeId, persona, reload]);
  if (error)
    return (
      <ErrorNotice message={error} onRetry={() => setReload((n) => n + 1)} />
    );
  if (!route)
    return (
      <div className="route-skeleton skeleton" aria-label="Загружаем схему" />
    );
  return (
    <div className="route-preview">
      <div className="route-heading">
        <strong>Схема маршрута</strong>
        <span>Демо · не точная карта местности</span>
      </div>
      <svg
        viewBox="0 0 400 220"
        role="img"
        aria-label={`Схема демонстрационного пути от ${hotelName} до ${destination}`}
      >
        <rect
          x="0"
          y="0"
          width="400"
          height="220"
          rx="16"
          fill="var(--map-bg)"
        />
        <path
          d="M0 205 Q120 200 170 180 T400 190 L400 220 L0 220Z"
          fill="var(--map-water)"
        />
        <path
          d="M20 45H380M20 110H380M65 20V185M155 20V185M260 20V185M335 20V175"
          stroke="var(--map-street)"
          strokeWidth="15"
          fill="none"
        />
        <rect
          x="122"
          y="105"
          width="57"
          height="44"
          rx="7"
          fill="var(--map-park)"
        />
        <text x="135" y="132" fill="var(--text-secondary)" fontSize="11">
          парк
        </text>
        <polyline
          points={route.geometry.map((p) => p.join(",")).join(" ")}
          fill="none"
          stroke="var(--action-primary)"
          strokeWidth="5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <circle
          cx={route.geometry[0][0]}
          cy={route.geometry[0][1]}
          r="10"
          fill="var(--action-primary)"
          stroke="white"
          strokeWidth="3"
        />
        <circle
          cx={route.geometry.at(-1)![0]}
          cy={route.geometry.at(-1)![1]}
          r="10"
          fill="var(--accent-turquoise-ink)"
          stroke="white"
          strokeWidth="3"
        />
        <text x="26" y="193" fill="var(--text-primary)" fontSize="12">
          Отель
        </text>
        <text x="302" y="40" fill="var(--text-primary)" fontSize="12">
          Цель прогулки
        </text>
      </svg>
      <div className="route-metrics">
        <strong>
          <Footprints size={20} />
          {route.minutes} мин пешком
        </strong>
        <span>
          {(route.meters / 1000).toLocaleString("ru-RU")} км по маршруту
        </span>
        <span>{route.straightMeters} м по прямой</span>
      </div>
      <ol className="route-points">
        <li>
          <span className="map-point start" />
          {hotelName}
        </li>
        <li>
          <span className="map-point end" />
          {destination}
        </li>
      </ol>
      {route.warning && (
        <p className="tradeoff">
          <Info size={17} />
          {route.warning}
        </p>
      )}
      <p className="data-caption">
        {route.source}. Время и геометрия синтетические.
      </p>
    </div>
  );
}
