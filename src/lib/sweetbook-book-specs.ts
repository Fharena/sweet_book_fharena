export type SweetbookBookSpec = {
  bookSpecUid: string;
  name: string;
  innerTrimWidthMm: number;
  innerTrimHeightMm: number;
  pageMin: number;
  pageMax: number;
  pageDefault: number;
  pageIncrement: number;
  coverType: string;
  bindingType: string;
  priceBase: number | null;
  pricePerIncrement: number | null;
  sandboxPriceBase: number | null;
  sandboxPricePerIncrement: number | null;
};

export type SweetbookEnvironment = "sandbox" | "live";

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function asNumber(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

function asNullableNumber(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function asText(value: unknown) {
  return typeof value === "string" ? value : "";
}

function normalizeBookSpec(value: unknown): SweetbookBookSpec | null {
  if (!isObject(value) || typeof value.bookSpecUid !== "string") {
    return null;
  }

  return {
    bookSpecUid: value.bookSpecUid,
    name: asText(value.name),
    innerTrimWidthMm: asNumber(value.innerTrimWidthMm),
    innerTrimHeightMm: asNumber(value.innerTrimHeightMm),
    pageMin: asNumber(value.pageMin),
    pageMax: asNumber(value.pageMax),
    pageDefault: asNumber(value.pageDefault),
    pageIncrement: asNumber(value.pageIncrement),
    coverType: asText(value.coverType),
    bindingType: asText(value.bindingType),
    priceBase: asNullableNumber(value.priceBase),
    pricePerIncrement: asNullableNumber(value.pricePerIncrement),
    sandboxPriceBase: asNullableNumber(value.sandboxPriceBase),
    sandboxPricePerIncrement: asNullableNumber(value.sandboxPricePerIncrement),
  };
}

export function extractSweetbookBookSpecs(payload: unknown) {
  if (!isObject(payload) || !Array.isArray(payload.data)) {
    return [] as SweetbookBookSpec[];
  }

  return payload.data
    .map((entry) => normalizeBookSpec(entry))
    .filter((entry): entry is SweetbookBookSpec => entry !== null);
}

export function findSweetbookBookSpec(
  bookSpecs: SweetbookBookSpec[],
  bookSpecUid: string,
) {
  return bookSpecs.find((bookSpec) => bookSpec.bookSpecUid === bookSpecUid) ?? null;
}

export function estimateRequestedTravelPages(photoCount: number, chapterCount: number) {
  return Math.max(24, chapterCount * 6 + Math.ceil(photoCount / 4) * 2);
}

export function normalizePageCountForBookSpec(
  requestedPageCount: number,
  bookSpec: SweetbookBookSpec | null,
) {
  if (!bookSpec) {
    return requestedPageCount;
  }

  const minimum = bookSpec.pageMin || bookSpec.pageDefault || 24;
  const increment = bookSpec.pageIncrement || 2;
  const maximum = bookSpec.pageMax || 0;
  const boundedBase = Math.max(requestedPageCount, minimum);
  const roundedCount =
    minimum + Math.ceil((boundedBase - minimum) / increment) * increment;

  if (maximum > 0) {
    return Math.min(roundedCount, maximum);
  }

  return roundedCount;
}

export function estimateDisplayPriceForBookSpec(
  pageCount: number,
  bookSpec: SweetbookBookSpec | null,
  environment: SweetbookEnvironment = "sandbox",
) {
  const fallbackPrice = Math.round(16800 + pageCount * 330);

  if (!bookSpec) {
    return fallbackPrice;
  }

  const minimum = bookSpec.pageMin || bookSpec.pageDefault || 24;
  const increment = bookSpec.pageIncrement || 2;
  const basePriceCandidates =
    environment === "live"
      ? [bookSpec.priceBase, bookSpec.sandboxPriceBase]
      : [bookSpec.sandboxPriceBase, bookSpec.priceBase];
  const incrementPriceCandidates =
    environment === "live"
      ? [bookSpec.pricePerIncrement, bookSpec.sandboxPricePerIncrement]
      : [bookSpec.sandboxPricePerIncrement, bookSpec.pricePerIncrement];
  const basePrice =
    basePriceCandidates.find((value) => typeof value === "number" && value >= 0) ?? null;
  const pricePerIncrement =
    incrementPriceCandidates.find((value) => typeof value === "number" && value >= 0) ?? 0;

  if (basePrice === null) {
    return fallbackPrice;
  }

  const increments = Math.max(0, Math.floor((pageCount - minimum) / increment));
  return Math.round(basePrice + increments * pricePerIncrement);
}

export function formatBookSpecDimension(bookSpec: SweetbookBookSpec | null) {
  if (
    !bookSpec ||
    bookSpec.innerTrimWidthMm <= 0 ||
    bookSpec.innerTrimHeightMm <= 0
  ) {
    return "규격 확인 중";
  }

  return `${bookSpec.innerTrimWidthMm} × ${bookSpec.innerTrimHeightMm} mm`;
}

export function formatBookSpecLabel(bookSpec: SweetbookBookSpec | null, fallbackLabel: string) {
  if (bookSpec?.name.trim()) {
    return bookSpec.name.trim();
  }

  return fallbackLabel;
}

export function formatPageRuleSummary(bookSpec: SweetbookBookSpec | null) {
  if (!bookSpec) {
    return "페이지 규격 확인 중";
  }

  const minimum = bookSpec.pageMin || bookSpec.pageDefault || 24;
  const maximum = bookSpec.pageMax || 0;
  const increment = bookSpec.pageIncrement || 2;

  return maximum > 0
    ? `최소 ${minimum}p · 최대 ${maximum}p · ${increment}p 단위`
    : `최소 ${minimum}p · ${increment}p 단위`;
}
