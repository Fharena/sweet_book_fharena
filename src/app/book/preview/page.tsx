"use client";

import { useMemo, useState } from "react";

import { AppShell } from "@/components/app-shell";
import { timelineGroups } from "@/lib/mock-trip";
import {
  applyThemeSelectionToDraft,
  saveTripDraft,
} from "@/lib/trip-draft";
import { useTripDraft } from "@/lib/use-trip-draft";
import {
  DEFAULT_TRAVEL_THEME_ID,
  resolveTravelTheme,
  travelThemes,
  type TravelThemeId,
} from "@/lib/travel-themes";

function estimatePages(photoCount: number, chapterCount: number) {
  return Math.max(24, chapterCount * 6 + Math.ceil(photoCount / 4) * 2);
}

function estimatePrice(pageCount: number) {
  return Math.round(16800 + pageCount * 330);
}

function formatCoordinate(value: number) {
  return value.toFixed(3);
}

const themeSpreadNotes: Record<TravelThemeId, string> = {
  "timeline-classic": "날짜 흐름을 먼저 읽히게 해서 여행의 시간 순서가 자연스럽게 이어집니다.",
  "postcard-map": "장소 카드와 체크포인트를 강조해 여행 중 이동 감각을 더 강하게 남깁니다.",
  "photo-essay": "큰 사진과 짧은 문장으로 장면의 인상을 오래 끌고 가는 구성입니다.",
};

export default function BookPreviewPage() {
  const { draft, hydrated } = useTripDraft();
  const [fallbackThemeId, setFallbackThemeId] =
    useState<TravelThemeId>(DEFAULT_TRAVEL_THEME_ID);
  const chapters = draft?.chapters ?? timelineGroups;
  const photoById = useMemo(
    () => new Map((draft?.photos ?? []).map((photo) => [photo.id, photo])),
    [draft?.photos],
  );
  const pageCount = estimatePages(
    draft?.stats.totalPhotos ?? timelineGroups.length * 8,
    chapters.length,
  );
  const price = estimatePrice(pageCount);
  const selectedThemeId = draft?.selectedThemeId ?? fallbackThemeId;
  const selectedTheme = resolveTravelTheme(selectedThemeId);
  const selectedThemeIndex = useMemo(
    () => travelThemes.findIndex((theme) => theme.id === selectedTheme.id),
    [selectedTheme.id],
  );

  function handleSelectTheme(themeId: TravelThemeId) {
    setFallbackThemeId(themeId);

    if (!draft) {
      return;
    }

    saveTripDraft(applyThemeSelectionToDraft(draft, themeId));
  }

  return (
    <AppShell
      eyebrow="미리보기 단계"
      title={
        draft
          ? `${draft.tripName}에 어울리는 패턴을 골라 보세요.`
          : "패턴을 고르고 챕터를 포토북 스프레드로 바꿔 보세요."
      }
      description={
        draft
          ? "업로드한 여행 초안이 미리보기로 이어지고 있어 표지와 스프레드, 예상 금액이 실제 챕터 구성을 반영합니다."
          : "이 MVP는 세 가지 편집형 패턴과 최종화 전 한 번의 미리보기로 범위를 좁혔습니다."
      }
      aside={
        <div className="space-y-4">
          <article className="soft-card rounded-[28px] p-5">
            <p className="eyebrow text-[11px] font-semibold">실시간 예상</p>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <div className="rounded-2xl border border-[var(--line)] bg-white/80 px-4 py-4">
                <p className="text-xs uppercase tracking-[0.2em] text-slate-500">페이지 수</p>
                <p className="mt-2 text-2xl font-semibold text-slate-900">{pageCount}</p>
                <p className="mt-2 text-xs leading-5 text-slate-500">
                  챕터 수와 사진 밀도에 따라 자동 산정됩니다.
                </p>
              </div>
              <div className="rounded-2xl border border-[var(--line)] bg-white/80 px-4 py-4">
                <p className="text-xs uppercase tracking-[0.2em] text-slate-500">예상 금액</p>
                <p className="mt-2 text-2xl font-semibold text-slate-900">
                  {price.toLocaleString("ko-KR")}원
                </p>
                <p className="mt-2 text-xs leading-5 text-slate-500">
                  최종화 전 확인용 기준가입니다.
                </p>
              </div>
            </div>
          </article>

          <article className="soft-card rounded-[28px] p-5">
            <p className="section-kicker">현재 선택된 패턴</p>
            <div className={`mt-4 rounded-[24px] px-4 py-4 ${selectedTheme.spotlightClassName}`}>
              <div className="flex items-center justify-between gap-3">
                <p className="font-display text-3xl leading-none text-slate-900">
                  {selectedTheme.name}
                </p>
                <span
                  className={`rounded-full px-3 py-1 text-xs font-semibold ${selectedTheme.badgeClassName}`}
                >
                  {selectedTheme.accentLabel}
                </span>
              </div>
              <p className="mt-3 text-sm leading-6 text-slate-700">
                {selectedTheme.editorialNote}
              </p>
            </div>
          </article>
        </div>
      }
    >
      {!hydrated ? (
        <div className="soft-card rounded-[28px] p-5 text-sm text-slate-600">
          여행 초안을 불러오는 중입니다...
        </div>
      ) : null}

      <section className="hero-sheen rounded-[32px] border border-[var(--line)] bg-[linear-gradient(135deg,_rgba(255,255,255,0.92),_rgba(255,244,236,0.96))] p-6 shadow-[0_18px_50px_rgba(82,55,29,0.08)] sm:p-8">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
          <div className="max-w-2xl space-y-4">
            <div className="flex flex-wrap gap-2">
              <span className="rounded-full bg-[var(--accent-soft)] px-3 py-1 text-xs font-semibold text-[var(--accent)]">
                패턴 비교
              </span>
              <span className="rounded-full bg-[var(--accent-secondary-soft)] px-3 py-1 text-xs font-semibold text-[var(--accent-secondary)]">
                Sweetbook 조립 반영
              </span>
            </div>
            <h2 className="font-display text-4xl leading-none text-slate-900 sm:text-5xl">
              앱에서 고른 무드가 실제 포토북 계획까지 이어집니다.
            </h2>
            <p className="max-w-2xl text-sm leading-7 text-slate-600 sm:text-base">
              선택한 패턴은 단순한 미리보기가 아니라 Sweetbook 조립 계획의 텍스트 톤과
              챕터 리듬에도 반영됩니다. 제출 데모에서는 이 흐름을 바로 설명할 수 있습니다.
            </p>
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="rounded-[24px] border border-[var(--line)] bg-white/85 px-4 py-4">
                <p className="text-xs uppercase tracking-[0.2em] text-slate-500">사진</p>
                <p className="mt-2 text-2xl font-semibold text-slate-900">
                  {draft?.stats.totalPhotos ?? chapters.length * 8}
                </p>
              </div>
              <div className="rounded-[24px] border border-[var(--line)] bg-white/85 px-4 py-4">
                <p className="text-xs uppercase tracking-[0.2em] text-slate-500">챕터</p>
                <p className="mt-2 text-2xl font-semibold text-slate-900">
                  {chapters.length}
                </p>
              </div>
              <div className="rounded-[24px] border border-[var(--line)] bg-white/85 px-4 py-4">
                <p className="text-xs uppercase tracking-[0.2em] text-slate-500">선택 패턴</p>
                <p className="mt-2 text-2xl font-semibold text-slate-900">
                  {selectedThemeIndex + 1} / 3
                </p>
              </div>
            </div>
          </div>

          <div className="grid min-w-full gap-3 sm:min-w-[18rem]">
            <div className="rounded-[28px] border border-[var(--line)] bg-white/85 px-5 py-5">
              <p className="text-xs uppercase tracking-[0.2em] text-slate-500">예상 페이지</p>
              <p className="mt-2 text-4xl font-semibold text-slate-900">{pageCount}</p>
              <p className="mt-3 text-sm leading-6 text-slate-600">
                챕터 흐름과 사진 수를 기준으로 계산된 전체 분량입니다.
              </p>
            </div>
            <div className="rounded-[28px] border border-[var(--line)] bg-[linear-gradient(135deg,_rgba(15,118,110,0.12),_rgba(249,115,82,0.12))] px-5 py-5">
              <p className="text-xs uppercase tracking-[0.2em] text-slate-500">예상 금액</p>
              <p className="mt-2 text-4xl font-semibold text-slate-900">
                {price.toLocaleString("ko-KR")}원
              </p>
              <p className="mt-3 text-sm leading-6 text-slate-600">
                최종화 전에 확인하는 기준 금액입니다.
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className="space-y-4">
        <div className="flex flex-col gap-2">
          <p className="section-kicker">패턴 선택</p>
          <p className="text-sm leading-6 text-slate-600">
            하나를 고르면 현재 여행 초안에 바로 저장되고, 이후 체크아웃과 Sweetbook 생성
            흐름까지 같은 무드로 이어집니다.
          </p>
        </div>
        <div className="grid gap-4 lg:grid-cols-3">
          {travelThemes.map((theme) => {
            const isSelected = theme.id === selectedTheme.id;

            return (
              <button
                key={theme.id}
                type="button"
                className={`text-left transition ${isSelected ? "-translate-y-1" : "hover:-translate-y-0.5"}`}
                onClick={() => handleSelectTheme(theme.id)}
              >
                <article
                  className={`soft-card h-full rounded-[32px] p-5 ${isSelected ? "ring-2 ring-[rgba(21,111,102,0.35)]" : ""}`}
                >
                  <div className={`rounded-[24px] p-4 ${theme.spotlightClassName}`}>
                    <div className="flex items-center justify-between gap-3">
                      <p className="font-display text-3xl leading-none text-slate-900">
                        {theme.name}
                      </p>
                      <span
                        className={`rounded-full px-3 py-1 text-xs font-semibold ${theme.badgeClassName}`}
                      >
                        {theme.accentLabel}
                      </span>
                    </div>
                    <p className="mt-3 text-sm leading-6 text-slate-700">{theme.note}</p>
                  </div>
                  <p className="mt-4 text-sm leading-6 text-slate-600">{theme.editorialNote}</p>
                  <div className="mt-5 flex items-center justify-between text-xs font-semibold text-slate-500">
                    <span>{theme.spreadEyebrow}</span>
                    <span>{isSelected ? "현재 선택됨" : "선택 가능"}</span>
                  </div>
                </article>
              </button>
            );
          })}
        </div>
      </section>

      <div className="grid gap-4 xl:grid-cols-[0.95fr_1.05fr]">
        <article className="soft-card rounded-[32px] p-5 sm:p-6">
          <p className="eyebrow text-[11px] font-semibold">표지 콘셉트</p>
          <div
            className={`mt-4 overflow-hidden rounded-[28px] p-6 text-white shadow-[0_18px_44px_rgba(24,33,40,0.22)] ${selectedTheme.coverClassName}`}
          >
            <div className="flex flex-wrap gap-2">
              <span className="rounded-full bg-white/10 px-3 py-1 text-[11px] font-semibold tracking-[0.16em] text-white/80">
                {draft ? draft.travelStart ?? "여행 포토북" : "도쿄 2026"}
              </span>
              <span className="rounded-full bg-white/10 px-3 py-1 text-[11px] font-semibold tracking-[0.16em] text-white/80">
                {selectedTheme.name}
              </span>
            </div>
            <h2 className="mt-14 font-display text-5xl leading-none">
              {draft ? draft.tripName : "밤의 기록"}
            </h2>
            <p className="mt-4 max-w-sm text-sm leading-6 text-white/80">
              {draft
                ? `사진 ${draft.stats.totalPhotos}장, 챕터 ${draft.chapters.length}개로 구성`
                : "도시 산책, 사찰의 아침, 그리고 호수로 잠시 벗어난 하루."}
            </p>
            <div className="mt-8 grid gap-3 sm:grid-cols-3">
              {[
                ["커버", "1장"],
                ["스프레드", `${chapters.length}개`],
                ["상태", draft ? "초안 준비" : "샘플"],
              ].map(([label, value]) => (
                <div
                  key={label}
                  className="rounded-[20px] border border-white/10 bg-white/10 px-4 py-4"
                >
                  <p className="text-[11px] uppercase tracking-[0.2em] text-white/60">
                    {label}
                  </p>
                  <p className="mt-2 text-base font-semibold text-white">{value}</p>
                </div>
              ))}
            </div>
          </div>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <div className="rounded-[24px] border border-[var(--line)] bg-white/80 px-4 py-4">
              <p className="text-xs uppercase tracking-[0.2em] text-slate-500">디자인 방향</p>
              <p className="mt-2 text-sm leading-6 text-slate-700">
                {selectedTheme.editorialNote}
              </p>
            </div>
            <div className="rounded-[24px] border border-[var(--line)] bg-white/80 px-4 py-4">
              <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Sweetbook 반영</p>
              <p className="mt-2 text-sm leading-6 text-slate-700">
                선택한 패턴 이름과 챕터 리듬이 책 생성 계획의 메타데이터에 함께 반영됩니다.
              </p>
            </div>
          </div>
        </article>

        <div className="grid gap-4">
          {(draft?.chapters ?? timelineGroups).map((group, index) => {
            const spreadPhotos =
              "photoIds" in group
                ? group.photoIds
                    .slice(0, 4)
                    .map((photoId) => photoById.get(photoId))
                    .filter((photo): photo is NonNullable<typeof photo> => Boolean(photo))
                : Array.from({ length: 4 }, (_, photoIndex) => draft?.photos[photoIndex]).filter(
                    (photo): photo is NonNullable<typeof photo> => Boolean(photo),
                  );
            const chapterGeoPhotos =
              "photoIds" in group
                ? group.photoIds
                    .map((photoId) => photoById.get(photoId))
                    .filter(
                      (
                        photo,
                      ): photo is NonNullable<typeof photo> & {
                        coordinates: NonNullable<NonNullable<typeof photo>["coordinates"]>;
                      } =>
                        Boolean(photo?.coordinates),
                    )
                : [];
            const leadGeoPhoto = chapterGeoPhotos[0];

            return (
              <article
                key={"photoIds" in group ? group.id : group.title}
                className="soft-card rounded-[32px] p-5 sm:p-6"
              >
                <p className="eyebrow text-[11px] font-semibold">
                  {selectedTheme.spreadEyebrow} / {"photoIds" in group ? group.dayLabel : group.day}
                </p>
                <div className="mt-4 grid gap-4 md:grid-cols-[1.08fr_0.92fr]">
                  <div
                    className={`grid min-h-48 grid-cols-2 gap-3 rounded-[28px] border border-[var(--line)] p-3 ${selectedTheme.spotlightClassName}`}
                  >
                    {Array.from({ length: 4 }, (_, photoIndex) => spreadPhotos[photoIndex]).map(
                      (photo, photoIndex) => (
                        <div
                          key={photo?.id ?? `${index}-${photoIndex}`}
                          className={`rounded-[22px] shadow-[0_10px_22px_rgba(24,33,40,0.08)] ${selectedTheme.coverClassName}`}
                        >
                          {photo ? (
                            <div className="flex h-full items-end p-3">
                              <span className="rounded-full bg-white/90 px-3 py-1 text-[11px] font-semibold text-slate-800">
                                {photo.locationLabel ?? photo.dateKey}
                              </span>
                            </div>
                          ) : null}
                        </div>
                      ),
                    )}
                  </div>

                  <div>
                    <div className="flex flex-wrap items-center gap-3">
                      <h3 className="font-display text-4xl leading-none text-slate-900">
                        {group.title}
                      </h3>
                      <span
                        className={`rounded-full px-3 py-1 text-xs font-semibold ${selectedTheme.badgeClassName}`}
                      >
                        {selectedTheme.accentLabel}
                      </span>
                    </div>
                    <p className="mt-3 text-sm leading-6 text-slate-600">
                      {"photoIds" in group ? group.placeLabel : group.place}
                    </p>
                    <p className="mt-4 text-sm leading-6 text-slate-700">
                      {"photoIds" in group
                        ? `${group.photoCount}장의 사진이 이 스프레드를 구성하고 있습니다.`
                        : "생성된 페이지는 여백을 살리고, 장소 메모와 깔끔한 챕터 오프너로 리듬을 잡습니다."}
                    </p>
                    <p className="mt-3 text-sm leading-6 text-slate-600">
                      {themeSpreadNotes[selectedTheme.id]}
                    </p>
                    <div className="mt-4 flex flex-wrap gap-2">
                      <span
                        className={`rounded-full px-3 py-1 text-xs font-semibold ${selectedTheme.badgeClassName}`}
                      >
                        {"photoIds" in group ? group.photoCount : group.photos}장
                      </span>
                      <span className="rounded-full bg-slate-900/8 px-3 py-1 text-xs font-semibold text-slate-700">
                        {"photoIds" in group ? group.dayLabel : group.time}
                      </span>
                    </div>
                    {leadGeoPhoto ? (
                      <div className="mt-4 rounded-[24px] border border-[var(--line)] bg-white/82 px-4 py-4">
                        <div className="flex items-center justify-between gap-3">
                          <p className="text-xs uppercase tracking-[0.2em] text-slate-500">
                            위치 포인트
                          </p>
                          <span className="rounded-full bg-[var(--accent-soft)] px-3 py-1 text-[11px] font-semibold text-[var(--accent)]">
                            지도 후보 {chapterGeoPhotos.length}장
                          </span>
                        </div>
                        <p className="mt-3 text-sm font-semibold text-slate-900">
                          {leadGeoPhoto.locationLabel ?? "좌표 기반 장소"}
                        </p>
                        <p className="mt-2 text-xs leading-5 text-slate-500">
                          {formatCoordinate(leadGeoPhoto.coordinates.latitude)},{" "}
                          {formatCoordinate(leadGeoPhoto.coordinates.longitude)}
                        </p>
                        <div className="mt-4 flex items-center gap-2">
                          {Array.from({ length: Math.min(chapterGeoPhotos.length, 4) }).map(
                            (_, dotIndex) => (
                              <span
                                key={`${group.title}-geo-${dotIndex}`}
                                className="h-2.5 w-2.5 rounded-full bg-[var(--accent)]"
                              />
                            ),
                          )}
                          <span className="text-xs text-slate-500">
                            GPS가 살아 있는 사진을 바탕으로 지도 카드 연출에 활용합니다.
                          </span>
                        </div>
                      </div>
                    ) : null}
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      </div>
    </AppShell>
  );
}
