import test from "node:test";
import assert from "node:assert/strict";
import {
  getTripWeather,
  TripWeatherError,
  type TripWeatherInput,
} from "../src/features/ostrovok/trip-weather";
import { GET } from "../src/app/api/trip-weather/route";

const now = new Date("2026-10-27T12:00:00Z");
const input = (
  checkin = "2026-11-01",
  checkout = "2026-11-03",
): TripWeatherInput => ({ city: "saint-petersburg", checkin, checkout });
function payload(
  url: URL,
  mins = [1, 2, 3],
  maxs = [4, 5, 6],
  codes = [3, 61, 61],
  forecastStart = "2026-10-11",
) {
  const start = url.searchParams.get("start_date") || forecastStart;
  const end =
    url.searchParams.get("end_date") ||
    new Date(Date.parse(start) + 31 * 86400000).toISOString().slice(0, 10);
  const length = (Date.parse(end) - Date.parse(start)) / 86400000 + 1;
  return {
    daily_units: {
      temperature_2m_min: "°C",
      temperature_2m_max: "°C",
      weather_code: "wmo code",
    },
    daily: {
      time: Array.from({ length }, (_, i) =>
        new Date(Date.parse(start) + i * 86400000).toISOString().slice(0, 10),
      ),
      temperature_2m_min: Array.from(
        { length },
        (_, i) => mins[i % mins.length],
      ),
      temperature_2m_max: Array.from(
        { length },
        (_, i) => maxs[i % maxs.length],
      ),
      weather_code: Array.from({ length }, (_, i) => codes[i % codes.length]),
    },
  };
}
function stub(
  handler: (url: URL, init?: RequestInit) => Response | Promise<Response>,
): typeof fetch {
  return async (url, init) => handler(new URL(String(url)), init);
}
function failure(status: number) {
  return (error: unknown) =>
    error instanceof TripWeatherError && error.status === status;
}

test("forecast uses Petersburg coordinates, daily Celsius data and the complete requested interval", async () => {
  const calls: URL[] = [];
  const weather = await getTripWeather(input(), {
    now,
    fetch: stub((url, init) => {
      calls.push(url);
      assert.equal(init?.cache, "no-store");
      assert.equal(
        new Headers(init?.headers).get("accept"),
        "application/json",
      );
      assert.ok(init?.signal);
      return Response.json(payload(url));
    }),
  });
  assert.equal(calls.length, 1);
  assert.equal(calls[0].origin, "https://api.open-meteo.com");
  assert.equal(calls[0].searchParams.get("latitude"), "59.9386");
  assert.equal(calls[0].searchParams.get("longitude"), "30.3141");
  assert.equal(calls[0].searchParams.get("timezone"), "Europe/Moscow");
  assert.equal(calls[0].searchParams.get("forecast_days"), "16");
  assert.equal(calls[0].searchParams.get("past_days"), "16");
  assert.equal(calls[0].searchParams.has("start_date"), false);
  assert.equal(calls[0].searchParams.has("end_date"), false);
  assert.equal(weather.kind, "forecast");
  assert.equal(weather.temperatureMin, 1);
  assert.equal(weather.temperatureMax, 6);
  assert.match(weather.description, /дожди/);
  assert.equal(weather.sourceUrl, calls[0].toString());
});

test("sixteen-day boundary includes today, and the day is computed in Moscow rather than UTC", async () => {
  const fetcher = stub((url) => Response.json(payload(url)));
  const boundary = await getTripWeather(input("2026-11-10", "2026-11-11"), {
    now,
    fetch: fetcher,
  });
  assert.equal(boundary.kind, "forecast");
  const outside = await getTripWeather(input("2026-11-10", "2026-11-12"), {
    now,
    fetch: fetcher,
  });
  assert.equal(outside.kind, "seasonal");
  const midnight = await getTripWeather(input("2026-11-10", "2026-11-12"), {
    now: new Date("2026-10-27T23:30:00Z"),
    fetch: stub((url) =>
      Response.json(
        payload(url, undefined, undefined, undefined, "2026-10-12"),
      ),
    ),
  });
  assert.equal(midnight.kind, "forecast");
});

test("recent past uses archived forecast days but is labelled historical", async () => {
  let used = "";
  const weather = await getTripWeather(input("2026-10-20", "2026-10-22"), {
    now,
    fetch: stub((url) => {
      used = url.origin;
      return Response.json(payload(url));
    }),
  });
  assert.equal(used, "https://api.open-meteo.com");
  assert.equal(weather.kind, "historical");
  assert.match(weather.description, /прошедшие даты, не прогноз/);
});

test("old past is read for its actual year; a range crossing the recent window uses at most two segments", async () => {
  const calls: URL[] = [];
  const fetcher = stub((url) => {
    calls.push(url);
    return Response.json(payload(url));
  });
  const historical = await getTripWeather(input("2024-06-01", "2024-06-03"), {
    now,
    fetch: fetcher,
  });
  assert.equal(historical.kind, "historical");
  assert.equal(calls[0].origin, "https://archive-api.open-meteo.com");
  assert.equal(calls[0].searchParams.get("start_date"), "2024-06-01");
  calls.length = 0;
  const mixed = await getTripWeather(input("2026-10-01", "2026-10-20"), {
    now,
    fetch: fetcher,
  });
  assert.equal(mixed.kind, "historical");
  assert.deepEqual(
    calls.map((url) => [
      url.origin,
      url.searchParams.get("start_date"),
      url.searchParams.get("end_date"),
    ]),
    [
      ["https://archive-api.open-meteo.com", "2026-10-01", "2026-10-10"],
      ["https://api.open-meteo.com", null, null],
    ],
  );
});

test("far future uses a completed-year seasonal analogue and cannot masquerade as a forecast", async () => {
  let source: URL | undefined;
  const weather = await getTripWeather(input("2027-07-01", "2027-07-03"), {
    now,
    fetch: stub((url) => {
      source = url;
      return Response.json(payload(url, [10, 14, 12], [20, 24, 22]));
    }),
  });
  assert.equal(source?.origin, "https://archive-api.open-meteo.com");
  assert.equal(source?.searchParams.get("start_date"), "2025-07-01");
  assert.equal(source?.searchParams.get("end_date"), "2025-07-03");
  assert.equal(weather.kind, "seasonal");
  assert.equal(weather.label, "Обычно в эти даты");
  assert.equal(weather.temperatureMin, 12);
  assert.equal(weather.temperatureMax, 22);
  assert.match(
    weather.description,
    /один исторический аналог, не прогноз и не многолетняя норма/,
  );
  assert.match(weather.description, /2025-07-01 — 2025-07-03/);
});

test("seasonal New Year and leap-day analogues remain valid and fully historical", async () => {
  const calls: URL[] = [];
  const fetcher = stub((url) => {
    calls.push(url);
    return Response.json(payload(url));
  });
  await getTripWeather(input("2026-12-29", "2027-01-03"), {
    now,
    fetch: fetcher,
  });
  assert.equal(calls[0].searchParams.get("start_date"), "2024-12-29");
  assert.equal(calls[0].searchParams.get("end_date"), "2025-01-03");
  await getTripWeather(input("2028-02-29", "2028-03-02"), {
    now,
    fetch: fetcher,
  });
  assert.equal(calls[1].searchParams.get("start_date"), "2025-02-28");
  assert.equal(calls[1].searchParams.get("end_date"), "2025-03-02");
});

test("invalid city, impossible dates, reversed dates and more than thirty nights never reach the provider", async () => {
  let calls = 0;
  const fetcher = stub(() => {
    calls++;
    throw new Error("must not fetch");
  });
  for (const value of [
    { ...input(), city: "sochi" },
    input("2026-02-30", "2026-03-02"),
    input("2026-11-01", "2026-11-01"),
    input("2026-11-03", "2026-11-01"),
    input("2026-11-01", "2026-12-02"),
    input("1939-12-01", "1939-12-03"),
    input("tomorrow", "2026-11-03"),
  ])
    await assert.rejects(
      getTripWeather(value, { now, fetch: fetcher }),
      failure(400),
    );
  assert.equal(calls, 0);
});

test("one transient failure is retried, successful results are cached and forecast cache expires after ten minutes", async () => {
  let calls = 0;
  const fetcher = stub((url) => {
    calls++;
    if (calls === 1)
      return new Response("private upstream details", { status: 503 });
    return Response.json(payload(url));
  });
  const first = await getTripWeather(input(), { now, fetch: fetcher });
  assert.equal(calls, 2);
  first.temperatureMin = 999;
  const cached = await getTripWeather(input(), {
    now: new Date(now.getTime() + 9 * 60000),
    fetch: fetcher,
  });
  assert.equal(calls, 2);
  assert.equal(cached.temperatureMin, 1);
  await getTripWeather(input(), {
    now: new Date(now.getTime() + 11 * 60000),
    fetch: fetcher,
  });
  assert.equal(calls, 3);
});

test("seasonal cache lasts one day and disabling cache obtains a fresh response", async () => {
  let calls = 0;
  const fetcher = stub((url) => {
    calls++;
    return Response.json(payload(url));
  });
  const trip = input("2027-07-01", "2027-07-03");
  await getTripWeather(trip, { now, fetch: fetcher });
  await getTripWeather(trip, {
    now: new Date(now.getTime() + 3600000),
    fetch: fetcher,
  });
  assert.equal(calls, 1);
  await getTripWeather(trip, { now, fetch: fetcher, cache: false });
  assert.equal(calls, 2);
});

test("missing, malformed or incomplete provider data is rejected without inventing weather", async () => {
  for (const mutate of [
    (data: ReturnType<typeof payload>) => {
      data.daily.temperature_2m_min[data.daily.time.indexOf("2026-11-01")] =
        null as unknown as number;
    },
    (data: ReturnType<typeof payload>) => {
      data.daily.time.pop();
    },
    (data: ReturnType<typeof payload>) => {
      data.daily.temperature_2m_max[data.daily.time.indexOf("2026-11-01")] =
        -99;
    },
    (data: ReturnType<typeof payload>) => {
      data.daily_units.temperature_2m_min = "°F";
    },
  ]) {
    let calls = 0;
    await assert.rejects(
      getTripWeather(input(), {
        now,
        fetch: stub((url) => {
          calls++;
          const data = payload(url);
          mutate(data);
          return Response.json(data);
        }),
      }),
      failure(502),
    );
    assert.equal(calls, 1);
  }
});

test("timeouts and client cancellation are bounded and expose only the sanitized error", async () => {
  let calls = 0;
  const hanging: typeof fetch = async () => {
    calls++;
    return new Promise<Response>(() => {});
  };
  const started = Date.now();
  await assert.rejects(
    getTripWeather(input(), { now, fetch: hanging, timeoutMs: 30 }),
    (error: unknown) => {
      assert.ok(error instanceof TripWeatherError);
      assert.equal(error.status, 502);
      assert.equal(
        error.message,
        "Не удалось получить погоду. Попробуйте ещё раз чуть позже.",
      );
      return true;
    },
  );
  assert.ok(Date.now() - started < 1000);
  assert.ok(calls >= 1 && calls <= 2);
  const controller = new AbortController();
  controller.abort();
  calls = 0;
  await assert.rejects(
    getTripWeather(input(), { now, fetch: hanging, signal: controller.signal }),
    failure(502),
  );
  assert.equal(calls, 0);
});

test("GET returns 400 for invalid query, 200 for weather and sanitized 502 for provider failure", async (t) => {
  for (const query of [
    "",
    "city=sochi&checkin=2026-11-01&checkout=2026-11-03",
    "city=saint-petersburg&city=sochi&checkin=2026-11-01&checkout=2026-11-03",
  ]) {
    const response = await GET(
      new Request(`http://localhost/api/trip-weather?${query}`),
    );
    assert.equal(response.status, 400);
  }
  const future = `city=saint-petersburg&checkin=2090-07-01&checkout=2090-07-03`;
  t.mock.method(
    globalThis,
    "fetch",
    stub((url) => Response.json(payload(url))),
  );
  const response = await GET(
    new Request(`http://localhost/api/trip-weather?${future}`),
  );
  assert.equal(response.status, 200);
  assert.equal(response.headers.get("cache-control"), "no-store");
  assert.equal((await response.json()).kind, "seasonal");
  t.mock.restoreAll();
  t.mock.method(
    globalThis,
    "fetch",
    stub(() => {
      throw new Error("SECRET upstream diagnostic");
    }),
  );
  const failed = await GET(
    new Request(`http://localhost/api/trip-weather?${future}`),
  );
  assert.equal(failed.status, 502);
  const body = await failed.text();
  assert.ok(!body.includes("SECRET"));
  assert.ok(body.includes("Не удалось получить погоду"));
});

test("split historical ranges share one retry rather than multiplying provider calls", async () => {
  let calls = 0;
  const fetcher = stub((url) => {
    calls++;
    return calls === 2
      ? Response.json(payload(url))
      : new Response("temporary failure", { status: 503 });
  });
  await assert.rejects(
    getTripWeather(input("2026-10-01", "2026-10-20"), { now, fetch: fetcher }),
    failure(502),
  );
  assert.equal(calls, 3);
});
