import { travelThemes } from "@/lib/travel-themes";

export const navSteps = [
  { href: "/", label: "개요" },
  { href: "/trips/new", label: "업로드" },
  { href: "/trips/review", label: "검토" },
  { href: "/book/preview", label: "미리보기" },
  { href: "/checkout", label: "주문" },
  { href: "/ops/webhooks", label: "웹훅 운영" },
];

export const tripSummary = {
  name: "도쿄 나이트 앤 라이트",
  travelWindow: "2026.04.02 - 2026.04.06",
  heroNote: "사진 42장, 위치 인식 31장, 추천 챕터 5개가 자동으로 정리됐습니다.",
  locationPolicy:
    "갤럭시에서는 카메라 설정의 위치 태그를 켜 두면 장소 자동 정리가 가장 정확합니다.",
};

export const timelineGroups = [
  {
    title: "시부야 도착 첫 저녁",
    day: "1일차",
    time: "18:10 - 21:20",
    place: "도쿄 시부야",
    photos: 9,
    confidence: "EXIF GPS 기준 92% 자동 일치",
  },
  {
    title: "아사쿠사 아침 산책",
    day: "2일차",
    time: "08:05 - 11:40",
    place: "도쿄 아사쿠사",
    photos: 11,
    confidence: "사진 6장은 수동 위치 태그 필요",
  },
  {
    title: "가와구치호로 잠시 벗어난 하루",
    day: "3일차",
    time: "10:15 - 16:50",
    place: "후지카와구치코",
    photos: 14,
    confidence: "시간대와 위치 힌트를 합쳐 챕터 병합",
  },
];

export const previewThemes = travelThemes;

export const orderSummary = {
  product: "A5 소프트커버 여행 포토북",
  pages: 38,
  chapters: 5,
  estimatedPrice: "23,400원",
};
