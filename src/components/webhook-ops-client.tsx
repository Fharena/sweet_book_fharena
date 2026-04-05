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
      eventType?: string;
      deliveryUid?: string;
      receivedAt?: string | null;
      verificationStatus?:
        | "VERIFIED"
        | "INVALID"
        | "PENDING"
        | "SKIPPED"
        | string;
      orderUid?: string;
      bookUid?: string;
      payload?: Record<string, unknown> | null;
    }>;
  };
  items?: Array<{
    receiptUid?: string;
    eventType?: string;
    deliveryUid?: string;
    receivedAt?: string | null;
    verificationStatus?:
      | "VERIFIED"
      | "INVALID"
      | "PENDING"
      | "SKIPPED"
      | string;
    orderUid?: string;
    bookUid?: string;
    payload?: Record<string, unknown> | null;
  }>;
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
    eventType: item.eventType ?? null,
    deliveryUid: item.deliveryUid ?? null,
    receivedAt: item.receivedAt ?? null,
    verificationStatus: item.verificationStatus ?? null,
    orderUid: item.orderUid ?? item.payload?.orderUid?.toString?.() ?? null,
    bookUid: item.bookUid ?? item.payload?.bookUid?.toString?.() ?? null,
  }));
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
      const response = await fetch("/api/webhooks/sweetbook/receipts?limit=20", {
        cache: "no-store",
      });
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
  }, []);

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
          ? "웹훅이 등록됐어요. 이번 응답에 포함된 secretKey는 지금만 확인할 수 있어요."
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

  return (
    <div className="space-y-4">
      <article className="soft-card rounded-[28px] p-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <p className="eyebrow text-[11px] font-semibold">Webhook config</p>
            <h2 className="mt-3 text-2xl font-semibold text-slate-900">
              Sweetbook 웹훅 등록과 시크릿 확인
            </h2>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-600">
              최초 등록 시에만 전체 `secretKey`가 내려오므로 바로 안전한 곳에 저장해야
              합니다. 이후 조회에서는 마스킹된 값만 보이는 흐름을 기준으로 만들었습니다.
            </p>
          </div>

          <button
            type="button"
            className="rounded-full border border-[var(--line)] bg-white/80 px-4 py-2 text-sm font-medium text-slate-700 hover:border-slate-400"
            onClick={() => void refreshConfig()}
            disabled={isRefreshing}
          >
            {isRefreshing ? "설정 새로고침 중..." : "설정 새로고침"}
          </button>
        </div>

        <div className="mt-6 grid gap-4">
          <label className="grid gap-2">
            <span className="text-sm font-semibold text-slate-900">Webhook URL</span>
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
            <span className="text-sm font-semibold text-slate-900">구독 이벤트</span>
            <div className="grid gap-3 sm:grid-cols-2">
              {webhookEvents.map((event) => (
                <label
                  key={event}
                  className="flex items-center gap-3 rounded-2xl border border-[var(--line)] bg-white/80 px-4 py-3 text-sm text-slate-700"
                >
                  <input
                    type="checkbox"
                    checked={selectedEventSet.has(event)}
                    onChange={() => toggleEvent(event)}
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
            <div className="rounded-[24px] border border-[var(--line)] bg-white/85 px-5 py-4 text-sm leading-6 text-slate-700">
              <p>
                <span className="font-semibold text-slate-900">현재 URL:</span>{" "}
                {configState.data.webhookUrl ?? "-"}
              </p>
              <p>
                <span className="font-semibold text-slate-900">등록된 이벤트:</span>{" "}
                {configState.data.events?.length
                  ? configState.data.events.join(", ")
                  : "전체 이벤트"}
              </p>
              <p>
                <span className="font-semibold text-slate-900">Secret:</span>{" "}
                {configState.data.secretKey ??
                  configState.data.maskedSecretKey ??
                  "이번 응답에서 제공되지 않음"}
              </p>
            </div>
          ) : null}
        </div>
      </article>

      <article className="soft-card rounded-[28px] p-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="eyebrow text-[11px] font-semibold">Recent receipts</p>
            <h2 className="mt-3 text-2xl font-semibold text-slate-900">
              최근 수신 이벤트
            </h2>
            <p className="mt-3 text-sm leading-6 text-slate-600">
              웹훅 수신이 실제로 들어왔는지 확인하고, 어떤 이벤트가 어떤 주문/책으로
              연결됐는지 빠르게 점검하는 영역입니다.
            </p>
          </div>

          <button
            type="button"
            className="rounded-full border border-[var(--line)] bg-white/80 px-4 py-2 text-sm font-medium text-slate-700 hover:border-slate-400"
            onClick={() => void refreshReceipts()}
            disabled={isRefreshingReceipts}
          >
            {isRefreshingReceipts ? "수신 이력 새로고침 중..." : "수신 이력 새로고침"}
          </button>
        </div>

        <div className="mt-5 space-y-3">
          {receiptItems.length ? (
            receiptItems.map((receipt) => (
              <article
                key={receipt.receiptUid ?? `${receipt.eventType}-${receipt.deliveryUid}-${receipt.receivedAt}`}
                className="rounded-[24px] border border-[var(--line)] bg-white/85 px-5 py-4"
              >
                <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                  <div>
                    <p className="text-sm font-semibold text-slate-900">
                      {receipt.eventType ?? "알 수 없는 이벤트"}
                    </p>
                    <p className="mt-1 text-xs text-slate-500">
                      deliveryUid {receipt.deliveryUid ?? "-"}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2 text-xs font-semibold">
                    <span className="rounded-full bg-slate-950 px-3 py-1 text-white">
                      {receipt.verificationStatus ?? "UNKNOWN"}
                    </span>
                    {receipt.bookUid ? (
                      <span className="rounded-full bg-[rgba(21,111,102,0.12)] px-3 py-1 text-[rgba(21,111,102,1)]">
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
                  <p>수신 시각: {formatDateTime(receipt.receivedAt)}</p>
                  <p>검증 상태: {receipt.verificationStatus ?? "-"}</p>
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
                </div>
              </article>
            ))
          ) : (
            <div className="rounded-[24px] border border-dashed border-[var(--line)] bg-white/65 px-5 py-10 text-sm text-slate-500">
              아직 수신된 웹훅 이벤트가 없습니다. 테스트 전송이나 실제 주문 상태 변경 후
              이 영역에 수신 로그가 표시됩니다.
            </div>
          )}
        </div>
      </article>

      <article className="soft-card rounded-[28px] p-5">
        <p className="eyebrow text-[11px] font-semibold">Webhook test</p>
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
          <div className="mt-4 rounded-[24px] border border-[var(--line)] bg-white/85 px-5 py-4 text-sm leading-6 text-slate-700">
            <p>
              <span className="font-semibold text-slate-900">deliveryUid:</span>{" "}
              {testState.data.deliveryUid ?? "-"}
            </p>
            <p>
              <span className="font-semibold text-slate-900">status:</span>{" "}
              {testState.data.status ?? "-"}
            </p>
            <p>
              <span className="font-semibold text-slate-900">responseStatus:</span>{" "}
              {testState.data.responseStatus ?? "-"}
            </p>
            <p>
              <span className="font-semibold text-slate-900">responseBody:</span>{" "}
              {testState.data.responseBody ?? "-"}
            </p>
          </div>
        ) : null}
      </article>

      <article className="soft-card rounded-[28px] p-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="eyebrow text-[11px] font-semibold">Delivery history</p>
            <h2 className="mt-3 text-2xl font-semibold text-slate-900">
              최근 전송 이력과 실패 건 점검
            </h2>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <select
              className="rounded-2xl border border-[var(--line)] bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-slate-500"
              value={statusFilter}
              onChange={(event) =>
                setStatusFilter(event.target.value as DeliveryStatus | "ALL")
              }
            >
              <option value="ALL">모든 상태</option>
              {deliveryStatuses.map((status) => (
                <option key={status} value={status}>
                  {status}
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
              <option value="ALL">모든 이벤트</option>
              {webhookEvents.map((event) => (
                <option key={event} value={event}>
                  {event}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="mt-5 space-y-3">
          {deliveriesState?.data?.items?.length ? (
            deliveriesState.data.items.map((delivery) => (
              <article
                key={delivery.deliveryUid ?? `${delivery.eventType}-${delivery.createdAt}`}
                className="rounded-[24px] border border-[var(--line)] bg-white/85 px-5 py-4"
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
                    <span className="rounded-full bg-slate-950 px-3 py-1 text-white">
                      {delivery.status ?? "-"}
                    </span>
                    <span className="rounded-full bg-[rgba(21,111,102,0.12)] px-3 py-1 text-[rgba(21,111,102,1)]">
                      응답 {delivery.responseStatus ?? "-"}
                    </span>
                    {delivery.isTest ? (
                      <span className="rounded-full bg-amber-100 px-3 py-1 text-amber-700">
                        TEST
                      </span>
                    ) : null}
                  </div>
                </div>
                <div className="mt-4 grid gap-2 text-sm leading-6 text-slate-600 md:grid-cols-2">
                  <p>생성 시각: {formatDateTime(delivery.createdAt)}</p>
                  <p>전송 시각: {formatDateTime(delivery.deliveredAt)}</p>
                  <p>시도 횟수: {delivery.attemptCount ?? "-"}</p>
                  <p className="md:col-span-2">
                    응답 body: {delivery.responseBody ?? "-"}
                  </p>
                </div>
              </article>
            ))
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
