"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { AppShell } from "@/components/app-shell";
import { BackendHealthCard } from "@/components/backend-health-card";
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
import { estimateRequestedTravelPages } from "@/lib/sweetbook-book-specs";
import { resolveTravelTheme } from "@/lib/travel-themes";
import { useSweetbookProductMeta } from "@/lib/use-sweetbook-product-meta";

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

const demoOrderPreset = {
  ordererName: "Triplogue Demo",
  recipientName: "홍길동",
  recipientPhone: "010-1234-5678",
  postalCode: "06134",
  address1: "서울 강남구 테헤란로 123",
  address2: "Triplogue Studio 5층",
  memo: "샘플 초안 데모용 배송지",
} satisfies Omit<CheckoutOrderDraft, "bookUid" | "quantity">;

const demoOrderDraftPreset: Omit<CheckoutOrderDraft, "bookUid"> = {
  ordererName: "Triplogue Demo",
  quantity: 1,
  recipientName: "김여행",
  recipientPhone: "010-5555-1234",
  postalCode: "06123",
  address1: "서울특별시 강남구 테헤란로 123",
  address2: "트립로그 스튜디오 8층",
  memo: "샘플 포토북 데모용 배송지",
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

type PlanPreviewPayload = {
  title: string;
  subtitle: string;
  dateRange: string;
  bookSpecUid: string;
  themeLabel: string;
  totalOperationCount: number;
  operationCounts: {
    cover: number;
    divider: number;
    content: number;
    publish: number;
  };
  operations: Array<{
    kind: string;
    templateUid: string;
    photoCount: number;
  }>;
};

type BookSpecPreview = {
  uid: string;
  label: string;
  detail: string | null;
  minPageCount: number | null;
  maxPageCount: number | null;
  pageStep: number | null;
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

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function pickString(record: Record<string, unknown>, keys: string[]) {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === "string" && value.trim()) {
      return value.trim();
    }
  }

  return null;
}

function pickNumber(record: Record<string, unknown>, keys: string[]) {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === "number" && Number.isFinite(value)) {
      return value;
    }
  }

  return null;
}

function normalizePlanPreview(payload: unknown): PlanPreviewPayload | null {
  if (!isObject(payload)) {
    return null;
  }

  const operations = Array.isArray(payload.operations)
    ? payload.operations.filter(isObject).map((operation) => ({
        kind:
          typeof operation.kind === "string" && operation.kind.trim()
            ? operation.kind.trim()
            : "unknown",
        templateUid:
          typeof operation.templateUid === "string" && operation.templateUid.trim()
            ? operation.templateUid.trim()
            : "-",
        photoCount: Array.isArray(operation.photoIds) ? operation.photoIds.length : 0,
      }))
    : [];

  return {
    title: typeof payload.title === "string" ? payload.title : "여행 포토북",
    subtitle: typeof payload.subtitle === "string" ? payload.subtitle : "",
    dateRange: typeof payload.dateRange === "string" ? payload.dateRange : "",
    bookSpecUid:
      typeof payload.bookSpecUid === "string" ? payload.bookSpecUid : "미확인",
    themeLabel:
      typeof payload.themeLabel === "string" ? payload.themeLabel : "미확인",
    totalOperationCount: operations.length,
    operationCounts: {
      cover: operations.filter((operation) => operation.kind === "cover").length,
      divider: operations.filter((operation) => operation.kind === "divider").length,
      content: operations.filter((operation) => operation.kind === "content").length,
      publish: operations.filter((operation) => operation.kind === "publish").length,
    },
    operations,
  };
}

function collectSpecCandidates(payload: unknown) {
  if (Array.isArray(payload)) {
    return payload.filter(isObject);
  }

  if (!isObject(payload)) {
    return [];
  }

  const queue: unknown[] = [
    payload.items,
    payload.bookSpecs,
    payload.results,
    payload.data,
    isObject(payload.data) ? payload.data.items : null,
    isObject(payload.data) ? payload.data.bookSpecs : null,
    isObject(payload.data) ? payload.data.results : null,
  ];

  return queue.flatMap((entry) =>
    Array.isArray(entry) ? entry.filter(isObject) : [],
  );
}

function normalizeBookSpecPreview(payload: unknown, bookSpecUid: string) {
  const matched = collectSpecCandidates(payload).find((candidate) => {
    const candidateUid = pickString(candidate, [
      "bookSpecUid",
      "uid",
      "specUid",
      "productUid",
    ]);

    return candidateUid === bookSpecUid;
  });

  if (!matched) {
    return null;
  }

  const detail = [
    pickString(matched, [
      "bookSizeName",
      "sizeDisplayName",
      "productName",
      "displayName",
    ]),
    pickString(matched, [
      "bindingTypeName",
      "bindingType",
      "coverTypeName",
      "coverType",
    ]),
  ].filter(Boolean);

  return {
    uid: bookSpecUid,
    label:
      pickString(matched, ["label", "name", "title", "displayName"]) ?? bookSpecUid,
    detail: detail.length ? detail.join(" / ") : null,
    minPageCount: pickNumber(matched, ["minPageCount", "minPages", "minimumPageCount"]),
    maxPageCount: pickNumber(matched, ["maxPageCount", "maxPages", "maximumPageCount"]),
    pageStep: pickNumber(matched, [
      "pageStep",
      "pageMultiple",
      "pageIncrement",
      "pageCountStep",
    ]),
  } satisfies BookSpecPreview;
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
  const requestedPageCount = draft
    ? estimateRequestedTravelPages(photoCount, chapterCount)
    : orderSummary.pages;
  const {
    plan,
    productLabel,
    productDimension,
    pageRuleSummary,
    coverSummary,
    pageCount,
    estimatedPrice: estimatedPriceValue,
    error: productMetaError,
    isLoading: isLoadingProductMeta,
    isNormalizedPageCount,
  } = useSweetbookProductMeta(draft, requestedPageCount);
  const estimatedPrice = formatCurrency(estimatedPriceValue);
  const resolvedLocationCount = draft?.stats.withResolvedLocation ?? 0;
  const gpsPhotoCount = draft?.stats.withGpsCoordinates ?? 0;
  const manualTaggingCount = draft?.stats.manualTaggingRequired ?? 0;
  const manualCorrectedCount =
    draft?.photos.filter(
      (photo) =>
        photo.locationSource === "manual" && !photo.requiresManualLocationTagging,
    ).length ?? 0;

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
  const [planPreview, setPlanPreview] = useState<PlanPreviewPayload | null>(null);
  const [planError, setPlanError] = useState<string | null>(null);
  const [isLoadingPlan, setIsLoadingPlan] = useState(false);
  const [planRefreshToken, setPlanRefreshToken] = useState(0);
  const [bookSpecPreview, setBookSpecPreview] = useState<BookSpecPreview | null>(null);
  const [trackingState, setTrackingState] = useState<TrackingReceiptPayload | null>(null);
  const [trackingError, setTrackingError] = useState<string | null>(null);
  const [isRefreshingTracking, setIsRefreshingTracking] = useState(false);
  const [lastTrackingAt, setLastTrackingAt] = useState<string | null>(null);
  const [trackingRefreshToken, setTrackingRefreshToken] = useState(0);
  const hasShippingDraftContent = Boolean(
    form.ordererName.trim() ||
      form.recipientName.trim() ||
      form.recipientPhone.trim() ||
      form.postalCode.trim() ||
      form.address1.trim() ||
      form.address2.trim() ||
      form.memo.trim(),
  );

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

  opsSearchParams.set("source", "checkout");

  const opsHref = opsSearchParams.size
    ? `/ops/webhooks?${opsSearchParams.toString()}`
    : "/ops/webhooks";
  const hasShippingDetails = Boolean(
    form.ordererName.trim() ||
      form.recipientName.trim() ||
      form.recipientPhone.trim() ||
      form.postalCode.trim() ||
      form.address1.trim() ||
      form.address2.trim() ||
      form.memo.trim(),
  );

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
    if (!isDemoDraft || hasShippingDraftContent) {
      return;
    }

    setForm((current) => ({
      ...current,
      ...demoOrderPreset,
    }));
  }, [hasShippingDraftContent, isDemoDraft]);

  useEffect(() => {
    if (!isDemoDraft || hasShippingDetails) {
      return;
    }

    setForm((current) => ({
      ...current,
      ...demoOrderDraftPreset,
      bookUid: current.bookUid,
    }));
  }, [hasShippingDetails, isDemoDraft]);

  useEffect(() => {
    if (!draft) {
      setPlanPreview(null);
      setBookSpecPreview(null);
      setPlanError(null);
      return;
    }

    let isCancelled = false;

    async function loadPlanPreview() {
      setIsLoadingPlan(true);
      setPlanError(null);

      try {
        const planResponse = await fetch("/api/sweetbook/books/plan", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(draft),
        });

        const planPayload = (await planResponse.json()) as {
          error?: string;
        } & Record<string, unknown>;

        if (!planResponse.ok) {
          throw new Error(planPayload.error ?? "서버 조립 계획을 불러오지 못했습니다.");
        }

        const nextPlanPreview = normalizePlanPreview(planPayload);
        if (!nextPlanPreview) {
          throw new Error("서버 조립 계획 형식을 해석하지 못했습니다.");
        }

        let nextBookSpecPreview: BookSpecPreview | null = null;
        const specResponse = await fetch("/api/sweetbook/book-specs", {
          cache: "no-store",
        });

        if (specResponse.ok) {
          const specPayload = (await specResponse.json()) as unknown;
          nextBookSpecPreview = normalizeBookSpecPreview(
            specPayload,
            nextPlanPreview.bookSpecUid,
          );
        }

        if (!isCancelled) {
          setPlanPreview(nextPlanPreview);
          setBookSpecPreview(nextBookSpecPreview);
        }
      } catch (error) {
        if (!isCancelled) {
          setPlanError(
            error instanceof Error
              ? error.message
              : "서버 조립 계획을 읽는 중 오류가 발생했습니다.",
          );
          setPlanPreview(null);
          setBookSpecPreview(null);
        }
      } finally {
        if (!isCancelled) {
          setIsLoadingPlan(false);
        }
      }
    }

    void loadPlanPreview();

    return () => {
      isCancelled = true;
    };
  }, [draft, planRefreshToken]);

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

          <BackendHealthCard title="주문 전 백엔드 상태" compact />
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
          <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
            <div>
              <p className="section-kicker">샘플 여행 초안</p>
              <p className="mt-3 text-sm leading-6 text-slate-600">
                현재 주문 단계는 데모용 여행 초안을 기준으로 이어지고 있습니다. 테스트
                책 생성으로 bookUid를 만든 뒤 주문 요청과 웹훅 추적까지 한 흐름으로
                확인할 수 있습니다.
              </p>
              <p className="mt-2 text-xs leading-5 text-slate-500">
                배송지 입력칸은 데모용 기본값으로 미리 채워 두었습니다. 필요하면 그대로
                수정해 사용할 수 있습니다.
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

      <div className="grid gap-4 xl:grid-cols-[minmax(0,0.92fr)_minmax(0,1.08fr)]">
        <article className="space-y-4">
          <div className="editorial-panel rounded-[32px] p-5">
            <p className="section-kicker">책 요약</p>
            <div className="mt-4 space-y-3 text-sm leading-6 text-slate-700">
              <p>
                <span className="font-semibold text-slate-900">상품:</span>{" "}
                {draft
                  ? `${draft.tripName} / ${productLabel}`
                  : `${orderSummary.product} / ${productLabel}`}
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
                <span className="font-semibold text-slate-900">상품 규칙:</span>{" "}
                {pageRuleSummary}
              </p>
              <p>
                <span className="font-semibold text-slate-900">최종화된 bookUid:</span>{" "}
                {form.bookUid.trim() ? form.bookUid : "아직 없습니다"}
              </p>
            </div>

            <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              <div className="metric-tile px-4 py-4">
                <p className="text-xs uppercase tracking-[0.2em] text-slate-500">예상 페이지</p>
                <p className="mt-2 text-2xl font-semibold text-slate-900">{pageCount}</p>
              </div>
              <div className="metric-tile px-4 py-4">
                <p className="text-xs uppercase tracking-[0.2em] text-slate-500">예상 금액</p>
                <p className="mt-2 text-2xl font-semibold text-slate-900">{estimatedPrice}</p>
              </div>
              <div className="metric-tile px-4 py-4">
                <p className="text-xs uppercase tracking-[0.2em] text-slate-500">상품 규격</p>
                <p className="mt-2 text-lg font-semibold text-slate-900">{productLabel}</p>
              </div>
            </div>

            <div className="mt-5 rounded-[24px] border border-[var(--line)] bg-white/82 px-4 py-4 text-sm leading-6 text-slate-700">
              <p>
                <span className="font-semibold text-slate-900">규격:</span> {productDimension}
              </p>
              <p>
                <span className="font-semibold text-slate-900">제본:</span> {coverSummary}
              </p>
              <p>
                <span className="font-semibold text-slate-900">페이지 규칙:</span>{" "}
                {pageRuleSummary}
              </p>
              {isNormalizedPageCount ? (
                <p>
                  <span className="font-semibold text-slate-900">보정:</span> 요청 분량을
                  상품 규칙에 맞게 {pageCount}p로 맞췄습니다.
                </p>
              ) : null}
              {plan ? (
                <p>
                  <span className="font-semibold text-slate-900">조립 계획:</span>{" "}
                  {plan.operations.length}개 단계
                </p>
              ) : null}
            </div>
            {productMetaError ? (
              <div className="mt-4 rounded-[24px] border border-amber-200 bg-amber-50 px-5 py-4 text-sm leading-6 text-amber-800">
                {productMetaError}
              </div>
            ) : null}
            {isLoadingProductMeta ? (
              <div className="mt-4 rounded-[24px] border border-[var(--line)] bg-white/78 px-5 py-4 text-sm leading-6 text-slate-600">
                Sweetbook 상품 규격과 조립 계획을 동기화하는 중입니다.
              </div>
            ) : null}

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
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <p className="section-kicker">서버 조립 계획</p>
                <p className="mt-3 text-sm leading-6 text-slate-600">
                  현재 여행 draft를 서버 route로 보내 실제 Sweetbook 조립 계획을 계산한
                  결과입니다. 제출 때 백엔드가 어떤 책 구조를 만드는지 설명하는 기준으로
                  쓸 수 있습니다.
                </p>
              </div>
              <button
                type="button"
                className="rounded-full border border-[var(--line)] bg-white px-4 py-2 text-xs font-semibold text-slate-700 transition hover:border-slate-400"
                onClick={() => setPlanRefreshToken((current) => current + 1)}
                disabled={isLoadingPlan || !draft}
              >
                {isLoadingPlan ? "계획 계산 중..." : "계획 새로고침"}
              </button>
            </div>

            {planPreview ? (
              <div className="mt-4 space-y-4">
                <div className="rounded-[24px] border border-[var(--line)] bg-[linear-gradient(145deg,_rgba(255,255,255,0.94),_rgba(247,240,231,0.84))] px-5 py-4 text-sm leading-6 text-slate-700">
                  <p>
                    <span className="font-semibold text-slate-900">책 제목:</span>{" "}
                    {planPreview.title}
                  </p>
                  <p>
                    <span className="font-semibold text-slate-900">서브타이틀:</span>{" "}
                    {planPreview.subtitle}
                  </p>
                  <p>
                    <span className="font-semibold text-slate-900">테마 레이블:</span>{" "}
                    {planPreview.themeLabel}
                  </p>
                  <p>
                    <span className="font-semibold text-slate-900">규격:</span>{" "}
                    {bookSpecPreview?.label ?? planPreview.bookSpecUid}
                  </p>
                  {bookSpecPreview?.detail ? (
                    <p>
                      <span className="font-semibold text-slate-900">규격 상세:</span>{" "}
                      {bookSpecPreview.detail}
                    </p>
                  ) : null}
                  <p>
                    <span className="font-semibold text-slate-900">여행 기간:</span>{" "}
                    {planPreview.dateRange}
                  </p>
                </div>

                <div className="grid gap-3 sm:grid-cols-2 2xl:grid-cols-4">
                  {[
                    ["전체 단계", planPreview.totalOperationCount, "cover + divider + content + publish"],
                    ["표지", planPreview.operationCounts.cover, "처음 한 번 적용"],
                    ["챕터 분리", planPreview.operationCounts.divider, "장소/날짜 오프너 페이지"],
                    ["내지/출판", `${planPreview.operationCounts.content} / ${planPreview.operationCounts.publish}`, "본문과 publish 템플릿 수"],
                  ].map(([label, value, note]) => (
                    <div
                      key={String(label)}
                      className="rounded-[24px] border border-[var(--line)] bg-white/82 px-4 py-4"
                    >
                      <p className="text-xs uppercase tracking-[0.2em] text-slate-500">
                        {label}
                      </p>
                      <p className="mt-2 text-2xl font-semibold text-slate-900">{value}</p>
                      <p className="mt-2 text-sm leading-6 text-slate-600">{note}</p>
                    </div>
                  ))}
                </div>

                {bookSpecPreview ? (
                  <div className="grid gap-3 sm:grid-cols-2 2xl:grid-cols-3">
                    <div className="rounded-[22px] border border-[var(--line)] bg-white/78 px-4 py-4">
                      <p className="text-xs uppercase tracking-[0.2em] text-slate-500">최소 페이지</p>
                      <p className="mt-2 text-xl font-semibold text-slate-900">
                        {bookSpecPreview.minPageCount ?? "미확인"}
                      </p>
                    </div>
                    <div className="rounded-[22px] border border-[var(--line)] bg-white/78 px-4 py-4">
                      <p className="text-xs uppercase tracking-[0.2em] text-slate-500">최대 페이지</p>
                      <p className="mt-2 text-xl font-semibold text-slate-900">
                        {bookSpecPreview.maxPageCount ?? "미확인"}
                      </p>
                    </div>
                    <div className="rounded-[22px] border border-[var(--line)] bg-white/78 px-4 py-4">
                      <p className="text-xs uppercase tracking-[0.2em] text-slate-500">증가 단위</p>
                      <p className="mt-2 text-xl font-semibold text-slate-900">
                        {bookSpecPreview.pageStep ?? "미확인"}
                      </p>
                    </div>
                  </div>
                ) : null}

                <div className="grid gap-4 2xl:grid-cols-[0.9fr_1.1fr]">
                  <div className="rounded-[24px] border border-[var(--line)] bg-white/80 px-5 py-4">
                    <p className="text-sm font-semibold text-slate-900">챕터 기준 미리보기</p>
                    <div className="mt-3 space-y-3">
                      {draft?.chapters.slice(0, 4).map((chapter, index) => (
                        <div
                          key={chapter.id}
                          className="rounded-[20px] border border-[var(--line)] bg-[rgba(255,255,255,0.78)] px-4 py-3"
                        >
                          <p className="text-sm font-semibold text-slate-900">
                            {index + 1}. {chapter.title}
                          </p>
                          <p className="mt-1 text-xs uppercase tracking-[0.18em] text-slate-500">
                            {chapter.dayLabel} / {chapter.placeLabel}
                          </p>
                          <p className="mt-2 text-sm leading-6 text-slate-600">
                            사진 {chapter.photoCount}장, 위치 소스 {chapter.locationSource}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="rounded-[24px] border border-[var(--line)] bg-white/80 px-5 py-4">
                    <p className="text-sm font-semibold text-slate-900">템플릿 실행 순서</p>
                    <div className="mt-3 space-y-3">
                      {planPreview.operations.slice(0, 6).map((operation, index) => (
                        <div
                          key={`${operation.templateUid}-${index}`}
                          className="rounded-[20px] border border-[var(--line)] bg-[rgba(255,255,255,0.78)] px-4 py-3"
                        >
                          <div className="flex items-center justify-between gap-3">
                            <p className="text-sm font-semibold text-slate-900">
                              {index + 1}. {operation.kind}
                            </p>
                            <span className="rounded-full bg-[var(--accent-soft)] px-3 py-1 text-xs font-semibold text-[var(--accent)]">
                              사진 {operation.photoCount}장
                            </span>
                          </div>
                          <p className="mt-2 text-xs uppercase tracking-[0.16em] text-slate-500">
                            templateUid / {operation.templateUid}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            ) : null}

            {isLoadingPlan && !planPreview ? (
              <div className="mt-4 rounded-[24px] border border-[var(--line)] bg-white/78 px-5 py-4 text-sm leading-6 text-slate-600">
                현재 여행 초안을 기준으로 서버 조립 계획을 계산하는 중입니다.
              </div>
            ) : null}

            {planError ? (
              <div className="mt-4 rounded-[24px] border border-amber-200 bg-amber-50 px-5 py-4 text-sm leading-6 text-amber-800">
                {planError}
              </div>
            ) : null}
          </div>

          <div className="soft-card rounded-[28px] p-5">
            <p className="section-kicker">출판 전 최종 요약</p>
            <p className="mt-3 text-sm leading-6 text-slate-600">
              이 책이 어떤 재료로 만들어졌고, 주문 이후 어떤 기준으로 추적되는지 한눈에
              확인할 수 있도록 최종 요약을 묶어뒀습니다.
            </p>

            <div className="mt-4 grid gap-3 sm:grid-cols-2 2xl:grid-cols-3">
              {[
                ["총 사진 수", photoCount, "현재 draft 전체 사진"],
                ["챕터 수", chapterCount, "포토북 스프레드 기준"],
                ["위치 정리", resolvedLocationCount, "장소 라벨이 확정된 사진"],
                ["GPS 포함", gpsPhotoCount, "지도 카드 후보가 되는 사진"],
                ["수동 보정 완료", manualCorrectedCount, "검토 단계에서 직접 보정한 사진"],
                ["보정 대기", manualTaggingCount, "아직 위치 확인이 필요한 사진"],
              ].map(([label, value, note]) => (
                <div
                  key={String(label)}
                  className="rounded-[24px] border border-[var(--line)] bg-white/82 px-4 py-4"
                >
                  <p className="text-xs uppercase tracking-[0.2em] text-slate-500">
                    {label}
                  </p>
                  <p className="metric-value mt-2 font-semibold text-slate-900">{value}</p>
                  <p className="mt-2 text-sm leading-6 text-slate-600">{note}</p>
                </div>
              ))}
            </div>

            <div className="mt-4 rounded-[24px] border border-[var(--line)] bg-[linear-gradient(145deg,_rgba(255,255,255,0.92),_rgba(247,240,231,0.82))] px-5 py-4 text-sm leading-6 text-slate-700">
              <p>
                <span className="font-semibold text-slate-900">선택 테마:</span>{" "}
                {selectedTheme.name}
              </p>
              <p>
                <span className="font-semibold text-slate-900">주문 후 추적:</span>{" "}
                checkout에서 먼저 확인하고, 필요하면 `ops/webhooks`로 이어서 같은
                orderUid 또는 bookUid 기준 로그를 봅니다.
              </p>
            </div>
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

              <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
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
                          <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
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

          {isDemoDraft ? (
            <div className="mt-5 rounded-[24px] border border-[var(--line)] bg-[linear-gradient(145deg,_rgba(255,255,255,0.92),_rgba(247,240,231,0.84))] px-5 py-4 text-sm leading-6 text-slate-700">
              샘플 초안 세션이라 배송지 예시를 미리 채워두었습니다. 실제 테스트 전에는
              필요한 값으로 바로 수정할 수 있습니다.
            </div>
          ) : null}

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
