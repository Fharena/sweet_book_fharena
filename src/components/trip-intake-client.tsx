"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { FormEvent } from "react";

import { AppShell } from "@/components/app-shell";
import { tripSummary } from "@/lib/mock-trip";
import { clearTripDraft, saveTripDraft } from "@/lib/trip-draft";
import type { TripIntakeResult } from "@/lib/trip-domain";

type ManualLocationOverride = {
  fileName: string;
  locationLabel: string;
};

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

export function TripIntakeClient() {
  const [files, setFiles] = useState<File[]>([]);
  const [tripName, setTripName] = useState("Tokyo Night & Light");
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
        preview: getPreviewUrl(file),
      })),
    [files],
  );

  useEffect(() => {
    return () => {
      previewItems.forEach((item) => URL.revokeObjectURL(item.preview));
    };
  }, [previewItems]);

  const manualFallbackCount = result?.stats.manualTaggingRequired ?? 0;

  function addFiles(nextFiles: FileList | File[]) {
    const accepted = Array.from(nextFiles).filter((file) =>
      file.type.startsWith("image/"),
    );

    if (accepted.length === 0) {
      return;
    }

    setFiles((current) => {
      const seen = new Set(current.map((file) => `${file.name}:${file.size}`));
      const merged = [...current];

      for (const file of accepted) {
        const key = `${file.name}:${file.size}`;
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

    const overrides = manualLocations
      .split("\n")
      .map((value) => value.trim())
      .filter(Boolean)
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
      eyebrow="Frontend Chunk 1"
      title="Import photos and collect the metadata that matters."
      description="This step explains the EXIF-first strategy: use Galaxy location tags when they exist, then fall back to manual place tagging for the missing photos."
      aside={
        <div className="space-y-5">
          <div className="soft-card rounded-[28px] p-5">
            <p className="eyebrow text-[11px] font-semibold">Photo intake checklist</p>
            <ul className="mt-4 space-y-3 text-sm leading-6 text-slate-700">
              <li>Accept JPG, HEIC, and PNG uploads.</li>
              <li>Read capture time and GPS from EXIF when available.</li>
              <li>Flag photos with missing location for manual tagging.</li>
            </ul>
          </div>

          <div className="soft-card rounded-[28px] p-5">
            <p className="text-sm font-semibold text-slate-900">Why this matters</p>
            <p className="mt-3 text-sm leading-6 text-slate-600">
              {tripSummary.locationPolicy}
            </p>
          </div>

          <div className="soft-card rounded-[28px] p-5">
            <p className="text-sm font-semibold text-slate-900">Manual fallback</p>
            <p className="mt-3 text-sm leading-6 text-slate-600">
              If a batch comes in without GPS, we keep it moving. You can assign a
              place label later and still continue toward the book preview.
            </p>
          </div>
        </div>
      }
    >
      <form className="space-y-6" onSubmit={handleSubmit}>
        <section className="rounded-[28px] border border-dashed border-[rgba(24,33,40,0.18)] bg-white/70 p-6 sm:p-8">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
            <div className="max-w-2xl space-y-4">
              <p className="eyebrow text-[11px] font-semibold">Upload center</p>
              <h2 className="font-display text-4xl leading-none text-slate-900">
                Drop your travel photos here.
              </h2>
              <p className="text-sm leading-6 text-slate-600">
                We keep the first interaction simple: one trip, one upload action,
                and a clearly visible note that location tags improve automatic
                grouping.
              </p>

              <div className="grid gap-3 sm:grid-cols-3">
                {[
                  `${files.length} photos queued`,
                  `${result?.stats.withGpsCoordinates ?? 0} photos with GPS`,
                  `${manualFallbackCount} photos need manual tagging`,
                ].map((item) => (
                  <div
                    key={item}
                    className="rounded-2xl border border-[var(--line)] bg-[var(--surface-strong)] px-4 py-4 text-sm font-semibold text-slate-700"
                  >
                    {item}
                  </div>
                ))}
              </div>
            </div>

            <div className="w-full max-w-md rounded-[24px] border border-[var(--line)] bg-white/80 p-5">
              <p className="text-sm font-semibold text-slate-900">Trip settings</p>
              <div className="mt-4 grid gap-3">
                <label className="grid gap-2">
                  <span className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
                    Trip name
                  </span>
                  <input
                    className="rounded-2xl border border-[var(--line)] bg-white px-4 py-3 text-sm outline-none transition focus:border-slate-500"
                    value={tripName}
                    onChange={(event) => setTripName(event.target.value)}
                    placeholder="Tokyo Night & Light"
                  />
                </label>
                <div className="grid gap-3 sm:grid-cols-2">
                  <label className="grid gap-2">
                    <span className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
                      Start
                    </span>
                    <input
                      className="rounded-2xl border border-[var(--line)] bg-white px-4 py-3 text-sm outline-none transition focus:border-slate-500"
                      value={travelStart}
                      onChange={(event) => setTravelStart(event.target.value)}
                      type="date"
                    />
                  </label>
                  <label className="grid gap-2">
                    <span className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
                      End
                    </span>
                    <input
                      className="rounded-2xl border border-[var(--line)] bg-white px-4 py-3 text-sm outline-none transition focus:border-slate-500"
                      value={travelEnd}
                      onChange={(event) => setTravelEnd(event.target.value)}
                      type="date"
                    />
                  </label>
                </div>
              </div>
            </div>
          </div>

          <div className="mt-6 rounded-[24px] border border-[var(--line)] bg-[linear-gradient(180deg,_rgba(21,111,102,0.08),_rgba(255,255,255,0.96))] p-5">
            <p className="text-sm font-semibold text-slate-900">
              Galaxy guidance
            </p>
            <p className="mt-2 text-sm leading-6 text-slate-700">
              On Samsung Galaxy, turn on Camera &gt; Settings &gt; Location tags so
              EXIF GPS is preserved. If a photo still comes in without location data,
              we will keep it in the manual tagging lane instead of blocking the trip.
            </p>
          </div>
        </section>

        <section className="grid gap-6 xl:grid-cols-[1.05fr_0.95fr]">
          <div className="space-y-4">
            <div
              className="soft-card rounded-[28px] border border-dashed border-[rgba(24,33,40,0.2)] p-6 transition hover:border-slate-400"
              onDragOver={(event) => event.preventDefault()}
              onDrop={(event) => {
                event.preventDefault();
                addFiles(event.dataTransfer.files);
              }}
            >
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-base font-semibold text-slate-900">
                    Select images from your trip
                  </p>
                  <p className="mt-2 text-sm leading-6 text-slate-600">
                    JPG, HEIC, and PNG work best for the demo. Drag and drop is
                    supported, but a file picker is fine too.
                  </p>
                </div>
                <button
                  type="button"
                  className="rounded-full border border-[var(--line)] bg-white px-4 py-2 text-sm font-semibold text-slate-800 transition hover:border-slate-500"
                  onClick={() => inputRef.current?.click()}
                >
                  Choose files
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
                  Manual fallback labels
                </span>
                <textarea
                  className="mt-2 min-h-28 w-full rounded-[24px] border border-[var(--line)] bg-white px-4 py-3 text-sm outline-none transition focus:border-slate-500"
                  value={manualLocations}
                  onChange={(event) => setManualLocations(event.target.value)}
                  placeholder="Optional. One location label per line for photos without GPS."
                />
              </label>

              <div className="mt-5 flex flex-wrap gap-3">
                <button
                  type="submit"
                  className="rounded-full bg-slate-950 px-5 py-3 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-400"
                  disabled={isSubmitting}
                >
                  {isSubmitting ? "Processing intake..." : "Submit travel intake"}
                </button>
                <button
                  type="button"
                  className="rounded-full border border-[var(--line)] bg-white px-5 py-3 text-sm font-semibold text-slate-700 transition hover:border-slate-500"
                  onClick={() => {
                    setFiles([]);
                    setManualLocations("");
                    setResult(null);
                    setError(null);
                    clearTripDraft();
                  }}
                >
                  Reset batch
                </button>
              </div>

              {error ? (
                <div className="mt-5 rounded-[20px] border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                  {error}
                </div>
              ) : null}
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              {previewItems.length > 0 ? (
                previewItems.map(({ file, preview }) => (
                  <article
                    key={`${file.name}:${file.size}`}
                    className="soft-card overflow-hidden rounded-[28px]"
                  >
                    <div
                      className="h-44 bg-cover bg-center"
                      style={{ backgroundImage: `url(${preview})` }}
                    />
                    <div className="space-y-2 p-4">
                      <p className="truncate text-sm font-semibold text-slate-900">
                        {file.name}
                      </p>
                      <div className="flex items-center justify-between text-xs text-slate-500">
                        <span>{formatBytes(file.size)}</span>
                        <span>{file.type || "unknown type"}</span>
                      </div>
                    </div>
                  </article>
                ))
              ) : (
                <div className="soft-card rounded-[28px] p-6 text-sm leading-6 text-slate-600">
                  Once you add files, this area becomes the quick intake preview so
                  you can sanity-check the batch before sending it to the server.
                </div>
              )}
            </div>
          </div>

          <div className="space-y-4">
            <article className="soft-card rounded-[28px] p-5">
              <p className="eyebrow text-[11px] font-semibold">Automatic path</p>
              <p className="mt-3 text-sm leading-6 text-slate-600">
                If EXIF GPS exists, we reverse-map it to a place label and connect
                it to the nearest travel day automatically.
              </p>
            </article>

            <article className="soft-card rounded-[28px] p-5">
              <p className="eyebrow text-[11px] font-semibold">Fallback path</p>
              <p className="mt-3 text-sm leading-6 text-slate-600">
                Missing GPS is not a blocker. Users can tag several photos at once
                with one place label before continuing to review.
              </p>
            </article>

            {result ? (
              <div className="space-y-4">
                <article className="soft-card rounded-[28px] p-5">
                  <p className="text-base font-semibold text-slate-900">
                    Intake summary
                  </p>
                  <div className="mt-4 grid gap-3 sm:grid-cols-2">
                    {[
                      ["Trip", result.tripName],
                      ["Photos", String(result.stats.totalPhotos)],
                      ["Chapters", String(result.chapters.length)],
                      ["GPS", String(result.stats.withGpsCoordinates)],
                      ["Manual tags", String(result.stats.manualTaggingRequired)],
                    ].map(([label, value]) => (
                      <div
                        key={label}
                        className="rounded-2xl border border-[var(--line)] bg-white/80 px-4 py-4"
                      >
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
                  <p className="text-base font-semibold text-slate-900">
                    Chapter suggestions
                  </p>
                  <div className="mt-4 space-y-3">
                    {result.chapters.map((chapter) => (
                      <div
                        key={chapter.id}
                        className="rounded-2xl border border-[var(--line)] bg-white/80 px-4 py-4"
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
                            {chapter.photoCount} photos
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
                  <p className="text-base font-semibold text-slate-900">
                    Photo quality breakdown
                  </p>
                  <div className="mt-4 space-y-3">
                    {result.photos.slice(0, 6).map((photo) => (
                      <div
                        key={photo.id}
                        className="rounded-2xl border border-[var(--line)] bg-white/80 px-4 py-4"
                      >
                        <div className="flex items-center justify-between gap-4">
                          <div>
                            <p className="text-sm font-semibold text-slate-900">
                              {photo.fileName}
                            </p>
                            <p className="mt-1 text-xs text-slate-500">
                              {photo.dateKey} / {photo.locationLabel ?? "No location"}
                            </p>
                          </div>
                          <span className="rounded-full bg-slate-950 px-3 py-1 text-xs font-semibold text-white">
                            {photo.locationSource}
                          </span>
                        </div>
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
