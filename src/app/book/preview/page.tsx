"use client";

import { AppShell } from "@/components/app-shell";
import { previewThemes, timelineGroups } from "@/lib/mock-trip";
import { useTripDraft } from "@/lib/use-trip-draft";

function estimatePages(photoCount: number, chapterCount: number) {
  return Math.max(24, chapterCount * 6 + Math.ceil(photoCount / 4) * 2);
}

function estimatePrice(pageCount: number) {
  return Math.round(16800 + pageCount * 330);
}

export default function BookPreviewPage() {
  const { draft, hydrated } = useTripDraft();
  const chapters = draft?.chapters ?? timelineGroups;
  const pageCount = estimatePages(
    draft?.stats.totalPhotos ?? timelineGroups.length * 8,
    chapters.length,
  );
  const price = estimatePrice(pageCount);

  return (
    <AppShell
      eyebrow="Preview Builder"
      title={
        draft
          ? `Choose a pattern for ${draft.tripName}.`
          : "Choose a pattern and turn chapters into spreads."
      }
      description={
        draft
          ? "The uploaded trip draft is flowing into the preview now, so the cover, spreads, and price estimate reflect the actual imported chapters."
          : "The MVP keeps design choices tight: three editorial patterns, clear cover treatment, and one Sweetbook-ready preview before finalization."
      }
      aside={
        <div className="space-y-4">
          {previewThemes.map((theme) => (
            <article key={theme.name} className="soft-card rounded-[28px] p-5">
              <p className="font-display text-3xl leading-none text-slate-900">
                {theme.name}
              </p>
              <p className="mt-3 text-sm leading-6 text-slate-600">{theme.note}</p>
            </article>
          ))}

          <article className="soft-card rounded-[28px] p-5">
            <p className="eyebrow text-[11px] font-semibold">Live estimate</p>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <div className="rounded-2xl border border-[var(--line)] bg-white/80 px-4 py-4">
                <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Pages</p>
                <p className="mt-2 text-2xl font-semibold text-slate-900">{pageCount}</p>
              </div>
              <div className="rounded-2xl border border-[var(--line)] bg-white/80 px-4 py-4">
                <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Price</p>
                <p className="mt-2 text-2xl font-semibold text-slate-900">
                  KRW {price.toLocaleString()}
                </p>
              </div>
            </div>
          </article>
        </div>
      }
    >
      {!hydrated ? (
        <div className="soft-card rounded-[28px] p-5 text-sm text-slate-600">
          Loading trip draft...
        </div>
      ) : null}

      <div className="grid gap-4 xl:grid-cols-[0.95fr_1.05fr]">
        <div className="soft-card rounded-[28px] p-5">
          <p className="eyebrow text-[11px] font-semibold">Cover concept</p>
          <div className="mt-4 rounded-[28px] bg-[linear-gradient(180deg,_rgba(21,111,102,0.16),_rgba(24,33,40,0.95))] p-6 text-white">
            <p className="text-xs uppercase tracking-[0.2em] text-white/70">
              {draft ? draft.travelStart ?? "Triplogue" : "Tokyo 2026"}
            </p>
            <h2 className="mt-16 font-display text-5xl leading-none">
              {draft ? draft.tripName : "Night & Light"}
            </h2>
            <p className="mt-4 max-w-sm text-sm leading-6 text-white/80">
              {draft
                ? `${draft.stats.totalPhotos} photos across ${draft.chapters.length} chapters`
                : "City trails, temple mornings, and one detour to the lake."}
            </p>
          </div>
        </div>

        <div className="grid gap-4">
          {(draft?.chapters ?? timelineGroups).map((group, index) => (
            <article
              key={"photoIds" in group ? group.id : group.title}
              className="soft-card rounded-[28px] p-5"
            >
              <p className="eyebrow text-[11px] font-semibold">
                Spread {index + 1} / {"photoIds" in group ? group.dayLabel : group.day}
              </p>
              <div className="mt-4 grid gap-4 md:grid-cols-[1.1fr_0.9fr]">
                <div className="grid min-h-48 grid-cols-2 gap-3 rounded-[24px] bg-[rgba(223,199,173,0.25)] p-3">
                  {Array.from({ length: 4 }, (_, photoIndex) => draft?.photos[photoIndex]).map(
                    (photo, photoIndex) => (
                      <div
                        key={photo?.id ?? `${index}-${photoIndex}`}
                        className="rounded-[20px] bg-[linear-gradient(160deg,_rgba(21,111,102,0.6),_rgba(255,255,255,0.85))]"
                      >
                        {photo ? (
                          <div className="flex h-full items-end p-3">
                            <span className="rounded-full bg-white/85 px-3 py-1 text-[11px] font-semibold text-slate-800">
                              {photo.locationLabel ?? photo.dateKey}
                            </span>
                          </div>
                        ) : null}
                      </div>
                    ),
                  )}
                </div>

                <div>
                  <h3 className="font-display text-4xl leading-none text-slate-900">
                    {group.title}
                  </h3>
                  <p className="mt-3 text-sm leading-6 text-slate-600">
                    {"photoIds" in group ? group.placeLabel : group.place}
                  </p>
                  <p className="mt-4 text-sm leading-6 text-slate-700">
                    {"photoIds" in group
                      ? `${group.photoCount} imported photos are feeding this spread.`
                      : "The generated page keeps the visual rhythm loose, then anchors it with one location note and a clean chapter opener."}
                  </p>
                </div>
              </div>
            </article>
          ))}
        </div>
      </div>
    </AppShell>
  );
}
