import { Suspense } from "react";

import { StudioSearchClient } from "@/components/studio-search-client";

export default function StudioPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-[#fbf9f4] px-6 py-10 text-slate-700">
          <div className="mx-auto max-w-screen-md rounded-[28px] border border-[rgba(191,201,196,0.18)] bg-white px-6 py-8 shadow-[0_8px_32px_rgba(27,28,25,0.04)]">
            <p className="text-xs font-bold uppercase tracking-[0.22em] text-[#00342b]">
              Triplogue Studio
            </p>
            <h1 className="mt-4 text-3xl font-extrabold tracking-[-0.05em] text-slate-950">
              스튜디오를 준비하고 있습니다
            </h1>
            <p className="mt-3 text-sm leading-7 text-slate-600">
              작업 화면을 불러오는 중입니다.
            </p>
          </div>
        </div>
      }
    >
      <StudioSearchClient />
    </Suspense>
  );
}
