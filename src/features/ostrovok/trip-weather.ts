export interface TripWeatherInput {
  city: string;
  checkin: string;
  checkout: string;
}
export interface TripWeather {
  label: string;
  description: string;
  temperatureMin: number;
  temperatureMax: number;
  sourceUrl: string;
  kind: "forecast" | "seasonal" | "historical";
}
export interface TripWeatherOptions {
  fetch?: typeof fetch;
  now?: Date;
  signal?: AbortSignal;
  /** Total network budget, including the single retry and all date segments. */
  timeoutMs?: number;
  cache?: boolean;
}
export class TripWeatherError extends Error {
  constructor(
    public readonly status: 400 | 502,
    message: string,
  ) {
    super(message);
    this.name = "TripWeatherError";
  }
}
const DAY = 86400000;
const FORECAST = "https://api.open-meteo.com/v1/forecast";
const ARCHIVE = "https://archive-api.open-meteo.com/v1/archive";
const UNAVAILABLE =
  "Не удалось получить погоду. Попробуйте ещё раз чуть позже.";
const caches = new WeakMap<
  typeof fetch,
  Map<string, { expires: number; value: TripWeather }>
>();
const codes = new Set([
  0, 1, 2, 3, 45, 48, 51, 53, 55, 56, 57, 61, 63, 65, 66, 67, 71, 73, 75, 77,
  80, 81, 82, 85, 86, 95, 96, 99,
]);
interface Segment {
  start: string;
  end: string;
  archive: boolean;
}
interface Daily {
  min: number;
  max: number;
  code: number;
}
class UpstreamError extends Error {
  constructor(public retryable: boolean) {
    super(UNAVAILABLE);
  }
}
function iso(value: unknown): value is string {
  return (
    typeof value === "string" &&
    /^\d{4}-\d{2}-\d{2}$/.test(value) &&
    Number.isFinite(Date.parse(value)) &&
    new Date(value).toISOString().slice(0, 10) === value
  );
}
function addDays(date: string, days: number) {
  return new Date(Date.parse(date) + days * DAY).toISOString().slice(0, 10);
}
function todayInMoscow(now: Date) {
  const parts = new Intl.DateTimeFormat("en", {
    timeZone: "Europe/Moscow",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);
  return ["year", "month", "day"]
    .map((key) => parts.find((p) => p.type === key)!.value)
    .join("-");
}
function validate(input: TripWeatherInput) {
  if (
    !input ||
    input.city !== "saint-petersburg" ||
    !iso(input.checkin) ||
    !iso(input.checkout) ||
    input.checkin < "1940-01-01" ||
    input.checkout <= input.checkin ||
    Date.parse(input.checkout) - Date.parse(input.checkin) > 30 * DAY
  ) {
    throw new TripWeatherError(
      400,
      "Укажите Санкт-Петербург и корректные даты поездки: выезд позже заезда, не более 30 ночей.",
    );
  }
}
function analogousDate(date: string, year: number) {
  const month = Number(date.slice(5, 7));
  const day = Math.min(
    Number(date.slice(8)),
    new Date(Date.UTC(year, month, 0)).getUTCDate(),
  );
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}
function plan(
  input: TripWeatherInput,
  today: string,
): { kind: TripWeather["kind"]; segments: Segment[] } {
  if (input.checkout > addDays(today, 15)) {
    // Use a completed historical period, even if the requested trip is years away.
    const endYear = Number(today.slice(0, 4)) - 1;
    const crossesYear = input.checkin.slice(5) > input.checkout.slice(5);
    return {
      kind: "seasonal",
      segments: [
        {
          start: analogousDate(input.checkin, endYear - Number(crossesYear)),
          end: analogousDate(input.checkout, endYear),
          archive: true,
        },
      ],
    };
  }
  const kind = input.checkout < today ? "historical" : "forecast";
  const recent = addDays(today, -16);
  if (input.checkin >= recent)
    return {
      kind,
      segments: [{ start: input.checkin, end: input.checkout, archive: false }],
    };
  if (input.checkout < recent)
    return {
      kind,
      segments: [{ start: input.checkin, end: input.checkout, archive: true }],
    };
  return {
    kind,
    segments: [
      { start: input.checkin, end: addDays(recent, -1), archive: true },
      { start: recent, end: input.checkout, archive: false },
    ],
  };
}
function urlFor(segment: Segment) {
  const url = new URL(segment.archive ? ARCHIVE : FORECAST);
  url.search = new URLSearchParams({
    latitude: "59.9386",
    longitude: "30.3141",
    timezone: "Europe/Moscow",
    daily: "temperature_2m_max,temperature_2m_min,weather_code",
    temperature_unit: "celsius",
    ...(segment.archive
      ? { start_date: segment.start, end_date: segment.end }
      : { past_days: "16", forecast_days: "16" }),
  }).toString();
  return url.toString();
}
function object(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}
function dailyData(value: unknown, segment: Segment): Daily[] {
  if (
    !object(value) ||
    !object(value.daily) ||
    !object(value.daily_units) ||
    value.daily_units.temperature_2m_min !== "°C" ||
    value.daily_units.temperature_2m_max !== "°C"
  )
    throw new UpstreamError(false);
  const d = value.daily;
  const length =
    Math.round((Date.parse(segment.end) - Date.parse(segment.start)) / DAY) + 1;
  const arrays = [
    d.time,
    d.temperature_2m_min,
    d.temperature_2m_max,
    d.weather_code,
  ];
  if (
    !arrays.every(
      (a) =>
        Array.isArray(a) &&
        a.length > 0 &&
        a.length <= 64 &&
        a.length === (Array.isArray(d.time) ? d.time.length : 0),
    )
  )
    throw new UpstreamError(false);
  const [times, mins, maxs, weatherCodes] = arrays as unknown[][];
  const first = times.indexOf(segment.start);
  const last = times.indexOf(segment.end);
  // Forecast API returns its full 16-day window plus past_days. Select the trip
  // locally: its relative window parameters cannot be combined with start/end.
  if (
    first < 0 ||
    last - first + 1 !== length ||
    (segment.archive && times.length !== length)
  )
    throw new UpstreamError(false);
  return times.slice(first, last + 1).map((time, offset) => {
    const i = first + offset;
    const min = mins[i],
      max = maxs[i],
      code = weatherCodes[i];
    if (
      time !== addDays(segment.start, offset) ||
      typeof min !== "number" ||
      typeof max !== "number" ||
      !Number.isFinite(min) ||
      !Number.isFinite(max) ||
      min < -90 ||
      max > 65 ||
      min > max ||
      typeof code !== "number" ||
      !codes.has(code)
    )
      throw new UpstreamError(false);
    return { min, max, code };
  });
}
async function abortable<T>(task: Promise<T>, signal: AbortSignal): Promise<T> {
  let abort: () => void = () => {};
  const cancelled = new Promise<never>((_, reject) => {
    abort = () => reject(new UpstreamError(true));
    if (signal.aborted) abort();
    else signal.addEventListener("abort", abort, { once: true });
  });
  try {
    return await Promise.race([task, cancelled]);
  } finally {
    signal.removeEventListener("abort", abort);
  }
}
async function load(
  segment: Segment,
  fetcher: typeof fetch,
  options: TripWeatherOptions,
  deadline: number,
  budget: number,
  retryBudget: { remaining: number },
) {
  for (let attempt = 0; attempt < 2; attempt++) {
    const remaining = deadline - Date.now();
    if (remaining <= 0 || options.signal?.aborted)
      throw new UpstreamError(false);
    const controller = new AbortController();
    const timeout = setTimeout(
      () => controller.abort(),
      Math.min(remaining, attempt === 0 ? Math.ceil(budget / 2) : remaining),
    );
    const cancel = () => controller.abort();
    options.signal?.addEventListener("abort", cancel, { once: true });
    try {
      return await abortable(
        (async () => {
          const response = await fetcher(urlFor(segment), {
            signal: controller.signal,
            cache: "no-store",
            headers: { Accept: "application/json" },
            redirect: "error",
          });
          if (!response.ok)
            throw new UpstreamError(
              response.status === 429 || response.status >= 500,
            );
          if (Number(response.headers.get("content-length")) > 65536)
            throw new UpstreamError(false);
          const text = await response.text();
          if (text.length > 65536) throw new UpstreamError(false);
          let value: unknown;
          try {
            value = JSON.parse(text);
          } catch {
            throw new UpstreamError(false);
          }
          return dailyData(value, segment);
        })(),
        controller.signal,
      );
    } catch (error) {
      if (
        attempt === 1 ||
        retryBudget.remaining === 0 ||
        options.signal?.aborted ||
        (error instanceof UpstreamError && !error.retryable)
      )
        throw error;
      retryBudget.remaining--;
    } finally {
      clearTimeout(timeout);
      options.signal?.removeEventListener("abort", cancel);
    }
  }
  throw new UpstreamError(false);
}
function conditions(days: Daily[]) {
  const descriptions = days.map(({ code }) =>
    code >= 95
      ? "грозы"
      : [71, 73, 75, 77, 85, 86].includes(code)
        ? "снег"
        : code >= 51
          ? "дожди"
          : code >= 45
            ? "туман"
            : code === 3
              ? "облачная погода"
              : code === 2
                ? "переменная облачность"
                : "ясная погода",
  );
  const counts = new Map<string, number>();
  for (const d of descriptions) counts.set(d, (counts.get(d) || 0) + 1);
  return [...counts]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 2)
    .map(([d]) => d)
    .join(" и ");
}
/** Open-Meteo forecast and historical APIs; seasonal means one historical analogue, not a climate normal.
 * https://open-meteo.com/en/docs
 * https://open-meteo.com/en/docs/historical-weather-api
 */
export async function getTripWeather(
  input: TripWeatherInput,
  options: TripWeatherOptions = {},
): Promise<TripWeather> {
  validate(input);
  const now = options.now || new Date();
  const today = todayInMoscow(now);
  const selection = plan(input, today);
  const fetcher = options.fetch || fetch;
  const key = `${today}|${input.checkin}|${input.checkout}`;
  let cache = caches.get(fetcher);
  if (!cache) {
    cache = new Map();
    caches.set(fetcher, cache);
  }
  const cached = cache.get(key);
  if (options.cache !== false && cached && cached.expires > now.getTime())
    return { ...cached.value };
  const budget = Math.min(8000, Math.max(1, options.timeoutMs ?? 8000));
  try {
    const days: Daily[] = [];
    const deadline = Date.now() + budget;
    const retryBudget = { remaining: 1 };
    for (const segment of selection.segments)
      days.push(
        ...(await load(
          segment,
          fetcher,
          options,
          deadline,
          budget,
          retryBudget,
        )),
      );
    const seasonal = selection.kind === "seasonal";
    const temperatureMin = Math.round(
      seasonal
        ? days.reduce((sum, d) => sum + d.min, 0) / days.length
        : Math.min(...days.map((d) => d.min)),
    );
    const temperatureMax = Math.round(
      seasonal
        ? days.reduce((sum, d) => sum + d.max, 0) / days.length
        : Math.max(...days.map((d) => d.max)),
    );
    const period = selection.segments[0];
    const value: TripWeather = {
      label: seasonal
        ? "Обычно в эти даты"
        : selection.kind === "forecast"
          ? "Прогноз на даты поездки"
          : "Погода в эти даты",
      description: seasonal
        ? `Сезонный ориентир для Санкт-Петербурга: средние ночные и дневные температуры за аналогичный период ${period.start} — ${period.end}. В тот период: ${conditions(days)}. Это один исторический аналог, не прогноз и не многолетняя норма.`
        : `${selection.kind === "forecast" ? "Прогноз" : "Исторические данные"} Open-Meteo для Санкт-Петербурга: ${conditions(days)}. ${selection.kind === "forecast" ? "Прогноз может измениться; прошедшие дни показаны по архиву." : "Это данные за выбранные прошедшие даты, не прогноз."}`,
      temperatureMin,
      temperatureMax,
      sourceUrl:
        selection.segments.length === 1
          ? urlFor(period)
          : "https://open-meteo.com/en/docs",
      kind: selection.kind,
    };
    if (options.cache !== false) {
      if (cache.size >= 100) cache.delete(cache.keys().next().value!);
      cache.set(key, {
        value,
        expires:
          now.getTime() +
          (value.kind === "forecast" ? 10 * 60000 : 24 * 3600000),
      });
    }
    return { ...value };
  } catch {
    throw new TripWeatherError(502, UNAVAILABLE);
  }
}
