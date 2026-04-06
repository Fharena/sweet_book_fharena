import Link from "next/link";

import { AppShell } from "@/components/app-shell";
import { BackendHealthCard } from "@/components/backend-health-card";
import { DemoTripLauncher } from "@/components/demo-trip-launcher";
import { previewThemes, timelineGroups, tripSummary } from "@/lib/mock-trip";

const quickStartPaths = [
  {
    href: "/trips/review",
    title: "샘플로 먼저 보기",
    copy: "업로드 없이 자동 그룹핑, 미리보기, 주문 흐름까지 빠르게 확인합니다.",
    note: "가장 빠른 진입",
  },
  {
    href: "/trips/new",
    title: "내 사진으로 시작",
    copy: "갤럭시 위치 태그 사진을 올리고 여행 draft를 직접 만들어 봅니다.",
    note: "실사용 진입",
  },
  {
    href: "/ops/launchpad",
    title: "현재 진행 상황 확인",
    copy: "테스트 책, 주문 결과, 백엔드 상태를 한 화면에서 다시 봅니다.",
    note: "디버깅/제출 허브",
  },
] as const;

export default function Home() {
  return (
    <AppShell
      eyebrow="여행 포토북 MVP"
      title="샘플로 전체 흐름을 보거나, 내 사진으로 바로 시작하세요."
      description="처음 보는 사람은 샘플 초안으로 빠르게 확인하고, 실제 검증은 갤럭시 여행 사진 업로드부터 바로 시작할 수 있게 정리했습니다."
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
      <div className="space-y-8">
        <div className="grid gap-6 lg:grid-cols-[1.15fr_0.85fr]">
          <div className="space-y-5">
            <span className="section-kicker">시작 방법</span>
            <p className="max-w-2xl text-base leading-8 text-slate-700 sm:text-[1.1rem]">
              지금 이 서비스에서 먼저 결정할 건 하나입니다. 발표와 리뷰처럼 흐름을
              빨리 보여줄지, 아니면 내 사진으로 실제 업로드와 EXIF 정리를 검증할지입니다.
              그 뒤 단계는 검토, 미리보기, 주문으로 같은 흐름을 따라갑니다.
            </p>
            <div className="flex flex-wrap gap-3">
              {[
                "샘플 초안으로 30초 재현",
                "실사진 업로드로 실제 검증",
                "주문과 웹훅까지 같은 흐름",
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
                내 사진 업로드
              </Link>
              <Link
                href="/trips/review"
                className="button-secondary rounded-full px-5 py-3 text-sm font-semibold text-slate-800"
              >
                샘플 흐름 바로 보기
              </Link>
              <Link
                href="/ops/launchpad"
                className="button-secondary rounded-full px-5 py-3 text-sm font-semibold text-slate-800"
              >
                현재 진행 상황 확인
              </Link>
            </div>
            <p className="text-sm leading-6 text-slate-500">
              처음 보는 사람은 `샘플 흐름 바로 보기`, 실제 테스트는 `내 사진 업로드`
              부터 시작하는 구성이 가장 자연스럽습니다.
            </p>
          </div>

          <div className="editorial-panel rounded-[32px] p-6">
            <div className="flex flex-col gap-3 border-b border-[var(--line)] pb-4">
              <p className="section-kicker">오늘 어디서 시작할까요?</p>
              <p className="text-sm leading-6 text-slate-600">
                아래 세 경로 중 하나만 고르면 바로 다음 화면으로 이어집니다.
              </p>
            </div>

            <div className="mt-5 space-y-3">
              {quickStartPaths.map((item, index) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className="soft-card block rounded-[24px] p-4 transition hover:-translate-y-0.5"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
                        {item.note}
                      </p>
                      <p className="mt-2 text-base font-semibold text-slate-900">
                        {index + 1}. {item.title}
                      </p>
                    </div>
                    <span className="rounded-full bg-[var(--accent-soft)] px-3 py-1 text-[11px] font-semibold text-[var(--accent)]">
                      바로 이동
                    </span>
                  </div>
                  <p className="mt-3 text-sm leading-6 text-slate-600">{item.copy}</p>
                </Link>
              ))}
            </div>

            <div className="mt-5 rounded-[24px] border border-[var(--line)] bg-[linear-gradient(180deg,_rgba(255,255,255,0.94),_rgba(247,240,231,0.86))] p-5">
              <p className="text-xs uppercase tracking-[0.24em] text-slate-500">
                자동 그룹핑 요약
              </p>
              <p className="mt-2 text-sm leading-6 text-slate-700">
                {tripSummary.heroNote}
              </p>
              <p className="mt-3 text-xs leading-5 text-slate-500">
                데모 프로젝트: 도쿄 나이트 앤 라이트 / {tripSummary.travelWindow}
              </p>
            </div>
          </div>
        </div>

        <section className="space-y-4">
          <p className="section-kicker">30초 시작</p>
          <div className="grid gap-4 md:grid-cols-3">
            {quickStartPaths.map((item, index) => (
              <Link
                key={item.href}
                href={item.href}
                className="soft-card rounded-[28px] p-5 transition hover:-translate-y-0.5"
              >
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
                      {item.note}
                    </p>
                    <p className="mt-3 text-lg font-semibold text-slate-900">
                      {index + 1}. {item.title}
                    </p>
                  </div>
                  <span className="rounded-full bg-[var(--accent-soft)] px-3 py-1 text-xs font-semibold text-[var(--accent)]">
                    바로 이동
                  </span>
                </div>
                <p className="mt-3 text-sm leading-6 text-slate-600">{item.copy}</p>
                <p className="mt-4 text-xs font-semibold uppercase tracking-[0.18em] text-[var(--accent)]">
                  {item.href}
                </p>
              </Link>
            ))}
          </div>
        </section>

        <DemoTripLauncher layout="compact" />

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
