import { NextResponse } from "next/server";

import type { TripIntakeResult } from "@/lib/trip-domain";
import { buildSweetbookTravelBookPlan } from "@/lib/server/sweetbook/book-plan";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as TripIntakeResult;

    if (!body.tripName || !Array.isArray(body.chapters) || !Array.isArray(body.photos)) {
      return NextResponse.json(
        { error: "A valid trip intake payload is required." },
        { status: 400 },
      );
    }

    const plan = buildSweetbookTravelBookPlan(body);
    return NextResponse.json(plan);
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to build Sweetbook book plan.",
      },
      { status: 500 },
    );
  }
}
