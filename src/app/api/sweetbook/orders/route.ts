import { NextResponse } from "next/server";

import type { CheckoutOrderRequest } from "@/lib/checkout-order";
import { sweetbookClient } from "@/lib/server/sweetbook/client";

export const runtime = "nodejs";

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isString(value: unknown): value is string {
  return typeof value === "string";
}

function normalizeOptionalText(value: unknown) {
  if (!isString(value)) {
    return undefined;
  }

  const trimmed = value.trim();
  return trimmed ? trimmed : undefined;
}

function parseRequestBody(body: unknown): {
  ok: true;
  data: CheckoutOrderRequest;
} | {
  ok: false;
  error: string;
} {
  if (!isObject(body)) {
    return {
      ok: false,
      error: "주문 요청 본문이 올바르지 않습니다.",
    };
  }

  if (!Array.isArray(body.items) || body.items.length === 0) {
    return {
      ok: false,
      error: "items는 하나 이상의 책을 포함해야 합니다.",
    };
  }

  const normalizedItems = [] as CheckoutOrderRequest["items"];
  for (const [index, item] of body.items.entries()) {
    if (!isObject(item) || !isString(item.bookUid)) {
      return {
        ok: false,
        error: `items[${index}].bookUid가 필요합니다.`,
      };
    }

    const quantity = Number(item.quantity);
    if (!Number.isInteger(quantity) || quantity < 1 || quantity > 100) {
      return {
        ok: false,
        error: `items[${index}].quantity는 1에서 100 사이의 정수여야 합니다.`,
      };
    }

    const bookUid = item.bookUid.trim();
    if (!bookUid) {
      return {
        ok: false,
        error: `items[${index}].bookUid가 비어 있습니다.`,
      };
    }

    normalizedItems.push({ bookUid, quantity });
  }

  if (!isObject(body.shipping)) {
    return {
      ok: false,
      error: "shipping은 필수입니다.",
    };
  }

  const shipping = body.shipping;
  const recipientName = normalizeOptionalText(shipping.recipientName);
  const recipientPhone = normalizeOptionalText(shipping.recipientPhone);
  const postalCode = normalizeOptionalText(shipping.postalCode);
  const address1 = normalizeOptionalText(shipping.address1);

  if (!recipientName || !recipientPhone || !postalCode || !address1) {
    return {
      ok: false,
      error: "배송지 필수 항목이 누락되었습니다.",
    };
  }

  const normalizedShipping = {
    recipientName,
    recipientPhone,
    postalCode,
    address1,
    ...(normalizeOptionalText(shipping.address2)
      ? { address2: normalizeOptionalText(shipping.address2) }
      : {}),
    ...(normalizeOptionalText(shipping.memo)
      ? { memo: normalizeOptionalText(shipping.memo) }
      : {}),
  };

  return {
    ok: true,
    data: {
      items: normalizedItems,
      shipping: normalizedShipping,
      ...(normalizeOptionalText(body.externalRef)
        ? { externalRef: normalizeOptionalText(body.externalRef) }
        : {}),
      ...(normalizeOptionalText(body.externalUserId)
        ? { externalUserId: normalizeOptionalText(body.externalUserId) }
        : {}),
    },
  };
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as unknown;
    const parsed = parseRequestBody(body);

    if (!parsed.ok) {
      return NextResponse.json({ error: parsed.error }, { status: 400 });
    }

    const data = await sweetbookClient.createOrder(parsed.data);
    return NextResponse.json(data, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "주문 생성에 실패했습니다.",
      },
      { status: 500 },
    );
  }
}
