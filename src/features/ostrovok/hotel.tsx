"use client";
import Link from "next/link";
import { useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  Bed,
  Buildings,
  Camera,
  CaretLeft,
  CaretRight,
  Check,
  Coffee,
  Headset,
  Info,
  MapPin,
  Car,
  ShieldCheck,
  Snowflake,
  Sparkle,
  SquaresFour,
  SwimmingPool,
  Users,
  WifiHigh,
} from "@phosphor-icons/react";
import { type Hotel } from "./catalog";
import {
  money,
  nights,
  plural,
  readSearch,
  searchParams,
  shortDate,
  type Query,
} from "./search-state";
import {
  Breadcrumbs,
  DemoNote,
  Favorite,
  Modal,
  SearchForm,
  Stars,
  useFavorites,
} from "./shared";
import { DemoMap } from "./map";
const amenityIcons: Record<string, typeof WifiHigh> = {
  "Бесплатный Wi-Fi": WifiHigh,
  Бассейн: SwimmingPool,
  Парковка: Car,
  Спа: Sparkle,
  Завтрак: Coffee,
  "Пляж рядом": MapPin,
  "Можно с питомцами": ShieldCheck,
  Фитнес: Users,
};
export function OstrovokHotel({
  hotel,
  query = {},
}: {
  hotel: Hotel;
  query?: Query;
}) {
  const state = { ...readSearch(query), city: hotel.citySlug };
  const params = new URLSearchParams(
    Object.entries(query).flatMap(([key, value]) =>
      value === undefined
        ? []
        : [[key, Array.isArray(value) ? value[0] : value]],
    ),
  );
  for (const [key, value] of searchParams(state)) params.set(key, value);
  const [gallery, setGallery] = useState(false);
  const [photo, setPhoto] = useState(0);
  const [map, setMap] = useState(false);
  const [booking, setBooking] = useState<number | null>(null);
  const [saved, setSaved] = useState(false);
  const [breakfast, setBreakfast] = useState(false);
  const { ids, toggle } = useFavorites();
  const count = nights(state);
  const roomTypes = [
    {
      name: "Двухместный номер Standard",
      size: 24,
      delta: 0,
      beds: "Двуспальная кровать или две односпальные",
    },
    {
      name: "Двухместный номер Superior",
      size: 32,
      delta: 1800,
      beds: "Двуспальная кровать",
    },
  ];
  const roomPrice = (index: number) =>
    (hotel.price ?? 0) +
    roomTypes[index].delta +
    (breakfast ? (1100 * state.adults) / state.rooms : 0);
  const total = (index: number) => roomPrice(index) * count * state.rooms;
  const openGallery = (index: number) => {
    setPhoto(index);
    setGallery(true);
  };
  return (
    <>
      <div className="ov-search-strip">
        <div className="ov-container">
          <SearchForm initial={state} compact />
        </div>
      </div>
      <div className="ov-container ov-hotel-page">
        <Breadcrumbs city={hotel.city} hotel={hotel.name} />
        <Link className="ov-back-link" href={`/search?${params}`}>
          <ArrowLeft size={16} />
          Все отели{" "}
          {hotel.city === "Сочи"
            ? "в Сочи"
            : hotel.city === "Казань"
              ? "в Казани"
              : "в Санкт-Петербурге"}
        </Link>
        <div className="ov-detail-heading">
          <div>
            <Stars count={hotel.stars} />
            <h1>{hotel.name}</h1>
            <div className="ov-detail-address">
              <MapPin size={18} />
              <span>{hotel.address}</span>
              <button onClick={() => setMap(true)}>Показать на карте</button>
            </div>
          </div>
          <div className="ov-detail-actions">
            <Favorite hotel={hotel} large />
            <a className="ov-button" href="#rooms">
              Выбрать номер <ArrowRight size={17} />
            </a>
          </div>
        </div>
        <div className="ov-hotel-mosaic">
          <button
            className="ov-mosaic-main"
            onClick={() => openGallery(0)}
            aria-label="Открыть фотографии отеля"
          >
            <img src={hotel.photos[0]} alt={hotel.name} fetchPriority="high" />
            <span>
              <Camera size={17} />
              Все фотографии
            </span>
          </button>
          <div className="ov-mosaic-secondary">
            {hotel.photos.slice(1, 3).map((image, i) => (
              <button
                key={image}
                onClick={() => openGallery(i + 1)}
                aria-label={`Открыть фотографию ${i + 2}`}
              >
                <img src={image} alt={`${hotel.name}, фото ${i + 2}`} />
                {i === 1 && (
                  <span>
                    <SquaresFour size={19} />
                    {hotel.photos.length} фото
                  </span>
                )}
              </button>
            ))}
          </div>
          <aside className="ov-hotel-overview">
            <div className="ov-overview-source">
              <span>
                <ShieldCheck size={28} />
              </span>
              <div>
                <h3>Знакомьтесь с отелем</h3>
                <p>Фотографии из официальной галереи</p>
              </div>
            </div>
            <div className="ov-overview-amenities">
              {hotel.amenities.slice(0, 4).map((item) => {
                const Icon = amenityIcons[item] || Check;
                return (
                  <span key={item}>
                    <Icon size={19} />
                    {item}
                  </span>
                );
              })}
            </div>
            <div className="ov-overview-location">
              <MapPin size={20} />
              <div>
                <b>Расположение</b>
                <span>{hotel.distance}</span>
                {hotel.beach && <span>{hotel.beach}</span>}
              </div>
            </div>
            <div className="ov-overview-price">
              <span>
                от <b>{money(hotel.price)}</b> за ночь
              </span>
              <a href="#rooms" className="ov-button">
                Посмотреть номера
              </a>
            </div>
          </aside>
        </div>
        <DemoNote />
        <nav className="ov-hotel-tabs" aria-label="Об отеле">
          <a href="#rooms">Номера</a>
          <a href="#location">Расположение</a>
          <a href="#about">Описание</a>
          <a href="#amenities">Удобства</a>
          <a href="#policies">Условия проживания</a>
        </nav>
        <div className="ov-hotel-body">
          <div>
            <section id="rooms" className="ov-detail-section">
              <div className="ov-section-heading">
                <div>
                  <h2>Доступные номера</h2>
                  <p>
                    {shortDate(state.checkin)} — {shortDate(state.checkout)} ·{" "}
                    {count} {plural(count, ["ночь", "ночи", "ночей"])} ·{" "}
                    {state.adults + state.children}{" "}
                    {plural(state.adults + state.children, [
                      "гость",
                      "гостя",
                      "гостей",
                    ])}
                  </p>
                </div>
              </div>
              <div className="ov-room-filters">
                <label className="ov-checkbox">
                  <input
                    type="checkbox"
                    checked={breakfast}
                    onChange={(event) => setBreakfast(event.target.checked)}
                  />
                  <Coffee size={19} />
                  <span>С завтраком</span>
                </label>
                <span>
                  <Info size={15} />
                  Категории и тарифы для демонстрации
                </span>
              </div>
              {roomTypes.map((room, i) => (
                <article className="ov-room" key={room.name}>
                  <div className="ov-room-top">
                    <div className="ov-room-photo">
                      {hotel.roomPhoto ? (
                        <img
                          src={hotel.roomPhoto}
                          alt="Фотография номера из галереи отеля"
                        />
                      ) : (
                        <div>
                          <Bed size={36} />
                          <span>
                            Фотография номера
                            <br />
                            пока не добавлена
                          </span>
                        </div>
                      )}
                    </div>
                    <div className="ov-room-description">
                      <span className="ov-room-category">Демо-категория</span>
                      <h3>{room.name}</h3>
                      <span>
                        <SquaresFour size={16} />
                        {room.size} м²
                      </span>
                      <span>
                        <Bed size={17} />
                        {room.beds}
                      </span>
                      <div className="ov-room-chips">
                        <span>
                          <WifiHigh size={15} />
                          Wi-Fi
                        </span>
                        <span>
                          <Snowflake size={15} />
                          Кондиционер
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className="ov-room-rate">
                    <div>
                      <span className="ov-room-meal">
                        <Coffee size={18} />
                        {breakfast ? "Завтрак включён" : "Без питания"}
                      </span>
                      <span className="ov-rate-cancel">
                        <Check size={17} />
                        Бесплатная отмена
                      </span>
                      <span className="ov-rate-payment">Оплата в отеле</span>
                      <small>Демонстрационные условия тарифа</small>
                    </div>
                    <div className="ov-room-total">
                      <strong>{money(total(i))}</strong>
                      <span>
                        за {count} {plural(count, ["ночь", "ночи", "ночей"])} ·{" "}
                        {state.rooms}{" "}
                        {plural(state.rooms, ["номер", "номера", "номеров"])}
                      </span>
                      <small>{money(roomPrice(i))} за ночь</small>
                    </div>
                    <button
                      className="ov-button"
                      onClick={() => {
                        setBooking(i);
                        setSaved(false);
                      }}
                    >
                      Выбрать <ArrowRight size={17} />
                    </button>
                  </div>
                </article>
              ))}
            </section>
            <section id="location" className="ov-detail-section">
              <h2>Расположение</h2>
              <p className="ov-location-address">
                <MapPin size={19} />
                {hotel.address}
              </p>
              <div className="ov-detail-map">
                <DemoMap hotels={[hotel]} query={params.toString()} />
              </div>
              <div className="ov-location-facts">
                <span>
                  <Buildings size={22} />
                  <b>{hotel.distance}</b>
                </span>
                {hotel.beach && (
                  <span>
                    <MapPin size={22} />
                    <b>{hotel.beach}</b>
                  </span>
                )}
              </div>
              <small className="ov-muted">
                Схема и расстояния демонстрационные. Адрес взят с официального
                сайта отеля.
              </small>
            </section>
            <section id="about" className="ov-detail-section">
              <h2>Описание отеля</h2>
              <h3>Расположение</h3>
              <p>
                «{hotel.name}» расположен по адресу: {hotel.address}. Посмотрите
                фотографии из официальной галереи, сравните демо-тарифы и
                сохраните понравившийся вариант.
              </p>
              <h3>Об отеле</h3>
              <p>{hotel.description}</p>
              <a
                href={hotel.source}
                className="ov-source-link"
                target="_blank"
                rel="noreferrer"
              >
                Официальный сайт отеля <ArrowRight size={16} />
              </a>
            </section>
            <section id="amenities" className="ov-detail-section">
              <h2>Услуги и удобства</h2>
              <div className="ov-all-amenities">
                {hotel.amenities.map((item) => {
                  const Icon = amenityIcons[item] || Check;
                  return (
                    <div key={item}>
                      <Icon size={24} />
                      <span>{item}</span>
                    </div>
                  );
                })}
              </div>
              <p className="ov-muted">
                Список удобств демонстрационный. Перед реальной поездкой условия
                необходимо уточнить у отеля.
              </p>
            </section>
            <section id="policies" className="ov-detail-section">
              <h2>Условия проживания</h2>
              <div className="ov-policy-times">
                <div>
                  <span>Заезд</span>
                  <b>После 15:00</b>
                </div>
                <div>
                  <span>Выезд</span>
                  <b>До 12:00</b>
                </div>
              </div>
              <p className="ov-muted">
                Время заезда, выезда и условия отмены приведены для демонстрации
                интерфейса.
              </p>
              <h3>Важная информация</h3>
              <p>
                Цены и наличие номеров в этом прототипе не связаны с реальной
                системой бронирования. Выбор номера сохраняется локально в вашем
                браузере.
              </p>
            </section>
          </div>
          <aside className="ov-detail-sidebar">
            <div className="ov-trip-summary">
              <span className="ov-kicker">Ваша поездка</span>
              <h3>{hotel.city}</h3>
              <span>
                {shortDate(state.checkin)} — {shortDate(state.checkout)}
              </span>
              <span>
                {state.adults}{" "}
                {plural(state.adults, ["взрослый", "взрослых", "взрослых"])}
                {state.children > 0 &&
                  ` · ${state.children} ${plural(state.children, ["ребёнок", "ребёнка", "детей"])}`}{" "}
                · {state.rooms}{" "}
                {plural(state.rooms, ["номер", "номера", "номеров"])}
              </span>
              <hr />
              <div>
                от <b>{money((hotel.price ?? 0) * count * state.rooms)}</b>
              </div>
              <small>за всё проживание</small>
              <a className="ov-button" href="#rooms">
                Выбрать номер
              </a>
              <span className="ov-summary-note">
                <ShieldCheck size={17} />
                Без оплаты в демо
              </span>
            </div>
            <div className="ov-detail-help">
              <Headset size={26} />
              <h3>Особые пожелания?</h3>
              <p>
                Расскажите о желаемом отдыхе на главной, чтобы подобрать
                подходящий отель.
              </p>
              <Link href="/#trip-request">
                Подобрать по пожеланиям <ArrowRight size={16} />
              </Link>
            </div>
          </aside>
        </div>
      </div>
      <Modal
        title={`Фотографии · ${hotel.name}`}
        open={gallery}
        onOpenChange={setGallery}
        wide
        onKeyDown={(event) => {
          if (event.key === "ArrowRight") {
            event.preventDefault();
            setPhoto((photo + 1) % hotel.photos.length);
          }
          if (event.key === "ArrowLeft") {
            event.preventDefault();
            setPhoto((photo + hotel.photos.length - 1) % hotel.photos.length);
          }
        }}
      >
        <div className="ov-gallery">
          <div className="ov-gallery-stage">
            <img
              src={hotel.photos[photo]}
              alt={`${hotel.name}, фото ${photo + 1}`}
            />
            <button
              className="ov-gallery-prev"
              aria-label="Предыдущее фото"
              onClick={() =>
                setPhoto(
                  (photo + hotel.photos.length - 1) % hotel.photos.length,
                )
              }
            >
              <CaretLeft size={25} />
            </button>
            <button
              className="ov-gallery-next"
              aria-label="Следующее фото"
              onClick={() => setPhoto((photo + 1) % hotel.photos.length)}
            >
              <CaretRight size={25} />
            </button>
          </div>
          <div className="ov-gallery-thumbs">
            {hotel.photos.map((src, i) => (
              <button
                className={i === photo ? "is-active" : ""}
                key={src}
                aria-label={`Показать фото ${i + 1}`}
                aria-pressed={i === photo}
                onClick={() => setPhoto(i)}
              >
                <img src={src} alt="" />
              </button>
            ))}
            <span>
              {photo + 1} / {hotel.photos.length}
            </span>
          </div>
          <p>Фотографии официальной галереи отеля.</p>
        </div>
      </Modal>
      <Modal title="Расположение отеля" open={map} onOpenChange={setMap} wide>
        <p>{hotel.address}</p>
        <div className="ov-modal-map">
          <DemoMap hotels={[hotel]} query={params.toString()} />
        </div>
        <p className="ov-muted">
          Это локальная демонстрационная схема, а не географическая карта.
        </p>
      </Modal>
      <Modal
        title={saved ? "Вариант сохранён" : "Ваш выбор"}
        open={booking !== null}
        onOpenChange={(value) => {
          if (!value) setBooking(null);
        }}
      >
        {booking !== null &&
          (saved ? (
            <div className="ov-booking-success">
              <span>
                <Check size={36} />
              </span>
              <h3>Можно возвращаться к планам</h3>
              <p>
                Выбранный номер сохранён в этом браузере, а отель добавлен в
                избранное. Реальное бронирование не оформляется.
              </p>
              <Link
                href="/favorites"
                className="ov-button"
                onClick={() => setBooking(null)}
              >
                Открыть избранное <ArrowRight size={18} />
              </Link>
            </div>
          ) : (
            <div className="ov-booking">
              <h3>{hotel.name}</h3>
              <p>{roomTypes[booking].name}</p>
              <div>
                <span>Даты</span>
                <b>
                  {shortDate(state.checkin)} — {shortDate(state.checkout)}
                </b>
              </div>
              <div>
                <span>Гости и номера</span>
                <b>
                  {state.adults + state.children}{" "}
                  {plural(state.adults + state.children, [
                    "гость",
                    "гостя",
                    "гостей",
                  ])}{" "}
                  · {state.rooms}{" "}
                  {plural(state.rooms, ["номер", "номера", "номеров"])}
                </b>
              </div>
              <div>
                <span>Питание</span>
                <b>{breakfast ? "С завтраком" : "Без питания"}</b>
              </div>
              <div className="ov-booking-total">
                <span>За всё проживание</span>
                <b>{money(total(booking))}</b>
              </div>
              <p className="ov-muted">
                Сохраните вариант для своей поездки. Оплата и настоящее
                бронирование в демо недоступны.
              </p>
              <button
                className="ov-button"
                onClick={() => {
                  try {
                    localStorage.setItem(
                      "ostrovok-demo-room-v1",
                      JSON.stringify({
                        hotelId: hotel.id,
                        room: roomTypes[booking].name,
                        state,
                        breakfast,
                        total: total(booking),
                      }),
                    );
                    if (!ids.includes(hotel.id)) toggle(hotel.id);
                    setSaved(true);
                  } catch {
                    setSaved(false);
                  }
                }}
              >
                Сохранить выбор <Check size={18} />
              </button>
            </div>
          ))}
      </Modal>
    </>
  );
}
