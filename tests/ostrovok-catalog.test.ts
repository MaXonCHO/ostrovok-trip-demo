import test from "node:test";
import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { join } from "node:path";
import {
  cities,
  filterHotels,
  getCity,
  getHotel,
  hotels,
} from "../src/features/ostrovok/catalog";

test("demo destinations have complete, individually addressable local hotels", () => {
  assert.equal(hotels.length, 18);
  assert.equal(filterHotels({ city: "sochi" }).length, 12);
  assert.equal(filterHotels({ city: "saint-petersburg" }).length, 3);
  assert.equal(filterHotels({ city: "kazan" }).length, 3);
  assert.equal(new Set(hotels.map((hotel) => hotel.slug)).size, hotels.length);
  for (const hotel of hotels) {
    assert.equal(getHotel(hotel.slug)?.id, hotel.id);
    assert.ok(getCity(hotel.citySlug));
    assert.match(hotel.source, /^https:\/\//);
    assert.ok(hotel.photos.length >= 3);
    for (const path of [
      ...hotel.photos,
      ...(hotel.roomPhoto ? [hotel.roomPhoto] : []),
    ]) {
      assert.match(path, /^\/demo\/real\//);
      assert.ok(existsSync(join(process.cwd(), "public", path)));
    }
    assert.equal("rating" in hotel, false);
    assert.equal("reviews" in hotel, false);
  }
  for (const city of cities) {
    assert.ok(existsSync(join(process.cwd(), "public", city.image)));
  }
  assert.equal(getHotel("unknown-hotel"), undefined);
  assert.equal(getCity("unknown-city"), undefined);
});

test("filters combine destination, affordable price, stars and all requested amenities", () => {
  const result = filterHotels({
    city: "sochi",
    maxPrice: 6000,
    stars: [3],
    amenities: ["Бассейн", "Пляж рядом"],
    sort: "price",
  });
  assert.deepEqual(
    result.map((hotel) => hotel.id),
    ["h10", "h9", "h7"],
  );
  assert.deepEqual(filterHotels({ city: "unknown-city" }), []);
  assert.deepEqual(filterHotels({ maxPrice: 0 }), []);
});

test("hotel search handles whitespace and case, and favorites only return saved objects", () => {
  assert.deepEqual(
    filterHotels({ query: "  PULLMAN  " }).map((hotel) => hotel.id),
    ["h1"],
  );
  assert.deepEqual(
    filterHotels({ city: "kazan", favorites: ["h1", "kazan-2"] }).map(
      (hotel) => hotel.id,
    ),
    ["kazan-2"],
  );
  assert.deepEqual(filterHotels({ favorites: [] }), []);
  assert.equal(filterHotels({ query: "Московская" })[0]?.id, "kazan-0");
});

test("changing sort does not mutate the recommended catalog order", () => {
  const originalOrder = hotels.map((hotel) => hotel.id);
  const ascending = filterHotels({ city: "kazan", sort: "price" });
  const descending = filterHotels({ city: "kazan", sort: "price-desc" });
  assert.deepEqual(
    ascending.map((hotel) => hotel.id),
    ["kazan-2", "kazan-0", "kazan-1"],
  );
  assert.deepEqual(
    descending.map((hotel) => hotel.id),
    ["kazan-1", "kazan-0", "kazan-2"],
  );
  assert.deepEqual(
    hotels.map((hotel) => hotel.id),
    originalOrder,
  );
  assert.deepEqual(
    filterHotels({ sort: "recommended" }).map((hotel) => hotel.id),
    originalOrder,
  );
});
