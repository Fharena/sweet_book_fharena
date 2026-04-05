import Link from "next/link";

import { AppShell } from "@/components/app-shell";
import { previewThemes, timelineGroups, tripSummary } from "@/lib/mock-trip";

export default function Home() {
  return (
    <AppShell
      eyebrow="Travel Photobook MVP"
      title="Turn a camera roll into a trip book in one pass."
      description="Triplogue reads capture time and location metadata from travel photos, suggests day-by-place chapters, and prepares a Sweetbook order flow without forcing users into a heavy editor."
      aside={
        <div className="space-y-6">
          <div className="soft-card rounded-[28px] p-5">
            <p className="eyebrow text-[11px] font-semibold">Galaxy Tip</p>
            <p className="mt-3 text-sm leading-6 text-slate-700">
              {tripSummary.locationPolicy}
            </p>
          </div>

          <div className="soft-card rounded-[28px] p-5">
            <p className="eyebrow text-[11px] font-semibold">Suggested Chapters</p>
            <div className="mt-4 space-y-3">
              {timelineGroups.map((group) => (
                <div
                  key={group.title}
                  className="rounded-2xl border border-[var(--line)] bg-white/80 px-4 py-3"
                >
                  <p className="text-sm font-semibold text-slate-900">{group.title}</p>
                  <p className="mt-1 text-xs uppercase tracking-[0.2em] text-slate-500">
                    {group.day} / {group.place}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>
      }
    >
      <div className="space-y-10">
        <div className="grid gap-6 lg:grid-cols-[1.15fr_0.85fr]">
          <div className="space-y-5">
            <p className="eyebrow text-[11px] font-semibold">What we are building</p>
            <p className="max-w-2xl text-lg leading-8 text-slate-700">
              A travel-first photobook service that groups uploaded photos by day
              and place, falls back to manual tagging when GPS is missing, and
              turns the result into a bookstore-quality preview and order.
            </p>
            <div className="flex flex-wrap gap-3">
              <Link
                href="/trips/new"
                className="rounded-full bg-slate-950 px-5 py-3 text-sm font-semibold text-white transition hover:bg-slate-800"
              >
                Start import flow
              </Link>
              <Link
                href="/book/preview"
                className="rounded-full border border-[var(--line)] bg-white/80 px-5 py-3 text-sm font-semibold text-slate-800 transition hover:border-slate-500"
              >
                Jump to book preview
              </Link>
            </div>
          </div>

          <div className="soft-card bg-grid rounded-[28px] p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-semibold text-slate-900">Tokyo Night & Light</p>
                <p className="mt-1 text-sm text-slate-600">{tripSummary.travelWindow}</p>
              </div>
              <span className="rounded-full bg-[var(--accent-soft)] px-3 py-1 text-xs font-semibold text-[var(--accent)]">
                Demo project
              </span>
            </div>

            <div className="relative mt-8 min-h-72 rounded-[24px] border border-[var(--line)] bg-[linear-gradient(180deg,_rgba(255,255,255,0.9),_rgba(247,240,231,0.78))] p-6">
              <div className="absolute left-[18%] top-[28%] h-3 w-3 rounded-full bg-[var(--accent)] map-dot" />
              <div className="absolute left-[45%] top-[22%] h-3 w-3 rounded-full bg-[var(--accent)] map-dot" />
              <div className="absolute left-[68%] top-[58%] h-3 w-3 rounded-full bg-[var(--accent)] map-dot" />
              <div className="absolute left-[23%] top-[56%] h-20 w-20 rounded-full border border-dashed border-[rgba(21,111,102,0.25)]" />

              <div className="absolute bottom-6 left-6 right-6 rounded-[24px] border border-[var(--line)] bg-white/85 p-4">
                <p className="text-xs uppercase tracking-[0.24em] text-slate-500">
                  Auto-grouping summary
                </p>
                <p className="mt-2 text-sm leading-6 text-slate-700">
                  {tripSummary.heroNote}
                </p>
              </div>
            </div>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          {[
            {
              title: "1. Import photos",
              copy: "Read EXIF capture time and GPS from travel photos, then flag anything incomplete.",
            },
            {
              title: "2. Review chapters",
              copy: "Merge or repair location groups before layout generation so the story still feels intentional.",
            },
            {
              title: "3. Order the book",
              copy: "Pick a layout pattern, generate a Sweetbook draft, and continue to estimate and checkout.",
            },
          ].map((item) => (
            <article key={item.title} className="soft-card rounded-[28px] p-5">
              <p className="text-base font-semibold text-slate-900">{item.title}</p>
              <p className="mt-3 text-sm leading-6 text-slate-600">{item.copy}</p>
            </article>
          ))}
        </div>

        <div className="space-y-4">
          <p className="eyebrow text-[11px] font-semibold">Initial design patterns</p>
          <div className="grid gap-4 md:grid-cols-3">
            {previewThemes.map((theme) => (
              <article key={theme.name} className="soft-card rounded-[28px] p-5">
                <p className="font-display text-3xl leading-none text-slate-900">
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
