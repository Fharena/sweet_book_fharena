import Link from "next/link";

import { DemoTripLauncher } from "@/components/demo-trip-launcher";

const landingPoints = [
  "사진 업로드 후 EXIF 시간과 GPS를 읽어 자동으로 챕터를 나눕니다.",
  "위치가 없는 사진은 검토 단계에서 필요한 것만 수동 태깅합니다.",
  "세 가지 포토북 포맷 중 하나를 고르면 바로 Sweetbook 초안으로 이어집니다.",
];

export default function Home() {
  return (
    <div className="relative px-4 py-6 sm:px-6 lg:px-8">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-6">
        <section className="studio-hero rounded-[40px] border border-white/60 px-6 py-8 shadow-[0_24px_80px_rgba(15,23,42,0.08)] sm:px-8 sm:py-10">
          <div className="grid gap-8 xl:grid-cols-[minmax(0,1.15fr)_minmax(300px,0.85fr)]">
            <div className="space-y-6">
              <div className="flex flex-wrap items-center gap-3">
                <span className="rounded-full border border-[rgba(15,118,110,0.18)] bg-white/80 px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.24em] text-[var(--accent)]">
                  Triplogue
                </span>
                <span className="rounded-full border border-[var(--line)] bg-white/70 px-4 py-2 text-xs font-medium text-slate-600">
                  여행 사진을 포토북으로 정리하는 스튜디오
                </span>
              </div>

              <div className="space-y-4">
                <h1 className="max-w-4xl text-[clamp(2.6rem,5.3vw,5.4rem)] font-semibold tracking-[-0.065em] text-slate-950">
                  사진을 올리고,
                  <br />
                  날짜와 장소 흐름을 확인한 뒤
                  <br />
                  바로 포토북으로 만듭니다.
                </h1>
                <p className="max-w-2xl text-base leading-8 text-slate-600">
                  랜딩에서는 시작만 고르고, 실제 작업은 단일 스튜디오에서 이어집니다. 단계가 쪼개져 새로고침처럼 느껴지던 흐름을 줄이고, 업로드부터 Sweetbook 생성까지 한 화면에서 검토할 수 있게 정리했습니다.
                </p>
              </div>

              <div className="flex flex-wrap gap-3">
                <Link
                  href="/studio"
                  className="button-primary rounded-full px-5 py-3 text-sm font-semibold !text-white visited:!text-white"
                >
                  내 사진으로 시작
                </Link>
                <Link
                  href="/studio?demo=1"
                  className="button-secondary rounded-full px-5 py-3 text-sm font-semibold text-slate-900"
                >
                  샘플 초안으로 둘러보기
                </Link>
              </div>
            </div>

            <div className="studio-card rounded-[32px] p-6">
              <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-500">
                실사용 흐름
              </p>
              <div className="mt-5 grid gap-3">
                {landingPoints.map((point, index) => (
                  <div
                    key={point}
                    className="rounded-[24px] border border-[var(--line)] bg-white px-4 py-4"
                  >
                    <div className="flex items-start gap-3">
                      <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-[var(--accent-soft)] text-xs font-semibold text-[var(--accent)]">
                        {index + 1}
                      </span>
                      <p className="text-sm leading-6 text-slate-700">{point}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        <DemoTripLauncher layout="compact" />
      </div>
    </div>
  );
}
