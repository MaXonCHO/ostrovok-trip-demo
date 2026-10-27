import type { SearchState } from "./search-state";
import { cities, hotels } from "./catalog";
import { petersburgCollections } from "./petersburg-collections";

export interface TripChatMessage {
  role: "user" | "assistant";
  content: string;
}
export interface TripChatContext {
  search: SearchState;
  wish: string;
  amenities: string[];
  maxPrice?: number;
  apartmentsOnly: boolean;
  source: "wish" | "filters";
}
export interface TripChatRequest {
  messages: TripChatMessage[];
  context: TripChatContext;
}
export interface TripChatProfile {
  city: "saint-petersburg" | null;
  checkin: string | null;
  checkout: string | null;
  tripType: string | null;
  datesFlexible: boolean;
  budgetMax: number | null;
  budgetFlexible: boolean;
  adults: number | null;
  children: number | null;
  rooms: number | null;
  tripTypeIds: string[];
}
export function emptyTripChatProfile(): TripChatProfile {
  return {
    city: null,
    checkin: null,
    checkout: null,
    tripType: null,
    datesFlexible: false,
    budgetMax: null,
    budgetFlexible: false,
    adults: null,
    children: null,
    rooms: null,
    tripTypeIds: [],
  };
}
export type TripChatStage =
  | "basics"
  | "trip-types"
  | "details"
  | "recommendations";
export interface TripChatReply {
  message: string;
  suggestions: string[];
  hotelSlugs: string[];
  ready: boolean;
  collectionIds: string[];
  candidateHotelSlugs: string[];
  profile: TripChatProfile;
  stage: TripChatStage;
}

export const TRIP_CHAT_BODY_LIMIT = 64 * 1024;
export class TripChatError extends Error {
  constructor(
    public readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = "TripChatError";
  }
}

function object(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
function keys(value: Record<string, unknown>, allowed: string[]) {
  return Object.keys(value).every((key) => allowed.includes(key));
}
function text(
  value: unknown,
  max: number,
  allowEmpty = false,
): value is string {
  return (
    typeof value === "string" &&
    value.length <= max &&
    (allowEmpty || value.trim().length > 0)
  );
}
function count(value: unknown, min: number, max: number): value is number {
  return (
    typeof value === "number" &&
    Number.isInteger(value) &&
    value >= min &&
    value <= max
  );
}
function date(value: unknown): value is string {
  return (
    typeof value === "string" &&
    /^\d{4}-\d{2}-\d{2}$/.test(value) &&
    !Number.isNaN(Date.parse(value)) &&
    new Date(value).toISOString().slice(0, 10) === value
  );
}

export function parseTripChatRequest(value: unknown): TripChatRequest {
  const bad = () =>
    new TripChatError(
      400,
      "Проверьте сообщение и параметры поездки: запрос имеет неверный формат.",
    );
  if (
    !object(value) ||
    !keys(value, ["messages", "context"]) ||
    !Array.isArray(value.messages) ||
    value.messages.length < 1 ||
    value.messages.length > 24
  )
    throw bad();
  const messages: TripChatMessage[] = [];
  let total = 0;
  for (const item of value.messages) {
    if (
      !object(item) ||
      !keys(item, ["role", "content"]) ||
      (item.role !== "user" && item.role !== "assistant") ||
      !text(item.content, 3000)
    )
      throw bad();
    total += item.content.length;
    messages.push({ role: item.role, content: item.content.trim() });
  }
  if (total > 18000 || messages.at(-1)?.role !== "user") throw bad();
  const c = value.context;
  if (
    !object(c) ||
    !keys(c, [
      "search",
      "wish",
      "amenities",
      "maxPrice",
      "apartmentsOnly",
      "source",
    ]) ||
    !object(c.search)
  )
    throw bad();
  const s = c.search;
  if (
    !keys(s, ["city", "checkin", "checkout", "adults", "children", "rooms"]) ||
    typeof s.city !== "string" ||
    !cities.some((city) => city.slug === s.city) ||
    !date(s.checkin) ||
    !date(s.checkout) ||
    s.checkout <= s.checkin ||
    !count(s.adults, 1, 6) ||
    !count(s.children, 0, 4) ||
    !count(s.rooms, 1, 3)
  )
    throw bad();
  const knownAmenities = new Set(hotels.flatMap((hotel) => hotel.amenities));
  if (
    !text(c.wish, 3000, true) ||
    typeof c.apartmentsOnly !== "boolean" ||
    (c.source !== "wish" && c.source !== "filters") ||
    !Array.isArray(c.amenities) ||
    c.amenities.length > 12 ||
    !c.amenities.every(
      (amenity) => typeof amenity === "string" && knownAmenities.has(amenity),
    ) ||
    (c.maxPrice !== undefined &&
      (typeof c.maxPrice !== "number" ||
        !Number.isFinite(c.maxPrice) ||
        c.maxPrice <= 0 ||
        c.maxPrice > 1000000))
  )
    throw bad();
  return {
    messages,
    context: {
      search: {
        city: s.city,
        checkin: s.checkin,
        checkout: s.checkout,
        adults: s.adults,
        children: s.children,
        rooms: s.rooms,
      },
      wish: c.wish.trim(),
      amenities: [...new Set(c.amenities as string[])],
      ...(c.maxPrice !== undefined ? { maxPrice: c.maxPrice as number } : {}),
      apartmentsOnly: c.apartmentsOnly,
      source: c.source,
    },
  };
}

export function parseTripChatReply(value: unknown): TripChatReply {
  const bad = () =>
    new TripChatError(
      502,
      "Ассистент прислал некорректный ответ. Попробуйте отправить сообщение ещё раз.",
    );
  if (
    !object(value) ||
    !keys(value, [
      "message",
      "suggestions",
      "hotelSlugs",
      "ready",
      "collectionIds",
      "candidateHotelSlugs",
      "profile",
      "stage",
    ]) ||
    !text(value.message, 2000) ||
    typeof value.ready !== "boolean" ||
    !["basics", "trip-types", "details", "recommendations"].includes(
      value.stage as string,
    ) ||
    !Array.isArray(value.suggestions) ||
    value.suggestions.length > 4 ||
    !value.suggestions.every((item) => text(item, 160)) ||
    !Array.isArray(value.hotelSlugs) ||
    value.hotelSlugs.length > 3 ||
    !value.hotelSlugs.every(
      (slug) =>
        typeof slug === "string" &&
        hotels.some(
          (hotel) =>
            hotel.slug === slug && hotel.citySlug === "saint-petersburg",
        ),
    ) ||
    new Set(value.hotelSlugs).size !== value.hotelSlugs.length ||
    !Array.isArray(value.collectionIds) ||
    value.collectionIds.length > 4 ||
    !value.collectionIds.every(
      (id) =>
        typeof id === "string" &&
        petersburgCollections.some((collection) => collection.id === id),
    ) ||
    new Set(value.collectionIds).size !== value.collectionIds.length ||
    !Array.isArray(value.candidateHotelSlugs) ||
    value.candidateHotelSlugs.length > 3 ||
    !value.candidateHotelSlugs.every(
      (slug) =>
        typeof slug === "string" &&
        hotels.some(
          (hotel) =>
            hotel.slug === slug && hotel.citySlug === "saint-petersburg",
        ),
    ) ||
    new Set(value.candidateHotelSlugs).size !==
      value.candidateHotelSlugs.length ||
    (value.ready ? value.hotelSlugs.length === 0 : value.hotelSlugs.length > 0)
  )
    throw bad();
  const profile = value.profile;
  if (
    !object(profile) ||
    !keys(profile, [
      "city",
      "checkin",
      "checkout",
      "tripType",
      "datesFlexible",
      "budgetMax",
      "budgetFlexible",
      "adults",
      "children",
      "rooms",
      "tripTypeIds",
    ]) ||
    (profile.city !== null && profile.city !== "saint-petersburg") ||
    (profile.tripType !== null && !text(profile.tripType, 80)) ||
    typeof profile.datesFlexible !== "boolean" ||
    typeof profile.budgetFlexible !== "boolean" ||
    (profile.budgetMax !== null &&
      (typeof profile.budgetMax !== "number" ||
        !Number.isFinite(profile.budgetMax) ||
        profile.budgetMax <= 0 ||
        profile.budgetMax > 1000000)) ||
    (profile.adults !== null && !count(profile.adults, 1, 6)) ||
    (profile.children !== null && !count(profile.children, 0, 4)) ||
    (profile.rooms !== null && !count(profile.rooms, 1, 3)) ||
    !Array.isArray(profile.tripTypeIds) ||
    profile.tripTypeIds.length > petersburgCollections.length ||
    !profile.tripTypeIds.every(
      (id) =>
        typeof id === "string" &&
        petersburgCollections.some((collection) => collection.id === id),
    ) ||
    new Set(profile.tripTypeIds).size !== profile.tripTypeIds.length ||
    !(
      (profile.checkin === null && profile.checkout === null) ||
      (date(profile.checkin) &&
        date(profile.checkout) &&
        profile.checkout > profile.checkin)
    )
  )
    throw bad();
  return {
    message: value.message.trim(),
    suggestions: value.suggestions.map((item) => item.trim()),
    hotelSlugs: [...value.hotelSlugs],
    ready: value.ready,
    collectionIds: [...value.collectionIds],
    candidateHotelSlugs: [...value.candidateHotelSlugs],
    stage: value.stage as TripChatStage,
    profile: {
      city: profile.city,
      checkin: profile.checkin as string | null,
      checkout: profile.checkout as string | null,
      tripType: profile.tripType === null ? null : profile.tripType.trim(),
      datesFlexible: profile.datesFlexible,
      budgetMax: profile.budgetMax as number | null,
      budgetFlexible: profile.budgetFlexible,
      adults: profile.adults as number | null,
      children: profile.children as number | null,
      rooms: profile.rooms as number | null,
      tripTypeIds: [...profile.tripTypeIds],
    },
  };
}

export async function readTripChatJson(
  input: Request | Response,
  status = 400,
): Promise<unknown> {
  const bad = () =>
    new TripChatError(
      status,
      status === 400
        ? "Запрос слишком большой или содержит некорректный JSON."
        : "Ассистент прислал некорректный ответ. Попробуйте ещё раз.",
    );
  const declared = Number(input.headers.get("content-length"));
  if (declared > TRIP_CHAT_BODY_LIMIT || !input.body) throw bad();
  const reader = input.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > TRIP_CHAT_BODY_LIMIT) {
        await reader.cancel();
        throw bad();
      }
      chunks.push(value);
    }
    const bytes = new Uint8Array(size);
    let offset = 0;
    for (const chunk of chunks) {
      bytes.set(chunk, offset);
      offset += chunk.byteLength;
    }
    return JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes));
  } catch (error) {
    if (error instanceof TripChatError) throw error;
    throw bad();
  } finally {
    reader.releaseLock();
  }
}
