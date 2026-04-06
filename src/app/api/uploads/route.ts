import { NextResponse } from "next/server";

import { readUploadedAsset } from "@/lib/server/uploads";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const assetId = searchParams.get("assetId");
  const mimeType = searchParams.get("type");
  const fileName = searchParams.get("name");

  if (!assetId?.trim()) {
    return NextResponse.json(
      { error: "assetId query parameter is required." },
      { status: 400 },
    );
  }

  try {
    const asset = await readUploadedAsset(assetId);

    return new NextResponse(asset.buffer, {
      headers: {
        "Content-Type": mimeType || asset.mimeType,
        "Cache-Control": "no-store",
        "Content-Disposition": `inline; filename*=UTF-8''${encodeURIComponent(fileName || asset.fileName)}`,
      },
    });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to load uploaded asset.",
      },
      { status: 404 },
    );
  }
}
