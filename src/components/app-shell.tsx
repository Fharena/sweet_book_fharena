"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

import { navSteps } from "@/lib/mock-trip";

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

  return (
    <div className="relative min-h-screen overflow-hidden px-4 py-6 text-slate-900 sm:px-6 lg:px-8">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-80 bg-[radial-gradient(circle_at_top,_rgba(21,111,102,0.18),_transparent_55%)]" />
      <div className="pointer-events-none absolute right-8 top-20 h-48 w-48 rounded-full bg-[rgba(223,199,173,0.28)] blur-3xl" />

      <div className="mx-auto flex w-full max-w-7xl flex-col gap-6">
        <header className="glass-panel rounded-[28px] px-6 py-5 sm:px-8">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="space-y-3">
              <p className="eyebrow text-xs font-semibold">Triplogue / Sweetbook</p>
              <div>
                <h1 className="font-display text-4xl leading-none sm:text-5xl">
                  {title}
                </h1>
                <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-600 sm:text-base">
                  {description}
                </p>
              </div>
            </div>

            <div className="rounded-[24px] border border-[var(--line)] bg-white/70 px-4 py-4 sm:min-w-72">
              <p className="eyebrow text-[11px] font-semibold">{eyebrow}</p>
              <p className="mt-2 text-sm leading-6 text-slate-700">
                Travel photos are grouped by capture time and location first, then
                turned into a Sweetbook-ready layout.
              </p>
            </div>
          </div>

          <nav className="mt-6 flex flex-wrap gap-2">
            {navSteps.map((step) => {
              const isActive = pathname === step.href;

              return (
                <Link
                  key={step.href}
                  href={step.href}
                  className={`rounded-full border px-4 py-2 text-sm font-medium transition ${
                    isActive
                      ? "border-transparent bg-slate-950 text-white"
                      : "border-[var(--line)] bg-white/75 text-slate-700 hover:border-slate-400"
                  }`}
                >
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
