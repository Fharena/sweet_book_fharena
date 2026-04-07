import { NextResponse } from "next/server";

import { sweetbookClient } from "@/lib/server/sweetbook/client";

export async function GET() {
  try {
    const data = await sweetbookClient.listBookSpecs();
    return NextResponse.json({
      ...(typeof data === "object" && data !== null ? data : { data }),
      env: process.env.SWEETBOOK_ENV === "live" ? "live" : "sandbox",
    });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Failed to fetch book specs.",
      },
      { status: 500 },
    );
  }
}
