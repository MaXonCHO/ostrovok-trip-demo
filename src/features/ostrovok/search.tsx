"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import {
  ArrowRight,
  Check,
  Heart,
  List,
  MagnifyingGlass,
  MapPin,
  SlidersHorizontal,
  X,
} from "@phosphor-icons/react";
import { useCatalog } from "@/features/planner/catalog-provider";
import { filterHotels, getCity } from "./catalog";
import {
  defaults,
  money,
  param,
  readSearch,
  searchParams,
  type Query,
} from "./search-state";
import {
  Breadcrumbs,
  DemoNote,
  HotelCard,
  Modal,
  SearchForm,
  useFavorites,
} from "./shared";
import { DemoMap } from "./map";
const amenities = [
  "Бесплатный Wi-Fi",
  "Бассейн",
  "Парковка",
  "Спа",
  "Завтрак",
  "Пляж рядом",
  "Можно с питомцами",
  "Фитнес",
];
export function OstrovokSearch({
  query = {},
  favoritesOnly = false,
  recommendationIds,
}: {
  query?: Query;
  favoritesOnly?: boolean;
  recommendationIds?: string[];
}) {
  const router = useRouter();
  const catalog = useCatalog();
  const apartmentsOnly = param(query, "property") === "apartments";
  const wish = param(query, "wish").slice(0, 3000);
  const initial = readSearch(query);
  const city = getCity(initial.city);
  const state = { ...initial, city: city?.slug || defaults.city };
  const activeCity = getCity(state.city)!;
  const { ids } = useFavorites();
  const [maxPrice, setMaxPrice] = useState(() =>
    Math.max(
      2000,
      Math.min(25000, Number(param(query, "maxPrice", "25000")) || 25000),
    ),
  );
  const [stars, setStars] = useState<number[]>(() =>
    param(query, "stars")
      .split(",")
      .map(Number)
      .filter((x) => x >= 1 && x <= 5),
  );
  const [selected, setSelected] = useState<string[]>(() =>
    param(query, "amenities")
      .split(",")
      .filter((x) => amenities.includes(x)),
  );
  const [name, setName] = useState(param(query, "q"));
  const [sort, setSort] = useState(param(query, "sort", "recommended"));
  const [showMap, setShowMap] = useState(param(query, "view") === "map");
  const [showFilters, setShowFilters] = useState(false);
  const filtered = apartmentsOnly
    ? []
    : filterHotels(
        {
          city: favoritesOnly ? undefined : state.city,
          query: name,
          maxPrice:
            maxPrice < 25000 || param(query, "maxPrice") ? maxPrice : undefined,
          stars,
          amenities: selected,
          sort,
          ...(favoritesOnly ? { favorites: ids } : {}),
        },
        catalog,
      );
  if (sort === "recommended" && recommendationIds) {
    const order = new Map(recommendationIds.map((id, index) => [id, index]));
    filtered.sort(
      (a, b) =>
        (order.get(a.id) ?? Number.MAX_SAFE_INTEGER) -
        (order.get(b.id) ?? Number.MAX_SAFE_INTEGER),
    );
  }
  const params = searchParams(state);
  if (wish) params.set("wish", wish);
  if (apartmentsOnly) params.set("property", "apartments");
  if (maxPrice < 25000) params.set("maxPrice", String(maxPrice));
  if (stars.length) params.set("stars", stars.join(","));
  if (selected.length) params.set("amenities", selected.join(","));
  if (name) params.set("q", name);
  if (sort !== "recommended") params.set("sort", sort);
  if (showMap) params.set("view", "map");
  const serialized = params.toString();
  useEffect(() => {
    if (!favoritesOnly)
      window.history.replaceState(null, "", `/search?${serialized}`);
  }, [serialized, favoritesOnly]);
  const reset = () => {
    if (apartmentsOnly) router.replace(`/search?${searchParams(state)}`);
    setMaxPrice(25000);
    setStars([]);
    setSelected([]);
    setName("");
    setSort("recommended");
  };
  const activeCount =
    (maxPrice < 25000 ? 1 : 0) +
    stars.length +
    selected.length +
    (name ? 1 : 0) +
    (apartmentsOnly ? 1 : 0);
  const filters = (
    <>
      <div className="ov-filter-heading">
        <b>Фильтры</b>
        {activeCount > 0 && (
          <button className="ov-text-button" onClick={reset}>
            Сбросить
          </button>
        )}
      </div>
      <section className="ov-filter-section">
        <h3>Цена за ночь, ₽</h3>
        <div className="ov-price-histogram" aria-hidden="true">
          {[
            15, 24, 33, 43, 60, 74, 82, 94, 100, 92, 76, 65, 55, 48, 40, 32, 28,
            23, 18, 14,
          ].map((h, i) => (
            <span
              key={i}
              style={{
                height: `${h}%`,
                background: (i / 20) * 25000 > maxPrice ? "#e5e5e5" : undefined,
              }}
            />
          ))}
        </div>
        <input
          className="ov-range"
          type="range"
          min="2000"
          max="25000"
          step="100"
          value={maxPrice}
          aria-label="Максимальная цена за ночь"
          onChange={(e) => setMaxPrice(Number(e.target.value))}
        />
        <div className="ov-price-inputs">
          <div>
            <small>От</small>
            <span>2 000 ₽</span>
          </div>
          <label>
            <small>До</small>
            <input
              type="number"
              min="2000"
              max="25000"
              step="100"
              aria-label="Цена до"
              value={maxPrice}
              onChange={(e) =>
                setMaxPrice(
                  Math.max(
                    2000,
                    Math.min(25000, Number(e.target.value) || 2000),
                  ),
                )
              }
            />
          </label>
        </div>
      </section>
      <section className="ov-filter-section">
        <h3>Популярные фильтры</h3>
        {amenities.map((item) => (
          <label className="ov-checkbox" key={item}>
            <input
              type="checkbox"
              checked={selected.includes(item)}
              onChange={() =>
                setSelected(
                  selected.includes(item)
                    ? selected.filter((x) => x !== item)
                    : [...selected, item],
                )
              }
            />
            <span>{item}</span>
          </label>
        ))}
      </section>
      <section className="ov-filter-section">
        <h3>Количество звёзд</h3>
        <div className="ov-stars-filter">
          {[5, 4, 3].map((n) => (
            <button
              key={n}
              aria-pressed={stars.includes(n)}
              className={stars.includes(n) ? "is-selected" : ""}
              onClick={() =>
                setStars(
                  stars.includes(n)
                    ? stars.filter((x) => x !== n)
                    : [...stars, n],
                )
              }
            >
              {n} <span>★</span>
            </button>
          ))}
        </div>
      </section>
      <section className="ov-filter-section">
        <h3>Название отеля</h3>
        <label className="ov-filter-input">
          <MagnifyingGlass size={17} />
          <input
            value={name}
            aria-label="Название отеля"
            placeholder="Например, Mercure"
            onChange={(e) => setName(e.target.value)}
          />
        </label>
      </section>
      <div className="ov-filter-footnote">
        Удобства, звёзды, расстояния и цены в каталоге — демонстрационные.
      </div>
    </>
  );
  return (
    <>
      <div className="ov-search-strip">
        <div className="ov-container">
          <SearchForm key={JSON.stringify(initial)} initial={state} compact />
        </div>
      </div>
      <div className="ov-container ov-results-container">
        <Breadcrumbs city={favoritesOnly ? "Избранное" : activeCity.name} />
        <div className="ov-results-layout">
          <aside className="ov-sidebar">
            <DemoMap
              hotels={filtered}
              mini
              onOpen={() => setShowMap(!showMap)}
            />
            <div className="ov-filter-panel">{filters}</div>
          </aside>
          <section className="ov-results">
            <div className="ov-results-title">
              <div>
                <h1>
                  {favoritesOnly
                    ? "Избранные отели"
                    : `Отели ${activeCity.preposition}`}
                </h1>
                <p aria-live="polite">
                  {favoritesOnly
                    ? "Ваши любимые места для будущих путешествий"
                    : `${filtered.length} вариантов в локальном каталоге`}
                </p>
              </div>
              <div className="ov-view-switch">
                <button
                  className={!showMap ? "is-active" : ""}
                  aria-label="Показать списком"
                  aria-pressed={!showMap}
                  onClick={() => setShowMap(false)}
                >
                  <List size={21} />
                </button>
                <button
                  className={showMap ? "is-active" : ""}
                  aria-label="Показать на карте"
                  aria-pressed={showMap}
                  onClick={() => setShowMap(true)}
                >
                  <MapPin size={21} />
                </button>
              </div>
            </div>
            {wish && (
              <div className="ov-wish-banner">
                <span>Ваши пожелания</span>
                <p>«{wish}»</p>
                <small>
                  Знакомые параметры перенесены в фильтры. Необычные пожелания
                  можно уточнить в «Моей поездке».
                </small>
              </div>
            )}
            <DemoNote />
            <div className="ov-sort-row">
              <label>
                Сначала{" "}
                <select
                  aria-label="Сортировка отелей"
                  value={sort}
                  onChange={(e) => setSort(e.target.value)}
                >
                  <option value="recommended">рекомендуемые</option>
                  <option value="price">недорогие</option>
                  <option value="price-desc">дорогие</option>
                  <option value="stars">больше звёзд</option>
                </select>
              </label>
              <button
                className="ov-mobile-filters ov-outline-button"
                onClick={() => setShowFilters(true)}
              >
                <SlidersHorizontal size={18} />
                Фильтры {activeCount > 0 && <span>{activeCount}</span>}
              </button>
              <span className="ov-results-count">
                Найдено: {filtered.length}
              </span>
            </div>
            {activeCount > 0 && (
              <div className="ov-active-filters">
                {selected.map((item) => (
                  <button
                    key={item}
                    onClick={() =>
                      setSelected(selected.filter((x) => x !== item))
                    }
                  >
                    {item}
                    <X size={13} />
                  </button>
                ))}
                {stars.map((n) => (
                  <button
                    key={n}
                    onClick={() => setStars(stars.filter((x) => x !== n))}
                  >
                    {n} звезды
                    <X size={13} />
                  </button>
                ))}
                {maxPrice < 25000 && (
                  <button onClick={() => setMaxPrice(25000)}>
                    До {money(maxPrice)}
                    <X size={13} />
                  </button>
                )}
                <button className="ov-reset-chip" onClick={reset}>
                  Сбросить всё
                </button>
              </div>
            )}
            {showMap && filtered.length > 0 && (
              <div className="ov-results-map">
                <DemoMap hotels={filtered} query={serialized} />
              </div>
            )}
            <div className="ov-hotel-list" aria-live="polite">
              {filtered.map((hotel) => (
                <HotelCard
                  hotel={hotel}
                  state={{ ...state, city: hotel.citySlug }}
                  query={new URLSearchParams({
                    ...Object.fromEntries(params),
                    city: hotel.citySlug,
                  }).toString()}
                  key={hotel.id}
                />
              ))}
            </div>
            {filtered.length === 0 && (
              <div className="ov-empty">
                <span>
                  {favoritesOnly && ids.length === 0 ? (
                    <Heart size={42} />
                  ) : (
                    <MagnifyingGlass size={42} />
                  )}
                </span>
                <h2>
                  {favoritesOnly && ids.length === 0
                    ? "Здесь будут ваши любимые отели"
                    : apartmentsOnly
                      ? "В каталоге пока нет квартир"
                      : "Не нашли подходящих отелей"}
                </h2>
                <p>
                  {favoritesOnly && ids.length === 0
                    ? "Нажмите на сердечко у понравившегося отеля. Мы сохраним его здесь."
                    : apartmentsOnly
                      ? "Посмотрите отели для выбранных дат или измените направление."
                      : "Попробуйте убрать часть фильтров или увеличить бюджет."}
                </p>
                {favoritesOnly && ids.length === 0 ? (
                  <Link href="/search" className="ov-button">
                    Найти отель <ArrowRight size={18} />
                  </Link>
                ) : (
                  <button className="ov-button" onClick={reset}>
                    {apartmentsOnly ? "Показать отели" : "Сбросить фильтры"}
                  </button>
                )}
              </div>
            )}
            <div className="ov-search-bottom">
              <Check size={20} />
              <p>
                Вы просматриваете готовый демо-каталог. Наличие номеров и
                стоимость не проверяются в реальном времени.
              </p>
            </div>
          </section>
        </div>
      </div>
      <Modal title="Фильтры" open={showFilters} onOpenChange={setShowFilters}>
        <div className="ov-mobile-filter-content">{filters}</div>
        <button
          className="ov-button ov-filter-apply"
          onClick={() => setShowFilters(false)}
        >
          Показать {filtered.length} вариантов
        </button>
      </Modal>
    </>
  );
}
