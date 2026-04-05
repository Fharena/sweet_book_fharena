import { NextResponse } from "next/server";

import { sweetbookClient } from "@/lib/server/sweetbook/client";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as Record<string, unknown>;

    if (!Array.isArray(body.items) || body.items.length === 0) {
      return NextResponse.json(
        { error: "items with at least one finalized book is required." },
        { status: 400 },
      );
    }

    if (!body.shipping || typeof body.shipping !== "object") {
      return NextResponse.json(
        { error: "shipping is required." },
        { status: 400 },
      );
    }

    const data = await sweetbookClient.createOrder(body);
    return NextResponse.json(data, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Failed to create order.",
      },
      { status: 500 },
    );
  }
}
