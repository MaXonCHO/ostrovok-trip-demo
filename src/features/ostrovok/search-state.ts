export interface SearchState {
  city: string;
  checkin: string;
  checkout: string;
  adults: number;
  children: number;
  rooms: number;
}
export type Query = Record<string, string | string[] | undefined>;
export const defaults: SearchState = {
  city: "saint-petersburg",
  checkin: "2026-11-06",
  checkout: "2026-11-09",
  adults: 2,
  children: 0,
  rooms: 1,
};
export function param(query: Query, key: string, fallback = "") {
  const value = query[key];
  return (Array.isArray(value) ? value[0] : value) || fallback;
}
function date(value: string, fallback: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value) &&
    !Number.isNaN(Date.parse(value)) &&
    new Date(value).toISOString().slice(0, 10) === value
    ? value
    : fallback;
}
export function readSearch(query: Query): SearchState {
  const checkin = date(param(query, "checkin"), defaults.checkin);
  const proposed = date(param(query, "checkout"), defaults.checkout);
  const checkout =
    proposed > checkin
      ? proposed
      : new Date(Date.parse(checkin) + 86400000).toISOString().slice(0, 10);
  const count = (key: string, min: number, max: number, fallback: number) => {
    const n = Number(param(query, key, String(fallback)));
    return Number.isFinite(n)
      ? Math.max(min, Math.min(max, Math.floor(n)))
      : fallback;
  };
  return {
    city: param(query, "city", defaults.city),
    checkin,
    checkout,
    adults: count("adults", 1, 6, 2),
    children: count("children", 0, 4, 0),
    rooms: count("rooms", 1, 3, 1),
  };
}
export function searchParams(state: SearchState) {
  return new URLSearchParams(
    Object.entries(state).map(([key, value]) => [key, String(value)]),
  );
}
export function nights(state: SearchState) {
  return Math.max(
    1,
    Math.round(
      (Date.parse(state.checkout) - Date.parse(state.checkin)) / 86400000,
    ),
  );
}
export function plural(n: number, forms: [string, string, string]) {
  return n % 100 >= 11 && n % 100 <= 14
    ? forms[2]
    : forms[n % 10 === 1 ? 0 : n % 10 >= 2 && n % 10 <= 4 ? 1 : 2];
}
export const money = (amount: number) =>
  new Intl.NumberFormat("ru-RU").format(amount) + " ₽";
export const shortDate = (value: string) =>
  new Date(value + "T12:00:00")
    .toLocaleDateString("ru-RU", { day: "numeric", month: "short" })
    .replace(" г.", "");
