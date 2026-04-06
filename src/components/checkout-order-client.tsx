"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { AppShell } from "@/components/app-shell";
import { DemoTripLauncher } from "@/components/demo-trip-launcher";
import { isDemoTripDraft } from "@/lib/demo-trip-draft";
import { orderSummary } from "@/lib/mock-trip";
import { useTripDraft } from "@/lib/use-trip-draft";
import type {
  CheckoutComposeResult,
  CheckoutOrderDraft,
  CheckoutOrderResult,
  CheckoutOrderRequest,
} from "@/lib/checkout-order";
import {
  clearCheckoutOrderResult,
  clearCheckoutComposeResult,
  loadCheckoutComposeResult,
  loadCheckoutOrderDraft,
  loadCheckoutOrderResult,
  saveCheckoutComposeResult,
  saveCheckoutOrderDraft,
  saveCheckoutOrderResult,
} from "@/lib/checkout-order";
import { resolveTravelTheme } from "@/lib/travel-themes";

function derivePrice(pageCount: number) {
  return Math.round(16800 + pageCount * 330);
}

function formatCurrency(value: number | null) {
  if (value === null) {
    return "확인 중";
  }

  return `${value.toLocaleString("ko-KR")}원`;
}

const defaultOrderDraft: CheckoutOrderDraft = {
  ordererName: "",
  bookUid: "",
  quantity: 1,
  recipientName: "",
  recipientPhone: "",
  postalCode: "",
  address1: "",
  address2: "",
  memo: "",
};

type TrackingReceiptPayload = {
  data?: {
    items?: Array<{
      receiptUid?: string;
      receiptGroupUid?: string;
      eventType?: string | null;
      deliveryUid?: string | null;
      latestReceivedAt?: string | null;
      verificationStatus?: string | null;
      verificationSummary?: string | null;
      orderUid?: string | null;
      bookUid?: string | null;
      payloadPreview?: string | null;
      receiptCount?: number | null;
      duplicateCount?: number | null;
      hasDuplicateReceipts?: boolean | null;
    }>;
    summary?: {
      totalReceipts?: number;
      uniqueDeliveryCount?: number;
      duplicateGroupCount?: number;
      invalidReceiptCount?: number;
      missingSecretCount?: number;
    };
  };
  error?: string;
};

const trackedEventMeta: Record<
  string,
  {
    label: string;
    note: string;
  }
> = {
  "order.created": {
    label: "주문 생성",
    note: "Sweetbook가 주문 생성 이벤트를 수신 시스템으로 보냈습니다.",
  },
  "production.confirmed": {
    label: "제작 확정",
    note: "책 제작이 확정되어 실제 생산 단계로 들어가기 시작합니다.",
  },
  "production.started": {
    label: "제작 시작",
    note: "제작이 실제로 시작된 상태입니다.",
  },
  "production.completed": {
    label: "제작 완료",
    note: "인쇄/제작이 끝나 배송 단계로 넘어갈 준비가 된 상태입니다.",
  },
  "shipping.departed": {
    label: "배송 출발",
    note: "출고가 완료되어 배송 중인 상태입니다.",
  },
  "shipping.delivered": {
    label: "배송 완료",
    note: "수령 완료까지 이어진 상태입니다.",
  },
  "order.cancelled": {
    label: "주문 취소",
    note: "주문이 취소된 상태이므로 운영 확인이 필요합니다.",
  },
  "order.restored": {
    label: "주문 복구",
    note: "취소되었던 주문이 다시 활성화된 상태입니다.",
  },
  "webhook.exhausted": {
    label: "웹훅 재시도 종료",
    note: "웹훅 전송 재시도가 모두 끝난 상태입니다.",
  },
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

function resolveTrackingEventMeta(eventType: string | null | undefined) {
  if (!eventType) {
    return {
      label: "이벤트 미확인",
      note: "아직 이 주문과 연결된 웹훅 이벤트를 받지 않았습니다.",
    };
  }

  return (
    trackedEventMeta[eventType] ?? {
      label: eventType,
      note: "수신 로그에 기록된 이벤트입니다.",
    }
  );
}

function resolveVerificationMeta(status: string | null | undefined) {
  switch (status) {
    case "verified":
      return {
        label: "검증 완료",
        className: "bg-[rgba(15,118,110,0.12)] text-[var(--accent)]",
      };
    case "invalid-signature":
      return {
        label: "검증 실패",
        className: "bg-rose-100 text-rose-700",
      };
    case "missing-secret":
      return {
        label: "시크릿 미설정",
        className: "bg-[rgba(249,115,82,0.16)] text-[var(--accent-secondary)]",
      };
    default:
      return {
        label: status ?? "상태 미확인",
        className: "bg-slate-100 text-slate-700",
      };
  }
}

function validateDraft(draft: CheckoutOrderDraft) {
  const errors: Partial<Record<keyof CheckoutOrderDraft, string>> = {};

  if (!draft.ordererName.trim()) {
    errors.ordererName = "주문자 이름을 입력해 주세요.";
  }

  if (!draft.bookUid.trim()) {
    errors.bookUid = "최종화된 bookUid가 필요합니다.";
  }

  if (!Number.isInteger(draft.quantity) || draft.quantity < 1 || draft.quantity > 100) {
    errors.quantity = "수량은 1에서 100 사이의 정수여야 합니다.";
  }

  if (!draft.recipientName.trim()) {
    errors.recipientName = "받는 분 이름을 입력해 주세요.";
  }

  if (!draft.recipientPhone.trim()) {
    errors.recipientPhone = "연락처를 입력해 주세요.";
  }

  if (!draft.postalCode.trim()) {
    errors.postalCode = "우편번호를 입력해 주세요.";
  }

  if (!draft.address1.trim()) {
    errors.address1 = "기본 주소를 입력해 주세요.";
  }

  return errors;
}

const checkoutFields: Array<{
  key: keyof CheckoutOrderDraft;
  label: string;
  placeholder: string;
  type: "text" | "number";
  span: string;
}> = [
  {
    key: "ordererName",
    label: "주문자 이름",
    placeholder: "홍길동",
    type: "text",
    span: "sm:col-span-1",
  },
  {
    key: "bookUid",
    label: "최종화된 bookUid",
    placeholder: "bk_abc123",
    type: "text",
    span: "sm:col-span-1",
  },
  {
    key: "quantity",
    label: "수량",
    placeholder: "1",
    type: "number",
    span: "sm:col-span-1",
  },
  {
    key: "recipientName",
    label: "받는 분 이름",
    placeholder: "홍길동",
    type: "text",
    span: "sm:col-span-1",
  },
  {
    key: "recipientPhone",
    label: "연락처",
    placeholder: "010-1234-5678",
    type: "text",
    span: "sm:col-span-1",
  },
  {
    key: "postalCode",
    label: "우편번호",
    placeholder: "06101",
    type: "text",
    span: "sm:col-span-1",
  },
  {
    key: "address1",
    label: "주소 1",
    placeholder: "서울시 강남구 테헤란로 123",
    type: "text",
    span: "sm:col-span-2",
  },
  {
    key: "address2",
    label: "주소 2",
    placeholder: "4층 401호",
    type: "text",
    span: "sm:col-span-2",
  },
  {
    key: "memo",
    label: "배송 메모",
    placeholder: "부재시 경비실",
    type: "text",
    span: "sm:col-span-2",
  },
];

function buildOrderRequest(draft: CheckoutOrderDraft): CheckoutOrderRequest {
  const bookUid = draft.bookUid.trim();

  return {
    items: [
      {
        bookUid,
        quantity: draft.quantity,
      },
    ],
    shipping: {
      recipientName: draft.recipientName.trim(),
      recipientPhone: draft.recipientPhone.trim(),
      postalCode: draft.postalCode.trim(),
      address1: draft.address1.trim(),
      ...(draft.address2.trim() ? { address2: draft.address2.trim() } : {}),
      ...(draft.memo.trim() ? { memo: draft.memo.trim() } : {}),
    },
    externalUserId: draft.ordererName.trim() || undefined,
    externalRef: `TRIPLOGUE-${bookUid}-${Date.now()}`,
  };
}

export function CheckoutOrderClient() {
  const { draft, hydrated } = useTripDraft();
  const isDemoDraft = isDemoTripDraft(draft);
  const photoCount = draft?.stats.totalPhotos ?? 0;
  const chapterCount = draft?.chapters.length ?? orderSummary.chapters;
  const selectedTheme = resolveTravelTheme(draft?.selectedThemeId);
  const pageCount = draft
    ? Math.max(24, chapterCount * 6 + Math.ceil(photoCount / 4) * 2)
    : orderSummary.pages;
  const estimatedPrice = draft
    ? formatCurrency(derivePrice(pageCount))
    : orderSummary.estimatedPrice;

  const [composeResult, setComposeResult] = useState<CheckoutComposeResult | null>(
    () => loadCheckoutComposeResult(),
  );
  const [form, setForm] = useState<CheckoutOrderDraft>(() => {
    const savedDraft = loadCheckoutOrderDraft();
    return savedDraft
      ? {
          ...defaultOrderDraft,
          ...savedDraft,
        }
      : {
          ...defaultOrderDraft,
          bookUid: composeResult?.bookUid ?? "",
        };
  });
  const [fieldErrors, setFieldErrors] = useState<
    Partial<Record<keyof CheckoutOrderDraft, string>>
  >({});
  const [composeError, setComposeError] = useState<string | null>(null);
  const [orderError, setOrderError] = useState<string | null>(null);
  const [isComposing, setIsComposing] = useState(false);
  const [isOrdering, setIsOrdering] = useState(false);
  const [orderResult, setOrderResult] = useState<CheckoutOrderResult | null>(() =>
    loadCheckoutOrderResult(),
  );
  const [trackingState, setTrackingState] = useState<TrackingReceiptPayload | null>(null);
  const [trackingError, setTrackingError] = useState<string | null>(null);
  const [isRefreshingTracking, setIsRefreshingTracking] = useState(false);
  const [lastTrackingAt, setLastTrackingAt] = useState<string | null>(null);
  const [trackingRefreshToken, setTrackingRefreshToken] = useState(0);

  const trackingSourceKey = orderResult?.orderUid?.trim()
    ? ("orderUid" as const)
    : orderResult?.bookUid?.trim()
      ? ("bookUid" as const)
      : form.bookUid.trim()
        ? ("bookUid" as const)
        : null;
  const trackingSourceValue =
    trackingSourceKey === "orderUid"
      ? orderResult?.orderUid?.trim() ?? ""
      : trackingSourceKey === "bookUid"
        ? orderResult?.bookUid?.trim() || form.bookUid.trim()
        : "";
  const trackingSource =
    trackingSourceKey && trackingSourceValue
      ? { key: trackingSourceKey, value: trackingSourceValue }
      : null;
  const trackingItems = trackingState?.data?.items ?? [];
  const trackingSummary = trackingState?.data?.summary;
  const latestTrackingItem = trackingItems[0];
  const latestTrackingMeta = resolveTrackingEventMeta(latestTrackingItem?.eventType);
  const opsSearchParams = new URLSearchParams();

  if (orderResult?.orderUid?.trim()) {
    opsSearchParams.set("orderUid", orderResult.orderUid.trim());
  }

  if (orderResult?.bookUid?.trim() || form.bookUid.trim()) {
    opsSearchParams.set(
      "bookUid",
      orderResult?.bookUid?.trim() || form.bookUid.trim(),
    );
  }

  const opsHref = opsSearchParams.size
    ? `/ops/webhooks?${opsSearchParams.toString()}`
    : "/ops/webhooks";

  useEffect(() => {
    saveCheckoutOrderDraft(form);
  }, [form]);

  useEffect(() => {
    if (composeResult) {
      saveCheckoutComposeResult(composeResult);
      return;
    }

    clearCheckoutComposeResult();
  }, [composeResult]);

  useEffect(() => {
    if (orderResult) {
      saveCheckoutOrderResult(orderResult);
      return;
    }

    clearCheckoutOrderResult();
  }, [orderResult]);

  useEffect(() => {
    if (composeResult?.bookUid && !form.bookUid.trim()) {
      setForm((current) => ({
        ...current,
        bookUid: composeResult.bookUid,
      }));
    }
  }, [composeResult?.bookUid, form.bookUid]);

  useEffect(() => {
    if (!trackingSourceKey || !trackingSourceValue) {
      setTrackingState(null);
      setTrackingError(null);
      setLastTrackingAt(null);
      return;
    }

    const currentTrackingSource = {
      key: trackingSourceKey,
      value: trackingSourceValue,
    };
    let isCancelled = false;

    async function refreshTracking() {
      setIsRefreshingTracking(true);
      setTrackingError(null);

      try {
        const params = new URLSearchParams({
          limit: "12",
        });
        params.set(currentTrackingSource.key, currentTrackingSource.value);

        const response = await fetch(
          `/api/webhooks/sweetbook/receipts?${params.toString()}`,
          { cache: "no-store" },
        );
        const payload = (await response.json()) as TrackingReceiptPayload;

        if (!response.ok) {
          throw new Error(payload.error ?? "주문 추적 이력을 불러오지 못했습니다.");
        }

        if (!isCancelled) {
          setTrackingState(payload);
          setLastTrackingAt(new Date().toISOString());
        }
      } catch (error) {
        if (!isCancelled) {
          setTrackingError(
            error instanceof Error
              ? error.message
              : "주문 추적 이력을 불러오는 중 오류가 발생했습니다.",
          );
        }
      } finally {
        if (!isCancelled) {
          setIsRefreshingTracking(false);
        }
      }
    }

    void refreshTracking();
    const timer = window.setInterval(() => {
      void refreshTracking();
    }, 15000);

    return () => {
      isCancelled = true;
      window.clearInterval(timer);
    };
  }, [trackingRefreshToken, trackingSourceKey, trackingSourceValue]);

  async function handleComposeBook() {
    if (!draft) {
      setComposeError("먼저 여행 사진을 업로드해 주세요.");
      return;
    }

    setComposeError(null);
    setIsComposing(true);

    try {
      const response = await fetch("/api/sweetbook/books/compose", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(draft),
      });

      const payload = (await response.json()) as {
        error?: string;
        bookUid?: string;
        plan?: {
          themeLabel?: string;
          operations?: Array<unknown>;
        };
        steps?: {
          finalizedBook?: unknown;
          contentResults?: Array<unknown>;
        };
      };

      if (!response.ok || !payload.bookUid) {
        throw new Error(payload.error ?? "Sweetbook 책 생성에 실패했습니다.");
      }

      const nextResult = {
        bookUid: payload.bookUid,
        finalizedBook: payload.steps?.finalizedBook,
        themeLabel: payload.plan?.themeLabel,
        operationCount: payload.plan?.operations?.length,
        contentCount: payload.steps?.contentResults?.length,
        savedAt: new Date().toISOString(),
      };

      setComposeResult(nextResult);
      setOrderResult(null);
      setForm((current) => ({
        ...current,
        bookUid: payload.bookUid ?? current.bookUid,
      }));
    } catch (error) {
      setComposeError(
        error instanceof Error
          ? error.message
          : "Sweetbook 책 생성 중 알 수 없는 오류가 발생했습니다.",
      );
    } finally {
      setIsComposing(false);
    }
  }

  async function handleOrderSubmit() {
    const validationErrors = validateDraft(form);
    setFieldErrors(validationErrors);

    if (Object.keys(validationErrors).length > 0) {
      setOrderError("입력값을 먼저 확인해 주세요.");
      return;
    }

    setIsOrdering(true);
    setOrderError(null);

    try {
      const response = await fetch("/api/sweetbook/orders", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(buildOrderRequest(form)),
      });

      const payload = (await response.json()) as {
        error?: string;
        message?: string;
        data?: {
          orderUid?: string;
          totalAmount?: number;
          orderStatusDisplay?: string;
          paidCreditAmount?: number;
        };
        orderUid?: string;
        totalAmount?: number;
        orderStatusDisplay?: string;
        paidCreditAmount?: number;
      };

      if (!response.ok) {
        throw new Error(payload.error ?? payload.message ?? "주문 생성에 실패했습니다.");
      }

      const responseData = payload.data ?? payload;
      setOrderResult({
        orderUid: typeof responseData.orderUid === "string" ? responseData.orderUid : null,
        bookUid: form.bookUid.trim(),
        totalAmount:
          typeof responseData.totalAmount === "number" ? responseData.totalAmount : null,
        orderStatusDisplay:
          typeof responseData.orderStatusDisplay === "string"
            ? responseData.orderStatusDisplay
            : null,
        paidCreditAmount:
          typeof responseData.paidCreditAmount === "number"
            ? responseData.paidCreditAmount
            : null,
        themeLabel: composeResult?.themeLabel ?? selectedTheme.name,
        savedAt: new Date().toISOString(),
      });
    } catch (error) {
      setOrderError(
        error instanceof Error
          ? error.message
          : "주문 요청 중 알 수 없는 오류가 발생했습니다.",
      );
    } finally {
      setIsOrdering(false);
    }
  }

  function updateField<Key extends keyof CheckoutOrderDraft>(
    key: Key,
    value: CheckoutOrderDraft[Key],
  ) {
    setForm((current) => ({
      ...current,
      [key]: value,
    }));

    setFieldErrors((current) => ({
      ...current,
      [key]: undefined,
    }));
  }

  return (
    <AppShell
      eyebrow="Sweetbook 주문"
      title={
        draft
          ? `주문 정보를 정리하고 ${draft.tripName} 포토북을 보내는 단계`
          : "주문 정보를 정리하고 포토북을 보내는 단계"
      }
      description={
        draft
          ? "체크아웃 화면에서 배송지와 주문자 정보를 입력하면, 마지막으로 생성한 bookUid를 사용해 Sweetbook 주문을 요청합니다."
          : "여행 사진이 아직 없더라도, 기존에 만들어 둔 최종화 책이 있으면 bookUid를 직접 넣어서 주문 흐름을 테스트할 수 있습니다."
      }
      aside={
        <div className="space-y-4">
          <div className="editorial-panel rounded-[28px] p-5">
            <p className="section-kicker">주문 순서</p>
            <ol className="mt-4 space-y-3 text-sm leading-6 text-slate-700">
              <li>1. 여행 사진을 책으로 조립하고 최종화합니다.</li>
              <li>2. 최종화된 bookUid를 주문 폼에 넣습니다.</li>
              <li>3. 배송지를 입력하고 주문을 요청합니다.</li>
            </ol>
          </div>

          <div className="soft-card rounded-[28px] p-5">
            <p className="text-sm font-semibold text-slate-900">API 동작</p>
            <p className="mt-3 text-sm leading-6 text-slate-600">
              주문은 `items + shipping + externalRef` 형태로 서버에서 Sweetbook API
              에 전달합니다. 비밀 키는 브라우저로 내려가지 않습니다.
            </p>
            <p className="mt-3 text-sm leading-6 text-slate-600">
              현재 선택된 패턴은 <span className="font-semibold text-slate-900">{selectedTheme.name}</span>
              이고, 이 정보는 책 생성 계획의 메타데이터에도 함께 반영됩니다.
            </p>
            <p className="mt-3 text-sm leading-6 text-slate-600">
              주문 이후 상태는 웹훅 수신 로그와 연결해 이 화면에서도 바로 추적합니다.
            </p>
          </div>

          <div className="ink-panel rounded-[28px] p-5 text-white">
            <p className="text-sm font-semibold text-white">현재 상태</p>
            <p className="mt-3 text-sm leading-6 text-white/76">
              {composeResult
                ? `bookUid ${composeResult.bookUid}가 준비되어 있습니다.`
                : "아직 bookUid가 없으면 먼저 테스트 책 생성을 눌러 주세요."}
            </p>
            {composeResult?.themeLabel ? (
              <p className="mt-3 text-sm leading-6 text-white/76">
                생성 계획 테마: {composeResult.themeLabel}
              </p>
            ) : null}
            {latestTrackingItem ? (
              <p className="mt-3 text-sm leading-6 text-white/76">
                최근 웹훅: {resolveTrackingEventMeta(latestTrackingItem.eventType).label}
              </p>
            ) : null}
          </div>
        </div>
      }
    >
      {!hydrated ? (
        <div className="soft-card rounded-[28px] p-5 text-sm text-slate-600">
          여행 초안을 불러오는 중입니다...
        </div>
      ) : null}

      {!draft && hydrated ? (
        <DemoTripLauncher
          layout="compact"
          className="bg-[linear-gradient(135deg,_rgba(255,255,255,0.94),_rgba(255,244,236,0.94))]"
        />
      ) : null}

      {draft && isDemoDraft ? (
        <article className="soft-card mb-4 rounded-[28px] p-5">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="section-kicker">샘플 여행 초안</p>
              <p className="mt-3 text-sm leading-6 text-slate-600">
                현재 주문 단계는 데모용 여행 초안을 기준으로 이어지고 있습니다. 테스트
                책 생성으로 bookUid를 만든 뒤 주문 요청과 웹훅 추적까지 한 흐름으로
                확인할 수 있습니다.
              </p>
            </div>
            <Link
              href={opsHref}
              className="button-secondary rounded-full px-5 py-3 text-sm font-semibold text-slate-800"
            >
              웹훅 운영으로 이동
            </Link>
          </div>
        </article>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-[0.9fr_1.1fr]">
        <article className="space-y-4">
          <div className="editorial-panel rounded-[32px] p-5">
            <p className="section-kicker">책 요약</p>
            <div className="mt-4 space-y-3 text-sm leading-6 text-slate-700">
              <p>
                <span className="font-semibold text-slate-900">상품:</span>{" "}
                {draft ? `${draft.tripName} 여행 포토북` : orderSummary.product}
              </p>
              <p>
                <span className="font-semibold text-slate-900">예상 페이지:</span> {pageCount}
              </p>
              <p>
                <span className="font-semibold text-slate-900">챕터 수:</span>{" "}
                {chapterCount}
              </p>
              <p>
                <span className="font-semibold text-slate-900">예상 금액:</span>{" "}
                {estimatedPrice}
              </p>
              <p>
                <span className="font-semibold text-slate-900">선택 패턴:</span>{" "}
                {selectedTheme.name}
              </p>
              <p>
                <span className="font-semibold text-slate-900">최종화된 bookUid:</span>{" "}
                {form.bookUid.trim() ? form.bookUid : "아직 없습니다"}
              </p>
            </div>

            <div className="mt-5 grid gap-3 sm:grid-cols-3">
              <div className="metric-tile px-4 py-4">
                <p className="text-xs uppercase tracking-[0.2em] text-slate-500">예상 페이지</p>
                <p className="mt-2 text-2xl font-semibold text-slate-900">{pageCount}</p>
              </div>
              <div className="metric-tile px-4 py-4">
                <p className="text-xs uppercase tracking-[0.2em] text-slate-500">예상 금액</p>
                <p className="mt-2 text-2xl font-semibold text-slate-900">{estimatedPrice}</p>
              </div>
              <div className="metric-tile px-4 py-4">
                <p className="text-xs uppercase tracking-[0.2em] text-slate-500">패턴</p>
                <p className="mt-2 text-lg font-semibold text-slate-900">{selectedTheme.name}</p>
              </div>
            </div>

            <button
              type="button"
              className="button-primary mt-5 w-full rounded-[24px] px-5 py-4 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:bg-slate-400 disabled:shadow-none"
              onClick={handleComposeBook}
              disabled={isComposing || !draft}
            >
              {isComposing ? "Sweetbook 테스트 책 생성 중..." : "Sweetbook 테스트 책 생성"}
            </button>

            {composeResult ? (
              <div className="mt-4 rounded-[24px] border border-emerald-200 bg-emerald-50 px-5 py-4 text-sm leading-6 text-emerald-800">
                테스트 책 생성이 완료됐어요. bookUid는{" "}
                <span className="font-semibold">{composeResult.bookUid}</span> 입니다.
              </div>
            ) : null}

            {isComposing ? (
              <div className="mt-4 rounded-[24px] border border-[var(--line)] bg-white/78 px-5 py-4">
                <p className="text-sm font-semibold text-slate-900">
                  책 생성 파이프라인을 실행 중입니다.
                </p>
                <ol className="mt-3 space-y-2 text-sm leading-6 text-slate-600">
                  <li>1. 책 생성</li>
                  <li>2. 표지 적용</li>
                  <li>3. 챕터별 내지 삽입</li>
                  <li>4. 최종화</li>
                </ol>
              </div>
            ) : null}

            {composeError ? (
              <div className="mt-4 rounded-[24px] border border-rose-200 bg-rose-50 px-5 py-4 text-sm leading-6 text-rose-700">
                {composeError}
              </div>
            ) : null}
          </div>

          <div className="soft-card rounded-[28px] p-5">
            <p className="section-kicker">주문 결과</p>
            {composeResult ? (
              <div className="mt-4 rounded-[24px] border border-[var(--line)] bg-white/80 px-5 py-4 text-sm leading-6 text-slate-700">
                <p>
                  <span className="font-semibold text-slate-900">생성 테마:</span>{" "}
                  {composeResult.themeLabel ?? selectedTheme.name}
                </p>
                <p>
                  <span className="font-semibold text-slate-900">조립 단계 수:</span>{" "}
                  {composeResult.operationCount ?? "확인 중"}
                </p>
                <p>
                  <span className="font-semibold text-slate-900">내지 작업 수:</span>{" "}
                  {composeResult.contentCount ?? "확인 중"}
                </p>
              </div>
            ) : null}
            {orderResult ? (
              <div className="mt-4 space-y-4">
                <div className="rounded-[24px] border border-emerald-200 bg-emerald-50 px-5 py-4 text-sm leading-6 text-emerald-800">
                  주문 요청이 접수됐습니다. 이제 아래 추적 카드에서 Sweetbook 웹훅 기준으로
                  이후 상태를 계속 확인할 수 있습니다.
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="rounded-[24px] border border-[var(--line)] bg-white/80 px-5 py-4 text-sm leading-6 text-slate-700">
                    <p>
                      <span className="font-semibold text-slate-900">주문 UID:</span>{" "}
                      {orderResult.orderUid ?? "응답에 포함되지 않았습니다"}
                    </p>
                    <p>
                      <span className="font-semibold text-slate-900">상태:</span>{" "}
                      {orderResult.orderStatusDisplay ?? "확인 중"}
                    </p>
                    <p>
                      <span className="font-semibold text-slate-900">주문 시각:</span>{" "}
                      {formatDateTime(orderResult.savedAt)}
                    </p>
                  </div>
                  <div className="rounded-[24px] border border-[var(--line)] bg-white/80 px-5 py-4 text-sm leading-6 text-slate-700">
                    <p>
                      <span className="font-semibold text-slate-900">총액:</span>{" "}
                      {formatCurrency(orderResult.totalAmount)}
                    </p>
                    <p>
                      <span className="font-semibold text-slate-900">차감 금액:</span>{" "}
                      {formatCurrency(orderResult.paidCreditAmount)}
                    </p>
                    <p>
                      <span className="font-semibold text-slate-900">추적 기준:</span>{" "}
                      {trackingSource?.key === "orderUid"
                        ? "orderUid 기준"
                        : trackingSource?.key === "bookUid"
                          ? "bookUid 기준"
                          : "없음"}
                    </p>
                  </div>
                </div>
              </div>
            ) : (
              <p className="mt-4 text-sm leading-6 text-slate-600">
                아직 주문 요청이 없습니다. 배송지를 입력한 뒤 주문 요청 버튼을 눌러
                주세요.
              </p>
            )}

            <div className="mt-5 rounded-[24px] border border-[var(--line)] bg-[linear-gradient(145deg,_rgba(255,255,255,0.94),_rgba(247,240,231,0.84))] px-5 py-5">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <p className="text-sm font-semibold text-slate-900">주문 이후 상태 추적</p>
                  <p className="mt-2 text-sm leading-6 text-slate-600">
                    웹훅 수신 로그를 15초 주기로 새로 읽어 현재 주문의 이후 상태를 이
                    화면에서 바로 확인합니다.
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    className="rounded-full border border-[var(--line)] bg-white px-4 py-2 text-xs font-semibold text-slate-700 transition hover:border-slate-500"
                    onClick={() => setTrackingRefreshToken((current) => current + 1)}
                    disabled={isRefreshingTracking || !trackingSource}
                  >
                    {isRefreshingTracking ? "새로고침 중..." : "지금 새로고침"}
                  </button>
                  <Link
                    href={opsHref}
                    className="rounded-full border border-[var(--line)] bg-white px-4 py-2 text-xs font-semibold text-slate-700 transition hover:border-slate-500"
                  >
                    운영 화면 열기
                  </Link>
                </div>
              </div>

              <div className="mt-4 grid gap-3 sm:grid-cols-3">
                <div className="rounded-[22px] border border-[var(--line)] bg-white/78 px-4 py-4">
                  <p className="text-xs uppercase tracking-[0.2em] text-slate-500">최근 이벤트</p>
                  <p className="mt-2 text-lg font-semibold text-slate-900">
                    {latestTrackingMeta.label}
                  </p>
                  <p className="mt-2 text-xs leading-5 text-slate-500">
                    {latestTrackingMeta.note}
                  </p>
                </div>
                <div className="rounded-[22px] border border-[var(--line)] bg-white/78 px-4 py-4">
                  <p className="text-xs uppercase tracking-[0.2em] text-slate-500">수신 그룹</p>
                  <p className="mt-2 text-lg font-semibold text-slate-900">
                    {trackingSummary?.uniqueDeliveryCount ?? trackingItems.length}
                  </p>
                  <p className="mt-2 text-xs leading-5 text-slate-500">
                    중복 그룹 {trackingSummary?.duplicateGroupCount ?? 0}개
                  </p>
                </div>
                <div className="rounded-[22px] border border-[var(--line)] bg-white/78 px-4 py-4">
                  <p className="text-xs uppercase tracking-[0.2em] text-slate-500">마지막 동기화</p>
                  <p className="mt-2 text-lg font-semibold text-slate-900">
                    {formatDateTime(lastTrackingAt)}
                  </p>
                  <p className="mt-2 text-xs leading-5 text-slate-500">
                    검증 실패 {trackingSummary?.invalidReceiptCount ?? 0}건 / 시크릿 누락{" "}
                    {trackingSummary?.missingSecretCount ?? 0}건
                  </p>
                </div>
              </div>

              {trackingSource ? (
                trackingItems.length ? (
                  <div className="mt-4 space-y-3">
                    {trackingItems.map((item) => {
                      const verificationMeta = resolveVerificationMeta(
                        item.verificationStatus,
                      );
                      const eventMeta = resolveTrackingEventMeta(item.eventType);

                      return (
                        <article
                          key={
                            item.receiptGroupUid ??
                            item.receiptUid ??
                            `${item.eventType ?? "event"}-${item.latestReceivedAt ?? "pending"}`
                          }
                          className="rounded-[22px] border border-[var(--line)] bg-white/86 px-4 py-4"
                        >
                          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                            <div>
                              <p className="text-sm font-semibold text-slate-900">
                                {eventMeta.label}
                              </p>
                              <p className="mt-1 text-xs text-slate-500">
                                {formatDateTime(item.latestReceivedAt)}
                              </p>
                            </div>
                            <div className="flex flex-wrap gap-2 text-xs font-semibold">
                              <span
                                className={`rounded-full px-3 py-1 ${verificationMeta.className}`}
                              >
                                {item.verificationSummary ?? verificationMeta.label}
                              </span>
                              {item.hasDuplicateReceipts ? (
                                <span className="rounded-full bg-[rgba(249,115,82,0.16)] px-3 py-1 text-[var(--accent-secondary)]">
                                  중복 {item.duplicateCount ?? 0}건
                                </span>
                              ) : null}
                            </div>
                          </div>
                          <p className="mt-3 text-sm leading-6 text-slate-600">
                            {eventMeta.note}
                          </p>
                          {item.payloadPreview ? (
                            <p className="mt-2 text-xs leading-5 text-slate-500">
                              응답 미리보기: {item.payloadPreview}
                            </p>
                          ) : null}
                        </article>
                      );
                    })}
                  </div>
                ) : (
                  <div className="mt-4 rounded-[22px] border border-dashed border-[var(--line)] bg-white/68 px-5 py-6 text-sm leading-6 text-slate-500">
                    아직 이{" "}
                    {trackingSource.key === "orderUid" ? "orderUid" : "bookUid"}와 연결된
                    웹훅 이벤트가 없습니다. 주문 직후이거나 웹훅 테스트 전일 수 있습니다.
                  </div>
                )
              ) : (
                <div className="mt-4 rounded-[22px] border border-dashed border-[var(--line)] bg-white/68 px-5 py-6 text-sm leading-6 text-slate-500">
                  bookUid 또는 orderUid가 생기면 이 영역에서 자동 추적을 시작합니다.
                </div>
              )}
            </div>

            {orderError ? (
              <div className="mt-4 rounded-[24px] border border-rose-200 bg-rose-50 px-5 py-4 text-sm leading-6 text-rose-700">
                {orderError}
              </div>
            ) : null}
            {trackingError ? (
              <div className="mt-4 rounded-[24px] border border-amber-200 bg-amber-50 px-5 py-4 text-sm leading-6 text-amber-800">
                {trackingError}
              </div>
            ) : null}
          </div>
        </article>

        <article className="editorial-panel rounded-[32px] p-5">
          <div className="flex flex-col gap-3 border-b border-[var(--line)] pb-4">
            <p className="section-kicker">배송지 입력</p>
            <p className="text-sm leading-6 text-slate-600">
              주문자 정보와 받는 사람 정보를 한 화면에서 정리합니다. compose 결과의
              bookUid가 있으면 자동으로 채워집니다.
            </p>
          </div>

          <div className="mt-5 grid gap-4 sm:grid-cols-2">
            {checkoutFields.map((field) => {
              const value = form[field.key];
              const error = fieldErrors[field.key];
              const isNumeric = field.key === "quantity";

              return (
                <label key={field.key} className={`space-y-2 ${field.span}`}>
                  <span className="block text-sm font-semibold text-slate-900">
                    {field.label}
                  </span>
                  <input
                    type={field.type}
                    value={isNumeric ? String(value) : value}
                    placeholder={field.placeholder}
                    onChange={(event) => {
                      const nextValue =
                        isNumeric ? Number(event.target.value) : event.target.value;

                      updateField(
                        field.key,
                        nextValue as CheckoutOrderDraft[typeof field.key],
                      );
                    }}
                    min={isNumeric ? 1 : undefined}
                    max={isNumeric ? 100 : undefined}
                    className={`w-full rounded-2xl border px-4 py-3 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 ${
                      error
                        ? "border-rose-300 bg-rose-50/40 focus:border-rose-500"
                        : "border-[var(--line)] bg-white/86 focus:border-slate-500"
                    }`}
                  />
                  {error ? (
                    <p className="text-xs leading-5 text-rose-600">{error}</p>
                  ) : null}
                </label>
              );
            })}
          </div>

          <button
            type="button"
            className="button-primary mt-6 w-full rounded-[24px] px-5 py-4 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:bg-emerald-300 disabled:shadow-none"
            onClick={handleOrderSubmit}
            disabled={isOrdering}
          >
            {isOrdering ? "주문 요청 중..." : "주문 요청"}
          </button>

          <p className="mt-4 text-xs leading-5 text-slate-500">
            주문 요청 버튼은 `FINALIZED` 상태의 책만 대상으로 동작합니다. 책 생성이
            끝나지 않았다면 먼저 테스트 책 생성을 눌러 주세요.
          </p>
        </article>
      </div>
    </AppShell>
  );
}
