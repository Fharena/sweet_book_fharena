"use client";

import { AppShell } from "@/components/app-shell";
import { timelineGroups } from "@/lib/mock-trip";
import { useTripDraft } from "@/lib/use-trip-draft";

function formatChapterSubtitle(
  chapter: { dayLabel: string; placeLabel: string },
  index: number,
) {
  return `${chapter.dayLabel} / ${chapter.placeLabel || `Fallback zone ${index + 1}`}`;
}

export default function TripReviewPage() {
  const { draft, hydrated } = useTripDraft();
  const activeDraft = draft;
  const groups = activeDraft?.chapters ?? timelineGroups;

  return (
    <AppShell
      eyebrow="Grouping Review"
      title={
        activeDraft
          ? `Review ${activeDraft.tripName} before the book is generated.`
          : "Review the chapters before the book is generated."
      }
      description={
        activeDraft
          ? "The uploaded intake draft is now driving the group list, so you can see actual chapter suggestions, photo counts, and manual-tagging gaps."
          : "This screen keeps automatic intelligence transparent. Users can trust the suggested story because they can still see and correct the raw day-and-place grouping."
      }
      aside={
        <div className="space-y-4">
          <div className="soft-card rounded-[28px] p-5">
            <p className="eyebrow text-[11px] font-semibold">Operations we support</p>
            <ul className="mt-4 space-y-3 text-sm leading-6 text-slate-700">
              <li>Merge neighboring groups that belong to one stop.</li>
              <li>Split a day into morning and evening moments.</li>
              <li>Apply one location tag to many missing photos at once.</li>
            </ul>
          </div>

          <div className="soft-card rounded-[28px] p-5">
            <p className="text-sm font-semibold text-slate-900">Book impact</p>
            <p className="mt-3 text-sm leading-6 text-slate-600">
              {activeDraft
                ? `${activeDraft.chapters.length} imported chapters are ready for layout generation.`
                : "Each approved group becomes a chapter candidate for the Sweetbook layout generator."}
            </p>
          </div>
        </div>
      }
    >
      <div className="space-y-4">
        {!hydrated ? (
          <div className="soft-card rounded-[28px] p-5 text-sm text-slate-600">
            Loading trip draft...
          </div>
        ) : null}

        {activeDraft ? (
          <div className="grid gap-4 lg:grid-cols-3">
            <article className="soft-card rounded-[28px] p-5">
              <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Photos</p>
              <p className="mt-2 text-3xl font-semibold text-slate-900">
                {activeDraft.stats.totalPhotos}
              </p>
              <p className="mt-3 text-sm leading-6 text-slate-600">
                {activeDraft.stats.manualTaggingRequired} photos still need a manual place tag.
              </p>
            </article>
            <article className="soft-card rounded-[28px] p-5">
              <p className="text-xs uppercase tracking-[0.2em] text-slate-500">GPS</p>
              <p className="mt-2 text-3xl font-semibold text-slate-900">
                {activeDraft.stats.withGpsCoordinates}
              </p>
              <p className="mt-3 text-sm leading-6 text-slate-600">
                Photos with EXIF coordinates can be auto-mapped into day-by-place chapters.
              </p>
            </article>
            <article className="soft-card rounded-[28px] p-5">
              <p className="text-xs uppercase tracking-[0.2em] text-slate-500">
                Timeline
              </p>
              <p className="mt-2 text-3xl font-semibold text-slate-900">
                {activeDraft.chapters.length}
              </p>
              <p className="mt-3 text-sm leading-6 text-slate-600">
                Suggested chapters feed directly into the preview builder.
              </p>
            </article>
          </div>
        ) : null}

        {groups.map((group, index) => (
          <article
            key={"photoIds" in group ? group.id : group.title}
            className="soft-card rounded-[28px] p-5 transition hover:-translate-y-0.5"
          >
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <p className="eyebrow text-[11px] font-semibold">
                  {"photoIds" in group ? group.dayLabel : group.day} /{" "}
                  {"photoIds" in group ? "From intake" : group.time}
                </p>
                <h2 className="mt-2 font-display text-4xl leading-none text-slate-900">
                  {group.title}
                </h2>
                <p className="mt-3 text-sm leading-6 text-slate-600">
                  {"photoIds" in group ? group.placeLabel : group.place}
                </p>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div className="rounded-2xl border border-[var(--line)] bg-white/80 px-4 py-4">
                  <p className="text-xs uppercase tracking-[0.2em] text-slate-500">
                    Photos
                  </p>
                  <p className="mt-2 text-2xl font-semibold text-slate-900">
                    {"photoIds" in group ? group.photoCount : group.photos}
                  </p>
                </div>
                <div className="rounded-2xl border border-[var(--line)] bg-white/80 px-4 py-4">
                  <p className="text-xs uppercase tracking-[0.2em] text-slate-500">
                    Confidence
                  </p>
                  <p className="mt-2 text-sm leading-6 text-slate-700">
                    {"photoIds" in group
                      ? formatChapterSubtitle(group, index)
                      : group.confidence}
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
