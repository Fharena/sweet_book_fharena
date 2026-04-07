"use client";

import { useEffect, useMemo, useState } from "react";

import { travelPhotobookPreset } from "@/lib/sweetbook-catalog";
import {
  estimateDisplayPriceForBookSpec,
  extractSweetbookBookSpecs,
  findSweetbookBookSpec,
  formatBookSpecDimension,
  formatBookSpecLabel,
  formatPageRuleSummary,
  normalizePageCountForBookSpec,
  type SweetbookEnvironment,
  type SweetbookBookSpec,
} from "@/lib/sweetbook-book-specs";
import type { TripDraft } from "@/lib/trip-draft";
import type { SweetbookBookPlan } from "@/lib/trip-domain";

type ProductMetaState = {
  bookSpecs: SweetbookBookSpec[];
  plan: SweetbookBookPlan | null;
  environment: SweetbookEnvironment;
  isLoading: boolean;
  error: string | null;
};

export function useSweetbookProductMeta(
  draft: TripDraft | null,
  requestedPageCount: number,
) {
  const [state, setState] = useState<ProductMetaState>({
    bookSpecs: [],
    plan: null,
    environment: "sandbox",
    isLoading: Boolean(draft),
    error: null,
  });

  useEffect(() => {
    let isCancelled = false;

    async function loadMetadata() {
      setState((current) => ({
        ...current,
        isLoading: true,
        error: null,
      }));

      try {
        const [bookSpecsResponse, planResponse] = await Promise.all([
          fetch("/api/sweetbook/book-specs", {
            cache: "no-store",
          }),
          draft
            ? fetch("/api/sweetbook/books/plan", {
                method: "POST",
                headers: {
                  "Content-Type": "application/json",
                },
                body: JSON.stringify(draft),
              })
            : Promise.resolve(null),
        ]);

        const bookSpecsPayload = (await bookSpecsResponse.json()) as unknown;
        if (!bookSpecsResponse.ok) {
          throw new Error("Sweetbook 상품 규격을 불러오지 못했습니다.");
        }

        const nextBookSpecs = extractSweetbookBookSpecs(bookSpecsPayload);
        const nextEnvironment =
          typeof (bookSpecsPayload as { env?: unknown }).env === "string" &&
          (bookSpecsPayload as { env?: unknown }).env === "live"
            ? "live"
            : "sandbox";
        let nextPlan: SweetbookBookPlan | null = null;

        if (planResponse) {
          const planPayload = (await planResponse.json()) as SweetbookBookPlan & {
            error?: string;
          };

          if (!planResponse.ok) {
            throw new Error(planPayload.error ?? "Sweetbook 조립 계획을 불러오지 못했습니다.");
          }

          nextPlan = planPayload;
        }

        if (!isCancelled) {
          setState({
            bookSpecs: nextBookSpecs,
            plan: nextPlan,
            environment: nextEnvironment,
            isLoading: false,
            error: null,
          });
        }
      } catch (error) {
        if (!isCancelled) {
          setState((current) => ({
            ...current,
            isLoading: false,
            error:
              error instanceof Error
                ? error.message
                : "Sweetbook 메타데이터를 불러오는 중 오류가 발생했습니다.",
          }));
        }
      }
    }

    void loadMetadata();

    return () => {
      isCancelled = true;
    };
  }, [draft]);

  const resolvedBookSpecUid = state.plan?.bookSpecUid ?? travelPhotobookPreset.bookSpecUid;
  const resolvedBookSpec = useMemo(
    () => findSweetbookBookSpec(state.bookSpecs, resolvedBookSpecUid),
    [resolvedBookSpecUid, state.bookSpecs],
  );
  const pageCount = normalizePageCountForBookSpec(requestedPageCount, resolvedBookSpec);
  const estimatedPrice = estimateDisplayPriceForBookSpec(
    pageCount,
    resolvedBookSpec,
    state.environment,
  );
  const productLabel = formatBookSpecLabel(resolvedBookSpec, travelPhotobookPreset.label);
  const pageRuleSummary = formatPageRuleSummary(resolvedBookSpec);
  const productDimension = formatBookSpecDimension(resolvedBookSpec);
  const coverSummary = resolvedBookSpec?.coverType
    ? `${resolvedBookSpec.coverType} / ${resolvedBookSpec.bindingType || "제본"}`
    : "제본 정보 확인 중";

  return {
    plan: state.plan,
    bookSpec: resolvedBookSpec,
    isLoading: state.isLoading,
    error: state.error,
    productLabel,
    productDimension,
    pageRuleSummary,
    coverSummary,
    pageCount,
    estimatedPrice,
    environment: state.environment,
    isNormalizedPageCount: pageCount !== requestedPageCount,
  };
}
