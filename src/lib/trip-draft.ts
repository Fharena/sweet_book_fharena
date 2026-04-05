export type TripDraftPhoto = {
  id: string;
  assetId: string | null;
  fileName: string;
  originalName: string;
  mimeType: string;
  size: number;
  capturedAt: string | null;
  dateKey: string;
  coordinates: { latitude: number; longitude: number } | null;
  locationLabel: string | null;
  locationSource: string;
  requiresManualLocationTagging: boolean;
  groupingReason: string;
};

export type TripDraftChapter = {
  id: string;
  title: string;
  dayLabel: string;
  dateKey: string;
  placeLabel: string;
  photoIds: string[];
  photoCount: number;
  locationSource: string;
  groupingReason: string;
};

export type TripDraftStats = {
  totalPhotos: number;
  withCaptureTime: number;
  withGpsCoordinates: number;
  withResolvedLocation: number;
  manualTaggingRequired: number;
};

export type TripDraft = {
  tripName: string;
  travelStart: string | null;
  travelEnd: string | null;
  photos: TripDraftPhoto[];
  chapters: TripDraftChapter[];
  stats: TripDraftStats;
};

export const TRIP_DRAFT_STORAGE_KEY = "triplogue:intake";
export const TRIP_DRAFT_STORAGE_EVENT = "triplogue:draft-changed";

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isTripDraftPhoto(value: unknown): value is TripDraftPhoto {
  return (
    isObject(value) &&
    typeof value.id === "string" &&
    (typeof value.assetId === "string" || value.assetId === null) &&
    typeof value.fileName === "string" &&
    typeof value.originalName === "string" &&
    typeof value.mimeType === "string" &&
    typeof value.size === "number" &&
    (typeof value.capturedAt === "string" || value.capturedAt === null) &&
    typeof value.dateKey === "string" &&
    (value.coordinates === null ||
      (isObject(value.coordinates) &&
        typeof value.coordinates.latitude === "number" &&
        typeof value.coordinates.longitude === "number")) &&
    (typeof value.locationLabel === "string" || value.locationLabel === null) &&
    typeof value.locationSource === "string" &&
    typeof value.requiresManualLocationTagging === "boolean" &&
    typeof value.groupingReason === "string"
  );
}

function isTripDraftChapter(value: unknown): value is TripDraftChapter {
  return (
    isObject(value) &&
    typeof value.id === "string" &&
    typeof value.title === "string" &&
    typeof value.dayLabel === "string" &&
    typeof value.dateKey === "string" &&
    typeof value.placeLabel === "string" &&
    Array.isArray(value.photoIds) &&
    value.photoIds.every((photoId) => typeof photoId === "string") &&
    typeof value.photoCount === "number" &&
    typeof value.locationSource === "string" &&
    typeof value.groupingReason === "string"
  );
}

function isTripDraftStats(value: unknown): value is TripDraftStats {
  return (
    isObject(value) &&
    typeof value.totalPhotos === "number" &&
    typeof value.withCaptureTime === "number" &&
    typeof value.withGpsCoordinates === "number" &&
    typeof value.withResolvedLocation === "number" &&
    typeof value.manualTaggingRequired === "number"
  );
}

export function isTripDraft(value: unknown): value is TripDraft {
  return (
    isObject(value) &&
    typeof value.tripName === "string" &&
    (typeof value.travelStart === "string" || value.travelStart === null) &&
    (typeof value.travelEnd === "string" || value.travelEnd === null) &&
    Array.isArray(value.photos) &&
    value.photos.every(isTripDraftPhoto) &&
    Array.isArray(value.chapters) &&
    value.chapters.every(isTripDraftChapter) &&
    isTripDraftStats(value.stats)
  );
}

export function loadTripDraft(): TripDraft | null {
  if (typeof window === "undefined") {
    return null;
  }

  const rawValue = window.sessionStorage.getItem(TRIP_DRAFT_STORAGE_KEY);
  if (!rawValue) {
    return null;
  }

  try {
    const parsed = JSON.parse(rawValue) as unknown;
    return isTripDraft(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

export function saveTripDraft(draft: TripDraft) {
  if (typeof window === "undefined") {
    return;
  }

  window.sessionStorage.setItem(TRIP_DRAFT_STORAGE_KEY, JSON.stringify(draft));
  window.dispatchEvent(new Event(TRIP_DRAFT_STORAGE_EVENT));
}

export function clearTripDraft() {
  if (typeof window === "undefined") {
    return;
  }

  window.sessionStorage.removeItem(TRIP_DRAFT_STORAGE_KEY);
  window.dispatchEvent(new Event(TRIP_DRAFT_STORAGE_EVENT));
}
