import {
  getTripWeather,
  TripWeatherError,
} from "@/features/ostrovok/trip-weather";

export const runtime = "nodejs";
export const maxDuration = 10;

export async function GET(request: Request) {
  const headers = { "Cache-Control": "no-store" };
  try {
    const query = new URL(request.url).searchParams;
    if (
      ["city", "checkin", "checkout"].some(
        (key) => query.getAll(key).length !== 1,
      )
    ) {
      throw new TripWeatherError(
        400,
        "Укажите город, дату заезда и дату выезда один раз.",
      );
    }
    const weather = await getTripWeather(
      {
        city: query.get("city") || "",
        checkin: query.get("checkin") || "",
        checkout: query.get("checkout") || "",
      },
      { signal: request.signal },
    );
    return Response.json(weather, { headers });
  } catch (error) {
    return Response.json(
      {
        error:
          error instanceof TripWeatherError
            ? error.message
            : "Не удалось получить погоду. Попробуйте ещё раз чуть позже.",
      },
      {
        status: error instanceof TripWeatherError ? error.status : 502,
        headers,
      },
    );
  }
}
