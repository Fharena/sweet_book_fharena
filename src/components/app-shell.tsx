"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

import { isDemoTripDraft } from "@/lib/demo-trip-draft";
import { navSteps } from "@/lib/mock-trip";
import { useTripDraft } from "@/lib/use-trip-draft";

type AppShellProps = {
  eyebrow: string;
  title: string;
  description: string;
  children: ReactNode;
  aside: ReactNode;
};

export function AppShell({
  eyebrow,
  title,
  description,
  children,
  aside,
}: AppShellProps) {
  const pathname = usePathname();
  const { draft } = useTripDraft();
  const activeStepIndex = navSteps.findIndex((step) => step.href === pathname);
  const activeStep = activeStepIndex >= 0 ? activeStepIndex + 1 : 1;
  const isDemoSession = isDemoTripDraft(draft);
  const sessionBadgeLabel = draft
    ? isDemoSession
      ? "샘플 초안 세션"
      : "실사진 draft 세션"
    : "초안 없음";
  const sessionBadgeClassName = draft
    ? isDemoSession
      ? "bg-[var(--accent-secondary-soft)] text-[var(--accent-secondary)]"
      : "bg-[var(--accent-soft)] text-[var(--accent)]"
    : "bg-slate-100 text-slate-600";
  const workflowChips = draft
    ? [
        isDemoSession ? "샘플 초안 이어보기" : `${draft.tripName} draft 활성`,
        "갤럭시 위치 태그 안내",
        "Sweetbook 주문 연결",
      ]
    : ["위치 기반 자동 정리", "갤럭시 위치 태그 안내", "Sweetbook 주문 연결"];
  const flowSummary = draft
    ? isDemoSession
      ? `${draft.tripName} 샘플 초안을 기준으로 검토, 미리보기, 주문, 웹훅 운영 흐름이 이어지고 있습니다.`
      : `${draft.tripName} 여행 초안이 현재 세션에 저장돼 있어 다음 단계까지 같은 흐름으로 이어집니다.`
    : "여행 사진을 시간과 위치 기준으로 정리하고, 위치가 비는 사진은 수동 보정한 뒤 Sweetbook 주문 플로우로 연결합니다.";

  return (
    <div className="relative min-h-screen overflow-hidden px-4 py-6 text-slate-900 sm:px-6 lg:px-8">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-96 bg-[radial-gradient(circle_at_top,_rgba(15,118,110,0.16),_transparent_58%)]" />
      <div className="pointer-events-none absolute left-[-4rem] top-28 h-44 w-44 rounded-full bg-[rgba(243,123,87,0.14)] blur-3xl" />
      <div className="pointer-events-none absolute right-8 top-20 h-56 w-56 rounded-full bg-[rgba(232,199,163,0.34)] blur-3xl float-orb" />
      <div className="pointer-events-none absolute bottom-16 right-[12%] h-36 w-36 rounded-full bg-[rgba(15,118,110,0.12)] blur-3xl float-orb" />
      <div className="pointer-events-none absolute left-[14%] top-[22rem] h-48 w-48 rounded-full border border-dashed border-[rgba(15,118,110,0.12)]" />

      <div className="mx-auto flex w-full max-w-7xl flex-col gap-6 rise-in">
        <header className="glass-panel hero-sheen rounded-[32px] px-6 py-5 sm:px-8">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--line)] pb-4">
            <div className="flex flex-wrap items-center gap-3">
              <span className="gradient-chip rounded-full px-3 py-1 text-[11px] font-semibold tracking-[0.22em] text-[var(--accent)]">
                TRIPLOGUE / SWEETBOOK
              </span>
              <span className="rounded-full border border-[var(--line)] bg-white/65 px-3 py-1 text-xs font-medium text-[var(--ink-soft)]">
                여행 포토북 빌더
              </span>
            </div>

            <div className="flex flex-wrap items-center gap-2 text-xs text-[var(--ink-soft)]">
              <span className="section-kicker">Seafoam 테마</span>
              <span
                className={`rounded-full px-3 py-1 font-semibold ${sessionBadgeClassName}`}
              >
                {sessionBadgeLabel}
              </span>
              <span className="rounded-full border border-[var(--line)] bg-white/70 px-3 py-1 font-semibold">
                단계 {activeStep} / {navSteps.length}
              </span>
            </div>
          </div>

          <div className="mt-5 grid gap-5 lg:grid-cols-[1.2fr_0.8fr]">
            <div className="space-y-5">
              <p className="eyebrow text-xs font-semibold">{eyebrow}</p>
              <div>
                <h1 className="max-w-3xl font-display text-4xl leading-none sm:text-5xl lg:text-[3.7rem]">
                  {title}
                </h1>
                <p className="mt-4 max-w-2xl text-sm leading-7 text-slate-600 sm:text-base">
                  {description}
                </p>
              </div>

              <div className="flex flex-wrap gap-3">
                {workflowChips.map((item) => (
                  <span
                    key={item}
                    className="rounded-full border border-[var(--line)] bg-white/72 px-4 py-2 text-xs font-semibold text-[var(--ink-soft)]"
                  >
                    {item}
                  </span>
                ))}
              </div>
            </div>

            <div className="ink-panel rounded-[32px] px-5 py-5 text-white">
              <div className="flex items-center justify-between gap-3">
                <p className="text-sm font-semibold">이번 화면의 역할</p>
                <span className="travel-badge rounded-full px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.2em] text-white/82">
                  현재 흐름
                </span>
              </div>

              <p className="mt-4 text-sm leading-6 text-white/78">
                {flowSummary}
              </p>

              <div className="mt-5 grid gap-3">
                {[
                  ["01", "사진과 EXIF를 읽고"],
                  ["02", "챕터 후보를 정리한 뒤"],
                  ["03", "포토북과 주문으로 마무리"],
                ].map(([step, copy]) => (
                  <div
                    key={step}
                    className="travel-badge flex items-center gap-3 rounded-[20px] px-4 py-3"
                  >
                    <span className="rounded-full bg-white/14 px-2.5 py-1 text-[11px] font-semibold tracking-[0.16em] text-white/88">
                      {step}
                    </span>
                    <span className="text-sm text-white/82">{copy}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <nav className="mt-6 flex flex-wrap gap-2">
            {navSteps.map((step, index) => {
              const isActive = pathname === step.href;

              return (
                <Link
                  key={step.href}
                  href={step.href}
                  className={`group rounded-full border px-4 py-2.5 text-sm font-medium transition ${
                    isActive
                      ? "border-transparent bg-slate-950 text-white shadow-[0_10px_22px_rgba(15,23,42,0.18)]"
                      : "border-[var(--line)] bg-white/75 text-slate-700 hover:border-slate-400 hover:bg-white"
                  }`}
                >
                  <span
                    className={`mr-2 inline-flex h-6 w-6 items-center justify-center rounded-full text-[11px] font-semibold ${
                      isActive
                        ? "bg-white/12 text-white"
                        : "bg-[var(--accent-soft)] text-[var(--accent)] group-hover:bg-[var(--accent-secondary-soft)] group-hover:text-[var(--accent-secondary)]"
                    }`}
                  >
                    {index + 1}
                  </span>
                  {step.label}
                </Link>
              );
            })}
          </nav>
        </header>

        <main className="grid gap-6 lg:grid-cols-[1.7fr_0.95fr]">
          <section className="glass-panel rounded-[32px] p-6 sm:p-8">{children}</section>
          <aside className="glass-panel rounded-[32px] p-6 sm:p-8">{aside}</aside>
        </main>
      </div>
    </div>
  );
}
