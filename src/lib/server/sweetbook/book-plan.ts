import type {
  SweetbookBookPlan,
  SweetbookBookPlanOperation,
  TripChapter,
  TripIntakeResult,
} from "@/lib/trip-domain";
import { travelPhotobookPreset } from "@/lib/sweetbook-catalog";

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

  return "Travel Archive";
}

function buildSubtitle(trip: TripIntakeResult) {
  return `${trip.stats.totalPhotos}장의 사진, ${trip.chapters.length}개의 장면`;
}

function buildDividerOperation(chapter: TripChapter): SweetbookBookPlanOperation {
  return {
    kind: "divider",
    templateUid: travelPhotobookPreset.templates.divider,
    parameters: {
      monthYearTitle: chapter.placeLabel,
      dateRangeDetail: chapter.dateKey,
      photoCount: `${chapter.photoCount} photos`,
    },
    photoIds: chapter.photoIds,
  };
}

function buildContentOperation(
  chapter: TripChapter,
  index: number,
): SweetbookBookPlanOperation {
  const isPrimary = index % 2 === 0;

  return {
    kind: "content",
    templateUid: isPrimary
      ? travelPhotobookPreset.templates.contentPrimary
      : travelPhotobookPreset.templates.contentSecondary,
    parameters: isPrimary
      ? {
          monthYearLabel: `${chapter.dayLabel} / ${chapter.placeLabel}`,
          photos: chapter.photoIds,
        }
      : {
          dayLabel: `${chapter.dayLabel} / ${chapter.placeLabel}`,
          photos: chapter.photoIds,
        },
    photoIds: chapter.photoIds,
  };
}

function buildPublishOperation(trip: TripIntakeResult): SweetbookBookPlanOperation {
  const firstPhoto = trip.photos[0];

  return {
    kind: "publish",
    templateUid: travelPhotobookPreset.templates.publish,
    parameters: {
      photo: firstPhoto?.id ?? null,
      title: trip.tripName,
      publishDate: new Date().toISOString().slice(0, 10),
      author: "Triplogue",
      hashtags: "#travel #photobook #sweetbook",
      publisher: "Triplogue x Sweetbook",
    },
    photoIds: firstPhoto ? [firstPhoto.id] : [],
  };
}

export function buildSweetbookTravelBookPlan(
  trip: TripIntakeResult,
): SweetbookBookPlan {
  const dateRange = formatDateRange(trip.travelStart, trip.travelEnd);
  const operations: SweetbookBookPlanOperation[] = [
    {
      kind: "cover",
      templateUid: travelPhotobookPreset.templates.cover,
      parameters: {
        coverPhoto: trip.photos[0]?.id ?? null,
        subtitle: buildSubtitle(trip),
        dateRange,
      },
    },
  ];

  trip.chapters.forEach((chapter, index) => {
    operations.push(buildDividerOperation(chapter));
    operations.push(buildContentOperation(chapter, index));
  });

  operations.push(buildPublishOperation(trip));

  return {
    title: trip.tripName,
    subtitle: buildSubtitle(trip),
    dateRange,
    bookSpecUid: travelPhotobookPreset.bookSpecUid,
    themeLabel: travelPhotobookPreset.label,
    operations,
  };
}
