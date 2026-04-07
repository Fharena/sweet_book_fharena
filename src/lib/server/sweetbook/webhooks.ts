import { createHmac, timingSafeEqual } from "node:crypto";

export function verifySweetbookWebhookSignature({
  payload,
  signature,
  timestamp,
  secretKey,
}: {
  payload: string;
  signature: string | null;
  timestamp: string | null;
  secretKey: string;
}) {
  if (!signature || !timestamp) {
    return false;
  }

  const signedPayload = `${timestamp}.${payload}`;
  const expectedSignature = `sha256=${createHmac("sha256", secretKey)
    .update(signedPayload)
    .digest("hex")}`;

  const signatureBuffer = Buffer.from(signature);
  const expectedBuffer = Buffer.from(expectedSignature);

  if (signatureBuffer.length !== expectedBuffer.length) {
    return false;
  }

  return timingSafeEqual(signatureBuffer, expectedBuffer);
}
