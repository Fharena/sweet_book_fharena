"use client";

import { useEffect, useState } from "react";

type BackendStatusPayload = {
  data?: {
    environment?: string;
    apiKeyConfigured?: boolean;
    bookSpecsReachable?: boolean;
    bookSpecCount?: number | null;
    webhookConfigured?: boolean;
    webhookUrl?: string | null;
    notes?: string[];
    checkedAt?: string;
  };
  error?: string;
};

type BackendHealthCardProps = {
  title?: string;
  compact?: boolean;
};

function formatDateTime(value: string | null | undefined) {
  if (!value) {
    return "아직 없음";
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat("ko-KR", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

export function BackendHealthCard({
  title = "백엔드 상태",
  compact = false,
}: BackendHealthCardProps) {
  const [state, setState] = useState<BackendStatusPayload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [refreshToken, setRefreshToken] = useState(0);

  useEffect(() => {
    let isCancelled = false;

    async function loadStatus() {
      setIsRefreshing(true);
      setError(null);

      try {
        const response = await fetch("/api/sweetbook/status", {
          cache: "no-store",
        });
        const payload = (await response.json()) as BackendStatusPayload;

        if (!response.ok) {
          throw new Error(payload.error ?? "백엔드 상태를 불러오지 못했습니다.");
        }

        if (!isCancelled) {
          setState(payload);
        }
      } catch (requestError) {
        if (!isCancelled) {
          setError(
            requestError instanceof Error
              ? requestError.message
              : "백엔드 상태를 불러오는 중 오류가 발생했습니다.",
          );
        }
      } finally {
        if (!isCancelled) {
          setIsRefreshing(false);
        }
      }
    }

    void loadStatus();

    return () => {
      isCancelled = true;
    };
  }, [refreshToken]);

  const data = state?.data;

  return (
    <article className={`soft-card rounded-[28px] ${compact ? "p-4" : "p-5"}`}>
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="section-kicker">Backend / BFF</p>
          <p className="mt-3 text-sm font-semibold text-slate-900">{title}</p>
          <p className="mt-2 text-sm leading-6 text-slate-600">
            Next.js 내부 API route가 Sweetbook 키를 감싸고 업로드, 책 조립, 주문,
            웹훅 운영 요청을 대신 처리합니다.
          </p>
        </div>
        <button
          type="button"
          className="rounded-full border border-[var(--line)] bg-white px-4 py-2 text-xs font-semibold text-slate-700 transition hover:border-slate-400"
          onClick={() => setRefreshToken((current) => current + 1)}
          disabled={isRefreshing}
        >
          {isRefreshing ? "확인 중..." : "상태 새로고침"}
        </button>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <div className="rounded-[22px] border border-[var(--line)] bg-white/82 px-4 py-4">
          <p className="text-xs uppercase tracking-[0.2em] text-slate-500">환경</p>
          <p className="mt-2 text-lg font-semibold text-slate-900">
            {data?.environment === "live" ? "Live" : "Sandbox"}
          </p>
        </div>
        <div className="rounded-[22px] border border-[var(--line)] bg-white/82 px-4 py-4">
          <p className="text-xs uppercase tracking-[0.2em] text-slate-500">API Key</p>
          <p className="mt-2 text-lg font-semibold text-slate-900">
            {data?.apiKeyConfigured ? "설정됨" : "없음"}
          </p>
        </div>
        <div className="rounded-[22px] border border-[var(--line)] bg-white/82 px-4 py-4">
          <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Book Specs</p>
          <p className="mt-2 text-lg font-semibold text-slate-900">
            {data?.bookSpecsReachable ? `연결됨${typeof data.bookSpecCount === "number" ? ` (${data.bookSpecCount})` : ""}` : "미확인"}
          </p>
        </div>
        <div className="rounded-[22px] border border-[var(--line)] bg-white/82 px-4 py-4">
          <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Webhook Config</p>
          <p className="mt-2 text-lg font-semibold text-slate-900">
            {data?.webhookConfigured ? "설정됨" : "미설정"}
          </p>
        </div>
      </div>

      {data?.webhookUrl ? (
        <div className="mt-4 rounded-[22px] border border-[var(--line)] bg-[linear-gradient(145deg,_rgba(255,255,255,0.94),_rgba(247,240,231,0.84))] px-4 py-4 text-sm leading-6 text-slate-700">
          <p>
            <span className="font-semibold text-slate-900">Webhook URL:</span> {data.webhookUrl}
          </p>
          <p>
            <span className="font-semibold text-slate-900">마지막 점검:</span>{" "}
            {formatDateTime(data.checkedAt)}
          </p>
        </div>
      ) : data?.checkedAt ? (
        <p className="mt-4 text-sm leading-6 text-slate-600">
          마지막 점검: {formatDateTime(data.checkedAt)}
        </p>
      ) : null}

      {data?.notes?.length ? (
        <div className="mt-4 space-y-2">
          {data.notes.map((note) => (
            <div
              key={note}
              className="rounded-[18px] border border-amber-200 bg-amber-50 px-4 py-3 text-sm leading-6 text-amber-800"
            >
              {note}
            </div>
          ))}
        </div>
      ) : null}

      {error ? (
        <div className="mt-4 rounded-[18px] border border-rose-200 bg-rose-50 px-4 py-3 text-sm leading-6 text-rose-700">
          {error}
        </div>
      ) : null}
    </article>
  );
}
