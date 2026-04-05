import { NextResponse } from "next/server";

import type { ManualLocationOverride } from "@/lib/trip-domain";
import { persistUploadedFile } from "@/lib/server/uploads";
import { extractPhotoMetadata } from "@/lib/server/trips/exif";
import { groupPhotosIntoTrip } from "@/lib/server/trips/grouping";

export const runtime = "nodejs";

function parseManualOverrides(rawValue: FormDataEntryValue | null) {
  if (typeof rawValue !== "string" || !rawValue.trim()) {
    return new Map<string, ManualLocationOverride>();
  }

  try {
    const overrides = JSON.parse(rawValue) as ManualLocationOverride[];
    return new Map(overrides.map((override) => [override.fileName, override]));
  } catch {
    return new Map<string, ManualLocationOverride>();
  }
}

export async function POST(request: Request) {
  const formData = await request.formData();
  const files = formData
    .getAll("files")
    .filter((entry): entry is File => entry instanceof File && entry.size > 0);

  if (files.length === 0) {
    return NextResponse.json(
      { error: "At least one image file is required." },
      { status: 400 },
    );
  }

  const tripName = String(formData.get("tripName") || "Untitled Trip");
  const travelStart = formData.get("travelStart");
  const travelEnd = formData.get("travelEnd");
  const manualOverrides = parseManualOverrides(formData.get("manualLocations"));
  const draftId = `draft-${Date.now()}-${crypto.randomUUID().slice(0, 8)}`;

  const photos = await Promise.all(
    files.map(async (file, index) => {
      const [assetId, metadata] = await Promise.all([
        persistUploadedFile(file, { draftId, index }),
        extractPhotoMetadata(file, {
          index,
          manualOverrides,
        }),
      ]);

      return {
        ...metadata,
        assetId,
      };
    }),
  );

  const groupedTrip = groupPhotosIntoTrip(
    tripName,
    typeof travelStart === "string" ? travelStart : null,
    typeof travelEnd === "string" ? travelEnd : null,
    photos,
  );

  return NextResponse.json(groupedTrip);
}
