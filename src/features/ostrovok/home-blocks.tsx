"use client";
import { useState } from "react";
import { ArrowRight, CaretRight, X } from "@phosphor-icons/react";
import type { Hotel } from "./catalog";
import { useCatalog } from "@/features/planner/catalog-provider";
import { useAccount } from "@/features/planner/account-provider";
import { HotelPhoto } from "@/features/planner/recommendation-card";
import { money } from "./search-state";
import { Modal } from "./shared";

export function AutumnOffers() {
  const hotels = useCatalog();
  const auth = useAccount();
  const [guru, setGuru] = useState(false);
  const picks = [
    ...hotels.filter((h) => h.photos.length),
    ...hotels.filter((h) => !h.photos.length),
  ].slice(0, 3);
  const hotelCard = (hotel: Hotel) => (
    <article className="ov-autumn-hotel" key={hotel.id}>
      <div className="ov-image-window">
        <HotelPhoto photos={hotel.photos} name={hotel.name} />
      </div>
      <div className="ov-autumn-caption">
        <span
          className="ov-autumn-stars"
          aria-label={`${hotel.stars} звёзд, демо`}
        >
          {"★".repeat(hotel.stars)}
        </span>
        <h3>{hotel.name}</h3>
        <p>{hotel.city}</p>
        <strong>
          {hotel.price === null ? money(null) : `от ${money(hotel.price)}`}
        </strong>
      </div>
    </article>
  );
  return (
    <section
      className="ov-home-section ov-autumn"
      aria-labelledby="autumn-title"
    >
      <div className="ov-editorial-heading">
        <h2 id="autumn-title">Отели для осенней поездки</h2>
        <p>300 карточек Петербурга с описаниями и сведениями об окружении</p>
      </div>
      <div className="ov-autumn-grid">
        {picks[0] && hotelCard(picks[0])}
        <article className="ov-guru-promo">
          <h3>Сохраните планы на поездку</h3>
          <p>
            Войдите в аккаунт
            <br />и выбирайте отель вместе
          </p>
          <img
            src="/ostrovok/guru-suitcase-original.webp"
            alt=""
            loading="lazy"
          />
          <button onClick={() => auth.openLogin()}>
            Авторизоваться <ArrowRight size={17} />
          </button>
        </article>
        {picks.slice(1).map(hotelCard)}
      </div>
      <span className="ov-editorial-note">
        Демонстрационные предложения из нашего каталога
      </span>
      <Modal title="Путешествуйте с ГУРУ" open={guru} onOpenChange={setGuru}>
        <p>
          На Островке участники программы ГУРУ получают специальные предложения
          и скидки.
        </p>
        <p>
          В нашем локальном прототипе представлены демонстрационные цены. Вход в
          программу лояльности и настоящее бронирование пока не подключены.
        </p>
        <button className="ov-button" onClick={() => setGuru(false)}>
          Понятно
        </button>
      </Modal>
    </section>
  );
}

const mysteries = [
  {
    image: "/ostrovok/mystic-egypt.jpg",
    alt: "Египетские пирамиды под звёздным небом",
    title: "Мистика Долины Царей в Луксоре",
  },
  {
    image: "/ostrovok/mystic-nesvizh.jpg",
    alt: "Несвижский замок в вечернем свете",
    title: "Призрак Чёрной дамы в окрестностях Минска",
  },
  {
    image: "/ostrovok/mystic-amberd.jpg",
    alt: "Крепость Амберд в тумане",
    title: "Туманная крепость Амберд под Ереваном",
  },
];
export function MysticRoutes() {
  return (
    <section
      className="ov-home-section ov-mystic"
      aria-labelledby="mystic-title"
    >
      <div className="ov-editorial-heading">
        <h2 id="mystic-title">Маршруты мистических историй</h2>
      </div>
      <div className="ov-mystic-grid">
        {mysteries.map((item) => (
          <article className="ov-mystic-card" key={item.title}>
            <img src={item.image} alt={item.alt} loading="lazy" />
            <div className="ov-editorial-shade" />
            <h3>{item.title}</h3>
          </article>
        ))}
      </div>
    </section>
  );
}

const halloweenHotels = [
  {
    name: "Отель Нессельбек",
    city: "Калининград",
    price: 7712,
    image: "/ostrovok/halloween-nesselbeck.jpg",
    alt: "Отель Нессельбек в виде средневекового замка",
  },
  {
    name: "Отель Alpine Castle",
    city: "Дилижан",
    price: 6988,
    image: "/ostrovok/halloween-alpine.jpg",
    alt: "Фахверковая башня отеля Alpine Castle",
  },
  {
    name: "Замок La Ferme De Reve",
    city: "Москва",
    price: 16102,
    image: "/ostrovok/halloween-ferme.jpg",
    alt: "Каменный замок La Ferme De Reve на зелёной лужайке",
  },
];
export function HalloweenStays() {
  const auth = useAccount();
  const [guru, setGuru] = useState(false);
  return (
    <section className="ov-halloween" aria-labelledby="halloween-title">
      <div className="ov-halloween-backdrop" aria-hidden="true" />
      <div className="ov-halloween-inner">
        <h2 className="ov-halloween-title" id="halloween-title">
          Где провести самую таинственную ночь в году
        </h2>
        <div className="ov-halloween-grid">
          {halloweenHotels.map((hotel) => (
            <article className="ov-halloween-hotel" key={hotel.name}>
              <div className="ov-image-window">
                <img src={hotel.image} alt={hotel.alt} loading="lazy" />
              </div>
              <div className="ov-halloween-caption">
                <h3>{hotel.name}</h3>
                <p>{hotel.city}</p>
                <strong>
                  {hotel.price === null
                    ? money(null)
                    : `от ${money(hotel.price)}`}
                </strong>
              </div>
            </article>
          ))}
          <article className="ov-halloween-guru">
            <h3>Подарки участникам программы ГУРУ</h3>
            <p>от завтрака до спа</p>
            <img
              src="/ostrovok/guru-breakfast-original.webp"
              alt=""
              loading="lazy"
            />
            <button onClick={() => auth.openLogin()}>
              Авторизоваться <ArrowRight size={17} />
            </button>
          </article>
        </div>
      </div>
      <Modal
        title="Подарки с программой ГУРУ"
        open={guru}
        onOpenChange={setGuru}
      >
        <p>
          Участники программы ГУРУ на Островке получают специальные предложения:
          от завтраков до дополнительных услуг в отеле.
        </p>
        <p>
          В локальном прототипе показан пример такой подборки. Настоящее
          бронирование не подключены.
        </p>
        <button className="ov-button" onClick={() => setGuru(false)}>
          Понятно
        </button>
      </Modal>
    </section>
  );
}

const foods = [
  {
    id: "kazan",
    country: "Россия",
    city: "Казань",
    price: 1700,
    image: "/ostrovok/food-kazan.jpg",
    alt: "Татарские эчпочмаки с мясом и картофелем",
    groups: ["Россия", "Восточный колорит", "Локальные открытия"],
    position: "center",
  },
  {
    id: "istanbul",
    country: "Турция",
    city: "Стамбул",
    price: 2700,
    image: "/ostrovok/food-istanbul.jpg",
    alt: "Искандер-кебаб по-турецки",
    groups: ["Кулинарная классика", "Дары моря", "Восточный колорит"],
    position: "center",
  },
  {
    id: "beijing",
    country: "Китай",
    city: "Пекин",
    price: 2100,
    image: "/ostrovok/food-beijing.jpg",
    alt: "Утка по-пекински с тонкими блинчиками и соусом",
    groups: ["Кулинарная классика", "Восточный колорит"],
    position: "center",
  },
  {
    id: "petersburg",
    country: "Россия",
    city: "Санкт-Петербург",
    price: 1300,
    image: "/ostrovok/food-petersburg.jpg",
    alt: "Ленинградский рассольник",
    groups: ["Россия", "Дары моря"],
    position: "center",
  },
  {
    id: "belgrade",
    country: "Сербия",
    city: "Белград",
    price: 3200,
    image: "/ostrovok/food-belgrade.jpg",
    alt: "Сербская плескавица с лепёшкой и овощами",
    groups: ["Кулинарная классика", "Локальные открытия"],
    position: "center",
  },
];
const foodCategories = [
  "Россия",
  "Кулинарная классика",
  "Дары моря",
  "Восточный колорит",
  "Локальные открытия",
];
export function GastroNotes() {
  const [category, setCategory] = useState<string | null>(null);
  const [offset, setOffset] = useState(0);
  const selected = category
    ? foods.filter((item) => item.groups.includes(category))
    : foods;
  const ordered = [
    ...selected.slice(offset % selected.length),
    ...selected.slice(0, offset % selected.length),
  ];
  return (
    <section
      className="ov-home-section ov-gastro"
      aria-labelledby="gastro-title"
    >
      <div className="ov-editorial-heading">
        <h2 id="gastro-title">Записки гастрономического туриста</h2>
        <p>
          Плескавица, мапо тофу, эчпочмак... Для каждого блюда свой маршрут!
        </p>
      </div>
      <div
        className="ov-food-categories"
        role="group"
        aria-label="Гастрономические направления"
      >
        {foodCategories.map((item) => (
          <button
            key={item}
            className={category === item ? "is-active" : ""}
            aria-pressed={category === item}
            onClick={() => {
              setCategory(category === item ? null : item);
              setOffset(0);
            }}
          >
            {item}
          </button>
        ))}
        {category && (
          <button
            className="ov-food-reset"
            onClick={() => setCategory(null)}
            aria-label="Все гастрономические направления"
          >
            <X size={16} />
          </button>
        )}
      </div>
      <div className="ov-food-slider">
        <div className="ov-food-track" aria-live="polite">
          {ordered.map((item) => (
            <article className="ov-food-card" key={item.id}>
              <img
                src={item.image}
                alt={item.alt}
                loading="lazy"
                style={{ objectPosition: item.position }}
              />
              <div className="ov-editorial-shade" />
              <div className="ov-food-caption">
                <h3>{item.city}</h3>
                <span>от {money(item.price)}</span>
              </div>
            </article>
          ))}
        </div>
        {selected.length > 1 && (
          <button
            className="ov-carousel-next"
            aria-label="Следующее гастрономическое направление"
            onClick={() => setOffset(offset + 1)}
          >
            <CaretRight size={24} />
          </button>
        )}
      </div>
      <span className="ov-editorial-note">
        Идеи для путешествий · цены в карточках демонстрационные
      </span>
    </section>
  );
}

const posts = [
  {
    id: "souvenirs",
    image: "/ostrovok/blog-souvenirs.jpg",
    href: "https://blog.ostrovok.ru/chto-privezti-iz-sankt-peterburga/",
    title: "От фарфора до сладостей: какие сувениры привезти из Петербурга",
    category: "О!Лайфхаки",
    date: "23.10.2026",
    datetime: "2026-10-23",
  },
  {
    id: "cancellation",
    image: "/ostrovok/blog-cancellation.jpg",
    href: "https://blog.ostrovok.ru/kak-besplatno-otmenit-bronirovanie/",
    title:
      "План перестроен: как бесплатно отменить бронирование отеля на Островке",
    category: "О!Лайфхаки",
    date: "22.10.2026",
    datetime: "2026-10-22",
  },
  {
    id: "farms",
    image: "/ostrovok/blog-farms.jpg",
    href: "https://blog.ostrovok.ru/agroturizm-v-rossii/",
    title:
      "Доить коров, варить сыр: 10 ферм и экоотелей для агротуризма в России",
    category: "О!Жильё",
    date: "20.10.2026",
    datetime: "2026-10-20",
  },
  {
    id: "mongolia",
    image: "/ostrovok/blog-mongolia.jpg",
    href: "https://blog.ostrovok.ru/ulan-batoru/",
    title: "О, Монголия: гид по Улан-Батору и окрестностям",
    category: "О!Места",
    date: "16.10.2026",
    datetime: "2026-10-16",
  },
];
export function TravelBlog() {
  const [selectedPost, setSelectedPost] = useState<
    (typeof posts)[number] | null
  >(null);
  return (
    <section className="ov-home-section ov-blog" aria-labelledby="blog-title">
      <div className="ov-editorial-heading">
        <h2 id="blog-title">О!Блог</h2>
        <p>
          Базовый минимум, роскошный максимум и другие идеи для ваших поездок
        </p>
      </div>
      <div className="ov-blog-grid">
        {posts.map((post) => (
          <article className={`ov-blog-card ov-blog-${post.id}`} key={post.id}>
            <img src={post.image} alt="" loading="lazy" />
            <div className="ov-editorial-shade" />
            <div className="ov-blog-caption">
              <h3>
                <button
                  className="ov-blog-title-button"
                  onClick={() => setSelectedPost(post)}
                >
                  {post.title}
                </button>
              </h3>
              <div>
                <span>{post.category}</span>
                <time dateTime={post.datetime}>{post.date}</time>
              </div>
            </div>
          </article>
        ))}
        <a
          className="ov-blog-more"
          href="https://blog.ostrovok.ru/"
          target="_blank"
          rel="noreferrer"
        >
          <span>
            Больше статей
            <br />
            про путешествия
          </span>
          <CaretRight size={29} />
        </a>
      </div>
      <Modal
        title={selectedPost?.title || "О!Блог"}
        open={selectedPost !== null}
        onOpenChange={(open) => {
          if (!open) setSelectedPost(null);
        }}
      >
        {selectedPost && (
          <>
            <img
              className="ov-blog-article-preview"
              src={selectedPost.image}
              alt=""
            />
            <p>
              {selectedPost.category} · {selectedPost.date}
            </p>
            <a
              className="ov-button"
              href={selectedPost.href}
              target="_blank"
              rel="noreferrer"
            >
              Читать статью <ArrowRight size={17} />
            </a>
          </>
        )}
      </Modal>
    </section>
  );
}
