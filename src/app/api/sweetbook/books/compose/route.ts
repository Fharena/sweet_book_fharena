import { NextResponse } from "next/server";

import type { ImportedPhoto, TripIntakeResult } from "@/lib/trip-domain";
import { travelPhotobookPreset } from "@/lib/sweetbook-catalog";
import {
  estimateRequestedTravelPages,
  extractSweetbookBookSpecs,
  findSweetbookBookSpec,
  normalizePageCountForBookSpec,
} from "@/lib/sweetbook-book-specs";
import { buildSweetbookTravelBookPlan } from "@/lib/server/sweetbook/book-plan";
import { sweetbookClient } from "@/lib/server/sweetbook/client";
import { loadUploadedFile } from "@/lib/server/uploads";

export const runtime = "nodejs";

type JsonLike =
  | string
  | number
  | boolean
  | null
  | JsonLike[]
  | { [key: string]: JsonLike };

function requirePhotoAsset(photo: ImportedPhoto) {
  if (!photo.assetId) {
    throw new Error(`Photo ${photo.fileName} is missing a stored assetId.`);
  }

  return loadUploadedFile(photo.assetId, {
    fileName: photo.originalName,
    mimeType: photo.mimeType,
  });
}

function replacePhotoReferences(
  value: JsonLike,
  uploadedFileNamesByPhotoId: Map<string, string>,
): JsonLike {
  if (typeof value === "string") {
    return uploadedFileNamesByPhotoId.get(value) ?? value;
  }

  if (Array.isArray(value)) {
    return value.map((item) => replacePhotoReferences(item, uploadedFileNamesByPhotoId));
  }

  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).map(([key, nestedValue]) => [
        key,
        replacePhotoReferences(nestedValue as JsonLike, uploadedFileNamesByPhotoId),
      ]),
    );
  }

  return value;
}

function extractPageCount(payload: unknown) {
  if (!payload || typeof payload !== "object") {
    return null;
  }

  const data =
    "data" in payload && payload.data && typeof payload.data === "object"
      ? (payload.data as Record<string, unknown>)
      : null;

  const candidate = data?.pageCount;
  return typeof candidate === "number" && Number.isFinite(candidate) ? candidate : null;
}

function buildFillerParameters(fileNames: string[], sequence: number) {
  return {
    dayLabel: `Triplogue Archive ${String(sequence).padStart(2, "0")}`,
    photos: fileNames,
  };
}

export async function POST(request: Request) {
  try {
    const draft = (await request.json()) as TripIntakeResult;

    if (!draft.tripName || !Array.isArray(draft.photos) || !Array.isArray(draft.chapters)) {
      return NextResponse.json(
        { error: "A valid trip draft payload is required." },
        { status: 400 },
      );
    }

    if (draft.photos.length === 0) {
      return NextResponse.json(
        { error: "At least one imported photo is required to compose a book." },
        { status: 400 },
      );
    }

    const plan = buildSweetbookTravelBookPlan(draft);
    const photoById = new Map(draft.photos.map((photo) => [photo.id, photo]));
    const bookSpecsPayload = await sweetbookClient.listBookSpecs();
    const resolvedBookSpec = findSweetbookBookSpec(
      extractSweetbookBookSpecs(bookSpecsPayload),
      plan.bookSpecUid,
    );
    const requestedPageCount = estimateRequestedTravelPages(
      draft.photos.length,
      draft.chapters.length,
    );
    const targetPageCount = normalizePageCountForBookSpec(
      requestedPageCount,
      resolvedBookSpec,
    );

    const createdBook = await sweetbookClient.createBook({
      bookSpecUid: plan.bookSpecUid,
      title: plan.title,
    });
    const createdBookRecord = createdBook as {
      data?: { bookUid?: string };
      bookUid?: string;
    };

    const bookUid =
      createdBookRecord.data?.bookUid ?? createdBookRecord.bookUid;

    if (!bookUid || typeof bookUid !== "string") {
      throw new Error("Sweetbook book creation did not return bookUid.");
    }

    const uploadedFileNamesByPhotoId = new Map<string, string>();
    const uploadedFileNames: string[] = [];
    for (const photo of draft.photos) {
      const file = await requirePhotoAsset(photo);
      const uploadResult = (await sweetbookClient.uploadPhoto(bookUid, file)) as {
        data?: { fileName?: string };
        fileName?: string;
      };
      const uploadedFileName = uploadResult.data?.fileName ?? uploadResult.fileName;

      if (!uploadedFileName || typeof uploadedFileName !== "string") {
        throw new Error(`Photo upload for ${photo.fileName} did not return fileName.`);
      }

      uploadedFileNamesByPhotoId.set(photo.id, uploadedFileName);
      uploadedFileNames.push(uploadedFileName);
    }

    const coverOperation = plan.operations.find((operation) => operation.kind === "cover");
    if (!coverOperation) {
      throw new Error("Cover operation is missing from the generated plan.");
    }

    const coverResult = await sweetbookClient.createCover(
      bookUid,
      coverOperation.templateUid,
      replacePhotoReferences(
        coverOperation.parameters as JsonLike,
        uploadedFileNamesByPhotoId,
      ) as Record<string, unknown>,
      [],
      "coverPhoto",
    );

    const contentResults = [];
    let currentPageCount = extractPageCount(coverResult) ?? 0;
    for (const operation of plan.operations.filter((entry) => entry.kind !== "cover")) {
      if (operation.kind === "divider") {
        const dividerResult = await sweetbookClient.insertContent(
          bookUid,
          operation.templateUid,
          replacePhotoReferences(
            operation.parameters as JsonLike,
            uploadedFileNamesByPhotoId,
          ) as Record<string, unknown>,
        );
        contentResults.push(dividerResult);
        currentPageCount = extractPageCount(dividerResult) ?? currentPageCount;
        continue;
      }

      if (operation.kind !== "publish") {
        for (const photoId of operation.photoIds ?? []) {
          if (!photoById.has(photoId)) {
            throw new Error(`Photo ${photoId} referenced by the plan is missing.`);
          }
        }
      }

      const contentResult = await sweetbookClient.insertContent(
        bookUid,
        operation.templateUid,
        replacePhotoReferences(
          operation.parameters as JsonLike,
          uploadedFileNamesByPhotoId,
        ) as Record<string, unknown>,
        [],
        undefined,
        operation.kind === "publish" ? "photo" : "photos",
      );
      contentResults.push(contentResult);
      currentPageCount = extractPageCount(contentResult) ?? currentPageCount;
    }

    const fillerResults = [];
    if (uploadedFileNames.length === 0) {
      throw new Error("Sweetbook compose requires at least one uploaded photo fileName.");
    }

    const fillerPhotoSet = uploadedFileNames.slice(0, Math.min(4, uploadedFileNames.length));
    let fillerAttempt = 0;
    while (currentPageCount < targetPageCount) {
      fillerAttempt += 1;
      const fillerResult = await sweetbookClient.insertContent(
        bookUid,
        travelPhotobookPreset.templates.contentSecondary,
        buildFillerParameters(fillerPhotoSet, fillerAttempt),
        [],
        "page",
        "photos",
      );
      fillerResults.push(fillerResult);

      const nextPageCount = extractPageCount(fillerResult);
      if (nextPageCount === null || nextPageCount <= currentPageCount) {
        throw new Error(
          `자동 페이지 보정 실패: 현재 ${currentPageCount}p에서 더 증가하지 않았습니다.`,
        );
      }

      currentPageCount = nextPageCount;

      if (fillerAttempt > 64) {
        throw new Error("자동 페이지 보정이 너무 많이 반복되어 중단했습니다.");
      }
    }

    const finalizedBook = await sweetbookClient.finalizeBook(bookUid);

    return NextResponse.json({
      bookUid,
      plan,
      steps: {
        createdBook,
        coverResult,
        contentResults,
        fillerResults,
        finalizedBook,
      },
      pageCountSummary: {
        requestedPageCount,
        targetPageCount,
        actualPageCountBeforeFinalization: currentPageCount,
        fillerInsertions: fillerResults.length,
      },
    });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Failed to compose Sweetbook book.",
      },
      { status: 500 },
    );
  }
}
