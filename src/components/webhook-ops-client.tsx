"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import type { SweetbookWebhookEvent } from "@/lib/trip-domain";

const webhookEvents: SweetbookWebhookEvent[] = [
  "order.created",
  "order.cancelled",
  "order.restored",
  "production.confirmed",
  "production.started",
  "production.completed",
  "shipping.departed",
  "shipping.delivered",
  "webhook.exhausted",
];

const deliveryStatuses = ["PENDING", "SUCCESS", "FAILED", "EXHAUSTED"] as const;

type DeliveryStatus = (typeof deliveryStatuses)[number];

type WebhookConfigPayload = {
  data?: {
    webhookUrl?: string;
    events?: SweetbookWebhookEvent[] | null;
    description?: string | null;
    secretKey?: string | null;
    maskedSecretKey?: string | null;
  };
  error?: string;
};

type DeliveryPayload = {
  data?: {
    items?: Array<{
      deliveryUid?: string;
      eventType?: string;
      status?: string;
      responseStatus?: number | null;
      responseBody?: string | null;
      deliveredAt?: string | null;
      createdAt?: string | null;
      attemptCount?: number | null;
      isTest?: boolean | null;
    }>;
  };
  error?: string;
};

type ReceiptPayload = {
  data?: {
    items?: Array<{
      receiptUid?: string;
      receiptGroupUid?: string;
      eventType?: string;
      deliveryUid?: string;
      receivedAt?: string | null;
      latestReceivedAt?: string | null;
      verificationStatus?:
        | "verified"
        | "invalid-signature"
        | "missing-secret"
        | string;
      verificationSummary?: string | null;
      orderUid?: string;
      bookUid?: string;
      payloadPreview?: string | null;
      receiptCount?: number | null;
      duplicateCount?: number | null;
      hasDuplicateReceipts?: boolean | null;
      statusCounts?: Record<string, number> | null;
    }>;
    summary?: {
      totalReceipts?: number;
      uniqueDeliveryCount?: number;
      duplicateDeliveryCount?: number;
      duplicateGroupCount?: number;
      verifiedReceiptCount?: number;
      invalidReceiptCount?: number;
      missingSecretCount?: number;
    };
  };
  items?: Array<{
    receiptUid?: string;
    receiptGroupUid?: string;
    eventType?: string;
    deliveryUid?: string;
    receivedAt?: string | null;
    latestReceivedAt?: string | null;
    verificationStatus?:
      | "verified"
      | "invalid-signature"
      | "missing-secret"
      | string;
    verificationSummary?: string | null;
    orderUid?: string;
    bookUid?: string;
    payloadPreview?: string | null;
    receiptCount?: number | null;
    duplicateCount?: number | null;
    hasDuplicateReceipts?: boolean | null;
    statusCounts?: Record<string, number> | null;
  }>;
  summary?: {
    totalReceipts?: number;
    uniqueDeliveryCount?: number;
    duplicateDeliveryCount?: number;
    duplicateGroupCount?: number;
    verifiedReceiptCount?: number;
    invalidReceiptCount?: number;
    missingSecretCount?: number;
  };
  error?: string;
};

type TestPayload = {
  data?: {
    deliveryUid?: string;
    eventType?: string;
    status?: string;
    responseStatus?: number | null;
    responseBody?: string | null;
  };
  error?: string;
};

const deliveryStatusLabels: Record<DeliveryStatus, string> = {
  PENDING: "대기",
  SUCCESS: "완료",
  FAILED: "실패",
  EXHAUSTED: "재시도 종료",
};

function formatDateTime(value: string | null | undefined) {
  if (!value) {
    return "-";
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

function normalizeReceiptItems(payload: ReceiptPayload) {
  const candidates = payload.data?.items ?? payload.items ?? [];

  return candidates.map((item) => ({
    receiptUid: item.receiptUid ?? null,
    receiptGroupUid: item.receiptGroupUid ?? null,
    eventType: item.eventType ?? null,
    deliveryUid: item.deliveryUid ?? null,
    receivedAt: item.receivedAt ?? null,
    latestReceivedAt: item.latestReceivedAt ?? item.receivedAt ?? null,
    verificationStatus: item.verificationStatus ?? null,
    verificationSummary: item.verificationSummary ?? null,
    orderUid: item.orderUid ?? null,
    bookUid: item.bookUid ?? null,
    payloadPreview: item.payloadPreview ?? null,
    receiptCount: item.receiptCount ?? 1,
    duplicateCount: item.duplicateCount ?? 0,
    hasDuplicateReceipts: item.hasDuplicateReceipts ?? false,
    statusCounts: item.statusCounts ?? null,
  }));
}

function getDeliveryStatusMeta(status?: string | null) {
  switch (status) {
    case "SUCCESS":
      return {
        label: "완료",
        className: "bg-[rgba(15,118,110,0.12)] text-[var(--accent)]",
      };
    case "FAILED":
      return {
        label: "실패",
        className: "bg-rose-100 text-rose-700",
      };
    case "EXHAUSTED":
      return {
        label: "재시도 종료",
        className: "bg-[rgba(249,115,82,0.16)] text-[var(--accent-secondary)]",
      };
    case "PENDING":
      return {
        label: "대기",
        className: "bg-amber-100 text-amber-800",
      };
    default:
      return {
        label: status ?? "-",
        className: "bg-slate-100 text-slate-700",
      };
  }
}

function getReceiptStatusMeta(status?: string | null) {
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
        className: "bg-[rgba(249,115,82,0.14)] text-[var(--accent-secondary)]",
      };
    default:
      return {
        label: status ?? "UNKNOWN",
        className: "bg-slate-100 text-slate-700",
      };
  }
}

async function parseJson<T>(response: Response): Promise<T> {
  return (await response.json()) as T;
}

export function WebhookOpsClient() {
  const [webhookUrl, setWebhookUrl] = useState("");
  const [description, setDescription] = useState("Triplogue 주문 상태 연동");
  const [selectedEvents, setSelectedEvents] = useState<SweetbookWebhookEvent[]>([
    "order.created",
    "shipping.departed",
  ]);
  const [testEvent, setTestEvent] = useState<SweetbookWebhookEvent>("order.created");
  const [statusFilter, setStatusFilter] = useState<DeliveryStatus | "ALL">("ALL");
  const [eventFilter, setEventFilter] = useState<SweetbookWebhookEvent | "ALL">("ALL");
  const [receiptStatusFilter, setReceiptStatusFilter] = useState<
    "all" | "verified" | "invalid-signature" | "missing-secret"
  >("all");
  const [duplicateOnly, setDuplicateOnly] = useState(false);
  const [configState, setConfigState] = useState<WebhookConfigPayload | null>(null);
  const [deliveriesState, setDeliveriesState] = useState<DeliveryPayload | null>(null);
  const [receiptsState, setReceiptsState] = useState<ReceiptPayload | null>(null);
  const [testState, setTestState] = useState<TestPayload | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isRefreshingReceipts, setIsRefreshingReceipts] = useState(false);
  const [isSendingTest, setIsSendingTest] = useState(false);

  const selectedEventSet = useMemo(() => new Set(selectedEvents), [selectedEvents]);

  const refreshConfig = useCallback(async () => {
    setIsRefreshing(true);
    setError(null);

    try {
      const response = await fetch("/api/sweetbook/webhooks/config", {
        cache: "no-store",
      });
      const payload = await parseJson<WebhookConfigPayload>(response);

      if (!response.ok) {
        throw new Error(payload.error ?? "웹훅 설정을 불러오지 못했습니다.");
      }

      setConfigState(payload);
      setWebhookUrl(payload.data?.webhookUrl ?? "");
      setDescription(payload.data?.description ?? "Triplogue 주문 상태 연동");
      setSelectedEvents(payload.data?.events?.length ? payload.data.events : []);
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "웹훅 설정을 불러오는 중 오류가 발생했습니다.",
      );
    } finally {
      setIsRefreshing(false);
    }
  }, []);

  const refreshDeliveries = useCallback(async () => {
    setError(null);

    try {
      const params = new URLSearchParams();
      params.set("limit", "10");

      if (statusFilter !== "ALL") {
        params.set("status", statusFilter);
      }

      if (eventFilter !== "ALL") {
        params.set("eventType", eventFilter);
      }

      const response = await fetch(
        `/api/sweetbook/webhooks/deliveries?${params.toString()}`,
        { cache: "no-store" },
      );
      const payload = await parseJson<DeliveryPayload>(response);

      if (!response.ok) {
        throw new Error(payload.error ?? "전송 이력을 불러오지 못했습니다.");
      }

      setDeliveriesState(payload);
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "전송 이력 조회 중 오류가 발생했습니다.",
      );
    }
  }, [eventFilter, statusFilter]);

  const refreshReceipts = useCallback(async () => {
    setIsRefreshingReceipts(true);
    setError(null);

    try {
      const params = new URLSearchParams();
      params.set("limit", "20");

      if (receiptStatusFilter !== "all") {
        params.set("status", receiptStatusFilter);
      }

      if (duplicateOnly) {
        params.set("duplicateOnly", "true");
      }

      const response = await fetch(
        `/api/webhooks/sweetbook/receipts?${params.toString()}`,
        { cache: "no-store" },
      );
      const payload = await parseJson<ReceiptPayload>(response);

      if (!response.ok) {
        throw new Error(payload.error ?? "수신 이력을 불러오지 못했습니다.");
      }

      setReceiptsState(payload);
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "수신 이력 조회 중 오류가 발생했습니다.",
      );
    } finally {
      setIsRefreshingReceipts(false);
    }
  }, [duplicateOnly, receiptStatusFilter]);

  useEffect(() => {
    void refreshConfig();
  }, [refreshConfig]);

  useEffect(() => {
    void refreshDeliveries();
  }, [refreshDeliveries]);

  useEffect(() => {
    void refreshReceipts();
  }, [refreshReceipts]);

  async function handleSave() {
    if (!webhookUrl.trim()) {
      setError("HTTPS 웹훅 URL을 입력해 주세요.");
      return;
    }

    setIsSaving(true);
    setFeedback(null);
    setError(null);

    try {
      const response = await fetch("/api/sweetbook/webhooks/config", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          webhookUrl: webhookUrl.trim(),
          events: selectedEvents.length ? selectedEvents : null,
          description: description.trim() || undefined,
        }),
      });
      const payload = await parseJson<WebhookConfigPayload>(response);

      if (!response.ok) {
        throw new Error(payload.error ?? "웹훅 설정 저장에 실패했습니다.");
      }

      setConfigState(payload);
      setFeedback(
        payload.data?.secretKey
          ? "웹훅이 등록됐어요. 이번 응답에 포함된 시크릿 키는 지금만 확인할 수 있어요."
          : "웹훅 설정이 업데이트됐어요.",
      );
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "웹훅 저장 중 오류가 발생했습니다.",
      );
    } finally {
      setIsSaving(false);
    }
  }

  async function handleDelete() {
    setIsDeleting(true);
    setFeedback(null);
    setError(null);

    try {
      const response = await fetch("/api/sweetbook/webhooks/config", {
        method: "DELETE",
      });
      const payload = await parseJson<WebhookConfigPayload>(response);

      if (!response.ok) {
        throw new Error(payload.error ?? "웹훅 해제에 실패했습니다.");
      }

      setConfigState(payload);
      setFeedback("웹훅 설정을 해제했어요.");
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "웹훅 해제 중 오류가 발생했습니다.",
      );
    } finally {
      setIsDeleting(false);
    }
  }

  async function handleSendTest() {
    setIsSendingTest(true);
    setFeedback(null);
    setError(null);

    try {
      const response = await fetch("/api/sweetbook/webhooks/test", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ eventType: testEvent }),
      });
      const payload = await parseJson<TestPayload>(response);

      if (!response.ok) {
        throw new Error(payload.error ?? "웹훅 테스트 전송에 실패했습니다.");
      }

      setTestState(payload);
      setFeedback("테스트 전송을 요청했어요. 응답 상태와 body를 바로 확인해 보세요.");
      await refreshDeliveries();
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "테스트 전송 중 오류가 발생했습니다.",
      );
    } finally {
      setIsSendingTest(false);
    }
  }

  function toggleEvent(event: SweetbookWebhookEvent) {
    setSelectedEvents((current) =>
      current.includes(event)
        ? current.filter((entry) => entry !== event)
        : [...current, event],
    );
  }

  const receiptItems = normalizeReceiptItems(receiptsState ?? {});
  const receiptSummary = receiptsState?.data?.summary;
  const deliveryItems = deliveriesState?.data?.items ?? [];
  const failedDeliveryCount = deliveryItems.filter(
    (item) => item.status === "FAILED",
  ).length;
  const succeededDeliveryCount = deliveryItems.filter(
    (item) => item.status === "SUCCESS",
  ).length;
  const configuredEventCount = configState?.data?.events?.length ?? selectedEvents.length;
  const hasConnectedWebhook = Boolean(configState?.data?.webhookUrl);

  return (
    <div className="space-y-5">
      <article className="soft-card hero-sheen rounded-[28px] p-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <p className="eyebrow text-[11px] font-semibold">웹훅 설정</p>
            <h2 className="mt-3 text-2xl font-semibold text-slate-900">
              Sweetbook 웹훅 등록과 시크릿 확인
            </h2>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-600">
              최초 등록 시에만 전체 `secretKey`가 내려오므로 바로 안전한 곳에 저장해야
              합니다. 이후 조회에서는 마스킹된 값만 보이는 흐름을 기준으로 만들었습니다.
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              {["시크릿 키 최초 노출", "HMAC-SHA256 검증", "최대 3회 재시도"].map((item) => (
                <span
                  key={item}
                  className="rounded-full border border-[var(--line)] bg-white/75 px-3 py-1 text-xs font-medium text-slate-700"
                >
                  {item}
                </span>
              ))}
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              <span
                className={`rounded-full px-3 py-1 text-xs font-semibold ${
                  hasConnectedWebhook
                    ? "bg-[rgba(15,118,110,0.12)] text-[var(--accent)]"
                    : "bg-slate-100 text-slate-600"
                }`}
              >
                {hasConnectedWebhook ? "연결됨" : "미연결"}
              </span>
              <span className="rounded-full bg-[rgba(249,115,82,0.14)] px-3 py-1 text-xs font-semibold text-[var(--accent-secondary)]">
                등록 이벤트 {configuredEventCount}개
              </span>
            </div>
          </div>

          <button
            type="button"
            className="rounded-full border border-[var(--line)] bg-white/80 px-4 py-2 text-sm font-medium text-slate-700 transition hover:border-slate-400"
            onClick={() => void refreshConfig()}
            disabled={isRefreshing}
          >
            {isRefreshing ? "설정 새로고침 중..." : "설정 새로고침"}
          </button>
        </div>

        <div className="mt-6 grid gap-4">
          <label className="grid gap-2">
            <span className="text-sm font-semibold text-slate-900">웹훅 URL</span>
            <input
              className="rounded-2xl border border-[var(--line)] bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-slate-500"
              placeholder="https://example.com/api/webhooks/sweetbook"
              value={webhookUrl}
              onChange={(event) => setWebhookUrl(event.target.value)}
            />
          </label>

          <label className="grid gap-2">
            <span className="text-sm font-semibold text-slate-900">설명</span>
            <input
              className="rounded-2xl border border-[var(--line)] bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-slate-500"
              placeholder="운영자용 식별 메모"
              value={description}
              onChange={(event) => setDescription(event.target.value)}
            />
          </label>

          <div className="grid gap-2">
            <div className="flex items-center justify-between gap-3">
              <span className="text-sm font-semibold text-slate-900">구독 이벤트</span>
              <span className="rounded-full bg-[rgba(15,118,110,0.12)] px-3 py-1 text-[11px] font-semibold text-[var(--accent)]">
                선택 {selectedEvents.length}개
              </span>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              {webhookEvents.map((event) => (
                <label
                  key={event}
                  className="flex items-center gap-3 rounded-2xl border border-[var(--line)] bg-white/80 px-4 py-3 text-sm text-slate-700 transition hover:border-slate-400"
                >
                  <input
                    type="checkbox"
                    checked={selectedEventSet.has(event)}
                    onChange={() => toggleEvent(event)}
                    className="accent-[var(--accent)]"
                  />
                  <span>{event}</span>
                </label>
              ))}
            </div>
            <p className="text-xs leading-5 text-slate-500">
              아무 이벤트도 선택하지 않으면 전체 이벤트 구독으로 전송됩니다.
            </p>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <button
              type="button"
              className="rounded-[24px] bg-slate-950 px-5 py-4 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-400"
              onClick={() => void handleSave()}
              disabled={isSaving}
            >
              {isSaving ? "저장 중..." : "웹훅 저장"}
            </button>
            <button
              type="button"
              className="rounded-[24px] border border-rose-200 bg-rose-50 px-5 py-4 text-sm font-semibold text-rose-700 transition hover:border-rose-300 hover:bg-rose-100 disabled:cursor-not-allowed disabled:opacity-60"
              onClick={() => void handleDelete()}
              disabled={isDeleting}
            >
              {isDeleting ? "해제 중..." : "웹훅 해제"}
            </button>
          </div>

          {configState?.data ? (
            <div className="rounded-[24px] border border-[var(--line)] bg-[linear-gradient(145deg,_rgba(255,255,255,0.9),_rgba(247,240,231,0.82))] px-5 py-4 text-sm leading-6 text-slate-700">
              <div className="flex flex-wrap gap-2">
                <span className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-slate-700">
                  현재 URL
                </span>
                <span className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-slate-700">
                  등록 이벤트 {configuredEventCount}개
                </span>
                <span className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-slate-700">
                  시크릿 키 {configState.data.secretKey ? "노출됨" : "마스킹"}
                </span>
              </div>
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <p>
                  <span className="font-semibold text-slate-900">현재 URL:</span>{" "}
                  {configState.data.webhookUrl ?? "-"}
                </p>
                <p>
                  <span className="font-semibold text-slate-900">설명:</span>{" "}
                  {configState.data.description ?? "-"}
                </p>
                <p className="sm:col-span-2">
                  <span className="font-semibold text-slate-900">시크릿 키:</span>{" "}
                  {configState.data.secretKey ??
                    configState.data.maskedSecretKey ??
                    "이번 응답에서 제공되지 않음"}
                </p>
              </div>
            </div>
          ) : null}
        </div>
      </article>

      <article className="soft-card rounded-[28px] p-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="eyebrow text-[11px] font-semibold">수신 로그</p>
            <h2 className="mt-3 text-2xl font-semibold text-slate-900">
              최근 수신 이벤트
            </h2>
            <p className="mt-3 text-sm leading-6 text-slate-600">
              웹훅 수신이 실제로 들어왔는지 확인하고, 같은 deliveryUid는 한 그룹으로
              묶어 중복 수신과 검증 실패를 빠르게 확인하는 영역입니다.
            </p>
          </div>

          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              className={`rounded-full border px-4 py-2 text-sm font-medium transition ${
                duplicateOnly
                  ? "border-transparent bg-slate-950 text-white"
                  : "border-[var(--line)] bg-white/80 text-slate-700 hover:border-slate-400"
              }`}
              onClick={() => setDuplicateOnly((current) => !current)}
            >
              {duplicateOnly ? "중복 그룹만 보기 중" : "중복 그룹만 보기"}
            </button>
            <button
              type="button"
              className="rounded-full border border-[var(--line)] bg-white/80 px-4 py-2 text-sm font-medium text-slate-700 transition hover:border-slate-400"
              onClick={() => void refreshReceipts()}
              disabled={isRefreshingReceipts}
            >
              {isRefreshingReceipts ? "수신 이력 새로고침 중..." : "수신 이력 새로고침"}
            </button>
          </div>
        </div>

        <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
          {[
            {
              label: "총 수신",
              value: receiptSummary?.totalReceipts ?? receiptItems.length,
              note: "원본 receipt 개수",
            },
            {
              label: "중복 그룹",
              value: receiptSummary?.duplicateGroupCount ?? 0,
              note: "같은 deliveryUid 묶음",
            },
            {
              label: "중복 건수",
              value: receiptSummary?.duplicateDeliveryCount ?? 0,
              note: "그룹 내 추가 수신",
            },
            {
              label: "검증 실패",
              value: receiptSummary?.invalidReceiptCount ?? 0,
              note: "서명 검증 실패",
            },
            {
              label: "시크릿 누락",
              value: receiptSummary?.missingSecretCount ?? 0,
              note: "운영 미설정 상태",
            },
          ].map((item) => (
            <div
              key={item.label}
              className="rounded-[24px] border border-[var(--line)] bg-[rgba(255,255,255,0.82)] px-4 py-4"
            >
              <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-500">
                {item.label}
              </p>
              <p className="mt-3 font-display text-3xl leading-none text-slate-900">
                {item.value}
              </p>
              <p className="mt-3 text-sm leading-6 text-slate-600">{item.note}</p>
            </div>
          ))}
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          {[
            `검증 완료 ${receiptSummary?.verifiedReceiptCount ?? 0}건`,
            `실패 ${receiptSummary?.invalidReceiptCount ?? 0}건`,
            `시크릿 누락 ${receiptSummary?.missingSecretCount ?? 0}건`,
          ].map((item) => (
            <span
              key={item}
              className="rounded-full border border-[var(--line)] bg-white/75 px-3 py-1 text-xs font-medium text-slate-700"
            >
              {item}
            </span>
          ))}
        </div>

        <div className="mt-5 flex flex-wrap gap-3">
          <label className="grid gap-2">
            <span className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
              수신 상태
            </span>
            <select
              className="rounded-2xl border border-[var(--line)] bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-slate-500"
              value={receiptStatusFilter}
              onChange={(event) =>
                setReceiptStatusFilter(
                  event.target.value as
                    | "all"
                    | "verified"
                    | "invalid-signature"
                    | "missing-secret",
                )
              }
            >
              <option value="all">전체 상태</option>
              <option value="verified">검증 완료</option>
              <option value="invalid-signature">검증 실패</option>
              <option value="missing-secret">시크릿 미설정</option>
            </select>
          </label>

        </div>

        <div className="mt-5 space-y-3">
          {receiptItems.length ? (
            receiptItems.map((receipt) => {
              const receiptMeta = getReceiptStatusMeta(receipt.verificationStatus);

              return (
                <article
                  key={receipt.receiptGroupUid ?? receipt.receiptUid}
                  className="rounded-[24px] border border-[var(--line)] bg-[rgba(255,255,255,0.84)] px-5 py-4"
                >
                  <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                    <div className="space-y-1">
                      <p className="text-sm font-semibold text-slate-900">
                        {receipt.eventType ?? "알 수 없는 이벤트"}
                      </p>
                      <p className="text-xs text-slate-500">
                        deliveryUid {receipt.deliveryUid ?? "-"}
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-2 text-xs font-semibold">
                      <span className={`rounded-full px-3 py-1 ${receiptMeta.className}`}>
                        {receipt.verificationSummary ?? receiptMeta.label}
                      </span>
                      {receipt.hasDuplicateReceipts ? (
                        <span className="rounded-full bg-[rgba(249,115,82,0.14)] px-3 py-1 text-[var(--accent-secondary)]">
                          중복 {receipt.duplicateCount}건
                        </span>
                      ) : (
                        <span className="rounded-full bg-slate-100 px-3 py-1 text-slate-700">
                          단건
                        </span>
                      )}
                      {receipt.bookUid ? (
                        <span className="rounded-full bg-[rgba(15,118,110,0.12)] px-3 py-1 text-[var(--accent)]">
                          bookUid {receipt.bookUid}
                        </span>
                      ) : null}
                      {receipt.orderUid ? (
                        <span className="rounded-full bg-amber-100 px-3 py-1 text-amber-700">
                          orderUid {receipt.orderUid}
                        </span>
                      ) : null}
                    </div>
                  </div>
                  <div className="mt-4 grid gap-2 text-sm leading-6 text-slate-600 md:grid-cols-2">
                    <p>최근 수신: {formatDateTime(receipt.latestReceivedAt)}</p>
                    <p>그룹 크기: {receipt.receiptCount}건</p>
                    <p className="md:col-span-2">
                      연결 정보:{" "}
                      {receipt.orderUid || receipt.bookUid
                        ? [
                            receipt.orderUid ? `orderUid ${receipt.orderUid}` : null,
                            receipt.bookUid ? `bookUid ${receipt.bookUid}` : null,
                          ]
                            .filter(Boolean)
                            .join(" / ")
                        : "없음"}
                    </p>
                    {receipt.payloadPreview ? (
                      <p className="md:col-span-2">
                        응답 미리보기: {receipt.payloadPreview}
                      </p>
                    ) : null}
                  </div>
                </article>
              );
            })
          ) : (
            <div className="rounded-[24px] border border-dashed border-[var(--line)] bg-white/65 px-5 py-10 text-sm text-slate-500">
              아직 수신된 웹훅 이벤트가 없습니다. 테스트 전송이나 실제 주문 상태 변경 후
              이 영역에 수신 로그가 표시됩니다.
            </div>
          )}
        </div>
      </article>

      <article className="soft-card rounded-[28px] p-5">
        <p className="eyebrow text-[11px] font-semibold">테스트 전송</p>
        <h2 className="mt-3 text-2xl font-semibold text-slate-900">웹훅 시뮬레이션</h2>
        <p className="mt-3 text-sm leading-6 text-slate-600">
          실운영 전에 이벤트 하나를 골라 전송 상태와 응답 본문을 바로 확인할 수
          있습니다.
        </p>

        <div className="mt-4 grid gap-3 lg:grid-cols-[1fr_auto]">
          <select
            className="rounded-2xl border border-[var(--line)] bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-slate-500"
            value={testEvent}
            onChange={(event) => setTestEvent(event.target.value as SweetbookWebhookEvent)}
          >
            {webhookEvents.map((event) => (
              <option key={event} value={event}>
                {event}
              </option>
            ))}
          </select>

          <button
            type="button"
            className="rounded-[24px] bg-[rgba(21,111,102,1)] px-5 py-4 text-sm font-semibold text-white transition hover:bg-[rgba(17,88,81,1)] disabled:cursor-not-allowed disabled:bg-[rgba(21,111,102,0.55)]"
            onClick={() => void handleSendTest()}
            disabled={isSendingTest}
          >
            {isSendingTest ? "테스트 전송 중..." : "테스트 전송"}
          </button>
        </div>

        {testState?.data ? (
          <div className="mt-4 rounded-[24px] border border-[var(--line)] bg-[linear-gradient(145deg,_rgba(255,255,255,0.9),_rgba(247,240,231,0.82))] px-5 py-4 text-sm leading-6 text-slate-700">
            <div className="flex flex-wrap gap-2">
              <span className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-slate-700">
                {testState.data.eventType ?? testEvent}
              </span>
              <span className="rounded-full bg-[rgba(15,118,110,0.12)] px-3 py-1 text-xs font-semibold text-[var(--accent)]">
                {testState.data.status ?? "-"}
              </span>
            </div>
            <div className="mt-4 grid gap-2 sm:grid-cols-2">
              <p>
                <span className="font-semibold text-slate-900">deliveryUid:</span>{" "}
                {testState.data.deliveryUid ?? "-"}
              </p>
              <p>
                <span className="font-semibold text-slate-900">응답 코드:</span>{" "}
                {testState.data.responseStatus ?? "-"}
              </p>
              <p className="sm:col-span-2">
                <span className="font-semibold text-slate-900">응답 본문:</span>{" "}
                {testState.data.responseBody ?? "-"}
              </p>
            </div>
          </div>
        ) : (
          <div className="mt-4 rounded-[24px] border border-dashed border-[var(--line)] bg-white/65 px-5 py-10 text-sm text-slate-500">
            테스트를 전송하면 응답 상태와 body가 이곳에 바로 표시됩니다.
          </div>
        )}
      </article>

      <article className="soft-card rounded-[28px] p-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="eyebrow text-[11px] font-semibold">전송 이력</p>
            <h2 className="mt-3 text-2xl font-semibold text-slate-900">
              최근 전송 이력과 실패 건 점검
            </h2>
            <p className="mt-3 text-sm leading-6 text-slate-600">
              필터를 바꿔 상태별 이력을 좁혀 보고, 실패한 전송만 빠르게 점검할 수
              있습니다.
            </p>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <select
              className="rounded-2xl border border-[var(--line)] bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-slate-500"
              value={statusFilter}
              onChange={(event) =>
                setStatusFilter(event.target.value as DeliveryStatus | "ALL")
              }
            >
              <option value="ALL">전체 상태</option>
              {deliveryStatuses.map((status) => (
                <option key={status} value={status}>
                  {deliveryStatusLabels[status]}
                </option>
              ))}
            </select>

            <select
              className="rounded-2xl border border-[var(--line)] bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-slate-500"
              value={eventFilter}
              onChange={(event) =>
                setEventFilter(event.target.value as SweetbookWebhookEvent | "ALL")
              }
            >
              <option value="ALL">전체 이벤트</option>
              {webhookEvents.map((event) => (
                <option key={event} value={event}>
                  {event}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          {[
            `성공 ${succeededDeliveryCount}건`,
            `실패 ${failedDeliveryCount}건`,
            `수신 그룹 ${receiptSummary?.uniqueDeliveryCount ?? receiptItems.length}개`,
          ].map((item) => (
            <span
              key={item}
              className="rounded-full border border-[var(--line)] bg-white/75 px-3 py-1 text-xs font-medium text-slate-700"
            >
              {item}
            </span>
          ))}
        </div>

        <div className="mt-5 space-y-3">
          {deliveriesState?.data?.items?.length ? (
            deliveriesState.data.items.map((delivery) => {
              const deliveryMeta = getDeliveryStatusMeta(delivery.status);

              return (
                <article
                  key={delivery.deliveryUid ?? `${delivery.eventType}-${delivery.createdAt}`}
                  className="rounded-[24px] border border-[var(--line)] bg-[rgba(255,255,255,0.84)] px-5 py-4"
                >
                  <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                    <div>
                      <p className="text-sm font-semibold text-slate-900">
                        {delivery.eventType ?? "알 수 없는 이벤트"}
                      </p>
                      <p className="mt-1 text-xs text-slate-500">
                        deliveryUid {delivery.deliveryUid ?? "-"}
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-2 text-xs font-semibold">
                      <span className={`rounded-full px-3 py-1 ${deliveryMeta.className}`}>
                        {deliveryMeta.label}
                      </span>
                      <span className="rounded-full bg-[rgba(21,111,102,0.12)] px-3 py-1 text-[var(--accent)]">
                        응답 {delivery.responseStatus ?? "-"}
                      </span>
                      {delivery.isTest ? (
                        <span className="rounded-full bg-amber-100 px-3 py-1 text-amber-700">
                          테스트
                        </span>
                      ) : null}
                    </div>
                  </div>
                  <div className="mt-4 grid gap-2 text-sm leading-6 text-slate-600 md:grid-cols-2">
                    <p>생성 시각: {formatDateTime(delivery.createdAt)}</p>
                    <p>전송 시각: {formatDateTime(delivery.deliveredAt)}</p>
                    <p>시도 횟수: {delivery.attemptCount ?? "-"}</p>
                    <p className="md:col-span-2">
                      응답 본문: {delivery.responseBody ?? "-"}
                    </p>
                  </div>
                </article>
              );
            })
          ) : (
            <div className="rounded-[24px] border border-dashed border-[var(--line)] bg-white/65 px-5 py-10 text-sm text-slate-500">
              현재 조건에 맞는 전송 이력이 없습니다.
            </div>
          )}
        </div>
      </article>

      {feedback ? (
        <div className="rounded-[24px] border border-emerald-200 bg-emerald-50 px-5 py-4 text-sm text-emerald-800">
          {feedback}
        </div>
      ) : null}

      {error ? (
        <div className="rounded-[24px] border border-rose-200 bg-rose-50 px-5 py-4 text-sm text-rose-700">
          {error}
        </div>
      ) : null}
    </div>
  );
}
