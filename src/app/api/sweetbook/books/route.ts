import { NextResponse } from "next/server";

import { sweetbookClient } from "@/lib/server/sweetbook/client";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      bookSpecUid?: string;
      title?: string;
      creationType?: "TEST" | "NORMAL";
      specProfileUid?: string;
      externalRef?: string;
    };

    if (!body.bookSpecUid) {
      return NextResponse.json(
        { error: "bookSpecUid is required." },
        { status: 400 },
      );
    }

    const data = await sweetbookClient.createBook({
      bookSpecUid: body.bookSpecUid,
      title: body.title,
      creationType: body.creationType,
      specProfileUid: body.specProfileUid,
      externalRef: body.externalRef,
    });

    return NextResponse.json(data, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Failed to create book.",
      },
      { status: 500 },
    );
  }
}
