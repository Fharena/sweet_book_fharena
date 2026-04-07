import { NextResponse } from "next/server";

import type { ImportedPhoto, TripIntakeResult } from "@/lib/trip-domain";
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
    for (const operation of plan.operations.filter((entry) => entry.kind !== "cover")) {
      if (operation.kind === "divider") {
        contentResults.push(
          await sweetbookClient.insertContent(
            bookUid,
            operation.templateUid,
            replacePhotoReferences(
              operation.parameters as JsonLike,
              uploadedFileNamesByPhotoId,
            ) as Record<string, unknown>,
          ),
        );
        continue;
      }

      if (operation.kind !== "publish") {
        for (const photoId of operation.photoIds ?? []) {
          if (!photoById.has(photoId)) {
            throw new Error(`Photo ${photoId} referenced by the plan is missing.`);
          }
        }
      }

      contentResults.push(
        await sweetbookClient.insertContent(
          bookUid,
          operation.templateUid,
          replacePhotoReferences(
            operation.parameters as JsonLike,
            uploadedFileNamesByPhotoId,
          ) as Record<string, unknown>,
          [],
          undefined,
          operation.kind === "publish" ? "photo" : "photos",
        ),
      );
    }

    const finalizedBook = await sweetbookClient.finalizeBook(bookUid);

    return NextResponse.json({
      bookUid,
      plan,
      steps: {
        createdBook,
        coverResult,
        contentResults,
        finalizedBook,
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
