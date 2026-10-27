import { searchParams, type SearchState } from "./search-state";

const amenities: [string, RegExp][] = [
  ["Бассейн", /(?<!\p{L})бассейн\p{L}*/gu],
  ["Спа", /(?<!\p{L})(?:спа|spa)(?!\p{L})/gu],
  ["Завтрак", /(?<!\p{L})завтрак\p{L}*/gu],
  ["Парковка", /(?<!\p{L})парков\p{L}*/gu],
  ["Бесплатный Wi-Fi", /(?<!\p{L})(?:wi[ -]?fi|вай[ -]?фай)(?!\p{L})/gu],
  ["Можно с питомцами", /(?<!\p{L})(?:питом\p{L}*|собак\p{L}*|кошк\p{L}*)/gu],
  ["Пляж рядом", /(?<!\p{L})(?:пляж\p{L}*|у\s+моря)(?!\p{L})/gu],
];

function negated(text: string, index: number, length: number) {
  // A short explicit list is intentional: this is keyword mapping, not an LLM.
  // A negative list continues through «и», but ends at punctuation or «с/со/у».
  const before =
    text
      .slice(0, index)
      .split(/[,.!?;:\n]/)
      .at(-1) ?? "";
  const markers = [
    ...before.matchAll(
      /(?<!\p{L})(без|с|со|у|не\s+(?:нужен|нужна|нужно|нужны|надо|хочу))(?!\p{L})/gu,
    ),
  ];
  const marker = markers.at(-1)?.[1];
  if (marker === "без" || marker?.startsWith("не ")) return true;
  return /^\s+не\s+(?:нужен|нужна|нужно|нужны|надо)(?!\p{L})/u.test(
    text.slice(index + length),
  );
}

export function buildNaturalSearch(
  wish: string,
  base: SearchState,
  options: { apartmentsOnly?: boolean; preferFilters?: boolean } = {},
): URLSearchParams {
  const trimmed = wish.trim().slice(0, 3000);
  const text = trimmed.toLocaleLowerCase("ru").replaceAll("ё", "е");
  const state = { ...base };

  if (!options.preferFilters) {
    const destinations: [string, RegExp][] = [
      ["sochi", /(?<!\p{L})(?:сочи|sochi)(?!\p{L})/u],
      [
        "saint-petersburg",
        /(?<!\p{L})(?:санкт[ -]?петербург\p{L}*|петербург\p{L}*|питер\p{L}*|спб|spb|saint[ -]?petersburg)(?!\p{L})/u,
      ],
      ["kazan", /(?<!\p{L})(?:казан[ьи]\p{L}*|kazan)(?!\p{L})/u],
    ];
    const city = destinations.find(([, pattern]) => pattern.test(text));
    if (city) state.city = city[0];
  }

  const params = searchParams(state);
  if (trimmed) params.set("wish", trimmed);
  if (options.apartmentsOnly) params.set("property", "apartments");

  const selected = amenities
    .filter(([, pattern]) =>
      [...text.matchAll(pattern)].some(
        (match) => !negated(text, match.index, match[0].length),
      ),
    )
    .map(([name]) => name);
  if (selected.length) params.set("amenities", selected.join(","));

  const budget = text.match(
    /(?<!\p{L})до\s+(\d+(?:[ \u00a0\u202f]\d{3})*(?:[.,]\d+)?)\s*(тысяч\p{L}*|тыс\.?)?/u,
  );
  if (budget) {
    const amount =
      Number(budget[1].replace(/[ \u00a0\u202f]/g, "").replace(",", ".")) *
      (budget[2] ? 1000 : 1);
    if (Number.isFinite(amount) && amount > 0)
      params.set("maxPrice", String(Math.round(amount)));
  }
  return params;
}
