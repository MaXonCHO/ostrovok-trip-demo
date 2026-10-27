export type DataMode = "mock" | "api";
export type Decision = "unseen" | "liked" | "rejected";
export type EvidenceStatus =
  | "demo"
  | "supported"
  | "uncertain"
  | "conflicting"
  | "stale";
export type Interest =
  | "food"
  | "italian"
  | "sights"
  | "sea"
  | "quiet"
  | "walks"
  | "nature";
export interface Evidence<T = unknown> {
  id: string;
  featureKey: string;
  scope: { hotelId?: string; roomTypeId?: string; placeId?: string };
  value: T;
  source: {
    kind: "fixture" | "open_data" | "review" | "host" | "calculated";
    name: string;
    url?: string;
    recordId?: string;
  };
  isSynthetic: boolean;
  confidence: number | null;
  status: EvidenceStatus;
  observedAt: string;
  validUntil?: string;
  method?: string;
  inputEvidenceIds?: string[];
  conflictsWith?: string[];
}
export interface Preference {
  id: string;
  participantId: string;
  key: string;
  value: unknown;
  importance: "required" | "preferred";
  priority: number;
  sourceMessageId?: string;
  updatedAt: string;
}
export interface Message {
  id: string;
  role: "user" | "agent";
  text: string;
  createdAt: string;
}
export interface Participant {
  id: string;
  name: string;
  role: "organizer" | "member" | "viewer";
  status: "collecting" | "ready" | "left";
  preferences: Preference[];
  messages: Message[];
  scenariosConfirmed: boolean;
  hotelsFinished: boolean;
}
export interface Scenario {
  id: string;
  selectionRevision: number;
  cityId: string;
  title: string;
  summary: string;
  imageAssetId: string;
  interests: Interest[];
  suggestedAreaIds: string[];
  dayOutline: string[];
  tradeoffs: string[];
  participantReasons: Record<string, string[]>;
  origin: "curated_demo";
  templateId: string;
}
export interface MediaAsset {
  id: string;
  path: string;
  kind: "exterior" | "room" | "area" | "detail";
  label: string;
  roomTypeId?: string;
  source: string;
  license: string;
  illustrative: boolean;
  objectPosition?: string;
}
export interface RoomType {
  id: string;
  name: string;
  capacity: number;
  images: MediaAsset[];
  features: Record<string, string | number | boolean | null>;
}
export interface Hotel {
  id: string;
  cityId: string;
  name: string;
  areaId: string;
  area: string;
  description: string;
  image: MediaAsset;
  gallery: MediaAsset[];
  room: RoomType;
  price: number | null;
  stars: number;
  rating: number | null;
  interests: Interest[];
  walkMinutes: number;
  seaMinutes: number;
  quiet: boolean | null;
  tradeoff: string;
  evidence: Evidence[];
  reviewExcerpts: ReviewExcerpt[];
}
export interface ReviewExcerpt {
  id: string;
  objectId: string;
  language: string;
  date: string;
  rating: number;
  scale: number;
  text: string;
  topics: string[];
  source: string;
  isSynthetic: boolean;
}
export interface Place {
  id: string;
  cityId: string;
  name: string;
  kind: "food" | "italian" | "sights" | "sea" | "nature";
  description: string;
  minutes: number;
  imageAssetId: string;
}
export interface Route {
  id: string;
  origin: string;
  destination: string;
  mode: "walk";
  meters: number;
  minutes: number;
  straightMeters: number;
  geometry: [number, number][];
  source: string;
  isSynthetic: boolean;
  warning?: string;
}
export interface HotelCandidate {
  hotelId: string;
  roomTypeId: string;
  scenarioIds: string[];
  price: {
    amount: number | null;
    currency: "RUB";
    basis: "room_night";
    nights?: number;
    isSynthetic: true;
  };
  participantReasons: Record<string, string[]>;
  tradeoffs: string[];
  evidenceIds: string[];
  needsClarification: boolean;
}
export interface Vote {
  participantId: string;
  selectionRevision: number;
  entityType: "scenario" | "hotel";
  entityId: string;
  decision: Decision;
  rejectionReason?: { code: string; text?: string };
  updatedAt: string;
}
export interface FinalProposal {
  hotelId: string;
  roomTypeId: string;
  price: number | null;
  selectionRevision: number;
  confirmationIds: string[];
  proposedBy: string;
}
export interface SavedMaterial {
  id: string;
  type: "link" | "note" | "ticket";
  title: string;
  url?: string;
  text?: string;
  authorId: string;
}
export interface Trip {
  catalogVersion?: number;
  id: string;
  version: number;
  selectionRevision: number;
  title: string;
  cityId: string | null;
  cityConfirmed: boolean;
  nights: number;
  rooms: number;
  dates: { start: string; end: string } | null;
  organizerId: string;
  group: boolean;
  expectedParticipants: number;
  participants: Participant[];
  stage: "chat" | "scenarios" | "hotels" | "selected";
  votes: Vote[];
  scenarios: Scenario[];
  candidates: HotelCandidate[];
  proposal: FinalProposal | null;
  selected: FinalProposal | null;
  history: {
    revision: number;
    reason: string;
    selected: FinalProposal | null;
    votes: Vote[];
  }[];
  materials: SavedMaterial[];
  savedPlaces: string[];
  customPlaces: { id: string; name: string; note: string }[];
  inviteToken: string;
  inviteRevoked: boolean;
  createdAt: string;
  updatedAt: string;
  isDemo: boolean;
  demoKind?: string;
  processedCommands: string[];
  lastChange?: string;
}
export interface FeatureDefinition {
  key: string;
  label: string;
  type: "boolean" | "number" | "text";
  unit?: string;
  scope: "hotel" | "room" | "place";
  freshnessDays: number;
  acquisition: "host" | "fixture" | "geo";
}
export interface HostQuestion {
  id: string;
  hotelId: string;
  roomTypeId: string;
  question: string;
  answer?: string;
  suggestion?: {
    featureKey: string;
    value: string | boolean;
    scope: "hotel" | "room";
  };
  status: "asked" | "extracted" | "confirmed";
  createdBy: string;
  createdAt: string;
}
export interface TripView
  extends Omit<Trip, "participants" | "inviteToken" | "processedCommands"> {
  participants: Omit<Participant, "messages">[];
  me: Participant;
  inviteUrl?: string;
  scenarioIds: string[];
  matches: string[];
  waitingHotelIds: string[];
  blocked: boolean;
  agentMode: "mock" | "deepseek";
  catalog: Hotel[];
  places: Place[];
}
