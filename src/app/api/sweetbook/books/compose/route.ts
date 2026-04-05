import { NextResponse } from "next/server";

import type { ImportedPhoto, TripIntakeResult } from "@/lib/trip-domain";
import { buildSweetbookTravelBookPlan } from "@/lib/server/sweetbook/book-plan";
import { sweetbookClient } from "@/lib/server/sweetbook/client";
import { loadUploadedFile } from "@/lib/server/uploads";

export const runtime = "nodejs";

function requirePhotoAsset(photo: ImportedPhoto) {
  if (!photo.assetId) {
    throw new Error(`Photo ${photo.fileName} is missing a stored assetId.`);
  }

  return loadUploadedFile(photo.assetId, {
    fileName: photo.originalName,
    mimeType: photo.mimeType,
  });
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
      creationType: "TEST",
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

    const coverOperation = plan.operations.find((operation) => operation.kind === "cover");
    if (!coverOperation) {
      throw new Error("Cover operation is missing from the generated plan.");
    }

    const coverPhoto = draft.photos[0];
    const coverFile = await requirePhotoAsset(coverPhoto);
    const coverResult = await sweetbookClient.createCover(
      bookUid,
      coverOperation.templateUid,
      coverOperation.parameters,
      [coverFile],
      "coverPhoto",
    );

    const contentResults = [];
    for (const operation of plan.operations.filter((entry) => entry.kind !== "cover")) {
      if (operation.kind === "divider") {
        contentResults.push(
          await sweetbookClient.insertContent(
            bookUid,
            operation.templateUid,
            operation.parameters,
          ),
        );
        continue;
      }

      if (operation.kind === "publish") {
        const publishFile = await requirePhotoAsset(coverPhoto);
        contentResults.push(
          await sweetbookClient.insertContent(
            bookUid,
            operation.templateUid,
            operation.parameters,
            [publishFile],
            undefined,
            "photo",
          ),
        );
        continue;
      }

      const files = await Promise.all(
        (operation.photoIds ?? []).map(async (photoId) => {
          const photo = photoById.get(photoId);
          if (!photo) {
            throw new Error(`Photo ${photoId} referenced by the plan is missing.`);
          }

          return requirePhotoAsset(photo);
        }),
      );

      contentResults.push(
        await sweetbookClient.insertContent(
          bookUid,
          operation.templateUid,
          operation.parameters,
          files,
          undefined,
          "photos",
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
