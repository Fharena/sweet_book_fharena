import { NextResponse } from "next/server";

import { sweetbookClient } from "@/lib/server/sweetbook/client";

export const runtime = "nodejs";

function resolveEnvironment() {
  return process.env.SWEETBOOK_ENV === "live" ? "live" : "sandbox";
}

function hasApiKey() {
  return Boolean(process.env.SWEETBOOK_API_KEY?.trim());
}

function countBookSpecs(payload: unknown): number | null {
  if (Array.isArray(payload)) {
    return payload.length;
  }

  if (typeof payload !== "object" || payload === null) {
    return null;
  }

  const record = payload as Record<string, unknown>;
  const candidates = [
    record.items,
    record.bookSpecs,
    record.results,
    record.data,
    typeof record.data === "object" && record.data !== null
      ? (record.data as Record<string, unknown>).items
      : null,
    typeof record.data === "object" && record.data !== null
      ? (record.data as Record<string, unknown>).bookSpecs
      : null,
  ];

  for (const candidate of candidates) {
    if (Array.isArray(candidate)) {
      return candidate.length;
    }
  }

  return null;
}

function extractWebhookUrl(payload: unknown) {
  if (typeof payload !== "object" || payload === null) {
    return null;
  }

  const record = payload as Record<string, unknown>;
  if (typeof record.webhookUrl === "string" && record.webhookUrl.trim()) {
    return record.webhookUrl.trim();
  }

  if (typeof record.data === "object" && record.data !== null) {
    const data = record.data as Record<string, unknown>;
    if (typeof data.webhookUrl === "string" && data.webhookUrl.trim()) {
      return data.webhookUrl.trim();
    }
  }

  return null;
}

export async function GET() {
  const environment = resolveEnvironment();
  const apiKeyConfigured = hasApiKey();

  if (!apiKeyConfigured) {
    return NextResponse.json({
      data: {
        environment,
        apiKeyConfigured,
        bookSpecsReachable: false,
        bookSpecCount: null,
        webhookConfigured: false,
        webhookUrl: null,
        notes: ["SWEETBOOK_API_KEY가 설정되지 않아 상태 점검을 건너뛰었습니다."],
        checkedAt: new Date().toISOString(),
      },
    });
  }

  const [bookSpecsResult, webhookConfigResult] = await Promise.allSettled([
    sweetbookClient.listBookSpecs(),
    sweetbookClient.getWebhookConfig(),
  ]);

  const notes: string[] = [];
  const bookSpecsReachable = bookSpecsResult.status === "fulfilled";
  const bookSpecCount =
    bookSpecsResult.status === "fulfilled"
      ? countBookSpecs(bookSpecsResult.value)
      : null;

  if (bookSpecsResult.status === "rejected") {
    notes.push("book-specs 조회에 실패했습니다.");
  }

  const webhookUrl =
    webhookConfigResult.status === "fulfilled"
      ? extractWebhookUrl(webhookConfigResult.value)
      : null;
  const webhookConfigured = Boolean(webhookUrl);

  if (webhookConfigResult.status === "rejected") {
    notes.push("웹훅 설정 조회에 실패했거나 아직 설정되지 않았습니다.");
  }

  return NextResponse.json({
    data: {
      environment,
      apiKeyConfigured,
      bookSpecsReachable,
      bookSpecCount,
      webhookConfigured,
      webhookUrl,
      notes,
      checkedAt: new Date().toISOString(),
    },
  });
}
