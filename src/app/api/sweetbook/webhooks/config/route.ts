import { NextResponse } from "next/server";

import { sweetbookClient } from "@/lib/server/sweetbook/client";
import type { SweetbookWebhookEvent } from "@/lib/trip-domain";

export async function GET() {
  try {
    const data = await sweetbookClient.getWebhookConfig();
    return NextResponse.json(data);
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to read webhook config.",
      },
      { status: 500 },
    );
  }
}

export async function PUT(request: Request) {
  try {
    const body = (await request.json()) as {
      webhookUrl?: string;
      events?: SweetbookWebhookEvent[] | null;
      description?: string;
    };

    if (!body.webhookUrl) {
      return NextResponse.json(
        { error: "webhookUrl is required." },
        { status: 400 },
      );
    }

    const data = await sweetbookClient.putWebhookConfig({
      webhookUrl: body.webhookUrl,
      events: body.events ?? null,
      description: body.description,
    });

    return NextResponse.json(data);
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to update webhook config.",
      },
      { status: 500 },
    );
  }
}

export async function DELETE() {
  try {
    const data = await sweetbookClient.deleteWebhookConfig();
    return NextResponse.json(data);
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to disable webhook config.",
      },
      { status: 500 },
    );
  }
}
