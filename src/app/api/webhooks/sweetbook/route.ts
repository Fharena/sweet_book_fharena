import { NextResponse } from "next/server";

import { verifySweetbookWebhookSignature } from "@/lib/server/sweetbook/webhooks";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const payload = await request.text();
  const secretKey = process.env.SWEETBOOK_WEBHOOK_SECRET;

  if (!secretKey) {
    return NextResponse.json(
      { error: "SWEETBOOK_WEBHOOK_SECRET is not configured." },
      { status: 500 },
    );
  }

  const signature = request.headers.get("x-webhook-signature");
  const timestamp = request.headers.get("x-webhook-timestamp");
  const eventType = request.headers.get("x-webhook-event");
  const deliveryUid = request.headers.get("x-webhook-delivery");

  const isValid = verifySweetbookWebhookSignature({
    payload,
    signature,
    timestamp,
    secretKey,
  });

  if (!isValid) {
    return NextResponse.json({ error: "Invalid signature." }, { status: 401 });
  }

  let body: unknown = null;
  try {
    body = JSON.parse(payload);
  } catch {
    body = payload;
  }

  return NextResponse.json({
    received: true,
    eventType,
    deliveryUid,
    body,
  });
}
