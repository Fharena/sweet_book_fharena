"use client";

import { useState } from "react";

import { AppShell } from "@/components/app-shell";
import { orderSummary } from "@/lib/mock-trip";
import { useTripDraft } from "@/lib/use-trip-draft";

function derivePrice(pageCount: number) {
  return Math.round(16800 + pageCount * 330);
}

export default function CheckoutPage() {
  const { draft, hydrated } = useTripDraft();
  const photoCount = draft?.stats.totalPhotos ?? 0;
  const chapterCount = draft?.chapters.length ?? orderSummary.chapters;
  const pageCount = draft
    ? Math.max(24, chapterCount * 6 + Math.ceil(photoCount / 4) * 2)
    : orderSummary.pages;
  const estimatedPrice = draft
    ? `KRW ${derivePrice(pageCount).toLocaleString()}`
    : orderSummary.estimatedPrice;
  const [isComposing, setIsComposing] = useState(false);
  const [composeError, setComposeError] = useState<string | null>(null);
  const [composeResult, setComposeResult] = useState<{
    bookUid: string;
    finalized?: unknown;
  } | null>(null);

  async function handleComposeBook() {
    if (!draft) {
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
        steps?: {
          finalizedBook?: unknown;
        };
      };

      if (!response.ok || !payload.bookUid) {
        throw new Error(payload.error ?? "Sweetbook 책 생성에 실패했습니다.");
      }

      setComposeResult({
        bookUid: payload.bookUid,
        finalized: payload.steps?.finalizedBook,
      });
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

  return (
    <AppShell
      eyebrow="Sweetbook Hand-off"
      title={
        draft
          ? `Finalize ${draft.tripName}, estimate, and place the order.`
          : "Finalize, estimate, and place the order."
      }
      description={
        draft
          ? "The checkout summary now reflects the imported draft, so page count, chapters, and price are no longer static."
          : "The order step is intentionally lean: show the generated book summary, collect shipping details, then call Sweetbook estimate and order APIs from a secure backend route."
      }
      aside={
        <div className="space-y-4">
          <div className="soft-card rounded-[28px] p-5">
            <p className="eyebrow text-[11px] font-semibold">Order payload essentials</p>
            <ul className="mt-4 space-y-3 text-sm leading-6 text-slate-700">
              <li>Finalized book UID</li>
              <li>Recipient and shipping address</li>
              <li>Quantity and order estimate</li>
            </ul>
          </div>

          <div className="soft-card rounded-[28px] p-5">
            <p className="text-sm font-semibold text-slate-900">Backend note</p>
            <p className="mt-3 text-sm leading-6 text-slate-600">
              API keys stay server-side. The frontend only posts clean order data to
              our own route handler.
            </p>
          </div>

          {draft ? (
            <div className="soft-card rounded-[28px] p-5">
              <p className="text-sm font-semibold text-slate-900">Draft ready</p>
              <p className="mt-3 text-sm leading-6 text-slate-600">
                {photoCount} photos and {chapterCount} chapters are ready to feed the
                Sweetbook order step.
              </p>
            </div>
          ) : null}
        </div>
      }
    >
      {!hydrated ? (
        <div className="soft-card rounded-[28px] p-5 text-sm text-slate-600">
          Loading trip draft...
        </div>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-[0.9fr_1.1fr]">
        <article className="soft-card rounded-[28px] p-5">
          <p className="eyebrow text-[11px] font-semibold">Book summary</p>
          <div className="mt-4 space-y-3 text-sm leading-6 text-slate-700">
            <p>
              <span className="font-semibold text-slate-900">Product:</span>{" "}
              {draft ? `Travel photobook for ${draft.tripName}` : orderSummary.product}
            </p>
            <p>
              <span className="font-semibold text-slate-900">Pages:</span>{" "}
              {pageCount}
            </p>
            <p>
              <span className="font-semibold text-slate-900">Chapters:</span>{" "}
              {chapterCount}
            </p>
            <p>
              <span className="font-semibold text-slate-900">Estimate:</span>{" "}
              {estimatedPrice}
            </p>
          </div>
        </article>

        <article className="soft-card rounded-[28px] p-5">
          <p className="eyebrow text-[11px] font-semibold">Shipping form placeholder</p>
          {draft ? (
            <p className="mt-3 text-sm leading-6 text-slate-600">
              The form stays lightweight here, but it is now clearly anchored to a real
              imported trip draft rather than a static mock.
            </p>
          ) : null}
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            {["Recipient name", "Phone number", "Postal code", "Address line 1", "Address line 2", "Delivery note"].map(
              (field) => (
                <div
                  key={field}
                  className="rounded-2xl border border-[var(--line)] bg-white/80 px-4 py-4 text-sm text-slate-500"
                >
                  {field}
                </div>
              ),
            )}
          </div>
          {draft ? (
            <button
              type="button"
              className="mt-5 w-full rounded-[24px] bg-slate-950 px-5 py-4 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-400"
              onClick={handleComposeBook}
              disabled={isComposing}
            >
              {isComposing
                ? "Sweetbook 테스트 책 생성 중..."
                : "Sweetbook 테스트 책 생성"}
            </button>
          ) : (
            <div className="mt-5 rounded-[24px] bg-slate-950 px-5 py-4 text-sm font-semibold text-white">
              Finalize book, request estimate, and place order
            </div>
          )}

          {composeResult ? (
            <div className="mt-4 rounded-[24px] border border-emerald-200 bg-emerald-50 px-5 py-4 text-sm text-emerald-800">
              테스트 책 생성이 완료됐어요. `bookUid`는{" "}
              <span className="font-semibold">{composeResult.bookUid}</span> 입니다.
            </div>
          ) : null}

          {composeError ? (
            <div className="mt-4 rounded-[24px] border border-rose-200 bg-rose-50 px-5 py-4 text-sm text-rose-700">
              {composeError}
            </div>
          ) : null}
        </article>
      </div>
    </AppShell>
  );
}
