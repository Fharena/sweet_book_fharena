"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

import { AppShell } from "@/components/app-shell";
import { DemoTripLauncher } from "@/components/demo-trip-launcher";
import { isDemoTripDraft } from "@/lib/demo-trip-draft";
import { timelineGroups } from "@/lib/mock-trip";
import {
  applyManualLocationTagToDraft,
  saveTripDraft,
} from "@/lib/trip-draft";
import { useTripDraft } from "@/lib/use-trip-draft";

function formatChapterSubtitle(
  chapter: { dayLabel: string; placeLabel: string },
  index: number,
) {
  return `${chapter.dayLabel} / ${chapter.placeLabel || `보완 구간 ${index + 1}`}`;
}

export default function TripReviewPage() {
  const { draft, hydrated } = useTripDraft();
  const [manualLocationLabel, setManualLocationLabel] = useState("");
  const [selectedPhotoIds, setSelectedPhotoIds] = useState<string[]>([]);
  const [feedback, setFeedback] = useState<string | null>(null);
  const activeDraft = draft;
  const isDemoDraft = isDemoTripDraft(activeDraft);
  const groups = activeDraft?.chapters ?? timelineGroups;
  const photosNeedingManualTagging = useMemo(
    () =>
      activeDraft?.photos.filter((photo) => photo.requiresManualLocationTagging) ?? [],
    [activeDraft],
  );
  const locationSuggestions = useMemo(() => {
    const values = new Set(
      (activeDraft?.photos ?? [])
        .map((photo) => photo.locationLabel)
        .filter((value): value is string => Boolean(value)),
    );

    return Array.from(values).slice(0, 6);
  }, [activeDraft]);
  const classificationSummary = useMemo(
    () => ({
      exif: activeDraft?.photos.filter((photo) => photo.locationSource === "exif").length ?? 0,
      timeCluster:
        activeDraft?.photos.filter((photo) => photo.locationSource === "time-cluster").length ??
        0,
      manual:
        activeDraft?.photos.filter(
          (photo) =>
            photo.locationSource === "manual" && !photo.requiresManualLocationTagging,
        ).length ?? 0,
      needsReview:
        activeDraft?.photos.filter((photo) => photo.requiresManualLocationTagging).length ?? 0,
      chapters: activeDraft?.chapters.length ?? 0,
    }),
    [activeDraft],
  );

  function togglePhotoSelection(photoId: string) {
    setSelectedPhotoIds((current) =>
      current.includes(photoId)
        ? current.filter((id) => id !== photoId)
        : [...current, photoId],
    );
  }

  function handleApplyManualTag() {
    if (!activeDraft) {
      return;
    }

    const normalizedLabel = manualLocationLabel.trim();

    if (!normalizedLabel || selectedPhotoIds.length === 0) {
      setFeedback("위치 라벨과 사진 선택을 먼저 확인해 주세요.");
      return;
    }

    const nextDraft = applyManualLocationTagToDraft(
      activeDraft,
      selectedPhotoIds,
      normalizedLabel,
    );
    saveTripDraft(nextDraft);
    setSelectedPhotoIds([]);
    setManualLocationLabel("");
    setFeedback(
      `${selectedPhotoIds.length}장의 사진에 "${normalizedLabel}" 태그를 적용했습니다.`,
    );
  }

  return (
    <AppShell
      eyebrow="검토 단계"
      title={
        activeDraft
          ? `${activeDraft.tripName}의 챕터를 검토하고 보정하는 단계`
          : "챕터를 검토하고 보정하는 단계"
      }
      description={
        activeDraft
          ? "자동 그룹핑 결과를 그대로 보여주고, 위치 정보가 없는 사진은 여기서 수동 태깅해 실제 포토북 초안을 더 정확하게 만들 수 있습니다."
          : "자동 그룹핑 결과를 눈으로 확인하고, 필요하면 수동 위치 태깅으로 챕터 구성을 보정하는 화면입니다."
      }
      aside={
        <div className="space-y-4">
          <div className="soft-card rounded-[28px] p-5">
            <p className="eyebrow text-[11px] font-semibold">검토 체크리스트</p>
            <ul className="mt-4 space-y-3 text-sm leading-6 text-slate-700">
              <li>같은 장소로 봐야 하는 사진을 수동 태깅으로 묶기</li>
              <li>위치 없는 사진 여러 장에 한 번에 동일한 태그 적용</li>
              <li>보정된 여행 초안을 미리보기와 주문 단계까지 그대로 전달</li>
            </ul>
          </div>

          <div className="soft-card rounded-[28px] p-5">
            <p className="text-sm font-semibold text-slate-900">포토북 반영 상태</p>
            <p className="mt-3 text-sm leading-6 text-slate-600">
              {activeDraft
                ? `${activeDraft.chapters.length}개 챕터가 현재 미리보기 생성에 사용됩니다.`
                : "검토를 마친 그룹은 Sweetbook 포토북 챕터 후보로 바로 이어집니다."}
            </p>
            {activeDraft ? (
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <div className="rounded-2xl border border-[var(--line)] bg-white/80 px-4 py-4">
                  <p className="text-xs uppercase tracking-[0.2em] text-slate-500">
                    수동 보정
                  </p>
                  <p className="mt-2 text-2xl font-semibold text-slate-900">
                    {activeDraft.stats.manualTaggingRequired}
                  </p>
                </div>
                <div className="rounded-2xl border border-[var(--line)] bg-white/80 px-4 py-4">
                  <p className="text-xs uppercase tracking-[0.2em] text-slate-500">
                    GPS 포함
                  </p>
                  <p className="mt-2 text-2xl font-semibold text-slate-900">
                    {activeDraft.stats.withGpsCoordinates}
                  </p>
                </div>
              </div>
            ) : null}
          </div>
        </div>
      }
    >
      <div className="space-y-4">
        {!hydrated ? (
          <div className="soft-card rounded-[28px] p-5 text-sm text-slate-600">
            여행 초안을 불러오는 중입니다...
          </div>
        ) : null}

        {activeDraft && isDemoDraft ? (
          <article className="soft-card rounded-[28px] p-5">
            <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
              <div>
                <p className="section-kicker">샘플 여행 초안</p>
                <p className="mt-3 text-sm leading-6 text-slate-600">
                  지금 보고 있는 데이터는 발표와 리뷰를 위한 데모용 초안입니다. 위치
                  보정이 필요한 사진을 한 번 태깅해 본 뒤 미리보기로 넘어가면 서비스
                  가치가 가장 빠르게 전달됩니다.
                </p>
              </div>
              <Link
                href="/book/preview"
                className="button-secondary rounded-full px-5 py-3 text-sm font-semibold text-slate-800"
              >
                미리보기로 바로 이동
              </Link>
            </div>
          </article>
        ) : null}

        {activeDraft ? (
          <article className="soft-card rounded-[32px] p-5 sm:p-6">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
              <div>
                <p className="section-kicker">자동 분류 근거</p>
                <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-600">
                  업로드 이후 어떤 사진이 GPS로 바로 정리됐는지, 어떤 사진이 시간대
                  힌트로 보완됐는지, 그리고 실제로 어느 정도가 수동 보정이 필요한지
                  한눈에 볼 수 있게 정리했습니다.
                </p>
              </div>
              <div className="rounded-full bg-[rgba(15,118,110,0.12)] px-4 py-2 text-xs font-semibold text-[var(--accent)]">
                자동 생성 챕터 {classificationSummary.chapters}개
              </div>
            </div>

            <div className="mt-5 grid gap-3 md:grid-cols-2 2xl:grid-cols-4">
              {[
                ["GPS 즉시 분류", classificationSummary.exif, "EXIF 좌표로 바로 묶인 사진"],
                [
                  "시간대 보완",
                  classificationSummary.timeCluster,
                  "같은 날짜의 인접 사진으로 장소를 보완한 사진",
                ],
                [
                  "수동 태그 완료",
                  classificationSummary.manual,
                  "검토 단계에서 직접 보정해 둔 사진",
                ],
                [
                  "보정 대기",
                  classificationSummary.needsReview,
                  "아직 위치 태그 확인이 필요한 사진",
                ],
              ].map(([label, value, note]) => (
                <div
                  key={String(label)}
                  className="rounded-[24px] border border-[var(--line)] bg-white/82 px-4 py-4"
                >
                  <p className="text-xs uppercase tracking-[0.2em] text-slate-500">
                    {label}
                  </p>
                  <p className="metric-value mt-2 font-semibold text-slate-900">{value}</p>
                  <p className="mt-2 text-sm leading-6 text-slate-600">{note}</p>
                </div>
              ))}
            </div>
          </article>
        ) : null}

        {activeDraft ? (
          <section className="hero-sheen rounded-[32px] border border-[var(--line)] bg-[linear-gradient(135deg,_rgba(255,255,255,0.92),_rgba(255,244,236,0.96))] p-6 shadow-[0_18px_50px_rgba(82,55,29,0.08)] sm:p-8">
            <div className="flex flex-col gap-6 xl:flex-row xl:items-start xl:justify-between">
              <div className="max-w-2xl min-w-0 space-y-4">
                <div className="flex flex-wrap gap-2">
                  <span className="rounded-full bg-[var(--accent-soft)] px-3 py-1 text-xs font-semibold text-[var(--accent)]">
                    자동 그룹핑
                  </span>
                  <span className="rounded-full bg-[var(--accent-secondary-soft)] px-3 py-1 text-xs font-semibold text-[var(--accent-secondary)]">
                    수동 보정 대기
                  </span>
                </div>
                <h2 className="display-title max-w-xl text-slate-900">
                  사진이 이야기처럼 이어지도록 먼저 정리합니다.
                </h2>
                <p className="max-w-2xl text-sm leading-7 text-slate-600 sm:text-base">
                  위치 정보가 있는 사진은 자동으로 묶고, 비어 있는 사진만 가볍게 보정합니다. 한 번의 검토로 포토북 흐름을 더 자연스럽게 만듭니다.
                </p>
              </div>

              <div className="grid w-full gap-3 md:grid-cols-2 xl:min-w-[17rem] xl:grid-cols-1">
                <div className="rounded-[24px] border border-[var(--line)] bg-white/85 px-5 py-4">
                  <p className="text-xs uppercase tracking-[0.2em] text-slate-500">
                    사진
                  </p>
                  <p className="metric-value mt-2 font-semibold text-slate-900">
                    {activeDraft.stats.totalPhotos}
                  </p>
                </div>
                <div className="rounded-[24px] border border-[var(--line)] bg-white/85 px-5 py-4">
                  <p className="text-xs uppercase tracking-[0.2em] text-slate-500">
                    챕터
                  </p>
                  <p className="metric-value mt-2 font-semibold text-slate-900">
                    {activeDraft.chapters.length}
                  </p>
                </div>
              </div>
            </div>

            <div className="mt-6 grid gap-3 md:grid-cols-3">
              <div className="rounded-[24px] border border-[var(--line)] bg-white/85 px-4 py-4">
                <p className="text-xs uppercase tracking-[0.2em] text-slate-500">
                  GPS 포함
                </p>
                <p className="mt-2 text-2xl font-semibold text-slate-900">
                  {activeDraft.stats.withGpsCoordinates}
                </p>
                <p className="mt-2 text-sm leading-6 text-slate-600">
                  위치 태그가 살아 있는 사진은 장소별 챕터로 우선 배치됩니다.
                </p>
              </div>
              <div className="rounded-[24px] border border-[var(--line)] bg-white/85 px-4 py-4">
                <p className="text-xs uppercase tracking-[0.2em] text-slate-500">
                  보정 필요
                </p>
                <p className="mt-2 text-2xl font-semibold text-slate-900">
                  {activeDraft.stats.manualTaggingRequired}
                </p>
                <p className="mt-2 text-sm leading-6 text-slate-600">
                  같은 장소 태그를 여러 장에 한 번에 적용할 수 있습니다.
                </p>
              </div>
              <div className="rounded-[24px] border border-[var(--line)] bg-white/85 px-4 py-4">
                <p className="text-xs uppercase tracking-[0.2em] text-slate-500">
                  정리 상태
                </p>
                <p className="mt-2 text-2xl font-semibold text-slate-900">
                  완료
                </p>
                <p className="mt-2 text-sm leading-6 text-slate-600">
                  검토를 마치면 미리보기와 주문 단계가 그대로 이어집니다.
                </p>
              </div>
            </div>
          </section>
        ) : null}

        {!activeDraft && hydrated ? (
          <DemoTripLauncher
            layout="compact"
            className="bg-[linear-gradient(135deg,_rgba(255,255,255,0.94),_rgba(255,244,236,0.94))]"
          />
        ) : null}

        {activeDraft ? (
          <article className="soft-card rounded-[32px] p-5 sm:p-6">
            <div className="flex flex-col gap-4 border-b border-[var(--line)] pb-5 xl:flex-row xl:items-start xl:justify-between">
              <div className="space-y-3">
                <p className="eyebrow text-[11px] font-semibold">수동 태깅</p>
                <h2 className="display-title max-w-xl text-slate-900">
                  위치가 비는 사진만 빠르게 보정합니다.
                </h2>
                <p className="max-w-2xl text-sm leading-6 text-slate-600">
                  같은 장소로 묶을 사진을 고르고 라벨을 넣으면 여행 초안이 다시 계산됩니다. 작업 흐름은 단순하게, 결과는 더 정확하게 유지합니다.
                </p>
              </div>

              <div className="grid gap-2 rounded-[24px] border border-[var(--line)] bg-white/85 px-4 py-4 text-sm text-slate-700">
                <span className="text-xs uppercase tracking-[0.2em] text-slate-500">
                  현재 선택
                </span>
                <span className="text-2xl font-semibold text-slate-900">
                  {selectedPhotoIds.length}장
                </span>
                <span className="text-xs text-slate-500">
                  보정 대기 {photosNeedingManualTagging.length}장
                </span>
              </div>
            </div>

            <div className="mt-5 grid gap-4 xl:grid-cols-[0.9fr_1.1fr]">
              <div className="space-y-4">
                <label className="grid gap-2">
                  <span className="text-sm font-semibold text-slate-900">적용할 위치 라벨</span>
                  <input
                    className="rounded-2xl border border-[var(--line)] bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-slate-500"
                    value={manualLocationLabel}
                    onChange={(event) => setManualLocationLabel(event.target.value)}
                    placeholder="예: 시부야 스카이"
                  />
                </label>

                {locationSuggestions.length > 0 ? (
                  <div className="flex flex-wrap gap-2">
                    {locationSuggestions.map((label) => (
                      <button
                        key={label}
                        type="button"
                        className="rounded-full border border-[var(--line)] bg-white px-3 py-2 text-xs font-semibold text-slate-700 transition hover:border-slate-500"
                        onClick={() => setManualLocationLabel(label)}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                ) : null}

                <div className="flex flex-wrap gap-3">
                  <button
                    type="button"
                    className="button-primary rounded-full px-5 py-3 text-sm font-semibold text-white"
                    onClick={handleApplyManualTag}
                  >
                    선택 사진에 태그 적용
                  </button>
                  <button
                    type="button"
                    className="rounded-full border border-[var(--line)] bg-white px-5 py-3 text-sm font-semibold text-slate-700 transition hover:border-slate-500"
                    onClick={() =>
                      setSelectedPhotoIds(
                        photosNeedingManualTagging.map((photo) => photo.id),
                      )
                    }
                  >
                    전체 선택
                  </button>
                  <button
                    type="button"
                    className="rounded-full border border-[var(--line)] bg-white px-5 py-3 text-sm font-semibold text-slate-700 transition hover:border-slate-500"
                    onClick={() => setSelectedPhotoIds([])}
                  >
                    선택 해제
                  </button>
                </div>

                {feedback ? (
                  <div className="rounded-[24px] border border-emerald-200 bg-emerald-50 px-5 py-4 text-sm text-emerald-800">
                    {feedback}
                  </div>
                ) : null}
              </div>

              <div className="space-y-3">
                {photosNeedingManualTagging.length > 0 ? (
                  photosNeedingManualTagging.map((photo) => {
                    const isSelected = selectedPhotoIds.includes(photo.id);

                    return (
                      <label
                        key={photo.id}
                        className={`flex cursor-pointer items-start gap-4 rounded-[24px] border px-4 py-4 transition ${
                          isSelected
                            ? "border-slate-900 bg-slate-50"
                            : "border-[var(--line)] bg-white/85 hover:border-slate-400"
                        }`}
                        >
                          <input
                            type="checkbox"
                            checked={isSelected}
                          onChange={() => togglePhotoSelection(photo.id)}
                          className="mt-1"
                        />
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                            <p className="truncate text-sm font-semibold text-slate-900">
                              {photo.fileName}
                            </p>
                            <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-700">
                              {photo.dateKey}
                            </span>
                          </div>
                          <p className="mt-2 text-sm leading-6 text-slate-600">
                            {photo.groupingReason}
                          </p>
                        </div>
                      </label>
                    );
                  })
                ) : (
                  <div className="rounded-[24px] border border-dashed border-[var(--line)] bg-white/65 px-5 py-10 text-sm text-slate-500">
                    현재 수동 태깅이 필요한 사진이 없습니다. 자동 그룹핑만으로도 다음 단계로 넘어갈 수 있습니다.
                  </div>
                )}
              </div>
            </div>
          </article>
        ) : null}

        {groups.map((group, index) => (
          <article
            key={"photoIds" in group ? group.id : group.title}
            className="soft-card rounded-[32px] p-5 transition hover:-translate-y-0.5 sm:p-6"
          >
            <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
              <div className="max-w-3xl space-y-3">
                <p className="eyebrow text-[11px] font-semibold">
                  {"photoIds" in group ? group.dayLabel : group.day} /{" "}
                  {"photoIds" in group ? "업로드 기준" : group.time}
                </p>
                <div className="flex flex-wrap items-center gap-3">
                  <h2 className="display-card-title text-slate-900">
                    {group.title}
                  </h2>
                  <span className="rounded-full bg-[var(--accent-soft)] px-3 py-1 text-xs font-semibold text-[var(--accent)]">
                    {"photoIds" in group ? group.photoCount : group.photos}장
                  </span>
                </div>
                <p className="text-sm leading-6 text-slate-600">
                  {"photoIds" in group ? group.placeLabel : group.place}
                </p>
                <p className="max-w-2xl text-sm leading-6 text-slate-700">
                  {"photoIds" in group
                    ? formatChapterSubtitle(group, index)
                    : group.confidence}
                </p>
              </div>

              <div className="grid w-full gap-3 md:grid-cols-2 xl:min-w-[16rem] xl:grid-cols-1">
                <div className="rounded-[24px] border border-[var(--line)] bg-white/80 px-4 py-4">
                  <p className="text-xs uppercase tracking-[0.2em] text-slate-500">
                    사진 수
                  </p>
                  <p className="mt-2 text-2xl font-semibold text-slate-900">
                    {"photoIds" in group ? group.photoCount : group.photos}
                  </p>
                </div>
                <div className="rounded-[24px] border border-[var(--line)] bg-white/80 px-4 py-4">
                  <p className="text-xs uppercase tracking-[0.2em] text-slate-500">
                    그룹 메모
                  </p>
                  <p className="mt-2 text-sm leading-6 text-slate-700">
                    {"photoIds" in group ? "검토 후 바로 미리보기에 반영" : group.confidence}
                  </p>
                </div>
              </div>
            </div>
          </article>
        ))}
      </div>
    </AppShell>
  );
}
