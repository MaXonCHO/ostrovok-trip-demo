"use client";
import { useId, useState } from "react";
import { ArrowRight, Check } from "@phosphor-icons/react";
import { petersburgCollections } from "./petersburg-collections";

const tripTypeCopy: Record<string, { title: string; description: string }> = {
  "spb-weekend": {
    title: "Выходные",
    description: "Короткая поездка и самые яркие впечатления.",
  },
  "spb-food": {
    title: "Гастрономия",
    description: "Кофейни, местная кухня и новые вкусы.",
  },
  "spb-romance": {
    title: "Романтика",
    description: "Время вдвоём и красивые вечера.",
  },
  "spb-museums": {
    title: "Культура",
    description: "Музеи, выставки и история города.",
  },
  "spb-family": {
    title: "С детьми",
    description: "Семейные маршруты и открытия для всех.",
  },
  "spb-walks": {
    title: "Прогулки",
    description: "Набережные, парки и красивые улицы.",
  },
  "spb-free": {
    title: "Бюджетно",
    description: "Больше впечатлений без лишних расходов.",
  },
  "spb-autumn": {
    title: "Спокойный отдых",
    description: "Неспешные дни, уют и время для себя.",
  },
};

const tripTypes = petersburgCollections
  .filter((collection) => tripTypeCopy[collection.id])
  .map((collection) => ({
    id: collection.id,
    image: collection.image,
    ...tripTypeCopy[collection.id],
  }));

export function TripTypeCards({
  onSelect,
  disabled = false,
}: {
  onSelect: (ids: string[]) => void;
  disabled?: boolean;
}) {
  const [selected, setSelected] = useState<string[]>([]);
  const headingId = useId();
  const descriptionId = useId();

  const toggle = (id: string) => {
    setSelected((previous) =>
      previous.includes(id)
        ? previous.filter((value) => value !== id)
        : [...previous, id],
    );
  };

  return (
    <section
      className="ov-trip-types"
      aria-labelledby={headingId}
      aria-describedby={descriptionId}
    >
      <header className="ov-trip-types-heading">
        <h2 id={headingId}>Какой отдых вам ближе?</h2>
        <p id={descriptionId}>Можно выбрать несколько вариантов</p>
      </header>
      <div className="ov-trip-types-grid">
        {tripTypes.map((tripType) => {
          const isSelected = selected.includes(tripType.id);
          return (
            <button
              className={`ov-trip-type-card${isSelected ? " is-selected" : ""}`}
              key={tripType.id}
              type="button"
              aria-pressed={isSelected}
              disabled={disabled}
              data-type-id={tripType.id}
              onClick={() => toggle(tripType.id)}
            >
              <span className="ov-trip-type-photo">
                <img
                  src={tripType.image}
                  alt=""
                  loading="lazy"
                  decoding="async"
                />
                <span className="ov-trip-type-check" aria-hidden="true">
                  {isSelected && <Check size={18} weight="bold" />}
                </span>
              </span>
              <span className="ov-trip-type-copy">
                <span className="ov-trip-type-title">{tripType.title}</span>
                <span className="ov-trip-type-description">
                  {tripType.description}
                </span>
              </span>
            </button>
          );
        })}
      </div>
      <div className="ov-trip-types-actions">
        <span
          className="ov-trip-types-count"
          aria-live="polite"
          aria-atomic="true"
        >
          {selected.length > 0
            ? `Выбрано: ${selected.length}`
            : "Выберите, что вам нравится"}
        </span>
        <button
          className="ov-button ov-trip-types-continue"
          type="button"
          disabled={disabled || selected.length === 0}
          onClick={() => onSelect([...selected])}
        >
          Продолжить <ArrowRight size={20} />
        </button>
      </div>
    </section>
  );
}
