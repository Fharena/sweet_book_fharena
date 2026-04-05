import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import type {
  SweetbookWebhookReceipt,
  SweetbookWebhookVerificationStatus,
} from "@/lib/trip-domain";

const receiptsRoot = path.join(process.cwd(), "tmp", "webhooks");
const receiptsFilePath = path.join(receiptsRoot, "receipts.json");
const maxStoredReceipts = 200;
let writeQueue = Promise.resolve();

type ReceiptInput = {
  eventType: string | null;
  deliveryUid: string | null;
  verificationStatus: SweetbookWebhookVerificationStatus;
  receivedAt?: string;
  parsedBody?: unknown;
  payload?: string | null;
};

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isStoredReceipt(value: unknown): value is SweetbookWebhookReceipt {
  return (
    isObject(value) &&
    typeof value.receiptUid === "string" &&
    (typeof value.eventType === "string" || value.eventType === null) &&
    (typeof value.deliveryUid === "string" || value.deliveryUid === null) &&
    (value.verificationStatus === "verified" ||
      value.verificationStatus === "invalid-signature" ||
      value.verificationStatus === "missing-secret") &&
    typeof value.receivedAt === "string" &&
    (typeof value.orderUid === "string" || value.orderUid === null) &&
    (typeof value.bookUid === "string" || value.bookUid === null) &&
    (typeof value.payloadPreview === "string" || value.payloadPreview === null)
  );
}

async function readReceipts() {
  try {
    const rawValue = await readFile(receiptsFilePath, "utf8");
    const parsed = JSON.parse(rawValue) as unknown;

    if (!Array.isArray(parsed)) {
      return [] as SweetbookWebhookReceipt[];
    }

    return parsed.filter(isStoredReceipt);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return [] as SweetbookWebhookReceipt[];
    }

    throw error;
  }
}

async function writeReceipts(receipts: SweetbookWebhookReceipt[]) {
  await mkdir(receiptsRoot, { recursive: true });
  await writeFile(
    receiptsFilePath,
    JSON.stringify(receipts.slice(0, maxStoredReceipts), null, 2),
    "utf8",
  );
}

function queueWrite<T>(operation: () => Promise<T>) {
  const nextOperation = writeQueue.then(operation, operation);
  writeQueue = nextOperation.then(
    () => undefined,
    () => undefined,
  );
  return nextOperation;
}

function firstString(values: unknown[]) {
  for (const value of values) {
    if (typeof value === "string" && value.trim()) {
      return value.trim();
    }
  }

  return null;
}

function extractReferenceIds(parsedBody: unknown) {
  if (!isObject(parsedBody)) {
    return { orderUid: null, bookUid: null };
  }

  const orderUid = firstString([
    parsedBody.orderUid,
    isObject(parsedBody.order) ? parsedBody.order.orderUid : null,
    isObject(parsedBody.data) ? parsedBody.data.orderUid : null,
  ]);

  const bookUid = firstString([
    parsedBody.bookUid,
    isObject(parsedBody.book) ? parsedBody.book.bookUid : null,
    isObject(parsedBody.data) ? parsedBody.data.bookUid : null,
    Array.isArray(parsedBody.items) && parsedBody.items.length > 0 && isObject(parsedBody.items[0])
      ? parsedBody.items[0].bookUid
      : null,
  ]);

  return { orderUid, bookUid };
}

function buildPayloadPreview(parsedBody: unknown, payload: string | null | undefined) {
  if (isObject(parsedBody)) {
    const parts = [
      typeof parsedBody.status === "string" ? `status=${parsedBody.status}` : null,
      typeof parsedBody.message === "string" ? `message=${parsedBody.message}` : null,
      isObject(parsedBody.order) && typeof parsedBody.order.statusDisplay === "string"
        ? `order=${parsedBody.order.statusDisplay}`
        : null,
    ].filter((value): value is string => Boolean(value));

    if (parts.length > 0) {
      return parts.join(" / ").slice(0, 220);
    }
  }

  if (!payload) {
    return null;
  }

  return payload.replace(/\s+/g, " ").slice(0, 220);
}

export async function recordWebhookReceipt(input: ReceiptInput) {
  return queueWrite(async () => {
    const receipts = await readReceipts();
    const ids = extractReferenceIds(input.parsedBody);

    const nextReceipt: SweetbookWebhookReceipt = {
      receiptUid: crypto.randomUUID(),
      eventType: input.eventType,
      deliveryUid: input.deliveryUid,
      verificationStatus: input.verificationStatus,
      receivedAt: input.receivedAt ?? new Date().toISOString(),
      orderUid: ids.orderUid,
      bookUid: ids.bookUid,
      payloadPreview: buildPayloadPreview(input.parsedBody, input.payload),
    };

    await writeReceipts([nextReceipt, ...receipts]);
    return nextReceipt;
  });
}

export async function listWebhookReceipts(limit = 20) {
  const receipts = await readReceipts();
  const normalizedLimit = Math.min(Math.max(limit, 1), 100);
  return receipts.slice(0, normalizedLimit);
}
