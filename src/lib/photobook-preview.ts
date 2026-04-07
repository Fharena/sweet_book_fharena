import type { TripDraft, TripDraftChapter, TripDraftPhoto } from "@/lib/trip-draft";
import {
  resolveTravelTheme,
  type TravelThemeDefinition,
  type TravelThemeId,
} from "@/lib/travel-themes";

export type PhotobookPreviewCover = {
  title: string;
  subtitle: string;
  accent: string;
  heroPhotoId: string | null;
};

export type PhotobookPreviewSpread = {
  id: string;
  chapterId: string;
  chapterTitle: string;
  dayLabel: string;
  placeLabel: string;
  caption: string;
  coordinateLabel: string | null;
  leadPhotoId: string | null;
  supportingPhotoIds: string[];
  photoCount: number;
  layoutKind: TravelThemeId;
};

export type PhotobookPreviewDocument = {
  theme: TravelThemeDefinition;
  cover: PhotobookPreviewCover;
  spreads: PhotobookPreviewSpread[];
};

function formatCoordinateLabel(photo: TripDraftPhoto | undefined) {
  if (!photo?.coordinates) {
    return null;
  }

  return `${photo.coordinates.latitude.toFixed(3)}, ${photo.coordinates.longitude.toFixed(3)}`;
}

function pickCaption(
  chapter: TripDraftChapter,
  photos: TripDraftPhoto[],
  themeId: TravelThemeId,
) {
  const leadPhoto = photos[0];

  switch (themeId) {
    case "timeline-classic":
      return leadPhoto?.capturedAt
        ? `${chapter.dayLabel}의 흐름에 맞춰 시간순으로 정리된 장면입니다.`
        : `${chapter.dayLabel}의 기록을 사진 순서대로 차분하게 이어갑니다.`;
    case "photo-essay":
      return leadPhoto?.groupingReason ?? `${chapter.placeLabel}에서 남긴 인상적인 컷을 크게 보여줍니다.`;
    case "postcard-map":
    default:
      return leadPhoto?.coordinates
        ? `${chapter.placeLabel} 주변의 GPS 사진을 중심으로 여행 동선을 카드처럼 정리했습니다.`
        : `${chapter.placeLabel} 구간을 날짜와 장면 기준으로 묶어 작은 포스트카드처럼 보여줍니다.`;
  }
}

function buildSpread(
  chapter: TripDraftChapter,
  photos: TripDraftPhoto[],
  themeId: TravelThemeId,
) {
  const leadPhoto = photos[0];
  const supportingPhotoIds = photos.slice(1, 5).map((photo) => photo.id);

  return {
    id: `spread-${chapter.id}`,
    chapterId: chapter.id,
    chapterTitle: chapter.title,
    dayLabel: chapter.dayLabel,
    placeLabel: chapter.placeLabel,
    caption: pickCaption(chapter, photos, themeId),
    coordinateLabel: formatCoordinateLabel(
      photos.find((photo) => Boolean(photo.coordinates)),
    ),
    leadPhotoId: leadPhoto?.id ?? null,
    supportingPhotoIds,
    photoCount: chapter.photoCount,
    layoutKind: themeId,
  } satisfies PhotobookPreviewSpread;
}

export function buildPhotobookPreviewDocument(
  draft: TripDraft,
  selectedThemeId?: TravelThemeId,
) {
  const theme = resolveTravelTheme(selectedThemeId ?? draft.selectedThemeId);
  const photoById = new Map(draft.photos.map((photo) => [photo.id, photo]));

  return {
    theme,
    cover: {
      title: draft.tripName,
      subtitle: `${draft.travelStart ?? "시작일 미정"} - ${draft.travelEnd ?? "종료일 미정"} · ${draft.stats.totalPhotos}장`,
      accent: theme.accentLabel,
      heroPhotoId: draft.photos[0]?.id ?? null,
    },
    spreads: draft.chapters.map((chapter) =>
      buildSpread(
        chapter,
        chapter.photoIds
          .map((photoId) => photoById.get(photoId))
          .filter((photo): photo is TripDraftPhoto => Boolean(photo)),
        theme.id,
      ),
    ),
  } satisfies PhotobookPreviewDocument;
}
