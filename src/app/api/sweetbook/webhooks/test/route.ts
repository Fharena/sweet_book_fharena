import { NextResponse } from "next/server";

import { sweetbookClient } from "@/lib/server/sweetbook/client";
import type { SweetbookWebhookEvent } from "@/lib/trip-domain";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { eventType?: SweetbookWebhookEvent };

    if (!body.eventType) {
      return NextResponse.json(
        { error: "eventType is required." },
        { status: 400 },
      );
    }

    const data = await sweetbookClient.sendWebhookTest(body.eventType);
    return NextResponse.json(data);
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to trigger webhook test.",
      },
      { status: 500 },
    );
  }
}
