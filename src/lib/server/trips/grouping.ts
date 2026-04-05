import type { ImportedPhoto, PhotoLocationSource, TripChapter, TripIntakeResult } from "@/lib/trip-domain";

const THREE_HOURS_IN_MS = 3 * 60 * 60 * 1000;

function toTimestamp(value: string | null) {
  if (!value) {
    return null;
  }

  const parsed = new Date(value).getTime();
  return Number.isNaN(parsed) ? null : parsed;
}

function comparePhotos(left: ImportedPhoto, right: ImportedPhoto) {
  const leftTime = toTimestamp(left.capturedAt);
  const rightTime = toTimestamp(right.capturedAt);

  if (leftTime !== null && rightTime !== null) {
    return leftTime - rightTime;
  }

  if (leftTime !== null) {
    return -1;
  }

  if (rightTime !== null) {
    return 1;
  }

  return left.fileName.localeCompare(right.fileName);
}

function enrichMissingLocationLabels(sortedPhotos: ImportedPhoto[]) {
  return sortedPhotos.map<ImportedPhoto>((photo, index) => {
    if (photo.locationLabel || !photo.capturedAt) {
      return photo;
    }

    const currentTime = toTimestamp(photo.capturedAt);
    if (currentTime === null) {
      return photo;
    }

    let nearest: ImportedPhoto | null = null;
    let nearestDelta = Number.POSITIVE_INFINITY;

    for (const candidate of sortedPhotos) {
      if (!candidate.locationLabel || candidate.dateKey !== photo.dateKey) {
        continue;
      }

      const candidateTime = toTimestamp(candidate.capturedAt);
      if (candidateTime === null) {
        continue;
      }

      const delta = Math.abs(candidateTime - currentTime);
      if (delta < nearestDelta) {
        nearest = candidate;
        nearestDelta = delta;
      }
    }

    if (nearest && nearestDelta <= THREE_HOURS_IN_MS) {
      return {
        ...photo,
        locationLabel: nearest.locationLabel,
        locationSource: "time-cluster" as PhotoLocationSource,
        requiresManualLocationTagging: false,
        groupingReason: `Borrowed the nearest same-day location from ${nearest.fileName}.`,
      };
    }

    return {
      ...photo,
      groupingReason:
        index === 0
          ? "Missing GPS and no nearby same-day photo could infer a place."
          : photo.groupingReason,
    };
  });
}

function formatDayLabel(dateKey: string, index: number) {
  return dateKey === "undated" ? "Unscheduled" : `Day ${index + 1}`;
}

function buildChapterTitle(placeLabel: string, dayLabel: string) {
  return placeLabel === "Manual tag needed"
    ? `${dayLabel} / Tag your stop`
    : `${placeLabel} / ${dayLabel}`;
}

export function groupPhotosIntoTrip(
  tripName: string,
  travelStart: string | null,
  travelEnd: string | null,
  photos: ImportedPhoto[],
): TripIntakeResult {
  const sortedPhotos = [...photos].sort(comparePhotos);
  const enrichedPhotos = enrichMissingLocationLabels(sortedPhotos);
  const chaptersMap = new Map<string, TripChapter>();
  const dayOrder = Array.from(
    new Set(enrichedPhotos.map((photo) => photo.dateKey)),
  ).filter(Boolean);

  enrichedPhotos.forEach((photo) => {
    const placeLabel = photo.locationLabel ?? "Manual tag needed";
    const chapterKey = `${photo.dateKey}::${placeLabel}`;
    const dayIndex = Math.max(dayOrder.indexOf(photo.dateKey), 0);

    const existing = chaptersMap.get(chapterKey);
    if (existing) {
      existing.photoIds.push(photo.id);
      existing.photoCount += 1;
      return;
    }

    chaptersMap.set(chapterKey, {
      id: `chapter-${chaptersMap.size + 1}`,
      title: buildChapterTitle(placeLabel, formatDayLabel(photo.dateKey, dayIndex)),
      dayLabel: formatDayLabel(photo.dateKey, dayIndex),
      dateKey: photo.dateKey,
      placeLabel,
      photoIds: [photo.id],
      photoCount: 1,
      locationSource: photo.locationSource,
      groupingReason: photo.groupingReason,
    });
  });

  return {
    tripName: tripName || "Untitled Trip",
    travelStart,
    travelEnd,
    photos: enrichedPhotos,
    chapters: Array.from(chaptersMap.values()),
    stats: {
      totalPhotos: enrichedPhotos.length,
      withCaptureTime: enrichedPhotos.filter((photo) => photo.capturedAt).length,
      withGpsCoordinates: enrichedPhotos.filter((photo) => photo.coordinates).length,
      withResolvedLocation: enrichedPhotos.filter((photo) => photo.locationLabel).length,
      manualTaggingRequired: enrichedPhotos.filter(
        (photo) => photo.requiresManualLocationTagging,
      ).length,
    },
  };
}
