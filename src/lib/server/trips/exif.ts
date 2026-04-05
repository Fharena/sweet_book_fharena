import exifr from "exifr";

import type { GeoPoint, ImportedPhoto, ManualLocationOverride } from "@/lib/trip-domain";

type ExtractPhotoMetadataOptions = {
  index: number;
  manualOverrides?: Map<string, ManualLocationOverride>;
};

type ExifEnvelope = {
  latitude?: number;
  longitude?: number;
  DateTimeOriginal?: Date | string;
  CreateDate?: Date | string;
  ModifyDate?: Date | string;
};

function toDateKey(date: Date | null) {
  if (!date) {
    return "undated";
  }

  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  const day = `${date.getDate()}`.padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function toIsoString(value: Date | string | null | undefined) {
  if (!value) {
    return null;
  }

  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function pickCapturedAt(exif: ExifEnvelope | null) {
  const candidates = [exif?.DateTimeOriginal, exif?.CreateDate, exif?.ModifyDate];

  for (const candidate of candidates) {
    const normalized = toIsoString(candidate);
    if (normalized) {
      return normalized;
    }
  }

  return null;
}

function formatCoordinateLabel(coordinates: GeoPoint) {
  return `${coordinates.latitude.toFixed(4)}, ${coordinates.longitude.toFixed(4)}`;
}

function normalizeCoordinates(exif: ExifEnvelope | null) {
  if (
    typeof exif?.latitude === "number" &&
    typeof exif?.longitude === "number"
  ) {
    return {
      latitude: exif.latitude,
      longitude: exif.longitude,
    };
  }

  return null;
}

export async function extractPhotoMetadata(
  file: File,
  options: ExtractPhotoMetadataOptions,
): Promise<ImportedPhoto> {
  const arrayBuffer = await file.arrayBuffer();
  let exif: ExifEnvelope | null = null;

  try {
    exif = (await exifr.parse(arrayBuffer)) as ExifEnvelope | null;
  } catch {
    exif = null;
  }

  const capturedAt = pickCapturedAt(exif);
  const coordinates = normalizeCoordinates(exif);
  const override = options.manualOverrides?.get(file.name);

  let locationLabel: string | null = null;
  let locationSource: ImportedPhoto["locationSource"] = "unknown";
  let groupingReason = "No EXIF location found yet.";

  if (override?.locationLabel) {
    locationLabel = override.locationLabel;
    locationSource = "manual";
    groupingReason = "Manual place tag provided by the user.";
  } else if (coordinates) {
    locationLabel = formatCoordinateLabel(coordinates);
    locationSource = "exif";
    groupingReason = "Resolved directly from EXIF GPS metadata.";
  }

  const capturedDate = capturedAt ? new Date(capturedAt) : null;

  return {
    id: `photo-${options.index + 1}-${file.name}`,
    assetId: null,
    fileName: file.name,
    originalName: file.name,
    mimeType: file.type || "application/octet-stream",
    size: file.size,
    capturedAt,
    dateKey: toDateKey(capturedDate),
    coordinates:
      override?.latitude !== undefined && override?.longitude !== undefined
        ? {
            latitude: override.latitude,
            longitude: override.longitude,
          }
        : coordinates,
    locationLabel,
    locationSource,
    requiresManualLocationTagging: !locationLabel,
    groupingReason,
  };
}
