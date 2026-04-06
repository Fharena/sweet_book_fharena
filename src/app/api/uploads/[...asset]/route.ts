import { NextResponse } from "next/server";

import { readUploadedAsset } from "@/lib/server/uploads";

export const runtime = "nodejs";

export async function GET(
  _request: Request,
  context: { params: Promise<{ asset: string[] }> },
) {
  try {
    const { asset } = await context.params;
    const assetId = asset.join("/");
    const uploadedAsset = await readUploadedAsset(assetId);

    return new NextResponse(uploadedAsset.buffer, {
      headers: {
        "Content-Type": uploadedAsset.mimeType,
        "Cache-Control": "private, max-age=60",
      },
    });
  } catch {
    return NextResponse.json({ error: "Uploaded asset not found." }, { status: 404 });
  }
}
