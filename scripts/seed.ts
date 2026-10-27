import { writeFileSync } from "node:fs";
import realHotels from "../src/data/fixtures/real-hotels.json";
import type {
  Hotel,
  Place,
  MediaAsset,
  Evidence,
  Interest,
} from "../src/domain/models";
let seed = 271026;
const random = () => {
  seed = (seed * 1664525 + 1013904223) >>> 0;
  return seed / 4294967296;
};
const media = (
  id: string,
  kind: MediaAsset["kind"],
  label: string,
  roomTypeId?: string,
): MediaAsset => ({
  id,
  path: `/demo/${id}.jpg`,
  kind,
  label,
  roomTypeId,
  source: "Unsplash, см. /demo/manifest.json",
  license: "Unsplash License",
  illustrative: true,
});
const names = [
  "Бриз на набережной",
  "Двор у платанов",
  "Линия моря",
  "Сад и терраса",
  "Портовый квартал",
  "Тихая роща",
  "Белый берег",
  "Вилла Камелия",
  "Морской переулок",
  "Дом на Ривьере",
  "Листва",
  "Южный свет",
];
const hotels: Hotel[] = names.map((name, i) => {
  const areaId = ["center", "sea", "quiet"][i % 3];
  const roomId = `h${i + 1}-standard`;
  const interests: Interest[] =
    areaId === "center"
      ? ["food", "italian", "sights", "walks"]
      : areaId === "sea"
        ? ["sea", "walks", "food"]
        : ["quiet", "nature"];
  const evidence: Evidence[] = [
    {
      id: `e-h${i + 1}-walk`,
      featureKey: "seaWalk",
      scope: { hotelId: `h${i + 1}` },
      value: i === 0 ? 27 : 8 + (i + 1) * 2,
      source: { kind: "fixture", name: "Демонстрационная геометрия маршрута" },
      isSynthetic: true,
      confidence: null,
      status: "demo",
      observedAt: "2026-10-27T00:00:00Z",
      method: "Подготовленный маршрут, не измерение на местности",
    },
    {
      id: `e-h${i + 1}-quiet`,
      featureKey: "quiet",
      scope: { hotelId: `h${i + 1}` },
      value: i === 2 ? null : areaId === "quiet",
      source: { kind: "review", name: "Синтетические фрагменты отзывов" },
      isSynthetic: true,
      confidence: null,
      status: i === 2 ? "uncertain" : i === 0 ? "conflicting" : "demo",
      observedAt: "2026-08-01T00:00:00Z",
      ...(i === 0 ? { conflictsWith: ["e-h1-windows"] } : {}),
    },
    ...(i === 0
      ? [
          {
            id: "e-h1-windows",
            featureKey: "windowSide",
            scope: { hotelId: "h1", roomTypeId: roomId },
            value: "во двор",
            source: {
              kind: "host" as const,
              name: "Демонстрационный ответ отельера",
            },
            isSynthetic: true,
            confidence: null,
            status: "conflicting" as const,
            observedAt: "2026-10-01T00:00:00Z",
            conflictsWith: ["e-h1-quiet"],
          },
        ]
      : []),
    {
      id: `e-h${i + 1}-breakfast`,
      featureKey: "breakfast",
      scope: { hotelId: `h${i + 1}` },
      value: "Завтрак с 8:00",
      source: { kind: "fixture", name: "Демонстрационный каталог" },
      isSynthetic: true,
      confidence: null,
      status: i === 3 ? "stale" : "demo",
      observedAt: "2025-01-01T00:00:00Z",
      validUntil: "2025-12-31T00:00:00Z",
    },
  ];
  return {
    id: `h${i + 1}`,
    cityId: "sochi",
    name,
    areaId,
    area: {
      center: "Прогулочный центр",
      sea: "Прибрежный квартал",
      quiet: "Зелёный тихий квартал",
    }[areaId]!,
    description:
      "Вымышленный отель для знакомства с подбором. Фотографии иллюстрируют атмосферу и категорию номера.",
    image: media(`exterior-${i + 1}`, "exterior", "Иллюстрация территории"),
    gallery: [
      media(`exterior-${i + 1}`, "exterior", "Иллюстрация территории"),
      media(`room-${i + 1}`, "room", "Иллюстрация номера «Стандарт»", roomId),
      media(`detail-${(i % 4) + 1}`, "detail", "Иллюстрация общих зон"),
    ],
    room: {
      id: roomId,
      name: "Стандарт с двуспальной кроватью",
      capacity: 2,
      images: [
        media(`room-${i + 1}`, "room", "Иллюстрация номера «Стандарт»", roomId),
      ],
      features: {
        windowSide: i === 0 ? "во двор" : null,
        airConditioning: true,
      },
    },
    price: i === 11 ? null : Math.round((4200 + random() * 7200) / 100) * 100,
    stars: 3 + (i % 3),
    rating: Math.round((7.6 + random() * 1.7) * 10) / 10,
    interests,
    walkMinutes: 6 + i * 2,
    seaMinutes: i === 0 ? 27 : 8 + (i + 1) * 2,
    quiet: i === 2 ? null : areaId === "quiet",
    tradeoff:
      areaId === "center"
        ? "Вечером со стороны улицы может быть шумно"
        : areaId === "sea"
          ? "До прогулочного центра удобнее доехать"
          : "До моря понадобится транспорт",
    evidence,
    reviewExcerpts: [
      {
        id: `r${i}`,
        objectId: `h${i + 1}`,
        language: "ru",
        date: "2026-08-01",
        rating: 8,
        scale: 10,
        text:
          areaId === "center"
            ? "Удобно выходить гулять и ужинать в центре. На оживлённую улицу лучше закрывать окна."
            : "Вечером было спокойно. Расстояния до центра стоит проверить до поездки.",
        topics: areaId === "center" ? ["walks", "quiet"] : ["quiet"],
        source: "Синтетический пример, не отзыв настоящего гостя",
        isSynthetic: true,
      },
    ],
  };
});
for (const [cityId, prefix] of [
  ["spb", "Каналы"],
  ["kazan", "Старый город"],
])
  for (let j = 0; j < 3; j++) {
    const h = structuredClone(hotels[j + 3]);
    h.id = `${cityId}-${j}`;
    h.cityId = cityId;
    h.name = `${prefix}: ${["Двор", "Набережная", "Сад"][j]}`;
    h.room.id = h.id + "-standard";
    h.room.images.forEach((a) => (a.roomTypeId = h.room.id));
    h.evidence = h.evidence.map((e) => ({
      ...e,
      id: `${h.id}-${e.featureKey}`,
      scope: { hotelId: h.id },
    }));
    h.interests = ["sights", "food", "walks", "quiet"];
    h.tradeoff = "В выходные рядом с главными улицами больше людей";
    hotels.push(h);
  }
const placeNames = [
  "Набережная у маяка",
  "Морской вокзал",
  "Парк «Ривьера»",
  "Сад у фонтана",
  "Итальянское бистро «Лимон»",
  "Паста-бар «Двор»",
  "Кофейня у платанов",
  "Городской пляж",
  "Прогулочная галерея",
  "Зелёная тропа",
  "Пиццерия «Тесто»",
  "Смотровая терраса",
  "Тихий сквер",
  "Исторический квартал",
  "Ресторан у порта",
  "Дендрарий",
  "Камерная выставка",
  "Пляжный променад",
];
const kinds: Place["kind"][] = [
  "sea",
  "sights",
  "nature",
  "nature",
  "italian",
  "italian",
  "food",
  "sea",
  "sights",
  "nature",
  "italian",
  "sights",
  "nature",
  "sights",
  "food",
  "nature",
  "sights",
  "sea",
];
const places: Place[] = placeNames.map((name, i) => ({
  id: `p${i + 1}`,
  cityId: "sochi",
  name,
  kind: kinds[i],
  description:
    "Демонстрационная точка сценария. Название и сведения приведены для примера.",
  minutes: 7 + i * 2,
  imageAssetId:
    kinds[i] === "sea"
      ? "sea"
      : kinds[i] === "nature"
        ? "nature"
        : kinds[i] === "italian"
          ? "italian"
          : kinds[i] === "food"
            ? "food"
            : "city",
}));
for (const cityId of ["spb", "kazan"])
  for (let i = 0; i < 6; i++)
    places.push({
      ...places[i],
      id: `${cityId}-p${i}`,
      cityId,
      name: [
        cityId === "spb" ? "Набережная канала" : "Кремлёвская набережная",
        "Исторический центр",
        "Городской парк",
        "Тихий сквер",
        "Итальянское бистро",
        "Кафе во дворе",
      ][i],
    });
const templates = [
  {
    id: "center",
    title: "Гулять, пробовать, открывать",
    summary: "Неспешное утро, архитектура и маленькие рестораны по пути.",
    image: "city",
    area: "center",
    interests: ["food", "italian", "sights", "walks"],
    day: [
      "Завтрак в кофейне у платанов",
      "Прогулка к морскому вокзалу",
      "Итальянское бистро и вечерняя набережная",
    ],
    tradeoff: "Центр оживлён даже вечером",
  },
  {
    id: "sea",
    title: "Просыпаться ближе к морю",
    summary: "Купаться без долгих сборов и встречать закат у воды.",
    image: "coast",
    area: "sea",
    interests: ["sea", "walks", "food"],
    day: ["Утро у воды", "Обед рядом с пляжем", "Закат на променаде"],
    tradeoff: "За архитектурой придётся съездить в центр",
  },
  {
    id: "quiet",
    title: "Замедлиться среди зелени",
    summary: "Тихий квартал, тенистые дорожки и день без спешки.",
    image: "nature",
    area: "quiet",
    interests: ["quiet", "nature"],
    day: [
      "Завтрак в саду",
      "Прогулка по зелёной тропе",
      "Ужин на тихой террасе",
    ],
    tradeoff: "К морю удобнее добираться транспортом",
  },
  {
    id: "food",
    title: "Знакомиться с городом на вкус",
    summary: "Небольшие бистро и локальная кухня становятся планом дня.",
    image: "food",
    area: "center",
    interests: ["food", "italian"],
    day: ["Кофе в квартале", "Обед в итальянском бистро", "Ужин у порта"],
    tradeoff: "В популярных местах стоит уточнять наличие столика",
  },
  {
    id: "nature",
    title: "Выбираться на природу",
    summary: "Зелёные маршруты днём и спокойное возвращение вечером.",
    image: "nature",
    area: "quiet",
    interests: ["nature", "walks"],
    day: ["Завтрак перед прогулкой", "Зелёная тропа", "Отдых в тихом квартале"],
    tradeoff: "Часть пути проходит с подъёмом",
  },
  {
    id: "slow",
    title: "Выходные без расписания",
    summary: "Свободные прогулки и время для случайных открытий.",
    image: "coast",
    area: "sea",
    interests: ["sea", "quiet"],
    day: ["Поздний завтрак", "Прогулка у воды", "Свободный вечер"],
    tradeoff: "Меньше достопримечательностей за один день",
  },
  {
    id: "culture",
    title: "Архитектура и камерные места",
    summary: "Детали старых улиц, небольшая выставка и хороший ужин.",
    image: "city",
    area: "center",
    interests: ["sights", "food"],
    day: ["Исторический квартал", "Камерная выставка", "Ужин в центре"],
    tradeoff: "Понадобится больше ходить пешком",
  },
  {
    id: "garden",
    title: "Сады и тихие вечера",
    summary: "День в зелени, отдых в номере и неспешный вечер.",
    image: "nature",
    area: "quiet",
    interests: ["quiet", "nature", "food"],
    day: ["Прогулка по парку", "Обед и отдых", "Вечер в саду"],
    tradeoff: "Активная вечерняя жизнь останется в другом районе",
  },
];
// Real identity and media are separate from the simulated recommendation inputs.
for (const real of realHotels) {
  const hotel = hotels.find((h) => h.id === real.id)!;
  hotel.name = real.name;
  hotel.area = real.address;
  hotel.description =
    "Настоящий объект из официального каталога. Фотографии относятся к этому отелю. Цена, доступность и параметры подбора демонстрационные.";
  hotel.gallery = real.assets as MediaAsset[];
  hotel.image = hotel.gallery[0];
  hotel.room.images = hotel.gallery.filter((a) => a.kind === "room");
  hotel.room.name = hotel.room.images.length
    ? "Номер из официальной галереи"
    : "Категория номера уточняется";
  hotel.room.features = { windowSide: null, airConditioning: null };
  hotel.rating = null;
  hotel.stars = 0;
  hotel.reviewExcerpts = [];
  hotel.tradeoff =
    "В демо подбор учитывает подготовленные параметры. Реальное время в пути и условия номера нужно подтвердить.";
  hotel.evidence.forEach((e) => {
    e.source.name = "Синтетический пример для проверки подбора";
    if (e.source.kind === "review") e.source.kind = "fixture";
  });
  hotel.evidence.push({
    id: "identity-" + hotel.id,
    featureKey: "identity",
    scope: { hotelId: hotel.id },
    value: hotel.name,
    source: {
      kind: "open_data",
      name: "Официальный сайт отеля",
      url: real.source,
    },
    isSynthetic: false,
    confidence: null,
    status: "supported",
    observedAt: "2026-10-27T00:00:00Z",
  });
}
writeFileSync(
  "src/data/fixtures/catalog.json",
  JSON.stringify({ seed: 271026, hotels, places, templates }, null, 2),
);
