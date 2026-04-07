import type { ImportedPhoto } from "@/lib/trip-domain";
import { groupPhotosIntoTrip } from "@/lib/trip-grouping";
import type { TripDraft } from "@/lib/trip-draft";

const demoTripSeedPhotos: ImportedPhoto[] = [
  {
    id: "demo-photo-01",
    assetId: "demo-assets/trip-01.png",
    fileName: "tokyo-shibuya-001.jpg",
    originalName: "tokyo-shibuya-001.jpg",
    mimeType: "image/jpeg",
    size: 4_830_214,
    capturedAt: "2026-04-02T18:12:00+09:00",
    dateKey: "2026-04-02",
    coordinates: {
      latitude: 35.6595,
      longitude: 139.7005,
    },
    locationLabel: "시부야 나이트 워크",
    locationSource: "exif",
    requiresManualLocationTagging: false,
    groupingReason: "촬영 시간과 GPS 좌표를 읽어 시부야 도착 챕터로 분류했습니다.",
  },
  {
    id: "demo-photo-02",
    assetId: "demo-assets/trip-02.png",
    fileName: "tokyo-shibuya-002.jpg",
    originalName: "tokyo-shibuya-002.jpg",
    mimeType: "image/jpeg",
    size: 5_110_228,
    capturedAt: "2026-04-02T19:04:00+09:00",
    dateKey: "2026-04-02",
    coordinates: {
      latitude: 35.6581,
      longitude: 139.7017,
    },
    locationLabel: "시부야 나이트 워크",
    locationSource: "exif",
    requiresManualLocationTagging: false,
    groupingReason: "EXIF GPS를 기준으로 시부야 스카이 야경 챕터에 배치했습니다.",
  },
  {
    id: "demo-photo-03",
    assetId: "demo-assets/trip-03.png",
    fileName: "tokyo-shibuya-003.jpg",
    originalName: "tokyo-shibuya-003.jpg",
    mimeType: "image/jpeg",
    size: 4_221_903,
    capturedAt: "2026-04-02T20:14:00+09:00",
    dateKey: "2026-04-02",
    coordinates: {
      latitude: 35.6602,
      longitude: 139.7023,
    },
    locationLabel: "시부야 나이트 워크",
    locationSource: "exif",
    requiresManualLocationTagging: false,
    groupingReason: "야간 산책 구간으로 묶기 좋은 GPS 사진이라 장소 카드에 바로 반영합니다.",
  },
  {
    id: "demo-photo-04",
    assetId: "demo-assets/trip-04.png",
    fileName: "tokyo-asakusa-001.jpg",
    originalName: "tokyo-asakusa-001.jpg",
    mimeType: "image/jpeg",
    size: 4_940_336,
    capturedAt: "2026-04-03T08:07:00+09:00",
    dateKey: "2026-04-03",
    coordinates: {
      latitude: 35.7148,
      longitude: 139.7967,
    },
    locationLabel: "아사쿠사 아침 산책",
    locationSource: "exif",
    requiresManualLocationTagging: false,
    groupingReason: "아침 산책 시작점이라 날짜와 장소가 모두 선명하게 남아 있습니다.",
  },
  {
    id: "demo-photo-05",
    assetId: "demo-assets/trip-05.png",
    fileName: "tokyo-asakusa-002.jpg",
    originalName: "tokyo-asakusa-002.jpg",
    mimeType: "image/jpeg",
    size: 3_988_522,
    capturedAt: "2026-04-03T09:11:00+09:00",
    dateKey: "2026-04-03",
    coordinates: null,
    locationLabel: null,
    locationSource: "unknown",
    requiresManualLocationTagging: true,
    groupingReason: "GPS가 없어 같은 날짜의 다른 사진 위치 정보로 보완을 시도합니다.",
  },
  {
    id: "demo-photo-06",
    assetId: "demo-assets/trip-06.png",
    fileName: "tokyo-asakusa-003.jpg",
    originalName: "tokyo-asakusa-003.jpg",
    mimeType: "image/jpeg",
    size: 4_341_172,
    capturedAt: "2026-04-03T10:42:00+09:00",
    dateKey: "2026-04-03",
    coordinates: {
      latitude: 35.7133,
      longitude: 139.7901,
    },
    locationLabel: "아사쿠사 아침 산책",
    locationSource: "exif",
    requiresManualLocationTagging: false,
    groupingReason: "수공예 상점 구간을 별도 챕터 후보로 남기기 좋은 위치 사진입니다.",
  },
  {
    id: "demo-photo-07",
    assetId: "demo-assets/trip-07.png",
    fileName: "kawaguchiko-001.jpg",
    originalName: "kawaguchiko-001.jpg",
    mimeType: "image/jpeg",
    size: 6_108_324,
    capturedAt: "2026-04-04T10:13:00+09:00",
    dateKey: "2026-04-04",
    coordinates: {
      latitude: 35.5173,
      longitude: 138.7519,
    },
    locationLabel: "가와구치호 데이 트립",
    locationSource: "exif",
    requiresManualLocationTagging: false,
    groupingReason: "후지산 뷰 포인트로 지도 카드에 대표로 쓰기 좋은 사진입니다.",
  },
  {
    id: "demo-photo-08",
    assetId: "demo-assets/trip-08.png",
    fileName: "kawaguchiko-002.jpg",
    originalName: "kawaguchiko-002.jpg",
    mimeType: "image/jpeg",
    size: 5_881_207,
    capturedAt: "2026-04-04T11:29:00+09:00",
    dateKey: "2026-04-04",
    coordinates: {
      latitude: 35.5199,
      longitude: 138.7425,
    },
    locationLabel: "가와구치호 데이 트립",
    locationSource: "exif",
    requiresManualLocationTagging: false,
    groupingReason: "같은 날 호수 근처 이동 흐름을 이어주는 대표 위치 사진입니다.",
  },
  {
    id: "demo-photo-09",
    assetId: "demo-assets/trip-01.png",
    fileName: "kawaguchiko-003.jpg",
    originalName: "kawaguchiko-003.jpg",
    mimeType: "image/jpeg",
    size: 4_502_188,
    capturedAt: "2026-04-04T12:18:00+09:00",
    dateKey: "2026-04-04",
    coordinates: null,
    locationLabel: null,
    locationSource: "unknown",
    requiresManualLocationTagging: true,
    groupingReason: "호수 주변 카페 컷이라 시간대 클러스터로 장소 보완이 가능한 상태입니다.",
  },
  {
    id: "demo-photo-10",
    assetId: "demo-assets/trip-02.png",
    fileName: "tokyo-evening-001.jpg",
    originalName: "tokyo-evening-001.jpg",
    mimeType: "image/jpeg",
    size: 4_023_712,
    capturedAt: "2026-04-05T17:45:00+09:00",
    dateKey: "2026-04-05",
    coordinates: null,
    locationLabel: null,
    locationSource: "unknown",
    requiresManualLocationTagging: true,
    groupingReason: "실내 촬영이라 위치 태그가 빠졌고, 수동 태깅 예시로 남겨 두었습니다.",
  },
  {
    id: "demo-photo-11",
    assetId: "demo-assets/trip-03.png",
    fileName: "tokyo-evening-002.jpg",
    originalName: "tokyo-evening-002.jpg",
    mimeType: "image/jpeg",
    size: 3_772_914,
    capturedAt: "2026-04-05T18:11:00+09:00",
    dateKey: "2026-04-05",
    coordinates: null,
    locationLabel: null,
    locationSource: "unknown",
    requiresManualLocationTagging: true,
    groupingReason: "호텔 근처 저녁 컷으로, 검토 단계에서 한 번에 같은 태그를 적용하기 좋습니다.",
  },
  {
    id: "demo-photo-12",
    assetId: "demo-assets/trip-04.png",
    fileName: "haneda-001.jpg",
    originalName: "haneda-001.jpg",
    mimeType: "image/jpeg",
    size: 4_991_082,
    capturedAt: "2026-04-06T09:12:00+09:00",
    dateKey: "2026-04-06",
    coordinates: {
      latitude: 35.5494,
      longitude: 139.7798,
    },
    locationLabel: "하네다 귀국 동선",
    locationSource: "exif",
    requiresManualLocationTagging: false,
    groupingReason: "귀국 직전 챕터의 대표 위치 사진으로 쓰기 좋습니다.",
  },
  {
    id: "demo-photo-13",
    assetId: "demo-assets/trip-05.png",
    fileName: "haneda-002.jpg",
    originalName: "haneda-002.jpg",
    mimeType: "image/jpeg",
    size: 3_621_440,
    capturedAt: "2026-04-06T09:39:00+09:00",
    dateKey: "2026-04-06",
    coordinates: null,
    locationLabel: null,
    locationSource: "unknown",
    requiresManualLocationTagging: true,
    groupingReason: "면세점 컷이라 좌표는 없지만 출국 직전 사진과 시간대가 가깝습니다.",
  },
];

export const demoTripQuickFacts = {
  tripName: "도쿄 나이트 앤 라이트",
  travelWindowLabel: "2026.04.02 - 2026.04.06",
  themeName: "포스트카드 맵",
  primaryNote:
    "업로드 없이도 날짜·장소 자동 정리, 수동 태깅, 미리보기, 주문 단계를 한 번에 재현할 수 있는 샘플 여행 초안입니다.",
  overwriteNote:
    "샘플을 불러오면 현재 세션의 여행 초안이 덮어써집니다. 데모나 리뷰 시작용으로 사용하는 빠른 경로입니다.",
};

export function createDemoTripDraft(): TripDraft {
  const grouped = groupPhotosIntoTrip(
    demoTripQuickFacts.tripName,
    "2026-04-02",
    "2026-04-06",
    demoTripSeedPhotos,
  );

  return {
    ...grouped,
    selectedThemeId: "postcard-map",
  };
}

export const demoTripDraftSnapshot = createDemoTripDraft();

export function isDemoTripDraft(
  draft: Pick<TripDraft, "tripName" | "travelStart" | "travelEnd"> | null | undefined,
) {
  return (
    draft?.tripName === demoTripQuickFacts.tripName &&
    draft.travelStart === "2026-04-02" &&
    draft.travelEnd === "2026-04-06"
  );
}
export const demoTripSnapshot = {
  tripName: demoTripDraftSnapshot.tripName,
  photoCount: demoTripDraftSnapshot.stats.totalPhotos,
  chapterCount: demoTripDraftSnapshot.chapters.length,
  manualTaggingCount: demoTripDraftSnapshot.stats.manualTaggingRequired,
  resolvedLocationCount: demoTripDraftSnapshot.stats.withResolvedLocation,
  travelWindow: demoTripQuickFacts.travelWindowLabel,
};
