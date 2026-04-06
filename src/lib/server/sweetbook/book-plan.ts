import type {
  SweetbookBookPlan,
  SweetbookBookPlanOperation,
  TripChapter,
  TripIntakeResult,
} from "@/lib/trip-domain";
import { travelPhotobookPreset } from "@/lib/sweetbook-catalog";
import {
  resolveTravelTheme,
  type TravelThemeId,
} from "@/lib/travel-themes";

function formatDateRange(start: string | null, end: string | null) {
  if (start && end) {
    return `${start} - ${end}`;
  }

  if (start) {
    return start;
  }

  if (end) {
    return end;
  }

  return "여행 아카이브";
}

function buildSubtitle(trip: TripIntakeResult) {
  return `${trip.stats.totalPhotos}장의 사진, ${trip.chapters.length}개의 장면`;
}

function buildDividerParameters(chapter: TripChapter, themeId: TravelThemeId) {
  switch (themeId) {
    case "timeline-classic":
      return {
        monthYearTitle: chapter.dayLabel,
        dateRangeDetail: chapter.placeLabel,
        photoCount: `${chapter.photoCount}장`,
      };
    case "photo-essay":
      return {
        monthYearTitle: chapter.placeLabel,
        dateRangeDetail: `${chapter.dayLabel}의 대표 장면`,
        photoCount: `대표 사진 ${chapter.photoCount}장`,
      };
    case "postcard-map":
    default:
      return {
        monthYearTitle: chapter.placeLabel,
        dateRangeDetail: `${chapter.dayLabel} 체크포인트`,
        photoCount: `${chapter.photoCount}장 이동 기록`,
      };
  }
}

function buildDividerOperation(
  chapter: TripChapter,
  themeId: TravelThemeId,
): SweetbookBookPlanOperation {
  return {
    kind: "divider",
    templateUid: travelPhotobookPreset.templates.divider,
    parameters: buildDividerParameters(chapter, themeId),
    photoIds: chapter.photoIds,
  };
}

function shouldUsePrimaryTemplate(themeId: TravelThemeId, index: number) {
  switch (themeId) {
    case "timeline-classic":
      return index % 2 === 0;
    case "photo-essay":
      return true;
    case "postcard-map":
    default:
      return index % 3 !== 1;
  }
}

function buildContentParameters(
  chapter: TripChapter,
  themeId: TravelThemeId,
  isPrimary: boolean,
) {
  if (isPrimary) {
    return {
      monthYearLabel:
        themeId === "postcard-map"
          ? `${chapter.placeLabel} / ${chapter.dayLabel}`
          : `${chapter.dayLabel} / ${chapter.placeLabel}`,
      photos: chapter.photoIds,
    };
  }

  return {
    dayLabel:
      themeId === "photo-essay"
        ? `${chapter.placeLabel}의 여백`
        : `${chapter.dayLabel} / ${chapter.placeLabel}`,
    photos: chapter.photoIds,
  };
}

function buildContentOperation(
  chapter: TripChapter,
  index: number,
  themeId: TravelThemeId,
): SweetbookBookPlanOperation {
  const isPrimary = shouldUsePrimaryTemplate(themeId, index);

  return {
    kind: "content",
    templateUid: isPrimary
      ? travelPhotobookPreset.templates.contentPrimary
      : travelPhotobookPreset.templates.contentSecondary,
    parameters: buildContentParameters(chapter, themeId, isPrimary),
    photoIds: chapter.photoIds,
  };
}

function buildPublishOperation(
  trip: TripIntakeResult,
  themeId: TravelThemeId,
): SweetbookBookPlanOperation {
  const firstPhoto = trip.photos[0];
  const travelTheme = resolveTravelTheme(themeId);

  return {
    kind: "publish",
    templateUid: travelPhotobookPreset.templates.publish,
    parameters: {
      photo: firstPhoto?.id ?? null,
      title: trip.tripName,
      publishDate: new Date().toISOString().slice(0, 10),
      author: "Triplogue",
      hashtags:
        themeId === "photo-essay"
          ? "#travel #photoessay #sweetbook"
          : themeId === "timeline-classic"
            ? "#travel #timeline #sweetbook"
            : "#travel #map #sweetbook",
      publisher: `Triplogue x Sweetbook / ${travelTheme.name}`,
    },
    photoIds: firstPhoto ? [firstPhoto.id] : [],
  };
}

export function buildSweetbookTravelBookPlan(
  trip: TripIntakeResult,
): SweetbookBookPlan {
  const dateRange = formatDateRange(trip.travelStart, trip.travelEnd);
  const travelTheme = resolveTravelTheme(trip.selectedThemeId);
  const operations: SweetbookBookPlanOperation[] = [
    {
      kind: "cover",
      templateUid: travelPhotobookPreset.templates.cover,
      parameters: {
        coverPhoto: trip.photos[0]?.id ?? null,
        subtitle: `${buildSubtitle(trip)} · ${travelTheme.name}`,
        dateRange,
      },
    },
  ];

  trip.chapters.forEach((chapter, index) => {
    operations.push(buildDividerOperation(chapter, travelTheme.id));
    operations.push(buildContentOperation(chapter, index, travelTheme.id));
  });

  operations.push(buildPublishOperation(trip, travelTheme.id));

  return {
    title: trip.tripName,
    subtitle: buildSubtitle(trip),
    dateRange,
    bookSpecUid: travelPhotobookPreset.bookSpecUid,
    themeLabel: `${travelPhotobookPreset.label} / ${travelTheme.name}`,
    selectedThemeId: travelTheme.id,
    operations,
  };
}
