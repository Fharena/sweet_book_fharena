import type {
  ImportedPhoto,
  PhotoLocationSource,
  TripIntakeResult,
} from "@/lib/trip-domain";
import { DEFAULT_TRAVEL_THEME_ID } from "@/lib/travel-themes";

const THREE_HOURS_IN_MS = 3 * 60 * 60 * 1000;
const LOCATION_CLUSTER_DISTANCE_KM = 0.85;

type LocationCluster = {
  dateKey: string;
  label: string | null;
  latitude: number;
  longitude: number;
  photoIds: string[];
};

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

function isMeaningfulLocationLabel(label: string | null) {
  return Boolean(label && !/^-?\d+\.\d+,\s*-?\d+\.\d+$/.test(label));
}

function toRadians(value: number) {
  return (value * Math.PI) / 180;
}

function getDistanceInKilometers(
  left: { latitude: number; longitude: number },
  right: { latitude: number; longitude: number },
) {
  const earthRadius = 6371;
  const latitudeDelta = toRadians(right.latitude - left.latitude);
  const longitudeDelta = toRadians(right.longitude - left.longitude);
  const latitudeA = toRadians(left.latitude);
  const latitudeB = toRadians(right.latitude);

  const haversine =
    Math.sin(latitudeDelta / 2) ** 2 +
    Math.cos(latitudeA) *
      Math.cos(latitudeB) *
      Math.sin(longitudeDelta / 2) ** 2;

  return 2 * earthRadius * Math.asin(Math.sqrt(haversine));
}

function clusterGpsPhotos(sortedPhotos: ImportedPhoto[]) {
  const clusters = [] as LocationCluster[];
  const photoClusterMap = new Map<string, LocationCluster>();

  for (const photo of sortedPhotos) {
    const coordinates = photo.coordinates;

    if (!coordinates) {
      continue;
    }

    const matchingCluster = clusters.find(
      (cluster) =>
        cluster.dateKey === photo.dateKey &&
        getDistanceInKilometers(cluster, coordinates) <= LOCATION_CLUSTER_DISTANCE_KM,
    );

    if (matchingCluster) {
      matchingCluster.photoIds.push(photo.id);
      const nextCount = matchingCluster.photoIds.length;
      matchingCluster.latitude =
        (matchingCluster.latitude * (nextCount - 1) + coordinates.latitude) / nextCount;
      matchingCluster.longitude =
        (matchingCluster.longitude * (nextCount - 1) + coordinates.longitude) / nextCount;

      if (isMeaningfulLocationLabel(photo.locationLabel)) {
        matchingCluster.label = photo.locationLabel;
      }

      photoClusterMap.set(photo.id, matchingCluster);
      continue;
    }

    const nextCluster = {
      dateKey: photo.dateKey,
      label: isMeaningfulLocationLabel(photo.locationLabel) ? photo.locationLabel : null,
      latitude: coordinates.latitude,
      longitude: coordinates.longitude,
      photoIds: [photo.id],
    } satisfies LocationCluster;

    clusters.push(nextCluster);
    photoClusterMap.set(photo.id, nextCluster);
  }

  const clusterOrder = new Map<string, number>();

  clusters.forEach((cluster, index) => {
    if (!cluster.label) {
      cluster.label = `스팟 ${index + 1}`;
    }

    clusterOrder.set(`${cluster.dateKey}:${cluster.label}`, index + 1);
  });

  return { photoClusterMap, clusterOrder };
}

function enrichMissingLocationLabels(sortedPhotos: ImportedPhoto[]) {
  const { photoClusterMap, clusterOrder } = clusterGpsPhotos(sortedPhotos);

  return sortedPhotos.map<ImportedPhoto>((photo, index) => {
    const ownCluster = photoClusterMap.get(photo.id);
    const ownClusterLabel = ownCluster?.label ?? null;

    if (isMeaningfulLocationLabel(photo.locationLabel)) {
      return {
        ...photo,
        requiresManualLocationTagging: false,
      };
    }

    if (ownClusterLabel) {
      const clusterIndex =
        clusterOrder.get(`${photo.dateKey}:${ownClusterLabel}`) ?? index + 1;

      return {
        ...photo,
        locationLabel: ownClusterLabel,
        locationSource: photo.locationSource === "manual" ? "manual" : "exif",
        requiresManualLocationTagging: false,
        groupingReason: `GPS 좌표를 기준으로 ${ownClusterLabel} 클러스터 #${clusterIndex}에 자동 배치했습니다.`,
      };
    }

    if (!photo.capturedAt) {
      return {
        ...photo,
        groupingReason:
          photo.groupingReason || "촬영 시간이 없어 수동 위치 태깅이 필요합니다.",
      };
    }

    const currentTime = toTimestamp(photo.capturedAt);
    if (currentTime === null) {
      return photo;
    }

    let nearest: ImportedPhoto | null = null;
    let nearestDelta = Number.POSITIVE_INFINITY;

    for (const candidate of sortedPhotos) {
      const candidateLabel = isMeaningfulLocationLabel(candidate.locationLabel)
        ? candidate.locationLabel
        : photoClusterMap.get(candidate.id)?.label;

      if (!candidateLabel || candidate.dateKey !== photo.dateKey) {
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
        locationLabel:
          nearest.locationLabel ?? photoClusterMap.get(nearest.id)?.label ?? null,
        locationSource: "time-cluster" as PhotoLocationSource,
        requiresManualLocationTagging: false,
        groupingReason: `${nearest.fileName}의 같은 날짜 위치 흐름을 기준으로 장소를 보완했습니다.`,
      };
    }

    return {
      ...photo,
      groupingReason:
        index === 0
          ? "GPS와 시간 힌트만으로는 장소를 특정하지 못해 수동 태깅이 필요합니다."
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
