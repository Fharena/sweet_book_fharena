export const travelThemeIds = [
  "timeline-classic",
  "postcard-map",
  "photo-essay",
] as const;

export type TravelThemeId = (typeof travelThemeIds)[number];

export const DEFAULT_TRAVEL_THEME_ID: TravelThemeId = "postcard-map";

export type TravelThemeDefinition = {
  id: TravelThemeId;
  name: string;
  note: string;
  accentLabel: string;
  editorialNote: string;
  coverClassName: string;
  spotlightClassName: string;
  badgeClassName: string;
  spreadEyebrow: string;
};

export const travelThemes: TravelThemeDefinition[] = [
  {
    id: "timeline-classic",
    name: "타임라인 클래식",
    note: "날짜 중심으로 차분하게 정리되는 기본형 레이아웃입니다.",
    accentLabel: "날짜 중심",
    editorialNote: "도착부터 마지막 밤까지 여행 순서를 안정적으로 따라갑니다.",
    coverClassName:
      "border-[var(--line)] bg-[linear-gradient(180deg,_rgba(15,118,110,0.18),_rgba(24,33,40,0.95))]",
    spotlightClassName:
      "bg-[linear-gradient(180deg,_rgba(15,118,110,0.12),_rgba(247,240,231,0.9))]",
    badgeClassName: "bg-[var(--accent-soft)] text-[var(--accent)]",
    spreadEyebrow: "날짜 흐름",
  },
  {
    id: "postcard-map",
    name: "포스트카드 맵",
    note: "챕터 첫 장에 지도 카드와 장소명을 강조하는 여행형 패턴입니다.",
    accentLabel: "장소 강조",
    editorialNote: "방문 지점과 이동 무드를 작은 지도 카드처럼 선명하게 보여줍니다.",
    coverClassName:
      "border-[rgba(243,123,87,0.18)] bg-[linear-gradient(180deg,_rgba(243,123,87,0.18),_rgba(21,111,102,0.92))]",
    spotlightClassName:
      "bg-[linear-gradient(180deg,_rgba(243,123,87,0.14),_rgba(255,247,241,0.92))]",
    badgeClassName: "bg-[var(--accent-secondary-soft)] text-[var(--accent-secondary)]",
    spreadEyebrow: "지도 카드",
  },
  {
    id: "photo-essay",
    name: "포토 에세이",
    note: "풍경 사진을 크게 살리고 캡션은 최소화하는 에디토리얼 패턴입니다.",
    accentLabel: "큰 사진 중심",
    editorialNote: "장면의 밀도와 여백을 크게 잡아 한 컷의 인상을 길게 남깁니다.",
    coverClassName:
      "border-[rgba(24,33,40,0.2)] bg-[linear-gradient(180deg,_rgba(24,33,40,0.78),_rgba(15,118,110,0.68))]",
    spotlightClassName:
      "bg-[linear-gradient(180deg,_rgba(24,33,40,0.08),_rgba(255,255,255,0.94))]",
    badgeClassName: "bg-slate-900/10 text-slate-800",
    spreadEyebrow: "에디토리얼",
  },
];

export function isTravelThemeId(value: unknown): value is TravelThemeId {
  return (
    typeof value === "string" &&
    travelThemeIds.includes(value as TravelThemeId)
  );
}

export function resolveTravelTheme(themeId: TravelThemeId | null | undefined) {
  return (
    travelThemes.find((theme) => theme.id === themeId) ??
    travelThemes.find((theme) => theme.id === DEFAULT_TRAVEL_THEME_ID) ??
    travelThemes[0]
  );
}
