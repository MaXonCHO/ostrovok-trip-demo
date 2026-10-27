import realHotels from "@/data/fixtures/real-hotels.json";

export interface Hotel {
  id: string;
  slug: string;
  name: string;
  city: string;
  citySlug: string;
  address: string;
  stars: number;
  photos: string[];
  price: number;
  oldPrice?: number;
  distance: string;
  beach?: string;
  amenities: string[];
  description: string;
  source: string;
  roomPhoto?: string;
}

export const cities = [
  {
    slug: "sochi",
    name: "Сочи",
    preposition: "в Сочи",
    image: "/demo/coast.jpg",
    description: "Море, горы и прогулки под пальмами",
  },
  {
    slug: "saint-petersburg",
    name: "Санкт-Петербург",
    preposition: "в Санкт-Петербурге",
    image: "/demo/city.jpg",
    description: "Набережные, музеи и уютные дворы",
  },
  {
    slug: "kazan",
    name: "Казань",
    preposition: "в Казани",
    image: "/demo/real/kazan-0-1.jpg",
    description: "История, новые впечатления и татарская кухня",
  },
];

// This is an offline UI fixture, not a current hotel offer. Names, addresses,
// sources and hotel photographs come from the existing verified-object fixture.
// Prices, discounts, star categories, distances and amenities below are demo
// values. They must not be used as verified evidence by the hackathon agent.
const demoDetails: Record<
  string,
  {
    slug: string;
    stars: number;
    price: number;
    oldPrice?: number;
    distance: string;
    beach?: string;
    amenities: string[];
  }
> = {
  h1: {
    slug: "pullman-sochi-centre",
    stars: 5,
    price: 12600,
    oldPrice: 14800,
    distance: "1,2 км от центра",
    beach: "250 м до пляжа",
    amenities: [
      "Бесплатный Wi-Fi",
      "Бассейн",
      "Спа",
      "Фитнес",
      "Завтрак",
      "Пляж рядом",
    ],
  },
  h2: {
    slug: "mercure-sochi-centre",
    stars: 4,
    price: 7900,
    distance: "1,2 км от центра",
    beach: "300 м до пляжа",
    amenities: [
      "Бесплатный Wi-Fi",
      "Парковка",
      "Завтрак",
      "Фитнес",
      "Пляж рядом",
    ],
  },
  h3: {
    slug: "sea-galaxy-sochi",
    stars: 4,
    price: 6400,
    oldPrice: 8200,
    distance: "2 км от центра",
    beach: "150 м до пляжа",
    amenities: ["Бесплатный Wi-Fi", "Спа", "Парковка", "Завтрак", "Пляж рядом"],
  },
  h4: {
    slug: "green-house-sochi",
    stars: 4,
    price: 8700,
    distance: "4 км от центра",
    beach: "900 м до пляжа",
    amenities: ["Бесплатный Wi-Fi", "Бассейн", "Спа", "Парковка", "Завтрак"],
  },
  h5: {
    slug: "denart-sochi",
    stars: 4,
    price: 4900,
    distance: "600 м от центра",
    beach: "1,1 км до пляжа",
    amenities: ["Бесплатный Wi-Fi", "Парковка", "Завтрак"],
  },
  h6: {
    slug: "zhemchuzhina-sochi",
    stars: 4,
    price: 7300,
    oldPrice: 9200,
    distance: "1,8 км от центра",
    beach: "100 м до пляжа",
    amenities: ["Бесплатный Wi-Fi", "Бассейн", "Спа", "Завтрак", "Пляж рядом"],
  },
  h7: {
    slug: "dolphin-sochi",
    stars: 3,
    price: 5800,
    distance: "2,5 км от центра",
    beach: "100 м до пляжа",
    amenities: [
      "Бесплатный Wi-Fi",
      "Бассейн",
      "Парковка",
      "Пляж рядом",
      "Можно с питомцами",
    ],
  },
  h8: {
    slug: "marina-yacht-sochi",
    stars: 4,
    price: 9600,
    distance: "500 м от центра",
    beach: "600 м до пляжа",
    amenities: ["Бесплатный Wi-Fi", "Завтрак", "Пляж рядом"],
  },
  h9: {
    slug: "sm-royal-adler",
    stars: 3,
    price: 4200,
    distance: "23,5 км от центра Сочи",
    beach: "500 м до пляжа",
    amenities: ["Бесплатный Wi-Fi", "Бассейн", "Завтрак", "Пляж рядом"],
  },
  h10: {
    slug: "kiparis-adler",
    stars: 3,
    price: 3800,
    distance: "24 км от центра Сочи",
    beach: "200 м до пляжа",
    amenities: ["Бесплатный Wi-Fi", "Бассейн", "Завтрак", "Пляж рядом"],
  },
  h11: {
    slug: "sphera-sochi",
    stars: 3,
    price: 4600,
    distance: "2,3 км от центра",
    beach: "250 м до пляжа",
    amenities: [
      "Бесплатный Wi-Fi",
      "Завтрак",
      "Пляж рядом",
      "Можно с питомцами",
    ],
  },
  h12: {
    slug: "tropicana-adler",
    stars: 3,
    price: 3500,
    distance: "22 км от центра Сочи",
    beach: "100 м до пляжа",
    amenities: ["Бесплатный Wi-Fi", "Парковка", "Пляж рядом"],
  },
  "spb-0": {
    slug: "helvetia-saint-petersburg",
    stars: 5,
    price: 11900,
    distance: "2,8 км от центра",
    amenities: ["Бесплатный Wi-Fi", "Завтрак", "Можно с питомцами"],
  },
  "spb-1": {
    slug: "domina-saint-petersburg",
    stars: 5,
    price: 9800,
    oldPrice: 11500,
    distance: "1,3 км от центра",
    amenities: [
      "Бесплатный Wi-Fi",
      "Спа",
      "Фитнес",
      "Завтрак",
      "Можно с питомцами",
    ],
  },
  "spb-2": {
    slug: "ambassador-saint-petersburg",
    stars: 4,
    price: 6700,
    distance: "2 км от центра",
    amenities: ["Бесплатный Wi-Fi", "Бассейн", "Парковка", "Фитнес", "Завтрак"],
  },
  "kazan-0": {
    slug: "mirage-kazan",
    stars: 5,
    price: 8900,
    distance: "600 м от центра",
    amenities: ["Бесплатный Wi-Fi", "Бассейн", "Парковка", "Фитнес", "Завтрак"],
  },
  "kazan-1": {
    slug: "luciano-kazan",
    stars: 5,
    price: 13700,
    distance: "1,2 км от центра",
    amenities: ["Бесплатный Wi-Fi", "Бассейн", "Спа", "Фитнес", "Завтрак"],
  },
  "kazan-2": {
    slug: "nogai-kazan",
    stars: 3,
    price: 5600,
    distance: "900 м от центра",
    amenities: ["Бесплатный Wi-Fi", "Парковка", "Завтрак"],
  },
};

export const hotels: Hotel[] = realHotels.map((hotel) => {
  const citySlug = hotel.id.startsWith("spb-")
    ? "saint-petersburg"
    : hotel.id.startsWith("kazan-")
      ? "kazan"
      : "sochi";
  const city = cities.find((item) => item.slug === citySlug)!;
  return {
    id: hotel.id,
    name: hotel.name,
    city: city.name,
    citySlug,
    address: hotel.address,
    source: hotel.source,
    photos: hotel.assets.map((asset) => asset.path),
    roomPhoto: hotel.assets.find((asset) => asset.kind === "room")?.path,
    description: `${hotel.name} — отель ${city.preposition}. Фотографии и адрес взяты с официального сайта отеля. Условия размещения и цены в этом прототипе демонстрационные; доступность номеров нужно уточнить.`,
    ...demoDetails[hotel.id],
  };
});

export function getHotel(slug: string): Hotel | undefined {
  return hotels.find((hotel) => hotel.slug === slug);
}

export function getCity(slug: string) {
  return cities.find((city) => city.slug === slug);
}

export interface HotelFilters {
  city?: string;
  query?: string;
  maxPrice?: number;
  stars?: number[];
  amenities?: string[];
  sort?: string;
  favorites?: string[];
}

const normalize = (value: string) =>
  value.trim().toLocaleLowerCase("ru").replaceAll("ё", "е");

export function filterHotels(filters: HotelFilters = {}): Hotel[] {
  const query = normalize(filters.query ?? "");
  const result = hotels.filter((hotel) => {
    if (filters.city && hotel.citySlug !== filters.city) return false;
    if (query && !normalize(`${hotel.name} ${hotel.address}`).includes(query))
      return false;
    if (filters.maxPrice !== undefined && hotel.price > filters.maxPrice)
      return false;
    if (filters.stars?.length && !filters.stars.includes(hotel.stars))
      return false;
    if (
      filters.amenities?.length &&
      !filters.amenities.every((amenity) => hotel.amenities.includes(amenity))
    )
      return false;
    if (filters.favorites && !filters.favorites.includes(hotel.id))
      return false;
    return true;
  });

  switch (filters.sort) {
    case "price":
      return result.sort((a, b) => a.price - b.price);
    case "price-desc":
      return result.sort((a, b) => b.price - a.price);
    case "stars":
      return result.sort((a, b) => b.stars - a.stars || a.price - b.price);
    default:
      return result;
  }
}
