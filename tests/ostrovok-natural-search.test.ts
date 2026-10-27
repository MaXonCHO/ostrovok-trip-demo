import test from "node:test";
import assert from "node:assert/strict";
import { buildNaturalSearch } from "../src/features/ostrovok/natural-search";
import { defaults } from "../src/features/ostrovok/search-state";

test("a natural wish becomes supported filters, never a hotel-name search", () => {
  const wish =
    "  Хочу в Питер с бассейном и завтраком до 8 тысяч, тихий номер  ";
  const params = buildNaturalSearch(wish, {
    ...defaults,
    adults: 3,
    children: 1,
    rooms: 2,
  });
  assert.equal(params.get("wish"), wish.trim());
  assert.equal(params.has("q"), false);
  assert.equal(params.get("city"), "saint-petersburg");
  assert.equal(params.get("maxPrice"), "8000");
  assert.deepEqual(params.get("amenities")?.split(","), ["Бассейн", "Завтрак"]);
  assert.equal(params.get("checkin"), defaults.checkin);
  assert.equal(params.get("checkout"), defaults.checkout);
  assert.equal(params.get("adults"), "3");
  assert.equal(params.get("children"), "1");
  assert.equal(params.get("rooms"), "2");
});

test("explicitly unwanted amenities are not added, including negative lists", () => {
  const params = buildNaturalSearch(
    "Сочи без бассейна и завтрака, с парковкой и спа",
    defaults,
  );
  assert.deepEqual(params.get("amenities")?.split(","), ["Спа", "Парковка"]);
  const mixed = buildNaturalSearch(
    "Без завтрака с бассейном. Парковка не нужна",
    defaults,
  );
  assert.equal(mixed.get("amenities"), "Бассейн");
  assert.equal(
    buildNaturalSearch("тихо, без завтрака", defaults).has("amenities"),
    false,
  );
});

test("manual destination wins when requested; apartment mode and recognized budget remain", () => {
  const base = { ...defaults, city: "kazan" };
  const params = buildNaturalSearch("В spb у моря до 8 000 руб", base, {
    preferFilters: true,
    apartmentsOnly: true,
  });
  assert.equal(params.get("city"), "kazan");
  assert.equal(params.get("maxPrice"), "8000");
  assert.equal(params.get("property"), "apartments");
  assert.equal(params.get("amenities"), "Пляж рядом");
  assert.equal(base.city, "kazan");
});

test("keyword mapper supports only explicit cities, amenities and upper budgets", () => {
  for (const budget of ["до 8000", "до 8тыс", "до 8 тысяч", "до 8 000руб"]) {
    assert.equal(buildNaturalSearch(budget, defaults).get("maxPrice"), "8000");
  }
  assert.equal(
    buildNaturalSearch("в Казани с собакой, вайфай и пляж", defaults).get(
      "city",
    ),
    "kazan",
  );
  assert.equal(
    buildNaturalSearch("Sochi WiFi", { ...defaults, city: "kazan" }).get(
      "city",
    ),
    "sochi",
  );
  assert.equal(
    buildNaturalSearch("Спасибо за спальный номер", defaults).has("amenities"),
    false,
  );
  assert.equal(
    buildNaturalSearch("Номер в Москве с видом на закат", defaults).get("city"),
    defaults.city,
  );
  assert.equal(buildNaturalSearch("", defaults).has("wish"), false);
  assert.equal(
    buildNaturalSearch("x".repeat(3100), defaults).get("wish")?.length,
    3000,
  );
});
