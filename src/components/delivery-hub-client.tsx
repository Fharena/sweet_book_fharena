"use client";

import Link from "next/link";
import { useMemo, useTransition } from "react";

import { BackendHealthCard } from "@/components/backend-health-card";
import { createDemoTripDraft, demoTripQuickFacts } from "@/lib/demo-trip-draft";
import {
  clearCheckoutComposeResult,
  clearCheckoutOrderDraft,
  clearCheckoutOrderResult,
} from "@/lib/checkout-order";
import { resolveTravelTheme } from "@/lib/travel-themes";
import { clearTripDraft, saveTripDraft } from "@/lib/trip-draft";
import { useCheckoutSession } from "@/lib/use-checkout-session";
import { useTripDraft } from "@/lib/use-trip-draft";

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

function formatCurrency(value: number | null | undefined) {
  if (typeof value !== "number") {
    return "확인 전";
  }

  return `${value.toLocaleString("ko-KR")}원`;
}

export function DeliveryHubClient() {
  const { draft } = useTripDraft();
  const { composeResult, orderResult, orderDraft } = useCheckoutSession();
  const [isPending, startTransition] = useTransition();
  const selectedTheme = resolveTravelTheme(draft?.selectedThemeId);
  const quickLinks = useMemo(
    () => [
      {
        href: "/",
        title: "홈",
        copy: "서비스 방향과 백엔드 상태를 첫 화면에서 확인합니다.",
      },
      {
        href: "/trips/new",
        title: "업로드",
        copy: "실사진 업로드와 샘플 초안 진입을 같이 점검합니다.",
      },
      {
        href: "/trips/review",
        title: "검토",
        copy: "자동 그룹핑과 수동 태깅 보정 상태를 확인합니다.",
      },
      {
        href: "/book/preview",
        title: "미리보기",
        copy: "상품 규격, 페이지 수, 테마 반영 상태를 봅니다.",
      },
      {
        href: "/checkout",
        title: "주문",
        copy: "서버 조립 계획, 책 생성, 주문 결과를 확인합니다.",
      },
      {
        href: "/ops/webhooks",
        title: "웹훅 운영",
        copy: "등록/테스트 전송/수신 로그를 운영 기준으로 봅니다.",
      },
    ],
    [],
  );

  const readinessItems = [
    {
      label: "여행 draft",
      ready: Boolean(draft),
      note: draft
        ? `${draft.tripName} / 사진 ${draft.stats.totalPhotos}장 / 챕터 ${draft.chapters.length}개`
        : "아직 여행 세션이 없습니다.",
    },
    {
      label: "수동 태깅",
      ready: (draft?.stats.manualTaggingRequired ?? 0) === 0,
      note: draft
        ? `보정 대기 ${draft.stats.manualTaggingRequired}장`
        : "업로드 후 확인",
    },
    {
      label: "테스트 책",
      ready: Boolean(composeResult?.bookUid),
      note: composeResult?.bookUid
        ? `bookUid ${composeResult.bookUid}`
        : "아직 생성되지 않았습니다.",
    },
    {
      label: "주문 결과",
      ready: Boolean(orderResult?.orderUid),
      note: orderResult?.orderUid
        ? `orderUid ${orderResult.orderUid}`
        : "아직 주문 요청 전입니다.",
    },
  ];
  const nextActions = [
    !draft
      ? {
          title: "여행 세션 준비",
          copy: "샘플 세션을 다시 불러오거나 실사진 업로드부터 시작해 현재 기준 draft를 만듭니다.",
          href: "/trips/new",
        }
      : null,
    draft && (draft.stats.manualTaggingRequired ?? 0) > 0
      ? {
          title: "위치 보정 마무리",
          copy: "검토 화면에서 위치가 비는 사진을 태깅해 포토북 흐름을 더 안정적으로 만듭니다.",
          href: "/trips/review",
        }
      : null,
    !composeResult?.bookUid
      ? {
          title: "테스트 책 생성",
          copy: "checkout에서 Sweetbook 테스트 책을 만들어 실제 bookUid를 확보합니다.",
          href: "/checkout",
        }
      : null,
    composeResult?.bookUid && !orderResult?.orderUid
      ? {
          title: "주문 결과 확보",
          copy: "배송지 입력 후 주문 요청을 보내고 orderUid를 운영 추적 기준으로 확보합니다.",
          href: "/checkout",
        }
      : null,
  ].filter(
    (
      item,
    ): item is {
      title: string;
      copy: string;
      href: string;
    } => Boolean(item),
  );
  const docLinks = [
    {
      href: "/ops/docs#demo-script",
      title: "5분 데모 스크립트",
      copy: "발표 순서와 멘트를 빠르게 다시 맞춥니다.",
    },
    {
      href: "/ops/docs#submission-checklist",
      title: "제출 체크리스트",
      copy: "누락 항목과 환경 변수, 점검 포인트를 다시 확인합니다.",
    },
    {
      href: "/ops/docs#operations-runbook",
      title: "운영/주문 런북",
      copy: "실제 주문과 웹훅 검증 순서를 따라갑니다.",
    },
    {
      href: "/ops/docs#git-rules",
      title: "Git 운영 규칙",
      copy: "작업 브랜치와 기준 PR, merge 기준을 다시 확인합니다.",
    },
  ];

  function handleLoadDemoFlow() {
    startTransition(() => {
      saveTripDraft(createDemoTripDraft());
      clearCheckoutComposeResult();
      clearCheckoutOrderDraft();
      clearCheckoutOrderResult();
    });
  }

  function handleResetSession() {
    startTransition(() => {
      clearTripDraft();
      clearCheckoutComposeResult();
      clearCheckoutOrderDraft();
      clearCheckoutOrderResult();
    });
  }

  return (
    <div className="space-y-6">
      <section className="editorial-panel rounded-[32px] p-6 sm:p-8">
        <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
          <div className="max-w-2xl space-y-4">
            <p className="section-kicker">제출/데모 허브</p>
            <h2 className="display-title max-w-2xl text-slate-900">
              지금 세션이 어디까지 왔는지 한 화면에서 확인합니다.
            </h2>
            <p className="text-sm leading-7 text-slate-600 sm:text-base">
              샘플 초안, 실사진 draft, 테스트 책, 주문 결과, 웹훅 운영 링크를 한곳에
              모았습니다. 디버깅 전 기준점으로도 쓰고, 제출 직전 체크에도 바로 활용할 수
              있습니다.
            </p>
          </div>

          <div className="grid w-full gap-3 sm:grid-cols-2 xl:max-w-md xl:grid-cols-1">
            <button
              type="button"
              className="button-primary rounded-full px-5 py-3 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-70"
              onClick={handleLoadDemoFlow}
              disabled={isPending}
            >
              {isPending ? "샘플 세션 준비 중..." : "샘플 세션 다시 불러오기"}
            </button>
            <button
              type="button"
              className="button-secondary rounded-full px-5 py-3 text-sm font-semibold text-slate-800"
              onClick={handleResetSession}
            >
              현재 세션 초기화
            </button>
          </div>
        </div>

        <div className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {readinessItems.map((item) => (
            <div
              key={item.label}
              className={`rounded-[24px] border px-4 py-4 ${
                item.ready
                  ? "border-[rgba(15,118,110,0.18)] bg-[rgba(15,118,110,0.08)]"
                  : "border-[var(--line)] bg-white/82"
              }`}
            >
              <p className="text-xs uppercase tracking-[0.2em] text-slate-500">{item.label}</p>
              <p className="mt-2 text-lg font-semibold text-slate-900">
                {item.ready ? "준비됨" : "대기 중"}
              </p>
              <p className="mt-2 text-sm leading-6 text-slate-600">{item.note}</p>
            </div>
          ))}
        </div>
      </section>

      <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
        <section className="soft-card rounded-[32px] p-6">
          <div className="flex flex-col gap-3 border-b border-[var(--line)] pb-4">
            <p className="section-kicker">현재 세션 요약</p>
            <p className="text-sm leading-6 text-slate-600">
              실제 브라우저 세션에 저장된 여행 draft와 checkout 상태를 그대로 읽습니다.
            </p>
          </div>

          <div className="mt-5 grid gap-4 md:grid-cols-2">
            <div className="rounded-[24px] border border-[var(--line)] bg-white/82 px-5 py-4">
              <p className="text-sm font-semibold text-slate-900">여행 draft</p>
              {draft ? (
                <div className="mt-3 space-y-2 text-sm leading-6 text-slate-700">
                  <p>
                    <span className="font-semibold text-slate-900">여행명:</span> {draft.tripName}
                  </p>
                  <p>
                    <span className="font-semibold text-slate-900">여행 기간:</span>{" "}
                    {draft.travelStart ?? "-"} ~ {draft.travelEnd ?? "-"}
                  </p>
                  <p>
                    <span className="font-semibold text-slate-900">테마:</span>{" "}
                    {selectedTheme.name}
                  </p>
                  <p>
                    <span className="font-semibold text-slate-900">사진/챕터:</span>{" "}
                    {draft.stats.totalPhotos}장 / {draft.chapters.length}개
                  </p>
                  <p>
                    <span className="font-semibold text-slate-900">위치 보정 대기:</span>{" "}
                    {draft.stats.manualTaggingRequired}장
                  </p>
                </div>
              ) : (
                <p className="mt-3 text-sm leading-6 text-slate-600">
                  아직 저장된 여행 draft가 없습니다. 샘플 세션을 불러오거나 실사진 업로드를
                  먼저 진행하세요.
                </p>
              )}
            </div>

            <div className="rounded-[24px] border border-[var(--line)] bg-white/82 px-5 py-4">
              <p className="text-sm font-semibold text-slate-900">주문 세션</p>
              <div className="mt-3 space-y-2 text-sm leading-6 text-slate-700">
                <p>
                  <span className="font-semibold text-slate-900">bookUid:</span>{" "}
                  {composeResult?.bookUid ?? orderDraft?.bookUid ?? "아직 없음"}
                </p>
                <p>
                  <span className="font-semibold text-slate-900">조립 테마:</span>{" "}
                  {composeResult?.themeLabel ?? selectedTheme.name}
                </p>
                <p>
                  <span className="font-semibold text-slate-900">주문 UID:</span>{" "}
                  {orderResult?.orderUid ?? "아직 없음"}
                </p>
                <p>
                  <span className="font-semibold text-slate-900">주문 상태:</span>{" "}
                  {orderResult?.orderStatusDisplay ?? "주문 전"}
                </p>
                <p>
                  <span className="font-semibold text-slate-900">주문 금액:</span>{" "}
                  {formatCurrency(orderResult?.totalAmount)}
                </p>
              </div>
            </div>
          </div>

          <div className="mt-4 rounded-[24px] border border-[var(--line)] bg-[linear-gradient(145deg,_rgba(255,255,255,0.94),_rgba(247,240,231,0.84))] px-5 py-4 text-sm leading-6 text-slate-700">
            <p>
              <span className="font-semibold text-slate-900">샘플 시드:</span>{" "}
              {demoTripQuickFacts.tripName} / {demoTripQuickFacts.travelWindowLabel}
            </p>
            <p>
              <span className="font-semibold text-slate-900">마지막 책 생성:</span>{" "}
              {formatDateTime(composeResult?.savedAt)}
            </p>
            <p>
              <span className="font-semibold text-slate-900">마지막 주문:</span>{" "}
              {formatDateTime(orderResult?.savedAt)}
            </p>
          </div>
        </section>

        <section className="space-y-6">
          <BackendHealthCard title="허브 기준 백엔드 상태" />

          <article className="ink-panel rounded-[32px] p-6 text-white">
            <p className="text-sm font-semibold text-white">실행 순서</p>
            <div className="mt-4 space-y-3">
              {[
                "1. 샘플 세션을 불러와 현재 상태를 만든다",
                "2. 검토 화면에서 수동 태깅과 챕터 흐름을 점검한다",
                "3. 미리보기에서 규격/페이지/테마 반영을 확인한다",
                "4. checkout에서 테스트 책 생성과 주문 결과를 확인한다",
                "5. 웹훅 운영 화면에서 수신 로그와 테스트 전송을 본다",
              ].map((item) => (
                <div key={item} className="travel-badge rounded-[20px] px-4 py-3 text-sm text-white/84">
                  {item}
                </div>
              ))}
            </div>
          </article>
        </section>
      </div>

      <section className="soft-card rounded-[32px] p-6">
        <div className="flex flex-col gap-3 border-b border-[var(--line)] pb-4">
          <p className="section-kicker">빠른 이동</p>
          <p className="text-sm leading-6 text-slate-600">
            디버깅이나 데모 때 자주 쓰는 화면을 한 번에 묶었습니다.
          </p>
        </div>

        <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {quickLinks.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="soft-card rounded-[28px] p-5 transition hover:-translate-y-0.5"
            >
              <p className="text-lg font-semibold text-slate-900">{item.title}</p>
              <p className="mt-3 text-sm leading-6 text-slate-600">{item.copy}</p>
              <p className="mt-4 text-xs font-semibold uppercase tracking-[0.18em] text-[var(--accent)]">
                {item.href}
              </p>
            </Link>
          ))}
        </div>
      </section>

      <section className="grid gap-6 xl:grid-cols-[1.05fr_0.95fr]">
        <article className="soft-card rounded-[32px] p-6">
          <div className="flex flex-col gap-3 border-b border-[var(--line)] pb-4">
            <p className="section-kicker">지금 바로 할 일</p>
            <p className="text-sm leading-6 text-slate-600">
              현재 세션 상태를 기준으로 다음 작업을 자동으로 좁혀 보여줍니다.
            </p>
          </div>

          <div className="mt-5 space-y-3">
            {nextActions.length ? (
              nextActions.map((action) => (
                <Link
                  key={`${action.href}-${action.title}`}
                  href={action.href}
                  className="soft-card block rounded-[28px] p-5 transition hover:-translate-y-0.5"
                >
                  <p className="text-lg font-semibold text-slate-900">{action.title}</p>
                  <p className="mt-3 text-sm leading-6 text-slate-600">{action.copy}</p>
                  <p className="mt-4 text-xs font-semibold uppercase tracking-[0.18em] text-[var(--accent)]">
                    {action.href}
                  </p>
                </Link>
              ))
            ) : (
              <div className="rounded-[28px] border border-[rgba(15,118,110,0.18)] bg-[rgba(15,118,110,0.08)] px-5 py-5 text-sm leading-6 text-slate-700">
                주요 흐름이 모두 한 번씩 준비된 상태입니다. 이제 브라우저 실검증과 제출
                직전 문서 점검만 진행하면 됩니다.
              </div>
            )}
          </div>
        </article>

        <article className="soft-card rounded-[32px] p-6">
          <div className="flex flex-col gap-3 border-b border-[var(--line)] pb-4">
            <p className="section-kicker">제출 문서</p>
            <p className="text-sm leading-6 text-slate-600">
              발표와 제출 직전에 다시 열어볼 문서를 한곳에 묶었습니다.
            </p>
          </div>

          <div className="mt-5 space-y-3">
            {docLinks.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="soft-card block rounded-[28px] p-5 transition hover:-translate-y-0.5"
              >
                <p className="text-lg font-semibold text-slate-900">{item.title}</p>
                <p className="mt-3 text-sm leading-6 text-slate-600">{item.copy}</p>
                <p className="mt-4 text-xs font-semibold uppercase tracking-[0.18em] text-[var(--accent)]">
                  {item.href}
                </p>
              </Link>
            ))}
          </div>
        </article>
      </section>
    </div>
  );
}
