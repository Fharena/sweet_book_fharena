import { NextResponse } from "next/server";

import { recordWebhookReceipt } from "@/lib/server/webhook-receipts";
import { verifySweetbookWebhookSignature } from "@/lib/server/sweetbook/webhooks";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const payload = await request.text();
  const secretKey = process.env.SWEETBOOK_WEBHOOK_SECRET;

  const signature = request.headers.get("x-webhook-signature");
  const timestamp = request.headers.get("x-webhook-timestamp");
  const eventType = request.headers.get("x-webhook-event");
  const deliveryUid = request.headers.get("x-webhook-delivery");

  let body: unknown = null;
  try {
    body = JSON.parse(payload);
  } catch {
    body = payload;
  }

  if (!secretKey) {
    await recordWebhookReceipt({
      eventType,
      deliveryUid,
      verificationStatus: "missing-secret",
      parsedBody: body,
      payload,
    });

    return NextResponse.json(
      { error: "SWEETBOOK_WEBHOOK_SECRET is not configured." },
      { status: 500 },
    );
  }

  const isValid = verifySweetbookWebhookSignature({
    payload,
    signature,
    timestamp,
    secretKey,
  });

  if (!isValid) {
    await recordWebhookReceipt({
      eventType,
      deliveryUid,
      verificationStatus: "invalid-signature",
      parsedBody: body,
      payload,
    });

    return NextResponse.json({ error: "Invalid signature." }, { status: 401 });
  }

  const receipt = await recordWebhookReceipt({
    eventType,
    deliveryUid,
    verificationStatus: "verified",
    parsedBody: body,
    payload,
  });

  return NextResponse.json({
    received: true,
    eventType,
    deliveryUid,
    receiptUid: receipt.receiptUid,
    body,
  });
}
