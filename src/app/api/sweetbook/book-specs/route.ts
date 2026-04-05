import { NextResponse } from "next/server";

import { sweetbookClient } from "@/lib/server/sweetbook/client";

export async function GET() {
  try {
    const data = await sweetbookClient.listBookSpecs();
    return NextResponse.json(data);
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
