"use client";

import { useEffect, useState } from "react";

import { AppShell } from "@/components/app-shell";
import { orderSummary } from "@/lib/mock-trip";
import { useTripDraft } from "@/lib/use-trip-draft";
import type {
  CheckoutComposeResult,
  CheckoutOrderDraft,
  CheckoutOrderRequest,
} from "@/lib/checkout-order";
import {
  clearCheckoutComposeResult,
  loadCheckoutComposeResult,
  loadCheckoutOrderDraft,
  saveCheckoutComposeResult,
  saveCheckoutOrderDraft,
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
  const [orderResult, setOrderResult] = useState<{
    orderUid: string | null;
    totalAmount: number | null;
    orderStatusDisplay: string | null;
    paidCreditAmount: number | null;
  } | null>(null);

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
    if (composeResult?.bookUid && !form.bookUid.trim()) {
      setForm((current) => ({
        ...current,
        bookUid: composeResult.bookUid,
      }));
    }
  }, [composeResult?.bookUid, form.bookUid]);

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
          </div>
        </div>
      }
    >
      {!hydrated ? (
        <div className="soft-card rounded-[28px] p-5 text-sm text-slate-600">
          여행 초안을 불러오는 중입니다...
        </div>
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
              <div className="mt-4 space-y-3 text-sm leading-6 text-slate-700">
                <p>
                  <span className="font-semibold text-slate-900">주문 UID:</span>{" "}
                  {orderResult.orderUid ?? "응답에 포함되지 않았습니다"}
                </p>
                <p>
                  <span className="font-semibold text-slate-900">상태:</span>{" "}
                  {orderResult.orderStatusDisplay ?? "확인 중"}
                </p>
                <p>
                  <span className="font-semibold text-slate-900">총액:</span>{" "}
                  {formatCurrency(orderResult.totalAmount)}
                </p>
                <p>
                  <span className="font-semibold text-slate-900">차감 금액:</span>{" "}
                  {formatCurrency(orderResult.paidCreditAmount)}
                </p>
              </div>
            ) : (
              <p className="mt-4 text-sm leading-6 text-slate-600">
                아직 주문 요청이 없습니다. 배송지를 입력한 뒤 주문 요청 버튼을 눌러
                주세요.
              </p>
            )}

            {orderError ? (
              <div className="mt-4 rounded-[24px] border border-rose-200 bg-rose-50 px-5 py-4 text-sm leading-6 text-rose-700">
                {orderError}
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
