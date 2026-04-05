import { NextResponse } from "next/server";

import { sweetbookClient } from "@/lib/server/sweetbook/client";
import type { SweetbookWebhookEvent } from "@/lib/trip-domain";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);

  try {
    const data = await sweetbookClient.listWebhookDeliveries({
      status:
        (searchParams.get("status") as
          | "PENDING"
          | "SUCCESS"
          | "FAILED"
          | "EXHAUSTED"
          | null) ?? undefined,
      eventType:
        (searchParams.get("eventType") as SweetbookWebhookEvent | null) ??
        undefined,
      limit: searchParams.get("limit")
        ? Number(searchParams.get("limit"))
        : undefined,
    });

    return NextResponse.json(data);
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to fetch webhook deliveries.",
      },
      { status: 500 },
    );
  }
}
