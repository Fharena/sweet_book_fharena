import { NextResponse } from "next/server";

import { listWebhookReceipts } from "@/lib/server/webhook-receipts";

export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const limitParam = searchParams.get("limit");
    const limit = limitParam ? Number(limitParam) : 20;

    const items = await listWebhookReceipts(limit);

    return NextResponse.json({
      data: {
        items,
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
