import { NextResponse } from "next/server";

import { listWebhookReceipts } from "@/lib/server/webhook-receipts";

export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const limitParam = searchParams.get("limit");
    const statusParam = searchParams.get("status");
    const deliveryUid = searchParams.get("deliveryUid");
    const duplicateOnly = searchParams.get("duplicateOnly");
    const normalizedStatus =
      statusParam === "verified" ||
      statusParam === "invalid-signature" ||
      statusParam === "missing-secret"
        ? statusParam
        : "all";
    const normalizedLimit = limitParam ? Number(limitParam) : 20;

    const payload = await listWebhookReceipts({
      limit: Number.isFinite(normalizedLimit) ? normalizedLimit : 20,
      status: normalizedStatus,
      deliveryUid,
      duplicateOnly: duplicateOnly === "true",
    });

    return NextResponse.json({
      data: {
        items: payload.items,
        summary: payload.summary,
      },
    });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "웹훅 수신 이력을 불러오지 못했습니다.",
      },
      { status: 500 },
    );
  }
}
