import type {
  ImportedPhoto,
  PhotoLocationSource,
  TripIntakeResult,
} from "@/lib/trip-domain";
import { DEFAULT_TRAVEL_THEME_ID } from "@/lib/travel-themes";

const THREE_HOURS_IN_MS = 3 * 60 * 60 * 1000;

function toTimestamp(value: string | null) {
  if (!value) {
    return null;
  }

  const parsed = new Date(value).getTime();
  return Number.isNaN(parsed) ? null : parsed;
}

export function comparePhotos(left: ImportedPhoto, right: ImportedPhoto) {
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

export function enrichMissingLocationLabels(sortedPhotos: ImportedPhoto[]) {
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
        groupingReason: `${nearest.fileName}의 같은 날짜 위치 정보를 기준으로 장소를 보완했습니다.`,
      };
    }

    return {
      ...photo,
      groupingReason:
        index === 0
          ? "GPS가 없고 같은 날짜의 인접 사진에서도 장소를 유추하지 못했습니다."
          : photo.groupingReason,
    };
  });
}

function formatDayLabel(dateKey: string, index: number) {
  return dateKey === "undated" ? "일정 미정" : `${index + 1}일차`;
}

function buildChapterTitle(placeLabel: string, dayLabel: string) {
  return placeLabel === "위치 태그 필요"
    ? `${dayLabel} / 위치 태그 필요`
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
  const chaptersMap = new Map<string, TripIntakeResult["chapters"][number]>();
  const dayOrder = Array.from(
    new Set(enrichedPhotos.map((photo) => photo.dateKey)),
  ).filter(Boolean);

  enrichedPhotos.forEach((photo) => {
    const placeLabel = photo.locationLabel ?? "위치 태그 필요";
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
    tripName: tripName || "이름 없는 여행",
    travelStart,
    travelEnd,
    selectedThemeId: DEFAULT_TRAVEL_THEME_ID,
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
