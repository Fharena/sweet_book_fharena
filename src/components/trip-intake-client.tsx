"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { FormEvent } from "react";

import { AppShell } from "@/components/app-shell";
import { BackendHealthCard } from "@/components/backend-health-card";
import { DemoTripLauncher } from "@/components/demo-trip-launcher";
import { tripSummary } from "@/lib/mock-trip";
import { clearTripDraft, saveTripDraft } from "@/lib/trip-draft";
import type { TripIntakeResult } from "@/lib/trip-domain";

type ManualLocationOverride = {
  fileName: string;
  locationLabel: string;
};

type TripPhoto = TripIntakeResult["photos"][number];

function formatBytes(bytes: number) {
  if (bytes < 1024) {
    return `${bytes} B`;
  }

  const units = ["KB", "MB", "GB"];
  let value = bytes / 1024;
  let unitIndex = 0;

  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024;
    unitIndex += 1;
  }

  return `${value.toFixed(value >= 10 ? 0 : 1)} ${units[unitIndex]}`;
}

function getPreviewUrl(file: File) {
  return URL.createObjectURL(file);
}

function getFileKey(file: File) {
  return `${file.name}:${file.size}`;
}

function getPhotoKey(photo: TripPhoto) {
  return `${photo.fileName}:${photo.size}`;
}

function formatLocationSource(source: TripPhoto["locationSource"]) {
  switch (source) {
    case "exif":
      return "EXIF 자동";
    case "manual":
      return "수동 보정";
    case "time-cluster":
      return "시간대 정리";
    default:
      return "확인 필요";
  }
}

function getLocationToneClass(photo?: TripPhoto) {
  if (!photo) {
    return "bg-slate-100 text-slate-700";
  }

  if (photo.requiresManualLocationTagging) {
    return "bg-amber-100 text-amber-900";
  }

  switch (photo.locationSource) {
    case "exif":
      return "bg-emerald-100 text-emerald-900";
    case "manual":
      return "bg-sky-100 text-sky-900";
    case "time-cluster":
      return "bg-indigo-100 text-indigo-900";
    default:
      return "bg-slate-100 text-slate-700";
  }
}

export function TripIntakeClient() {
  const [files, setFiles] = useState<File[]>([]);
  const [tripName, setTripName] = useState("도쿄 나이트 앤 라이트");
  const [travelStart, setTravelStart] = useState("2026-04-02");
  const [travelEnd, setTravelEnd] = useState("2026-04-06");
  const [manualLocations, setManualLocations] = useState("");
  const [result, setResult] = useState<TripIntakeResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const inputRef = useRef<HTMLInputElement | null>(null);

  const previewItems = useMemo(
    () =>
      files.map((file) => ({
        file,
        key: getFileKey(file),
        preview: getPreviewUrl(file),
      })),
    [files],
  );

  const totalSize = useMemo(
    () => files.reduce((sum, file) => sum + file.size, 0),
    [files],
  );

  const manualLocationEntries = useMemo(
    () =>
      manualLocations
        .split("\n")
        .map((value) => value.trim())
        .filter(Boolean),
    [manualLocations],
  );

  const processedPhotoMap = useMemo(
    () =>
      new Map(
        (result?.photos ?? []).map((photo) => [getPhotoKey(photo), photo]),
      ),
    [result],
  );

  useEffect(() => {
    return () => {
      previewItems.forEach((item) => URL.revokeObjectURL(item.preview));
    };
  }, [previewItems]);

  const selectedFileCount = files.length;
  const manualFallbackCount = result?.stats.manualTaggingRequired ?? 0;
  const gpsCount = result?.stats.withGpsCoordinates ?? 0;
  const resolvedLocationCount = result?.stats.withResolvedLocation ?? 0;
  const hasResult = result !== null;
  const workflowStage = hasResult
    ? "업로드 완료"
    : isSubmitting
      ? "처리 중"
      : selectedFileCount > 0
        ? "업로드 대기"
        : "사진 선택 전";

  const workflowStepStates = [
    selectedFileCount > 0,
    hasResult || isSubmitting || selectedFileCount > 0,
    hasResult,
  ];

  function addFiles(nextFiles: FileList | File[]) {
    const accepted = Array.from(nextFiles).filter((file) =>
      file.type.startsWith("image/"),
    );

    if (accepted.length === 0) {
      return;
    }

    setFiles((current) => {
      const seen = new Set(current.map((file) => getFileKey(file)));
      const merged = [...current];

      for (const file of accepted) {
        const key = getFileKey(file);
        if (!seen.has(key)) {
          merged.push(file);
          seen.add(key);
        }
      }

      return merged;
    });
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    if (files.length === 0) {
      setError("최소 한 장의 여행 사진을 선택해 주세요.");
      return;
    }

    const formData = new FormData();
    files.forEach((file) => formData.append("files", file));
    formData.append("tripName", tripName);
    formData.append("travelStart", travelStart);
    formData.append("travelEnd", travelEnd);

    const overrides = manualLocationEntries
      .slice(0, files.length)
      .map<ManualLocationOverride>((value, index) => ({
        fileName: files[index]?.name ?? `manual-${index + 1}`,
        locationLabel: value,
      }));

    if (overrides.length > 0) {
      formData.append("manualLocations", JSON.stringify(overrides));
    }

    setIsSubmitting(true);

    try {
      const response = await fetch("/api/trips/intake", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        const payload = (await response.json()) as { error?: string };
        throw new Error(payload.error ?? "업로드 처리에 실패했습니다.");
      }

      const payload = (await response.json()) as TripIntakeResult;
      setResult(payload);
      saveTripDraft(payload);
    } catch (submissionError) {
      setError(
        submissionError instanceof Error
          ? submissionError.message
          : "알 수 없는 오류가 발생했습니다.",
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <AppShell
      eyebrow="여행 사진 업로드"
      title="사진을 올리고 포토북 초안의 재료를 정리하는 단계"
      description="EXIF 중심으로 촬영 시간과 위치를 읽고, 위치 태그가 없는 사진은 수동 보정으로 보완해 다음 단계로 넘깁니다."
      aside={
        <div className="space-y-5">
          <div className="soft-card rounded-[28px] p-5">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="eyebrow text-[11px] font-semibold">업로드 요약</p>
                <p className="mt-3 text-2xl font-semibold text-slate-900">
                  {selectedFileCount > 0
                    ? `${selectedFileCount}장 준비됨`
                    : "사진을 아직 고르지 않았어요"}
                </p>
                <p className="mt-2 text-sm leading-6 text-slate-600">
                  {hasResult
                    ? `업로드 후 ${resolvedLocationCount}장의 위치가 정리됐고 ${manualFallbackCount}장은 수동 보정이 남았습니다.`
                    : `총 ${formatBytes(totalSize)} 용량의 사진을 받아 EXIF/GPS 상태를 한눈에 보여줍니다.`}
                </p>
              </div>
              <span
                className={`rounded-full px-3 py-1 text-xs font-semibold ${
                  hasResult
                    ? "bg-emerald-100 text-emerald-900"
                    : isSubmitting
                      ? "bg-amber-100 text-amber-900"
                      : "bg-slate-100 text-slate-700"
                }`}
              >
                {workflowStage}
              </span>
            </div>

            <div className="mt-5 grid gap-3 sm:grid-cols-3">
              <div className="metric-tile px-4 py-4">
                <p className="text-xs uppercase tracking-[0.2em] text-slate-500">
                  사진
                </p>
                <p className="mt-2 text-lg font-semibold text-slate-900">
                  {selectedFileCount}장
                </p>
              </div>
              <div className="metric-tile px-4 py-4">
                <p className="text-xs uppercase tracking-[0.2em] text-slate-500">
                  총 용량
                </p>
                <p className="mt-2 text-lg font-semibold text-slate-900">
                  {formatBytes(totalSize)}
                </p>
              </div>
              <div className="metric-tile px-4 py-4">
                <p className="text-xs uppercase tracking-[0.2em] text-slate-500">
                  위치 태그
                </p>
                <p className="mt-2 text-sm font-semibold text-slate-900">
                  {hasResult
                    ? `${gpsCount}장 자동 / ${manualFallbackCount}장 보정`
                    : manualLocationEntries.length > 0
                      ? `${manualLocationEntries.length}개 보정 후보 입력됨`
                      : "업로드 후 자동 계산"}
                </p>
              </div>
            </div>

            <p className="mt-4 text-xs leading-5 text-slate-500">
              수동 위치 라벨은 한 줄에 한 장씩, 앞에서부터 순서대로 적용됩니다.
            </p>
          </div>

          <div className="soft-card rounded-[28px] p-5">
            <p className="text-sm font-semibold text-slate-900">
              위치 태그 기대치
            </p>
            <p className="mt-3 text-sm leading-6 text-slate-600">
              {tripSummary.locationPolicy}
            </p>
            <div className="mt-4 rounded-[20px] border border-[var(--line)] bg-white px-4 py-3">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
                데모에서 보여줄 포인트
              </p>
              <p className="mt-2 text-sm leading-6 text-slate-700">
                사진 개수, 총 용량, GPS 유무, 수동 보정 대기 상태가 한 화면에서
                바로 보이도록 설계했습니다.
              </p>
            </div>
          </div>

          <div className="soft-card rounded-[28px] p-5">
            <p className="text-sm font-semibold text-slate-900">업로드 흐름</p>
            <div className="mt-4 space-y-3">
              {[
                {
                  title: "1. 사진 선택",
                  detail: "JPG, HEIC, PNG를 한 번에 받아 중복은 건너뜁니다.",
                },
                {
                  title: "2. 위치 정리",
                  detail: "EXIF GPS와 수동 라벨을 함께 써서 장소를 보정합니다.",
                },
                {
                  title: "3. 초안 생성",
                  detail: "챕터로 묶인 결과를 다음 미리보기 단계로 넘깁니다.",
                },
              ].map((step, index) => (
                <div
                  key={step.title}
                  className={`rounded-2xl border px-4 py-3 ${
                    workflowStepStates[index]
                      ? "border-[var(--line-strong)] bg-[rgba(15,118,110,0.08)]"
                      : "border-[var(--line)] bg-white"
                  }`}
                >
                  <p className="text-sm font-semibold text-slate-900">
                    {step.title}
                  </p>
                  <p className="mt-1 text-sm leading-6 text-slate-600">
                    {step.detail}
                  </p>
                </div>
              ))}
            </div>
          </div>

          <BackendHealthCard title="업로드 전 백엔드 상태" compact />
        </div>
      }
    >
      <form className="space-y-6" onSubmit={handleSubmit}>
        <section className="editorial-panel hero-sheen rounded-[32px] p-6 sm:p-8">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
            <div className="max-w-2xl min-w-0 space-y-4">
              <span className="section-kicker">업로드 센터</span>
              <h2 className="max-w-xl font-display text-3xl text-slate-900 sm:text-[2.7rem]">
                여행 사진을 올리면 정리 상태가 바로 보입니다.
              </h2>
              <p className="text-sm leading-6 text-slate-600">
                첫 단계는 최대한 단순하게 가져갑니다. 여행 하나, 업로드 한 번,
                그리고 위치 태그가 자동 그룹핑 정확도를 높여준다는 안내만 또렷하게
                보여줍니다.
              </p>

              <div className="grid gap-3 sm:grid-cols-3">
                {[
                  {
                    label: "선택된 사진",
                    value: `${selectedFileCount}장`,
                    note: hasResult ? "업로드 완료 기준" : "파일을 고르면 즉시 반영",
                  },
                  {
                    label: "총 용량",
                    value: formatBytes(totalSize),
                    note: "모바일 업로드 전 확인용",
                  },
                  {
                    label: "위치 태그",
                    value: hasResult
                      ? `${gpsCount}장 자동 / ${manualFallbackCount}장 보정`
                      : "업로드 후 계산",
                    note:
                      manualLocationEntries.length > 0
                        ? `${manualLocationEntries.length}개 수동 라벨 입력`
                        : "GPS 없는 사진은 수동으로 보완",
                  },
                ].map((item) => (
                  <div
                    key={item.label}
                    className="metric-tile px-4 py-4 text-sm font-semibold text-slate-700"
                  >
                    <p className="text-xs uppercase tracking-[0.2em] text-slate-500">
                      {item.label}
                    </p>
                    <p className="mt-2 text-lg font-semibold text-slate-900">
                      {item.value}
                    </p>
                    <p className="mt-2 text-xs font-normal leading-5 text-slate-500">
                      {item.note}
                    </p>
                  </div>
                ))}
              </div>
            </div>

            <div className="ink-panel w-full max-w-md rounded-[28px] p-5 text-white">
              <div className="flex items-center justify-between gap-4">
                <p className="text-sm font-semibold text-white">여행 기본 정보</p>
                <span className="rounded-full bg-white/14 px-3 py-1 text-xs font-semibold text-white/90">
                  {workflowStage}
                </span>
              </div>
              <div className="mt-4 grid gap-3">
                <label className="grid gap-2">
                  <span className="text-xs font-semibold uppercase tracking-[0.2em] text-white/62">
                    여행 이름
                  </span>
                  <input
                    className="rounded-2xl border border-white/12 bg-white/92 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-white"
                    value={tripName}
                    onChange={(event) => setTripName(event.target.value)}
                    placeholder="도쿄 나이트 앤 라이트"
                  />
                </label>
                <div className="grid gap-3 sm:grid-cols-2">
                  <label className="grid gap-2">
                    <span className="text-xs font-semibold uppercase tracking-[0.2em] text-white/62">
                      출발일
                    </span>
                    <input
                      className="rounded-2xl border border-white/12 bg-white/92 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-white"
                      value={travelStart}
                      onChange={(event) => setTravelStart(event.target.value)}
                      type="date"
                    />
                  </label>
                  <label className="grid gap-2">
                    <span className="text-xs font-semibold uppercase tracking-[0.2em] text-white/62">
                      종료일
                    </span>
                    <input
                      className="rounded-2xl border border-white/12 bg-white/92 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-white"
                      value={travelEnd}
                      onChange={(event) => setTravelEnd(event.target.value)}
                      type="date"
                    />
                  </label>
                </div>
              </div>
            </div>
          </div>

          <div
            className={`mt-6 rounded-[24px] border p-5 ${
              hasResult
                ? "border-emerald-200 bg-emerald-50/80"
                : "border-[var(--line)] bg-[linear-gradient(135deg,_rgba(15,118,110,0.12),_rgba(243,123,87,0.1))]"
            }`}
          >
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="section-kicker">
                  {hasResult ? "업로드 후 상태" : "업로드 전 상태"}
                </p>
                <p className="mt-2 text-sm leading-6 text-slate-700">
                  {hasResult
                    ? `정리된 결과가 보입니다. ${result.chapters.length}개 챕터와 ${resolvedLocationCount}개의 위치 정리가 다음 단계로 이어집니다.`
                    : "사진을 선택하면 정리 전 상태와 완료 후 상태를 같은 화면에서 비교할 수 있습니다."}
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <span className="rounded-full bg-white/80 px-3 py-1 text-xs font-semibold text-slate-700">
                  {hasResult ? `${result.chapters.length}개 챕터` : "챕터 미생성"}
                </span>
                <span className="rounded-full bg-white/80 px-3 py-1 text-xs font-semibold text-slate-700">
                  {selectedFileCount > 0 ? `${selectedFileCount}장 선택됨` : "사진 대기"}
                </span>
              </div>
            </div>
          </div>
        </section>

        <DemoTripLauncher
          layout="compact"
          className="bg-[linear-gradient(135deg,_rgba(255,255,255,0.92),_rgba(255,244,236,0.94))]"
        />

        <section className="grid gap-6 xl:grid-cols-[1.05fr_0.95fr]">
          <div className="space-y-4">
            <div
              className="editorial-panel rounded-[32px] border border-dashed border-[rgba(24,33,40,0.2)] p-6 transition hover:border-[var(--line-strong)]"
              onDragOver={(event) => event.preventDefault()}
              onDrop={(event) => {
                event.preventDefault();
                addFiles(event.dataTransfer.files);
              }}
            >
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-base font-semibold text-slate-900">
                    여행 사진을 선택해 주세요
                  </p>
                  <p className="mt-2 text-sm leading-6 text-slate-600">
                    데모 기준으로 JPG, HEIC, PNG가 가장 안정적입니다. 드래그 앤 드롭도
                    가능하고 파일 선택기로 올려도 됩니다.
                  </p>
                </div>
                <button
                  type="button"
                  className="button-secondary rounded-full px-4 py-2 text-sm font-semibold text-slate-800"
                  onClick={() => inputRef.current?.click()}
                >
                  파일 고르기
                </button>
              </div>

              <input
                ref={inputRef}
                className="hidden"
                type="file"
                accept="image/*"
                multiple
                onChange={(event) => {
                  if (event.target.files) {
                    addFiles(event.target.files);
                    event.target.value = "";
                  }
                }}
              />

              <label className="mt-5 block">
                <span className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
                  위치 라벨 보정(선택)
                </span>
                <textarea
                  className="mt-2 min-h-28 w-full rounded-[24px] border border-[var(--line)] bg-white px-4 py-3 text-sm outline-none transition focus:border-slate-500"
                  value={manualLocations}
                  onChange={(event) => setManualLocations(event.target.value)}
                  placeholder="GPS가 없는 사진용 위치 라벨을 한 줄에 하나씩 넣어둘 수 있습니다. 앞에서부터 순서대로 적용됩니다."
                />
              </label>

              <div className="mt-5 flex flex-wrap gap-3">
                <button
                  type="submit"
                  className="button-primary rounded-full px-5 py-3 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:bg-slate-400 disabled:shadow-none"
                  disabled={isSubmitting}
                >
                  {isSubmitting ? "업로드 처리 중..." : "여행 사진 업로드 시작"}
                </button>
                <button
                  type="button"
                  className="button-secondary rounded-full px-5 py-3 text-sm font-semibold text-slate-700"
                  onClick={() => {
                    setFiles([]);
                    setManualLocations("");
                    setResult(null);
                    setError(null);
                    clearTripDraft();
                    if (inputRef.current) {
                      inputRef.current.value = "";
                    }
                  }}
                >
                  배치 초기화
                </button>
              </div>

              {error ? (
                <div className="mt-5 rounded-[20px] border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                  {error}
                </div>
              ) : null}
            </div>

            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {previewItems.length > 0 ? (
                previewItems.map(({ file, key, preview }, index) => {
                  const processedPhoto = processedPhotoMap.get(key);
                  const statusLabel = processedPhoto
                    ? formatLocationSource(processedPhoto.locationSource)
                    : "업로드 전";
                  const statusClass = getLocationToneClass(processedPhoto);

                  return (
                    <article
                      key={key}
                      className="editorial-panel overflow-hidden rounded-[28px]"
                    >
                      <div className="relative h-44 bg-slate-100">
                        <div
                          className="h-full bg-cover bg-center"
                          style={{ backgroundImage: `url(${preview})` }}
                        />
                        <div className="absolute inset-x-4 top-4 flex items-start justify-between gap-3">
                          <span className="rounded-full bg-black/70 px-3 py-1 text-xs font-semibold text-white">
                            #{String(index + 1).padStart(2, "0")}
                          </span>
                          <span
                            className={`rounded-full px-3 py-1 text-xs font-semibold ${statusClass}`}
                          >
                            {statusLabel}
                          </span>
                        </div>
                        <div className="absolute inset-x-4 bottom-4 flex flex-wrap gap-2">
                          <span className="rounded-full bg-white/90 px-3 py-1 text-[11px] font-semibold text-slate-800">
                            {file.type || "알 수 없는 형식"}
                          </span>
                          <span className="rounded-full bg-white/90 px-3 py-1 text-[11px] font-semibold text-slate-800">
                            {formatBytes(file.size)}
                          </span>
                        </div>
                      </div>
                      <div className="space-y-3 p-4">
                        <div>
                          <p className="truncate text-sm font-semibold text-slate-900">
                            {file.name}
                          </p>
                          <p className="mt-1 text-xs text-slate-500">
                            {processedPhoto
                              ? `${processedPhoto.dateKey} / ${processedPhoto.locationLabel ?? "위치 정보 없음"}`
                              : "업로드 전 상태입니다."}
                          </p>
                        </div>

                        <div className="flex flex-wrap gap-2">
                          <span className="rounded-full bg-[var(--accent-soft)] px-3 py-1 text-xs font-semibold text-[var(--accent)]">
                            {processedPhoto
                              ? processedPhoto.requiresManualLocationTagging
                                ? "수동 보정 필요"
                                : "자동 정리"
                              : "정리 대기"}
                          </span>
                          <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">
                            순서 {String(index + 1).padStart(2, "0")}
                          </span>
                        </div>

                        {processedPhoto ? (
                          <p className="text-xs leading-5 text-slate-500">
                            {processedPhoto.groupingReason}
                          </p>
                        ) : (
                          <p className="text-xs leading-5 text-slate-500">
                            업로드 후 위치와 날짜를 읽고 챕터 후보로 정리합니다.
                          </p>
                        )}
                      </div>
                    </article>
                  );
                })
              ) : (
                <div className="editorial-panel rounded-[28px] p-6 text-sm leading-6 text-slate-600">
                  파일을 올리면 이 영역이 빠른 업로드 미리보기로 바뀝니다. 서버로 보내기
                  전에 배치 상태를 한 번 더 눈으로 확인할 수 있습니다.
                </div>
              )}
            </div>
          </div>

          <div className="space-y-4">
            <article className="editorial-panel rounded-[28px] p-5">
              <p className="section-kicker">자동 정리 경로</p>
              <p className="mt-3 text-sm leading-6 text-slate-600">
                EXIF GPS가 있으면 장소 라벨을 먼저 읽고, 촬영 날짜와 함께 가장 자연스러운
                여행 챕터 후보로 자동 연결합니다.
              </p>
            </article>

            <article className="editorial-panel rounded-[28px] p-5">
              <p className="section-kicker">수동 보정 경로</p>
              <p className="mt-3 text-sm leading-6 text-slate-600">
                GPS가 없는 사진은 막히지 않고 그대로 넘어갑니다. 검토 단계에서 한 장소
                태그를 여러 장에 한 번에 적용할 수 있습니다.
              </p>
            </article>

            <article className="editorial-panel rounded-[28px] p-5">
              <p className="section-kicker">
                {hasResult ? "업로드 완료" : "업로드 전"}
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                <span className="rounded-full bg-[var(--accent-soft)] px-3 py-1 text-xs font-semibold text-[var(--accent)]">
                  {hasResult ? "정리 결과 생성됨" : "정리 결과 대기"}
                </span>
                <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">
                  {selectedFileCount > 0
                    ? `${selectedFileCount}장 업로드 준비됨`
                    : "사진 선택 필요"}
                </span>
              </div>
              <p className="mt-4 text-sm leading-6 text-slate-600">
                {hasResult
                  ? `${result.chapters.length}개 챕터와 ${result.photos.length}장의 사진이 포토북 초안으로 넘어갈 준비가 됐습니다.`
                  : "파일을 선택하면 업로드 전/후 상태 전환이 이 카드에서 바로 드러납니다."}
              </p>
            </article>

            {result ? (
              <div className="space-y-4">
                <article className="soft-card rounded-[28px] p-5">
                  <p className="section-kicker">업로드 요약</p>
                  <div className="mt-4 grid gap-3 sm:grid-cols-2">
                    {[
                      ["여행", result.tripName],
                      ["사진", String(result.stats.totalPhotos)],
                      ["챕터", String(result.chapters.length)],
                      ["GPS", String(result.stats.withGpsCoordinates)],
                      ["수동 태그", String(result.stats.manualTaggingRequired)],
                      ["위치 정리", String(result.stats.withResolvedLocation)],
                    ].map(([label, value]) => (
                      <div key={label} className="metric-tile px-4 py-4">
                        <p className="text-xs uppercase tracking-[0.2em] text-slate-500">
                          {label}
                        </p>
                        <p className="mt-2 text-lg font-semibold text-slate-900">
                          {value}
                        </p>
                      </div>
                    ))}
                  </div>
                </article>

                <article className="soft-card rounded-[28px] p-5">
                  <p className="section-kicker">추천 챕터</p>
                  <div className="mt-4 space-y-3">
                    {result.chapters.map((chapter) => (
                      <div
                        key={chapter.id}
                        className="editorial-panel rounded-2xl px-4 py-4"
                      >
                        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                          <div>
                            <p className="text-sm font-semibold text-slate-900">
                              {chapter.title}
                            </p>
                            <p className="mt-1 text-xs uppercase tracking-[0.2em] text-slate-500">
                              {chapter.dayLabel} / {chapter.placeLabel}
                            </p>
                          </div>
                          <div className="rounded-full bg-[var(--accent-soft)] px-3 py-1 text-xs font-semibold text-[var(--accent)]">
                            사진 {chapter.photoCount}장
                          </div>
                        </div>
                        <p className="mt-3 text-sm leading-6 text-slate-600">
                          {chapter.groupingReason}
                        </p>
                      </div>
                    ))}
                  </div>
                </article>

                <article className="soft-card rounded-[28px] p-5">
                  <p className="section-kicker">사진 상태 미리보기</p>
                  <div className="mt-4 space-y-3">
                    {result.photos.slice(0, 6).map((photo) => (
                      <div key={photo.id} className="metric-tile px-4 py-4">
                        <div className="flex items-center justify-between gap-4">
                          <div>
                            <p className="text-sm font-semibold text-slate-900">
                              {photo.fileName}
                            </p>
                            <p className="mt-1 text-xs text-slate-500">
                              {photo.dateKey} / {photo.locationLabel ?? "위치 정보 없음"}
                            </p>
                          </div>
                          <span className="rounded-full bg-slate-950 px-3 py-1 text-xs font-semibold text-white">
                            {formatLocationSource(photo.locationSource)}
                          </span>
                        </div>
                        <p className="mt-3 text-xs leading-5 text-slate-500">
                          {photo.groupingReason}
                        </p>
                      </div>
                    ))}
                  </div>
                </article>
              </div>
            ) : null}
          </div>
        </section>
      </form>
    </AppShell>
  );
}
