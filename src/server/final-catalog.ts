import photoSource from "../../data/final/photo-manifest.json";
import searchSource from "../../data/final/search-documents.json";
import report from "../../data/final/import-report.json";

export interface FinalPhotoEvidence {
  path: string;
  sha256: string;
  sourceUrl: string;
  originalImageUrl: string;
  author: string | null;
  license: string;
  licenseUrl: string | null;
  matchStatus: string;
  usageStatus: string;
  identityEvidence: unknown;
}
export interface FinalHotelMedia {
  hotelId: string;
  imageUrl: string | null;
  gallery: string[];
  displayImageUrl: string;
  imageType: "hotel_photo" | "illustration";
  matchStatus: string;
  confidence: string;
  usageStatus: string;
  license: string | null;
  sourceUrl: string | null;
  author: string | null;
  licenseUrl: string | null;
  identityVerified: boolean;
  photos: FinalPhotoEvidence[];
}
export interface FinalSearchDocument {
  hotelId: string;
  embeddingText: string;
  fullText: string;
  searchTerms: string[];
  tags: string[];
  sources: Record<string, string>;
}
const media = photoSource as Record<string, FinalHotelMedia>;
const documents = searchSource as Record<string, FinalSearchDocument>;
export const finalCatalogImport = report;

/** Join media by the stable source hotel_id; never change hotel identity/rank. */
export function finalHotelMedia(id: string): FinalHotelMedia | undefined {
  return Object.hasOwn(media, id) ? media[id] : undefined;
}
export function finalHotelGallery(id: string): string[] {
  const row = finalHotelMedia(id);
  return row?.imageType === "hotel_photo" ? [...row.gallery] : [];
}
export function finalHotelSearchDocument(
  id: string,
): FinalSearchDocument | undefined {
  return Object.hasOwn(documents, id) ? documents[id] : undefined;
}
export function finalSearchText(id: string, full = false): string {
  const document = finalHotelSearchDocument(id);
  return (full ? document?.fullText : document?.embeddingText) || "";
}
