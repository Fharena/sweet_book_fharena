import Link from "next/link";

import { AppShell } from "@/components/app-shell";
import { BackendHealthCard } from "@/components/backend-health-card";
import { DemoTripLauncher } from "@/components/demo-trip-launcher";
import { previewThemes, timelineGroups, tripSummary } from "@/lib/mock-trip";

export default function Home() {
  return (
    <AppShell
      eyebrow="여행 포토북 MVP"
      title="여행 사진을 한 번에 포토북 초안으로 바꾸는 서비스"
      description="Triplogue는 여행 사진의 촬영 시간과 위치 정보를 읽어 날짜별, 장소별 챕터를 제안하고, 무거운 편집기 없이 Sweetbook 주문 흐름까지 이어줍니다."
      aside={
        <div className="space-y-6">
          <div className="ink-panel rounded-[28px] px-5 py-5 text-white">
            <p className="section-kicker border-white/10 bg-white/10 text-white before:bg-white">
              갤럭시 가이드
            </p>
            <p className="mt-4 text-lg font-semibold">위치 태그만 켜면 자동 정리가 훨씬 선명해집니다.</p>
            <p className="mt-3 text-sm leading-6 text-white/76">
              {tripSummary.locationPolicy}
            </p>
            <div className="mt-5 grid gap-3">
              {[
                "촬영 시간은 날짜별 챕터 흐름을 만들고",
                "GPS 좌표는 장소 라벨과 지도 카드를 돕고",
                "빠진 위치는 검토 단계에서 수동 태깅으로 보완합니다",
              ].map((item) => (
                <div
                  key={item}
                  className="travel-badge rounded-[20px] px-4 py-3 text-sm text-white/82"
                >
                  {item}
                </div>
              ))}
            </div>
          </div>

          <div className="editorial-panel rounded-[28px] p-5">
            <p className="section-kicker">추천 챕터</p>
            <div className="mt-4 space-y-3">
              {timelineGroups.map((group) => (
                <div
                  key={group.title}
                  className="metric-tile rounded-2xl px-4 py-4"
                >
                  <p className="text-sm font-semibold text-slate-900">{group.title}</p>
                  <p className="mt-1 text-xs uppercase tracking-[0.2em] text-slate-500">
                    {group.day} / {group.place}
                  </p>
                </div>
              ))}
            </div>
          </div>

          <BackendHealthCard title="첫 진입 기준 백엔드 상태" compact />
        </div>
      }
    >
      <div className="space-y-10">
        <div className="grid gap-6 lg:grid-cols-[1.15fr_0.85fr]">
          <div className="space-y-5">
            <span className="section-kicker">서비스 콘셉트</span>
            <p className="max-w-2xl text-base leading-8 text-slate-700 sm:text-[1.1rem]">
              여행 사진을 날짜와 장소 기준으로 자동 정리하고, GPS가 없는 사진은 수동
              태깅으로 보완한 뒤, 서점 수준의 미리보기와 주문 흐름으로 이어주는
              여행 포토북 서비스입니다.
            </p>
            <div className="flex flex-wrap gap-3">
              {[
                "웜 아이보리 · 틸 · 코랄",
                "지도 카드 중심 여행 편집 UX",
                "무거운 편집기 없이 주문까지",
              ].map((item) => (
                <span
                  key={item}
                  className="rounded-full border border-[var(--line)] bg-white/72 px-4 py-2 text-xs font-semibold text-[var(--ink-soft)]"
                >
                  {item}
                </span>
              ))}
            </div>
            <div className="flex flex-wrap gap-3">
              <Link
                href="/trips/new"
                className="button-primary rounded-full px-5 py-3 text-sm font-semibold text-white"
              >
                실사진 업로드 시작
              </Link>
              <Link
                href="/trips/review"
                className="button-secondary rounded-full px-5 py-3 text-sm font-semibold text-slate-800"
              >
                검토 단계 먼저 보기
              </Link>
              <Link
                href="/ops/launchpad"
                className="button-secondary rounded-full px-5 py-3 text-sm font-semibold text-slate-800"
              >
                데모/제출 허브 열기
              </Link>
            </div>
          </div>

          <div className="editorial-panel bg-grid rounded-[32px] p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-semibold text-slate-900">도쿄 나이트 앤 라이트</p>
                <p className="mt-1 text-sm text-slate-600">{tripSummary.travelWindow}</p>
              </div>
              <span className="rounded-full bg-[var(--accent-soft)] px-3 py-1 text-xs font-semibold text-[var(--accent)]">
                데모 프로젝트
              </span>
            </div>

            <div className="relative mt-8 min-h-72 rounded-[28px] border border-[var(--line)] bg-[linear-gradient(180deg,_rgba(255,255,255,0.94),_rgba(247,240,231,0.86))] p-6">
              <div className="dashed-arc left-[8%] top-[10%] h-44 w-44" />
              <div className="dashed-arc right-[8%] top-[18%] h-28 w-28" />
              <div className="absolute left-[18%] top-[28%] h-3 w-3 rounded-full bg-[var(--accent)] map-dot" />
              <div className="absolute left-[45%] top-[22%] h-3 w-3 rounded-full bg-[var(--accent)] map-dot" />
              <div className="absolute left-[68%] top-[58%] h-3 w-3 rounded-full bg-[var(--accent)] map-dot" />
              <div className="absolute left-[23%] top-[56%] h-20 w-20 rounded-full border border-dashed border-[rgba(21,111,102,0.25)]" />

              <div className="absolute right-5 top-5 rounded-[22px] bg-white/88 px-4 py-3 shadow-[0_10px_26px_rgba(35,31,26,0.08)]">
                <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-500">
                  여행 무드
                </p>
                <p className="mt-2 text-sm font-semibold text-slate-900">
                  여행 무드 보드
                </p>
              </div>

              <div className="absolute bottom-6 left-6 right-6 rounded-[24px] border border-[var(--line)] bg-white/88 p-4">
                <p className="text-xs uppercase tracking-[0.24em] text-slate-500">
                  자동 그룹핑 요약
                </p>
                <p className="mt-2 text-sm leading-6 text-slate-700">
                  {tripSummary.heroNote}
                </p>
              </div>
            </div>
          </div>
        </div>

        <DemoTripLauncher />

        <div className="grid gap-4 md:grid-cols-3">
          {[
            {
              title: "1. 사진 불러오기",
              copy: "여행 사진의 EXIF 촬영 시간과 GPS를 읽고, 빠진 정보는 바로 수동 태깅으로 넘깁니다.",
            },
            {
              title: "2. 챕터 검토",
              copy: "레이아웃을 만들기 전에 장소 그룹을 합치거나 고쳐서 이야기가 자연스럽게 이어지게 합니다.",
            },
            {
              title: "3. 포토북 주문",
              copy: "레이아웃 패턴을 고르고 Sweetbook 초안을 만든 뒤, 견적과 주문까지 이어갑니다.",
            },
          ].map((item) => (
            <article key={item.title} className="editorial-panel rounded-[28px] p-5">
              <p className="section-kicker">{item.title}</p>
              <p className="mt-3 text-sm leading-6 text-slate-600">{item.copy}</p>
            </article>
          ))}
        </div>

        <div className="space-y-4">
          <p className="section-kicker">초기 디자인 패턴</p>
          <div className="grid gap-4 md:grid-cols-3">
            {previewThemes.map((theme) => (
              <article key={theme.name} className="soft-card rounded-[28px] p-5">
                <p className="display-card-title text-slate-900">
                  {theme.name}
                </p>
                <p className="mt-3 text-sm leading-6 text-slate-600">{theme.note}</p>
              </article>
            ))}
          </div>
        </div>
      </div>
    </AppShell>
  );
}
