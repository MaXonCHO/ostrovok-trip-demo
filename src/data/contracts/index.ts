import type {
  Trip,
  Hotel,
  Place,
  Evidence,
  Scenario,
  HotelCandidate,
  Route,
  Preference,
  FeatureDefinition,
} from "@/domain/models";
export interface CatalogRepository {
  listHotels(query: { cityId: string }): Promise<Hotel[]>;
  getHotel(id: string): Promise<Hotel | null>;
  listPlaces(query: { cityId: string }): Promise<Place[]>;
  getEvidence(ids: string[]): Promise<Evidence[]>;
  addEvidence(hotelId: string, evidence: Evidence): Promise<void>;
}
export interface TripRepository {
  get(id: string): Promise<Trip | null>;
  create(trip: Trip): Promise<Trip>;
  applyCommand(
    id: string,
    expectedVersion: number,
    command: (trip: Trip) => Promise<void> | void,
  ): Promise<Trip>;
}
export interface AgentInput {
  trip: Trip;
  participantId: string;
  text: string;
}
export interface AgentReply {
  text: string;
  updates: Pick<Preference, "key" | "value" | "importance" | "priority">[];
  cityId?: string;
}
export interface AgentProvider {
  reply(input: AgentInput): Promise<AgentReply>;
}
export interface RecommendationProvider {
  getScenarios(input: { trip: Trip }): Promise<Scenario[]>;
  getHotels(input: {
    trip: Trip;
    scenarioIds: string[];
  }): Promise<HotelCandidate[]>;
}
export interface GeoProvider {
  getRoute(input: { hotelId: string; placeId: string }): Promise<Route>;
  evaluateFeature(input: {
    hotelId: string;
    featureKey: string;
  }): Promise<Evidence>;
}
export const features: FeatureDefinition[] = [
  {
    key: "quiet",
    label: "Тишина ночью",
    type: "boolean",
    scope: "hotel",
    freshnessDays: 90,
    acquisition: "host",
  },
  {
    key: "windowSide",
    label: "Сторона окон",
    type: "text",
    scope: "room",
    freshnessDays: 365,
    acquisition: "host",
  },
  {
    key: "seaWalk",
    label: "Пешком к морю",
    type: "number",
    unit: "мин",
    scope: "hotel",
    freshnessDays: 180,
    acquisition: "geo",
  },
];
