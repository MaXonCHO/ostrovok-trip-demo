import source from "@/data/blog-articles.json";

export type BlogArticle = (typeof source)[number] & { views?: number };
export const blogArticles: BlogArticle[] = [...source].sort((a, b) =>
  b.date.localeCompare(a.date),
);
export const blogCategories = [
  ...new Map(source.map((a) => [a.category, a.categoryLabel])).entries(),
];
export const blogSections = [
  { id: "actual", label: "О!АКТУАЛОЧКА", categories: ["seasonal"] },
  { id: "housing", label: "О!ЖИЛЬЁ", categories: ["housing"] },
  { id: "places", label: "О!МЕСТА", categories: ["unusual", "nature"] },
  { id: "tips", label: "О!ЛАЙФХАКИ", categories: ["tips"] },
  { id: "experiences", label: "О!ВПЕЧАТЛЕНИЯ", categories: ["food", "family"] },
  { id: "guides", label: "ПУТЕВОДИТЕЛИ", categories: ["routes"] },
];
// The parser's broad topic is retained as source metadata. A small editorial
// override separates news from evergreen places and accommodation from nature.
// Slugs are intentional: title keywords alone can misclassify historical guides.
const sectionOverrides: Record<string, string> = {
  "na-zavode-lada-v-peterburge-nachali-provodit-ekskursii": "actual",
  "v-pitere-zapustili-novyj-ekomarshrut-edem-gulyat-na-novyj-uchastok-ozyornoj-tropy":
    "actual",
  "10-glempingov-ryadom-s-peterburgom": "housing",
};
export function sectionForBlogArticle(article: BlogArticle) {
  return (
    sectionOverrides[article.slug] ??
    blogSections.find((section) =>
      section.categories.includes(article.category),
    )?.id
  );
}
export function filterBlogSection(query: string, section: string) {
  const knownSection = blogSections.some((s) => s.id === section);
  return filterBlogArticles(query, "all").filter(
    (article) => !knownSection || sectionForBlogArticle(article) === section,
  );
}
const collectionDetails: Record<
  string,
  { title: string; description: string; featured: string }
> = {
  actual: {
    title: "Сезонные идеи и новости путешествий",
    description:
      "Открытия, новые маршруты и идеи для разных сезонов. У каждого материала указана дата публикации: программы и доступность мест могут меняться.",
    featured: "10-idej-chem-zanyatsya-v-sankt-peterburge-osenyu",
  },
  housing: {
    title: "Места, в которых хочется остаться",
    description:
      "Апартаменты, исторические интерьеры и районы с характером. Найдите свой способ почувствовать город.",
    featured: "gde-luchshe-ostanovitsya-v-sankt-peterburge",
  },
  places: {
    title: "За пределами привычных маршрутов",
    description:
      "Необычные музеи, красивые виды и тихие тропы. Идеи для тех, кто любит открывать новое.",
    featured: "peterburg-na-vykhodnye",
  },
  tips: {
    title: "Маленькие секреты большой поездки",
    description:
      "Где искать впечатления без лишних трат и что привезти домой, чтобы сохранить воспоминания.",
    featured: "besplatnyj-sankt-peterburg",
  },
  experiences: {
    title: "Впечатления, которые остаются с вами",
    description:
      "Авторская кухня, любимые кофейни местных и открытия всей семьёй. Выбирайте, чем наполнить путешествие.",
    featured: "chto-poprobovat-v-peterburge",
  },
  guides: {
    title: "Ваш следующий маршрут",
    description:
      "Городские прогулки, дворцы и короткие поездки за город. Готовые идеи для новых историй.",
    featured: "dostoprimechatelnosti-sankt-peterburga",
  },
};
export function groupBlogCollections(query: string, section: string) {
  const visible = filterBlogSection(query, section);
  return blogSections.flatMap((group) => {
    const members = visible.filter(
      (article) => sectionForBlogArticle(article) === group.id,
    );
    if (!members.length) return [];
    const details = collectionDetails[group.id];
    // Source data currently has no readership figures. Never manufacture them:
    // actual view counts take precedence when supplied; otherwise use curation.
    const counted = members.filter(
      (a) =>
        typeof a.views === "number" && Number.isFinite(a.views) && a.views >= 0,
    );
    const lead = counted.length
      ? [...counted].sort(
          (a, b) => b.views! - a.views! || b.date.localeCompare(a.date),
        )[0]
      : (members.find((a) => a.slug === details.featured) ?? members[0]);
    return [
      {
        id: group.id,
        title: details.title,
        description: details.description,
        lead,
        leadLabel: counted.length ? "Популярное в подборке" : "Выбор редакции",
        articles: members.filter((a) => a.slug !== lead.slug),
      },
    ];
  });
}
export const blogDraftKey = "ostrovok-blog-wish-v1";
export const blogConversationKey = "ostrovok-trip-conversation-v1";
export const blogInterestEvent = "ov:blog-interests";
export const articleBySlug = (slug: string) =>
  blogArticles.find((article) => article.slug === slug);
export function blogDate(date: string) {
  return new Intl.DateTimeFormat("ru-RU", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${date}T12:00:00Z`));
}
const record = (value: unknown): Record<string, unknown> =>
  value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
const text = (value: unknown) =>
  typeof value === "string" ? value.slice(0, 6000) : "";

// Deterministic editorial matching uses only the user's words and confirmed
// preferences, never assistant questions or unverified hotel facts.
export function recommendBlogArticle(draft: string, conversation: unknown) {
  const state = record(conversation);
  const profile = draft.trim() ? {} : record(state.profile);
  const expectations = draft.trim() ? {} : record(state.expectations);
  const messages = Array.isArray(state.messages) ? state.messages : [];
  const criteria = Array.isArray(expectations.criteria)
    ? expectations.criteria.map(record).filter((c) => c.value === true)
    : [];
  const words = (
    draft.trim() ||
    [
      text(record(state.context).wish),
      text(expectations.purpose),
      text(profile.tripType),
      ...messages
        .filter((m) => record(m).role === "user")
        .slice(-12)
        .map((m) => text(record(m).content)),
      ...criteria.map((c) => `${text(c.key)} ${text(c.detail)}`),
      ...(Array.isArray(profile.tripTypeIds)
        ? profile.tripTypeIds.map(text)
        : []),
    ].join(" ")
  )
    .toLowerCase()
    .replaceAll("ё", "е")
    .replace(/без\s+детей|без\s+ребенка|не\s+с\s+детьми/g, "");
  const scores = new Map<string, { score: number; reason: string }>();
  const add = (
    match: (a: BlogArticle) => boolean,
    points: number,
    reason: string,
  ) => {
    for (const article of blogArticles)
      if (match(article)) {
        const previous = scores.get(article.slug);
        scores.set(article.slug, {
          score: (previous?.score ?? 0) + points,
          reason:
            previous && previous.score > points ? previous.reason : reason,
        });
      }
  };
  const category = (id: string, points: number, reason: string) =>
    add((a) => a.category === id, points, reason);
  const slug = (id: string, points: number, reason: string) =>
    add((a) => a.slug === id, points, reason);
  if (
    /с деть|ребен|семейн|children|spb-family/.test(words) ||
    (typeof profile.children === "number" && profile.children > 0)
  )
    category("family", 18, "Для поездки с детьми");
  if (
    /ресторан|гастроном|поесть|кухн|блюд|еда|еды|вкусн|restaurants|spb-food/.test(
      words,
    )
  )
    category("food", 12, "Для гастрономических открытий");
  if (/кофе|кофейн/.test(words))
    slug("luchshie-kofejni-peterburga", 20, "Для любителей кофе");
  if (/музе|культур|искусств|culture|spb-museums/.test(words))
    slug(
      "10-neobychnyx-muzeev-sankt-peterburga",
      16,
      "Для знакомства с культурой",
    );
  if (/природ|экотроп|лес|загород|глэмп|троп/.test(words))
    category("nature", 14, "Для отдыха на природе");
  if (/прогул|пешком|маршрут|walks|spb-walks/.test(words))
    category("routes", 10, "Для прогулок по Петербургу");
  if (/бесплат|эконом|недорог|spb-free/.test(words))
    slug(
      "besplatnyj-sankt-peterburg",
      16,
      "Больше впечатлений без лишних трат",
    );
  if (/сувенир|подар|шоппинг|покупк|shopping|brands|localshops/.test(words))
    slug(
      "chto-privezti-iz-sankt-peterburga",
      16,
      "Для поиска подарков и местных вещей",
    );
  if (/район|апарт|квартир|жиль/.test(words))
    category("housing", 10, "Чтобы выбрать, где остановиться");
  if (/романт|вдвоем|свидан|панорам|spb-romance/.test(words))
    slug(
      "11-smotrovyx-ploshhadok-peterburga",
      14,
      "Для красивых моментов вдвоём",
    );
  if (
    /осен|spb-autumn/.test(words) ||
    /-1[01]-|\b202\d-09-/.test(text(profile.checkin))
  )
    slug(
      "10-idej-chem-zanyatsya-v-sankt-peterburge-osenyu",
      5,
      "Для осенней поездки",
    );
  if (/новый год|новогод|празднич/.test(words))
    slug(
      "novyj-god-v-sankt-peterburge-sovetuem-mesta-s-prazdnichnoj-atmosferoj",
      16,
      "Для праздничной поездки",
    );
  if (/белые ночи|летом|летн/.test(words))
    slug("belye-nochi-v-pitere", 12, "Для летних прогулок");
  const best = blogArticles
    .filter((a) => scores.has(a.slug))
    .sort((a, b) => scores.get(b.slug)!.score - scores.get(a.slug)!.score)[0];
  return best
    ? {
        article: best,
        reason: scores.get(best.slug)!.reason,
        personalized: true,
      }
    : {
        article: articleBySlug("peterburg-na-vykhodnye")!,
        reason: "Начните знакомство с городом",
        personalized: false,
      };
}

export function filterBlogArticles(query: string, category: string) {
  const terms = query
    .trim()
    .toLowerCase()
    .replaceAll("ё", "е")
    .split(/\s+/)
    .filter(Boolean);
  return blogArticles.filter(
    (a) =>
      (category === "all" || a.category === category) &&
      terms.every((term) =>
        `${a.title} ${a.summary} ${a.tags.join(" ")}`
          .toLowerCase()
          .replaceAll("ё", "е")
          .includes(term),
      ),
  );
}
