import {
  readFile,
  writeFile,
  mkdir,
  copyFile,
  realpath,
} from "node:fs/promises";
import { resolve, dirname, relative, isAbsolute } from "node:path";
import { createHash } from "node:crypto";

const root = process.cwd();
const incoming = resolve(
  root,
  process.argv[2] || "data/incoming/ostrovok-final",
);
const output = resolve(root, "data/final");
const publicRoot = resolve(root, "public/demo/final");
const json = async (path) =>
  JSON.parse(await readFile(resolve(incoming, path), "utf8"));
const sha = (bytes) => createHash("sha256").update(bytes).digest("hex");
const jsonl = async (path) =>
  (await readFile(resolve(incoming, path), "utf8"))
    .split(/\r?\n/)
    .filter(Boolean)
    .map((s) => JSON.parse(s));
const catalog = await json("data/hotels_catalog.json");
const mapping = await json("hotel_photos.json");
const metadata = await json("photo_metadata.json");
const permission = await json("photo_permission.json");
const documents = await jsonl("data/hotel_search_texts.jsonl");
const full = await jsonl("data/hotel_texts_full.jsonl");
const embeddings = await json("data/hotel_embedding_ids.json");
const ids = new Set(catalog.map((h) => h.hotel_id));
const allowed = new Set([
  "matched",
  "matched_from_existing_parser",
  "fallback_web_match",
]);
if (ids.size !== catalog.length || catalog.length !== 300)
  throw Error("Expected 300 unique source hotel IDs");
for (const rows of [documents, full]) {
  if (
    rows.length !== ids.size ||
    new Set(rows.map((d) => d.hotel_id)).size !== ids.size ||
    rows.some((d) => !ids.has(d.hotel_id))
  )
    throw Error("Search documents and catalog IDs differ");
}
if (
  JSON.stringify(embeddings) !==
  JSON.stringify(documents.map((d) => d.hotel_id))
)
  throw Error("Embedding ID order differs from search texts");
if (
  Object.keys(mapping).length !== ids.size ||
  Object.keys(mapping).some((id) => !ids.has(id))
)
  throw Error("Photo manifest and catalog IDs differ");
const embeddingMetadata = await json("data/embedding_metadata.json");
if (
  embeddingMetadata.text_file_sha256 !==
  sha(await readFile(resolve(incoming, "data/hotel_search_texts.jsonl")))
)
  throw Error("Embedding source SHA mismatch");
const fullById = new Map(full.map((d) => [d.hotel_id, d]));
const sourcePublic = await realpath(resolve(incoming, "public"));
const assetTasks = [];
const photos = {};
const search = {};
const statuses = {};
let publishedFiles = 0;
for (const hotel of catalog) {
  const id = hotel.hotel_id;
  if (!/^kaggle_\d+$/.test(id)) throw Error("Unexpected source ID");
  const row = mapping[id];
  const meta = metadata[id];
  if (row.hotel_id !== id || meta?.hotel_id !== id)
    throw Error("Photo evidence ID mismatch");
  const gallery = [...new Set([row.image_url, ...row.gallery].filter(Boolean))];
  const provenance = [];
  if (
    gallery.length &&
    (!allowed.has(row.match_status) ||
      row.usage_status !== "allowed" ||
      !meta.license ||
      meta.license === "unknown")
  )
    throw Error("Photo lacks a publication decision");
  if (
    gallery.length &&
    meta.license === "user_attested_hackathon_permission" &&
    (permission.scope !== "hackathon" || permission.usage_status !== "allowed")
  )
    throw Error("Hackathon permission not present");
  const mappedGallery = [];
  for (const path of gallery) {
    if (!new RegExp(`^/hotel-images/${id}/[a-zA-Z0-9_.-]+\\.webp$`).test(path))
      throw Error("Invalid public photo path");
    const asset = await realpath(resolve(sourcePublic, `.${path}`));
    const rel = relative(sourcePublic, asset);
    if (rel.startsWith("..") || isAbsolute(rel))
      throw Error("Photo path leaves source public directory");
    const evidence = meta.photos.find(
      (p) =>
        p.public_path === path &&
        allowed.has(p.match_status) &&
        p.usage_status === "allowed",
    );
    if (!evidence) throw Error("Missing per-photo provenance");
    const bytes = await readFile(asset);
    if (
      sha(bytes) !== evidence.sha256 ||
      bytes.subarray(0, 4).toString() !== "RIFF" ||
      bytes.subarray(8, 12).toString() !== "WEBP"
    )
      throw Error("Photo integrity mismatch");
    const publicPath = `/demo/final${path}`;
    assetTasks.push({
      asset,
      destination: resolve(root, `public${publicPath}`),
    });
    mappedGallery.push(publicPath);
    provenance.push({
      path: publicPath,
      sha256: evidence.sha256,
      sourceUrl: evidence.source_url,
      originalImageUrl: evidence.image_url,
      author: evidence.creator || meta.author || null,
      license: evidence.license || meta.license,
      licenseUrl: meta.license_url || null,
      matchStatus: evidence.match_status,
      usageStatus: evidence.usage_status,
      identityEvidence: evidence.identity_evidence || null,
    });
    publishedFiles++;
  }
  statuses[row.match_status] = (statuses[row.match_status] || 0) + 1;
  photos[id] = {
    hotelId: id,
    imageUrl: mappedGallery[0] || null,
    gallery: mappedGallery,
    displayImageUrl: mappedGallery[0] || "/demo/final/illustration.svg",
    imageType: mappedGallery.length ? "hotel_photo" : "illustration",
    matchStatus: row.match_status,
    confidence: row.confidence,
    usageStatus: row.usage_status,
    license: meta.license || null,
    sourceUrl: meta.source_url || null,
    author: meta.author || null,
    licenseUrl: meta.license_url || null,
    identityVerified: hotel.identity_verified,
    photos: provenance,
  };
  const document = documents.find((d) => d.hotel_id === id);
  const fullText = fullById.get(id)?.embedding_text || "";
  const text = [
    hotel.name,
    hotel.description_snapshot,
    hotel.amenities_snapshot.join(" "),
  ].join(" ");
  search[id] = {
    hotelId: id,
    embeddingText: document.embedding_text,
    fullText,
    searchTerms: [
      ...new Set(
        text
          .toLowerCase()
          .replaceAll("ё", "е")
          .match(/[\p{L}\d]{3,}/gu) || [],
      ),
    ],
    tags: hotel.amenities_snapshot,
    sources: hotel.sources,
  };
}
// Validate all provenance and hashes before making output mutations.
for (const { asset, destination } of assetTasks) {
  await mkdir(dirname(destination), { recursive: true });
  await copyFile(asset, destination);
}
await mkdir(publicRoot, { recursive: true });
await copyFile(
  resolve(incoming, "public/illustrations/petersburg.svg"),
  resolve(publicRoot, "illustration.svg"),
);
await copyFile(
  resolve(incoming, "public/photo_credits.json"),
  resolve(publicRoot, "credits.json"),
);
await copyFile(
  resolve(incoming, "public/photo_credits.html"),
  resolve(publicRoot, "credits.html"),
);
await mkdir(output, { recursive: true });
const report = {
  source: "ostrovok_mvp_FINAL_frontend.zip",
  hotels: catalog.length,
  photographedHotels: Object.values(photos).filter(
    (p) => p.imageType === "hotel_photo",
  ).length,
  illustrations: Object.values(photos).filter(
    (p) => p.imageType === "illustration",
  ).length,
  publishedFiles,
  multiPhotoGalleries: Object.values(photos).filter((p) => p.gallery.length > 1)
    .length,
  statuses,
  catalogSha256: sha(Buffer.from(JSON.stringify(catalog))),
  embeddingModel: embeddingMetadata.model,
  embeddingDimensions: embeddingMetadata.dimension,
  queryPrefix: embeddingMetadata.query_prefix,
  identityVerifiedCount: catalog.filter((h) => h.identity_verified).length,
  permission: {
    scope: permission.scope,
    usageStatus: permission.usage_status,
    independentlyVerified: permission.independently_verified,
    validOutsideHackathon: permission.valid_outside_hackathon,
  },
  search: {
    native: "E5 + metric-percentiles",
    semanticWeight: 0.68,
    metricWeight: 0.32,
    quietSemanticWeight: 0.4,
    quietMetricWeight: 0.6,
    quietNightlifeWeight: 4,
    metricPercentiles: [10, 90],
    hardNightlifeMetric: "nightlife_within_500m",
    centerIsSemanticOnly: true,
    currentPrices: false,
  },
};
for (const [name, value] of Object.entries({
  "catalog.json": catalog,
  "photo-manifest.json": photos,
  "search-documents.json": search,
  "import-report.json": report,
}))
  await writeFile(resolve(output, name), JSON.stringify(value, null, 2) + "\n");
for (const name of [
  "embedding_metadata.json",
  "hotel_embedding_ids.json",
  "hotel_embeddings.npy",
  "hotel_search_texts.jsonl",
])
  await copyFile(resolve(incoming, "data", name), resolve(output, name));
console.log(JSON.stringify(report, null, 2));
