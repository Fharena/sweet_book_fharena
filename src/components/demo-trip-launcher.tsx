"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import {
  clearCheckoutComposeResult,
  clearCheckoutOrderDraft,
  clearCheckoutOrderResult,
} from "@/lib/checkout-order";
import {
  createDemoTripDraft,
  demoTripDraftSnapshot,
  demoTripQuickFacts,
} from "@/lib/demo-trip-draft";
import { saveTripDraft } from "@/lib/trip-draft";

type DemoTripLauncherProps = {
  layout?: "stacked" | "compact";
  className?: string;
};

export function DemoTripLauncher({
  layout = "stacked",
  className,
}: DemoTripLauncherProps) {
  const router = useRouter();
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleLoadDemoDraft(nextHref: string) {
    saveTripDraft(createDemoTripDraft());
    clearCheckoutComposeResult();
    clearCheckoutOrderDraft();
    clearCheckoutOrderResult();
    setStatusMessage("샘플 여행 초안을 불러왔습니다. 바로 다음 단계로 이동합니다.");

    startTransition(() => {
      router.push(nextHref);
    });
  }

  return (
    <div
      className={`${layout === "compact" ? "rounded-[28px] border border-[var(--line)] bg-white/85 p-5" : "soft-card rounded-[32px] p-6"} ${className ?? ""}`.trim()}
    >
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="max-w-2xl space-y-3">
          <p className="section-kicker">빠른 데모 시작</p>
          <h3 className="font-display text-4xl leading-none text-slate-900">
            업로드 없이 샘플 여행 초안을 바로 불러올 수 있습니다.
          </h3>
          <p className="text-sm leading-6 text-slate-600">
            {demoTripQuickFacts.primaryNote}
          </p>
        </div>

        <div className="grid min-w-full gap-3 sm:min-w-[18rem] sm:grid-cols-2 lg:max-w-sm lg:grid-cols-1">
          <button
            type="button"
            className="button-primary rounded-full px-5 py-3 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:bg-slate-400 disabled:shadow-none"
            onClick={() => handleLoadDemoDraft("/trips/review")}
            disabled={isPending}
          >
            {isPending ? "샘플 초안 준비 중..." : "샘플 초안으로 검토 시작"}
          </button>
          <button
            type="button"
            className="button-secondary rounded-full px-5 py-3 text-sm font-semibold text-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
            onClick={() => handleLoadDemoDraft("/book/preview")}
            disabled={isPending}
          >
            샘플 초안 바로 미리보기
          </button>
        </div>
      </div>

      <div className="mt-5 grid gap-3 sm:grid-cols-4">
        <div className="metric-tile px-4 py-4">
          <p className="text-xs uppercase tracking-[0.2em] text-slate-500">여행</p>
          <p className="mt-2 text-sm font-semibold text-slate-900">
            {demoTripQuickFacts.tripName}
          </p>
        </div>
        <div className="metric-tile px-4 py-4">
          <p className="text-xs uppercase tracking-[0.2em] text-slate-500">사진</p>
          <p className="mt-2 text-2xl font-semibold text-slate-900">
            {demoTripDraftSnapshot.stats.totalPhotos}
          </p>
        </div>
        <div className="metric-tile px-4 py-4">
          <p className="text-xs uppercase tracking-[0.2em] text-slate-500">챕터</p>
          <p className="mt-2 text-2xl font-semibold text-slate-900">
            {demoTripDraftSnapshot.chapters.length}
          </p>
        </div>
        <div className="metric-tile px-4 py-4">
          <p className="text-xs uppercase tracking-[0.2em] text-slate-500">수동 보정</p>
          <p className="mt-2 text-2xl font-semibold text-slate-900">
            {demoTripDraftSnapshot.stats.manualTaggingRequired}
          </p>
        </div>
      </div>

      <div className="mt-5 flex flex-wrap gap-2">
        <span className="rounded-full bg-[var(--accent-soft)] px-3 py-1 text-xs font-semibold text-[var(--accent)]">
          위치 정리 {demoTripDraftSnapshot.stats.withResolvedLocation}장
        </span>
        <span className="rounded-full bg-[var(--accent-secondary-soft)] px-3 py-1 text-xs font-semibold text-[var(--accent-secondary)]">
          여행 기간 {demoTripQuickFacts.travelWindowLabel}
        </span>
        <span className="rounded-full border border-[var(--line)] bg-white/80 px-3 py-1 text-xs font-semibold text-slate-700">
          기본 테마 {demoTripQuickFacts.themeName}
        </span>
      </div>

      <p className="mt-4 text-xs leading-5 text-slate-500">
        {demoTripQuickFacts.overwriteNote}
      </p>

      {statusMessage ? (
        <div className="mt-4 rounded-[22px] border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm leading-6 text-emerald-800">
          {statusMessage}
        </div>
      ) : null}
    </div>
  );
}
