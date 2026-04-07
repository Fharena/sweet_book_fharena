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

export type WebhookReceiptStatusFilter =
  | SweetbookWebhookVerificationStatus
  | "all";

export type WebhookReceiptListItem = {
  receiptUid: string;
  receiptGroupUid: string;
  eventType: string | null;
  deliveryUid: string | null;
  verificationStatus: SweetbookWebhookVerificationStatus;
  verificationSummary: string;
  receivedAt: string;
  latestReceivedAt: string;
  orderUid: string | null;
  bookUid: string | null;
  payloadPreview: string | null;
  receiptCount: number;
  duplicateCount: number;
  hasDuplicateReceipts: boolean;
  statusCounts: Record<SweetbookWebhookVerificationStatus, number>;
};

export type WebhookReceiptSummary = {
  totalReceipts: number;
  uniqueDeliveryCount: number;
  duplicateDeliveryCount: number;
  duplicateGroupCount: number;
  verifiedReceiptCount: number;
  invalidReceiptCount: number;
  missingSecretCount: number;
};

type WebhookReceiptQuery = {
  limit?: number;
  status?: WebhookReceiptStatusFilter;
  deliveryUid?: string | null;
  orderUid?: string | null;
  bookUid?: string | null;
  duplicateOnly?: boolean;
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

function getLatestReceivedAt(receipts: SweetbookWebhookReceipt[]) {
  return [...receipts].sort(
    (left, right) =>
      new Date(right.receivedAt).getTime() - new Date(left.receivedAt).getTime(),
  )[0]?.receivedAt;
}

function getAggregateStatus(
  statusCounts: Record<SweetbookWebhookVerificationStatus, number>,
) {
  if (statusCounts["missing-secret"] > 0) {
    return "missing-secret";
  }

  if (statusCounts["invalid-signature"] > 0) {
    return "invalid-signature";
  }

  return "verified";
}

function getStatusLabel(status: SweetbookWebhookVerificationStatus) {
  switch (status) {
    case "verified":
      return "검증 완료";
    case "invalid-signature":
      return "검증 실패";
    case "missing-secret":
      return "시크릿 미설정";
  }
}

function groupReceipts(receipts: SweetbookWebhookReceipt[]) {
  const groups = new Map<string, SweetbookWebhookReceipt[]>();

  for (const receipt of receipts) {
    const groupKey = receipt.deliveryUid?.trim() || `receipt:${receipt.receiptUid}`;
    const current = groups.get(groupKey);
    if (current) {
      current.push(receipt);
    } else {
      groups.set(groupKey, [receipt]);
    }
  }

  return Array.from(groups.entries())
    .map(([groupKey, groupedReceipts]) => {
      const sortedReceipts = [...groupedReceipts].sort(
        (left, right) =>
          new Date(right.receivedAt).getTime() - new Date(left.receivedAt).getTime(),
      );
      const latestReceipt = sortedReceipts[0];
      const statusCounts: Record<SweetbookWebhookVerificationStatus, number> = {
        verified: 0,
        "invalid-signature": 0,
        "missing-secret": 0,
      };

      for (const receipt of sortedReceipts) {
        statusCounts[receipt.verificationStatus] += 1;
      }

      const verificationStatus = getAggregateStatus(statusCounts);
      const duplicateCount = Math.max(sortedReceipts.length - 1, 0);

      return {
        receiptUid: latestReceipt.receiptUid,
        receiptGroupUid: groupKey,
        eventType: latestReceipt.eventType,
        deliveryUid: latestReceipt.deliveryUid,
        verificationStatus,
        verificationSummary: getStatusLabel(verificationStatus),
        receivedAt: latestReceipt.receivedAt,
        latestReceivedAt: getLatestReceivedAt(sortedReceipts) ?? latestReceipt.receivedAt,
        orderUid: latestReceipt.orderUid,
        bookUid: latestReceipt.bookUid,
        payloadPreview: latestReceipt.payloadPreview,
        receiptCount: sortedReceipts.length,
        duplicateCount,
        hasDuplicateReceipts: duplicateCount > 0,
        statusCounts,
      } satisfies WebhookReceiptListItem;
    })
    .sort(
      (left, right) =>
        new Date(right.latestReceivedAt).getTime() - new Date(left.latestReceivedAt).getTime(),
    );
}

function buildSummary(receipts: SweetbookWebhookReceipt[], grouped: WebhookReceiptListItem[]) {
  const summary: WebhookReceiptSummary = {
    totalReceipts: receipts.length,
    uniqueDeliveryCount: grouped.length,
    duplicateDeliveryCount: grouped.reduce((acc, item) => acc + item.duplicateCount, 0),
    duplicateGroupCount: grouped.filter((item) => item.hasDuplicateReceipts).length,
    verifiedReceiptCount: 0,
    invalidReceiptCount: 0,
    missingSecretCount: 0,
  };

  for (const receipt of receipts) {
    switch (receipt.verificationStatus) {
      case "verified":
        summary.verifiedReceiptCount += 1;
        break;
      case "invalid-signature":
        summary.invalidReceiptCount += 1;
        break;
      case "missing-secret":
        summary.missingSecretCount += 1;
        break;
    }
  }

  return summary;
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

export async function listWebhookReceipts(query: WebhookReceiptQuery = {}) {
  const receipts = await readReceipts();
  const normalizedLimit = Math.min(Math.max(query.limit ?? 20, 1), 100);
  const normalizedDeliveryUid = query.deliveryUid?.trim();
  const normalizedOrderUid = query.orderUid?.trim();
  const normalizedBookUid = query.bookUid?.trim();
  const normalizedStatus = query.status ?? "all";

  const filteredReceipts = receipts.filter((receipt) => {
    if (normalizedDeliveryUid && receipt.deliveryUid !== normalizedDeliveryUid) {
      return false;
    }

    if (normalizedOrderUid && receipt.orderUid !== normalizedOrderUid) {
      return false;
    }

    if (normalizedBookUid && receipt.bookUid !== normalizedBookUid) {
      return false;
    }

    if (normalizedStatus !== "all" && receipt.verificationStatus !== normalizedStatus) {
      return false;
    }

    return true;
  });

  const groupedReceipts = groupReceipts(filteredReceipts);
  const filteredGroupedReceipts =
    query.duplicateOnly === true
      ? groupedReceipts.filter((item) => item.hasDuplicateReceipts)
      : groupedReceipts;

  return {
    items: filteredGroupedReceipts.slice(0, normalizedLimit),
    summary: buildSummary(filteredReceipts, filteredGroupedReceipts),
  };
}
