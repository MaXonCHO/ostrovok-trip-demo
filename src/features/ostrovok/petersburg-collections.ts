export interface Collection {
  id: string;
  title: string;
  description: string;
  image: string;
  href: string;
  tags: string[];
}

// Editorial inspiration from O!Blog, not verified amenities of catalog hotels.
// Source titles, publication dates and original photographs are recorded in
// public/ostrovok/collections/sources.json. Time-sensitive offers are omitted.
export const petersburgCollections: Collection[] = [
  {
    id: "spb-weekend",
    title: "Петербург на выходные",
    description:
      "Короткая поездка с небанальными местами, новыми впечатлениями и временем на отдых.",
    image: "/ostrovok/collections/spb-weekend.jpg",
    href: "https://blog.ostrovok.ru/peterburg-na-vykhodnye/",
    tags: [
      "выходные",
      "короткая поездка",
      "необычные места",
      "впечатления",
      "прогулки",
    ],
  },
  {
    id: "spb-food",
    title: "Куда сходить поесть в Питере",
    description:
      "Завтраки, кофейни и петербургские рестораны — гастрономия в центре вашей поездки.",
    image: "/ostrovok/collections/spb-food.jpg",
    href: "https://blog.ostrovok.ru/kuda-sxodit-poest-v-pitere/",
    tags: ["еда", "рестораны", "завтраки", "кофе", "гастрономия", "бары"],
  },
  {
    id: "spb-romance",
    title: "Петербург для двоих",
    description:
      "Время вдвоём, неспешное утро и красивые вечера — настрой для романтической поездки.",
    image: "/ostrovok/collections/spb-romance.jpg",
    href: "https://blog.ostrovok.ru/romantika-v-rossijskix-otelyax/",
    tags: [
      "романтика",
      "вдвоём",
      "пара",
      "свидание",
      "ужин",
      "спокойный отдых",
    ],
  },
  {
    id: "spb-museums",
    title: "10 необычных музеев Петербурга",
    description:
      "Музеи, выставки и культурные маршруты — Петербург для тех, кто любит узнавать новое.",
    image: "/ostrovok/collections/spb-museums.jpg",
    href: "https://blog.ostrovok.ru/10-neobychnyx-muzeev-sankt-peterburga/",
    tags: [
      "музеи",
      "культура",
      "искусство",
      "история",
      "необычные места",
      "в помещении",
      "дождь",
    ],
  },
  {
    id: "spb-family",
    title: "Петербург с детьми",
    description:
      "Семейная поездка с планетарием, интерактивными музеями и впечатлениями для детей и взрослых.",
    image: "/ostrovok/collections/spb-family.jpg",
    href: "https://blog.ostrovok.ru/otdyh-na-osennih-kanikulah-2025/",
    tags: [
      "семья",
      "дети",
      "с ребёнком",
      "каникулы",
      "интерактивные музеи",
      "планетарий",
    ],
  },
  {
    id: "spb-walks",
    title: "Прогулки по Петербургу",
    description:
      "Пешие маршруты по центру, набережные и парки — знакомство с городом в своём темпе.",
    image: "/ostrovok/collections/spb-walks.jpg",
    href: "https://blog.ostrovok.ru/dostoprimechatelnosti-sankt-peterburga/",
    tags: [
      "прогулки",
      "достопримечательности",
      "архитектура",
      "первый визит",
      "парки",
      "пешком",
    ],
  },
  {
    id: "spb-free",
    title: "Бесплатный Петербург",
    description:
      "Больше впечатлений при небольшом бюджете: прогулки, галереи и культурные пространства.",
    image: "/ostrovok/collections/spb-free.jpg",
    href: "https://blog.ostrovok.ru/besplatnyj-sankt-peterburg/",
    tags: [
      "бесплатно",
      "бюджет",
      "экономно",
      "культура",
      "галереи",
      "необычные места",
    ],
  },
  {
    id: "spb-autumn",
    title: "Осенний Петербург",
    description:
      "Осенние парки, оранжереи и уютные пространства — неспешная поездка в прохладную погоду.",
    image: "/ostrovok/collections/spb-autumn.jpg",
    href: "https://blog.ostrovok.ru/10-idej-chem-zanyatsya-v-sankt-peterburge-osenyu/",
    tags: [
      "осень",
      "уют",
      "парки",
      "оранжереи",
      "арт-пространства",
      "прохладная погода",
    ],
  },
];
