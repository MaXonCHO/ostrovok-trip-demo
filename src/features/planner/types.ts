import type { Hotel } from "@/features/ostrovok/catalog";
import type {
  TripChatContext,
  TripChatMessage,
  TripChatProfile,
  TripChatReply,
} from "@/features/ostrovok/trip-chat-contract";
export type CriterionKey =
  | "quiet"
  | "beach"
  | "walks"
  | "shopping"
  | "malls"
  | "brands"
  | "localShops"
  | "restaurants"
  | "children"
  | "playground"
  | "groceries"
  | "pharmacy"
  | "culture"
  | "wifi"
  | "parking"
  | "breakfast"
  | "pets"
  | "accessible";
export interface Criterion {
  key: CriterionKey;
  label: string;
  importance: "required" | "preferred";
  value: boolean;
  detail?: string;
}
export interface Expectations {
  criteria: Criterion[];
  shoppingDetail: string | null;
  brandNames: string[];
  purpose: string | null;
}
export const emptyExpectations = (): Expectations => ({
  criteria: [],
  shoppingDetail: null,
  brandNames: [],
  purpose: null,
});
export interface CatalogRecord {
  hotel_id: string;
  name: string;
  lat: number;
  lon: number;
  rating_snapshot: number | null;
  reviews_snapshot: number;
  description_snapshot: string;
  amenities_snapshot: string[];
  metrics: Record<string, number | null>;
  identity_verified: boolean;
  geocode_status: string;
  sources: Record<string, string>;
}
export interface EvidenceItem {
  label: string;
  value: string;
  source: string;
  url?: string;
  date: string | null;
  status: "snapshot" | "unverified" | "unknown";
  method: string;
}
export interface RankedHotel {
  hotel: Hotel;
  score: number;
  status: "matches" | "needs-check";
  reasons: string[];
  unknowns: string[];
  tradeoffs: string[];
  nearby: EvidenceItem[];
}
export interface Selection {
  results: RankedHotel[];
  needsCheck: RankedHotel[];
  excludedCount: number;
  total: number;
  matchingCount: number;
  unverifiedCount: number;
  applied: Criterion[];
  suggestions: { key: string; label: string; impact: number }[];
  engine: "lexical+facts" | "e5+facts";
  revision: number;
}
export interface Account {
  id: string;
  name: string;
  phone: string | null;
  authenticated: boolean;
}
export interface TripWorkspace {
  id: string;
  title: string;
  ownerId: string;
  myRole: "owner" | "member";
  version: number;
  revision: number;
  status: "draft" | "profile";
  context: TripChatContext;
  profile: TripChatProfile;
  expectations: Expectations;
  selection: Selection;
  messages: TripChatMessage[];
  includeUnverified: boolean;
  members: { id: string; name: string; role: string }[];
  votes: { hotelId: string; userId: string; name: string; liked: boolean }[];
  comments: {
    id: string;
    hotelId: string;
    userId: string;
    name: string;
    text: string;
    createdAt: string;
  }[];
  pinnedHotelId: string | null;
  inviteUrl?: string;
  updatedAt: string;
  notice: string | null;
}
export interface PlannerReply {
  reply: TripChatReply;
  tripId: string;
  tripVersion: number;
  expectations: Expectations;
  selection: Selection;
}
