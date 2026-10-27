"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import {
  ArrowRight,
  CalendarBlank,
  CaretDown,
  Check,
  Heart,
  MapPin,
  Minus,
  Plus,
  User,
  Users,
  X,
  GlobeHemisphereWest,
  Headset,
  Suitcase,
  List,
  Buildings,
  MagnifyingGlass,
  CaretLeft,
  CaretRight,
} from "@phosphor-icons/react";
import { cities, type Hotel } from "./catalog";
import { StorefrontFooter } from "./footer";
import {
  defaults,
  money,
  nights,
  plural,
  searchParams,
  shortDate,
  type SearchState,
} from "./search-state";

const subscribeToHydration = () => () => {};
const clientReady = () => true;
const serverReady = () => false;

const favoritesKey = "ostrovok-demo-favorites-v1";
function snapshot() {
  try {
    return localStorage.getItem(favoritesKey) || "[]";
  } catch {
    return "[]";
  }
}
function subscribe(callback: () => void) {
  window.addEventListener("storage", callback);
  window.addEventListener("ov-favorites", callback);
  return () => {
    window.removeEventListener("storage", callback);
    window.removeEventListener("ov-favorites", callback);
  };
}
export function useFavorites() {
  const raw = useSyncExternalStore(subscribe, snapshot, () => "[]");
  let ids: string[] = [];
  try {
    const parsed: unknown = JSON.parse(raw);
    if (Array.isArray(parsed))
      ids = parsed.filter(
        (value): value is string => typeof value === "string",
      );
  } catch {}
  const toggle = (id: string) => {
    const next = ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id];
    try {
      localStorage.setItem(favoritesKey, JSON.stringify(next));
      window.dispatchEvent(new Event("ov-favorites"));
    } catch {}
  };
  return { ids, toggle };
}
export function Favorite({
  hotel,
  large = false,
}: {
  hotel: Hotel;
  large?: boolean;
}) {
  const { ids, toggle } = useFavorites();
  const saved = ids.includes(hotel.id);
  return (
    <button
      className={`ov-favorite ${saved ? "is-saved" : ""} ${large ? "ov-favorite-large" : ""}`}
      aria-label={`${saved ? "Убрать из избранного" : "В избранное"}: ${hotel.name}`}
      aria-pressed={saved}
      onClick={() => toggle(hotel.id)}
    >
      <Heart size={22} weight={saved ? "fill" : "regular"} />
      {large && (saved ? "В избранном" : "В избранное")}
    </button>
  );
}
export function Modal({
  title,
  open,
  onOpenChange,
  children,
  wide = false,
  onKeyDown,
  className = "",
}: {
  title: string;
  open: boolean;
  onOpenChange: (value: boolean) => void;
  children: React.ReactNode;
  wide?: boolean;
  onKeyDown?: React.KeyboardEventHandler<HTMLDivElement>;
  className?: string;
}) {
  const returnFocus = useRef<HTMLElement | null>(null);
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="ov-overlay" />
        <Dialog.Content
          className={`ov-modal ${wide ? "ov-modal-wide" : ""} ${className}`}
          aria-describedby={undefined}
          onKeyDown={onKeyDown}
          onOpenAutoFocus={() => {
            returnFocus.current =
              document.activeElement instanceof HTMLElement
                ? document.activeElement
                : null;
          }}
          onCloseAutoFocus={(event) => {
            if (returnFocus.current?.isConnected) {
              event.preventDefault();
              returnFocus.current.focus();
            }
          }}
        >
          <Dialog.Title className="ov-modal-title">{title}</Dialog.Title>
          <Dialog.Close className="ov-modal-close" aria-label="Закрыть">
            <X size={24} />
          </Dialog.Close>
          {children}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
export function StorefrontShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const home = pathname === "/" || pathname === "/my-trip";
  const hydrated = useSyncExternalStore(
    subscribeToHydration,
    clientReady,
    serverReady,
  );
  const { ids } = useFavorites();
  const [info, setInfo] = useState(false);
  const [support, setSupport] = useState(false);
  const [menu, setMenu] = useState(false);
  return (
    <div className="ov" data-hydrated={hydrated}>
      <a href="#main" className="skip-link">
        Перейти к содержимому
      </a>
      <header className={`ov-header ${home ? "ov-header-home" : ""}`}>
        <div className="ov-header-inner">
          <Link href="/" className="ov-logo" aria-label="Островок — главная">
            <img
              src="/ostrovok/logo.svg"
              width="172"
              height="40"
              alt="Островок"
            />
          </Link>
          <nav className="ov-header-nav" aria-label="Основная навигация">
            <Link
              href="/"
              className={pathname === "/my-trip" ? undefined : "ov-nav-active"}
              aria-current={pathname === "/my-trip" ? undefined : "page"}
            >
              <Buildings size={20} />
              Отели
            </Link>
            <Link
              href="/my-trip"
              className={pathname === "/my-trip" ? "ov-nav-active" : undefined}
              aria-current={pathname === "/my-trip" ? "page" : undefined}
            >
              <Suitcase size={20} />
              Моя поездка
            </Link>
          </nav>
          <div className="ov-header-actions">
            <button
              className="ov-header-help"
              aria-label="Помощь"
              onClick={() => setSupport(true)}
            >
              <Headset size={20} />
              <span>Помощь</span>
            </button>
            <button
              className="ov-header-locale"
              aria-label="RUB"
              onClick={() => setInfo(true)}
            >
              <GlobeHemisphereWest size={20} />
              <span>RUB</span>
            </button>
            <Link
              href="/favorites"
              className="ov-header-favorites"
              aria-label={`Избранное: ${ids.length}`}
            >
              <Heart size={22} />
              {ids.length > 0 && (
                <span className="ov-counter">{ids.length}</span>
              )}
            </Link>
            <button className="ov-login" onClick={() => setInfo(true)}>
              <User size={19} />
              Войти
            </button>
            <button
              className="ov-mobile-menu"
              aria-label="Меню"
              aria-expanded={menu}
              onClick={() => setMenu(!menu)}
            >
              <List size={25} />
            </button>
          </div>
        </div>
        {menu && (
          <nav className="ov-mobile-nav">
            <Link
              href="/"
              onClick={() => setMenu(false)}
              aria-current={pathname === "/" ? "page" : undefined}
            >
              Отели
            </Link>
            <Link href="/favorites" onClick={() => setMenu(false)}>
              Избранное
            </Link>
            <Link href="/my-trip" onClick={() => setMenu(false)}>
              Моя поездка
            </Link>
            <button
              onClick={() => {
                setSupport(true);
                setMenu(false);
              }}
            >
              Помощь
            </button>
          </nav>
        )}
      </header>
      <main id="main">{children}</main>
      <StorefrontFooter />
      <Modal
        title="Локальный прототип Островка"
        open={info}
        onOpenChange={setInfo}
      >
        <p>
          Здесь можно выбрать направление, найти отель и посмотреть номера.
          Избранное сохраняется в этом браузере.
        </p>
        <p>
          Названия, адреса и фотографии отелей взяты из локального каталога.
          Цены, категории номеров и удобства — демо-данные. Рейтинги и отзывы не
          моделируются.
        </p>
        <p>
          Вход в аккаунт и реальное бронирование не подключены. Валюта демо —
          российский рубль.
        </p>
        <Link
          className="ov-button"
          href="/my-trip"
          onClick={() => setInfo(false)}
        >
          Рассказать о поездке <ArrowRight size={18} />
        </Link>
      </Modal>
      <Modal
        title="Помощь в путешествии"
        open={support}
        onOpenChange={setSupport}
      >
        <div className="ov-support-icon">
          <Headset size={42} />
        </div>
        <p>
          В демо можно самостоятельно пройти поиск, выбрать номер и сохранить
          его в избранное.
        </p>
        <p>
          Опишите пожелания на главной или задайте город, даты и гостей через
          кнопку «Фильтры».
        </p>
        <Link
          className="ov-button"
          href="/my-trip"
          onClick={() => setSupport(false)}
        >
          Подобрать отель <ArrowRight size={18} />
        </Link>
      </Modal>
    </div>
  );
}
function Counter({
  label,
  value,
  min,
  max,
  onChange,
  hint,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  onChange: (value: number) => void;
  hint?: string;
}) {
  return (
    <div className="ov-guest-row">
      <div>
        <b>{label}</b>
        {hint && <small>{hint}</small>}
      </div>
      <div className="ov-stepper">
        <button
          type="button"
          aria-label={`Уменьшить: ${label}`}
          disabled={value <= min}
          onClick={() => onChange(value - 1)}
        >
          <Minus size={16} />
        </button>
        <span aria-live="polite">{value}</span>
        <button
          type="button"
          aria-label={`Увеличить: ${label}`}
          disabled={value >= max}
          onClick={() => onChange(value + 1)}
        >
          <Plus size={16} />
        </button>
      </div>
    </div>
  );
}
function dayString(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}
export function SearchForm({
  initial = defaults,
  compact = false,
  original = false,
  apartmentsOnly = false,
  onStateChange,
  onSearch,
  id,
  externalSubmit = false,
}: {
  initial?: SearchState;
  compact?: boolean;
  original?: boolean;
  apartmentsOnly?: boolean;
  onStateChange?: (state: SearchState) => void;
  onSearch?: (state: SearchState) => void;
  id?: string;
  externalSubmit?: boolean;
}) {
  const router = useRouter();
  const [state, setState] = useState(initial);
  const [open, setOpen] = useState<"city" | "dates" | "guests" | null>(null);
  const [cityQuery, setCityQuery] = useState("");
  const [month, setMonth] = useState(new Date(initial.checkin + "T12:00:00"));
  const [selectingEnd, setSelectingEnd] = useState(false);
  const ref = useRef<HTMLFormElement>(null);
  useEffect(() => {
    const close = (event: MouseEvent) => {
      if (ref.current && !ref.current.contains(event.target as Node))
        setOpen(null);
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, []);
  const city = cities.find((x) => x.slug === state.city) || cities[0];
  const patch = (value: Partial<SearchState>) => {
    const next = { ...state, ...value };
    setState(next);
    onStateChange?.(next);
  };
  const selectDate = (value: string) => {
    if (!selectingEnd || value <= state.checkin) {
      patch({
        checkin: value,
        checkout: dayString(new Date(Date.parse(value) + 86400000)),
      });
      setSelectingEnd(true);
    } else {
      patch({ checkout: value });
      setSelectingEnd(false);
    }
  };
  const toggle = (key: typeof open) => setOpen(open === key ? null : key);
  const fullDate = (value: string) =>
    new Date(value + "T12:00:00")
      .toLocaleDateString("ru-RU", {
        day: "numeric",
        month: "short",
        year: "numeric",
      })
      .replace(" г.", "");
  const openOriginalDate = (end: boolean) => {
    setOpen(open === "dates" && selectingEnd === end ? null : "dates");
    setSelectingEnd(end);
    setMonth(new Date((end ? state.checkout : state.checkin) + "T12:00:00"));
  };
  return (
    <form
      id={id}
      className={`ov-search-form ${compact ? "ov-search-compact" : ""} ${original ? "ov-search-original" : ""}`}
      ref={ref}
      onSubmit={(event) => {
        event.preventDefault();
        setOpen(null);
        if (onSearch) {
          onSearch(state);
          return;
        }
        const params = searchParams(state);
        if (apartmentsOnly) params.set("property", "apartments");
        router.push(`/search?${params}`);
      }}
      onKeyDown={(event) => {
        if (event.key === "Escape") setOpen(null);
      }}
    >
      <div className="ov-search-field ov-destination">
        <button
          type="button"
          className="ov-field-button"
          aria-expanded={open === "city"}
          onClick={() => toggle("city")}
        >
          {!original && <MapPin size={23} />}
          <span>
            <small>Город, отель или регион</small>
            <strong>{city.name}, Россия</strong>
          </span>
          {open === "city" ? <X size={16} /> : <CaretDown size={16} />}
        </button>
        {open === "city" && (
          <div className="ov-popover ov-city-popover">
            <label className="ov-city-input">
              <MagnifyingGlass size={19} />
              <input
                autoFocus
                aria-label="Найти направление"
                placeholder="Куда хотите поехать?"
                value={cityQuery}
                onChange={(event) => setCityQuery(event.target.value)}
              />
            </label>
            <small className="ov-popover-label">Направления в демо</small>
            {cities
              .filter((x) =>
                x.name.toLowerCase().includes(cityQuery.toLowerCase()),
              )
              .map((x) => (
                <button
                  type="button"
                  key={x.slug}
                  className="ov-city-option"
                  onClick={() => {
                    patch({ city: x.slug });
                    setOpen(null);
                    setCityQuery("");
                  }}
                >
                  <MapPin size={23} />
                  <span>
                    <b>{x.name}</b>
                    <small>Россия</small>
                  </span>
                  {x.slug === state.city && <Check size={18} />}
                </button>
              ))}
            {!cities.some((x) =>
              x.name.toLowerCase().includes(cityQuery.toLowerCase()),
            ) && (
              <p className="ov-no-city">
                Попробуйте Сочи, Санкт-Петербург или Казань.
              </p>
            )}
          </div>
        )}
      </div>
      <div className="ov-search-field ov-dates">
        {original ? (
          <>
            <button
              type="button"
              className="ov-field-button ov-original-date"
              aria-label={`Заезд — выезд: заезд ${fullDate(state.checkin)}`}
              aria-expanded={open === "dates" && !selectingEnd}
              onClick={() => openOriginalDate(false)}
            >
              <span>
                <small>Заезд</small>
                <strong>{fullDate(state.checkin)}</strong>
              </span>
            </button>
            <button
              type="button"
              className="ov-field-button ov-original-date"
              aria-label={`Выезд ${fullDate(state.checkout)}`}
              aria-expanded={open === "dates" && selectingEnd}
              onClick={() => openOriginalDate(true)}
            >
              <span>
                <small>Выезд</small>
                <strong>{fullDate(state.checkout)}</strong>
              </span>
            </button>
          </>
        ) : (
          <button
            type="button"
            className="ov-field-button"
            aria-expanded={open === "dates"}
            onClick={() => toggle("dates")}
          >
            <CalendarBlank size={23} />
            <span>
              <small>Заезд — выезд</small>
              <strong>
                {shortDate(state.checkin)} — {shortDate(state.checkout)}
              </strong>
            </span>
            <span className="ov-night-count">
              {nights(state)} {plural(nights(state), ["ночь", "ночи", "ночей"])}
            </span>
          </button>
        )}
        {open === "dates" && (
          <div className="ov-popover ov-calendar">
            <div className="ov-calendar-controls">
              <button
                type="button"
                aria-label="Предыдущий месяц"
                onClick={() =>
                  setMonth(
                    new Date(month.getFullYear(), month.getMonth() - 1, 1),
                  )
                }
              >
                <CaretLeft size={20} />
              </button>
              <b>
                {selectingEnd ? "Выберите дату выезда" : "Выберите дату заезда"}
              </b>
              <button
                type="button"
                aria-label="Следующий месяц"
                onClick={() =>
                  setMonth(
                    new Date(month.getFullYear(), month.getMonth() + 1, 1),
                  )
                }
              >
                <CaretRight size={20} />
              </button>
            </div>
            <div className="ov-months">
              {[0, 1].map((offset) => {
                const m = new Date(
                  month.getFullYear(),
                  month.getMonth() + offset,
                  1,
                );
                const start = (m.getDay() + 6) % 7;
                const days = new Date(
                  m.getFullYear(),
                  m.getMonth() + 1,
                  0,
                ).getDate();
                return (
                  <div className="ov-month" key={offset}>
                    <b>
                      {m
                        .toLocaleDateString("ru-RU", {
                          month: "long",
                          year: "numeric",
                        })
                        .replace(" г.", "")}
                    </b>
                    <div className="ov-days">
                      {["пн", "вт", "ср", "чт", "пт", "сб", "вс"].map((day) => (
                        <small key={day}>{day}</small>
                      ))}
                      {Array.from({ length: start }, (_, i) => (
                        <span key={`empty-${i}`} />
                      ))}
                      {Array.from({ length: days }, (_, i) => {
                        const value = dayString(
                          new Date(m.getFullYear(), m.getMonth(), i + 1),
                        );
                        const selected =
                          value === state.checkin || value === state.checkout;
                        return (
                          <button
                            type="button"
                            key={value}
                            disabled={value < "2026-10-27"}
                            aria-label={new Date(
                              value + "T12:00:00",
                            ).toLocaleDateString("ru-RU", {
                              day: "numeric",
                              month: "long",
                              year: "numeric",
                            })}
                            aria-pressed={selected}
                            className={`${selected ? "is-selected" : ""} ${value > state.checkin && value < state.checkout ? "in-range" : ""}`}
                            onClick={() => selectDate(value)}
                          >
                            {i + 1}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
            <div className="ov-calendar-bottom">
              <span>
                {shortDate(state.checkin)} — {shortDate(state.checkout)} ·{" "}
                {nights(state)}{" "}
                {plural(nights(state), ["ночь", "ночи", "ночей"])}
              </span>
              <button
                className="ov-button"
                type="button"
                onClick={() => {
                  setOpen(null);
                  setSelectingEnd(false);
                }}
              >
                Готово
              </button>
            </div>
          </div>
        )}
      </div>
      <div className="ov-search-field ov-guests">
        <button
          type="button"
          className="ov-field-button"
          aria-expanded={open === "guests"}
          aria-label={
            original
              ? `${state.rooms} ${plural(state.rooms, ["номер", "номера", "номеров"])} ${state.adults + state.children} ${plural(state.adults + state.children, ["гость", "гостя", "гостей"])}`
              : undefined
          }
          onClick={() => toggle("guests")}
        >
          {!original && <Users size={23} />}
          <span>
            {original ? (
              <>
                <small>
                  {state.rooms}{" "}
                  {plural(state.rooms, ["номер", "номера", "номеров"])} для
                </small>
                <strong>
                  {state.adults + state.children}{" "}
                  {plural(state.adults + state.children, [
                    "гость",
                    "гостя",
                    "гостей",
                  ])}
                </strong>
              </>
            ) : (
              <>
                <small>
                  {state.rooms}{" "}
                  {plural(state.rooms, ["номер", "номера", "номеров"])}
                </small>
                <strong>
                  {state.adults + state.children}{" "}
                  {plural(state.adults + state.children, [
                    "гость",
                    "гостя",
                    "гостей",
                  ])}
                </strong>
              </>
            )}
          </span>
          <CaretDown size={16} />
        </button>
        {open === "guests" && (
          <div className="ov-popover ov-guests-popover">
            <Counter
              label="Взрослые"
              value={state.adults}
              min={1}
              max={6}
              onChange={(adults) => patch({ adults })}
              hint="От 18 лет"
            />
            <Counter
              label="Дети"
              value={state.children}
              min={0}
              max={4}
              onChange={(children) => patch({ children })}
              hint="До 17 лет включительно"
            />
            <Counter
              label="Номера"
              value={state.rooms}
              min={1}
              max={3}
              onChange={(rooms) => patch({ rooms })}
            />
            <button
              className="ov-button"
              type="button"
              onClick={() => setOpen(null)}
            >
              Готово
            </button>
          </div>
        )}
      </div>
      {!externalSubmit && (
        <button className="ov-button ov-search-submit" type="submit">
          {!original && <MagnifyingGlass size={21} />}
          <span>Найти</span>
        </button>
      )}
    </form>
  );
}
export function Stars({ count }: { count: number }) {
  return (
    <span className="ov-stars" aria-label={`${count} звезды`}>
      {"★".repeat(count)}
    </span>
  );
}
export function Breadcrumbs({
  city,
  hotel,
}: {
  city?: string;
  hotel?: string;
}) {
  return (
    <nav className="ov-breadcrumbs" aria-label="Навигационная цепочка">
      <Link href="/">Главная</Link>
      <CaretRight size={12} />
      <Link href="/search">Россия</Link>
      {city && (
        <>
          <CaretRight size={12} />
          <span>{city}</span>
        </>
      )}
      {hotel && (
        <>
          <CaretRight size={12} />
          <span>{hotel}</span>
        </>
      )}
    </nav>
  );
}
export function DemoNote() {
  return (
    <div className="ov-demo-note">
      <span className="ov-demo-dot" />
      Демо-каталог · цены и условия проживания примерные
    </div>
  );
}
export function HotelCard({
  hotel,
  state,
  query,
}: {
  hotel: Hotel;
  state: SearchState;
  query?: string;
}) {
  const [photo, setPhoto] = useState(0);
  const href = `/hotel/${hotel.slug}?${query || searchParams(state).toString()}`;
  const total = hotel.price * nights(state) * state.rooms;
  return (
    <article className="ov-hotel-card">
      <div className="ov-card-image">
        <Link href={href} aria-label={`Посмотреть ${hotel.name}`}>
          <img src={hotel.photos[photo]} alt={hotel.name} loading="lazy" />
        </Link>
        <Favorite hotel={hotel} />
        {hotel.beach && <span className="ov-photo-tag">Пляж рядом</span>}
        {hotel.photos.length > 1 && (
          <>
            <button
              className="ov-photo-prev"
              aria-label={`Предыдущее фото: ${hotel.name}`}
              onClick={() =>
                setPhoto(
                  (photo + hotel.photos.length - 1) % hotel.photos.length,
                )
              }
            >
              <CaretLeft size={19} />
            </button>
            <button
              className="ov-photo-next"
              aria-label={`Следующее фото: ${hotel.name}`}
              onClick={() => setPhoto((photo + 1) % hotel.photos.length)}
            >
              <CaretRight size={19} />
            </button>
            <div className="ov-photo-dots">
              {hotel.photos.map((_, i) => (
                <button
                  key={i}
                  className={photo === i ? "is-active" : ""}
                  aria-label={`Фото ${i + 1}: ${hotel.name}`}
                  onClick={() => setPhoto(i)}
                />
              ))}
            </div>
          </>
        )}
      </div>
      <div className="ov-card-content">
        <div className="ov-card-info">
          <Stars count={hotel.stars} />
          <Link href={href} className="ov-hotel-name">
            {hotel.name}
          </Link>
          <p className="ov-card-address">{hotel.address}</p>
          <span className="ov-distance">
            <MapPin size={14} />
            {hotel.distance}
            {hotel.beach && ` · ${hotel.beach}`}
          </span>
          <div className="ov-amenity-chips">
            {hotel.amenities.slice(0, 4).map((a) => (
              <span key={a}>{a}</span>
            ))}
          </div>
          <div className="ov-card-source">
            <Check size={15} />
            Фотографии с сайта отеля
          </div>
        </div>
        <div className="ov-card-price">
          <span className="ov-rate-label">Номер в этом отеле</span>
          <span className="ov-price-caption">
            {nights(state)} {plural(nights(state), ["ночь", "ночи", "ночей"])} ·{" "}
            {state.adults + state.children}{" "}
            {plural(state.adults + state.children, [
              "гость",
              "гостя",
              "гостей",
            ])}{" "}
            · {state.rooms}{" "}
            {plural(state.rooms, ["номер", "номера", "номеров"])}
          </span>
          {hotel.oldPrice && (
            <del>{money(hotel.oldPrice * nights(state) * state.rooms)}</del>
          )}
          <strong className="ov-total">{money(total)}</strong>
          <small>{money(hotel.price)} за ночь за номер</small>
          <span className="ov-taxes">Включая налоги и сборы</span>
          <Link className="ov-button" href={href}>
            Выбрать номер
          </Link>
          <span className="ov-cancel">Бесплатная отмена</span>
        </div>
      </div>
    </article>
  );
}
