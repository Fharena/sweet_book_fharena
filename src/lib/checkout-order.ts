export type CheckoutComposeResult = {
  bookUid: string;
  finalizedBook?: unknown;
  savedAt: string;
};

export type CheckoutOrderDraft = {
  ordererName: string;
  bookUid: string;
  quantity: number;
  recipientName: string;
  recipientPhone: string;
  postalCode: string;
  address1: string;
  address2: string;
  memo: string;
};

export type CheckoutShippingDetails = {
  recipientName: string;
  recipientPhone: string;
  postalCode: string;
  address1: string;
  address2?: string;
  memo?: string;
};

export type CheckoutOrderItem = {
  bookUid: string;
  quantity: number;
};

export type CheckoutOrderRequest = {
  items: CheckoutOrderItem[];
  shipping: CheckoutShippingDetails;
  externalRef?: string;
  externalUserId?: string;
};

export const CHECKOUT_COMPOSE_RESULT_KEY = "triplogue:checkout-compose-result";
export const CHECKOUT_ORDER_DRAFT_KEY = "triplogue:checkout-order-draft";

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isString(value: unknown): value is string {
  return typeof value === "string";
}

function readSessionValue<T>(key: string, validator: (value: unknown) => value is T) {
  if (typeof window === "undefined") {
    return null;
  }

  const rawValue = window.sessionStorage.getItem(key);
  if (!rawValue) {
    return null;
  }

  try {
    const parsed = JSON.parse(rawValue) as unknown;
    return validator(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

export function isCheckoutComposeResult(value: unknown): value is CheckoutComposeResult {
  return (
    isObject(value) &&
    isString(value.bookUid) &&
    (typeof value.finalizedBook === "undefined" || value.finalizedBook !== null) &&
    isString(value.savedAt)
  );
}

export function loadCheckoutComposeResult(): CheckoutComposeResult | null {
  return readSessionValue(CHECKOUT_COMPOSE_RESULT_KEY, isCheckoutComposeResult);
}

export function saveCheckoutComposeResult(result: CheckoutComposeResult) {
  if (typeof window === "undefined") {
    return;
  }

  window.sessionStorage.setItem(
    CHECKOUT_COMPOSE_RESULT_KEY,
    JSON.stringify(result),
  );
}

export function clearCheckoutComposeResult() {
  if (typeof window === "undefined") {
    return;
  }

  window.sessionStorage.removeItem(CHECKOUT_COMPOSE_RESULT_KEY);
}

export function isCheckoutOrderDraft(value: unknown): value is CheckoutOrderDraft {
  return (
    isObject(value) &&
    isString(value.ordererName) &&
    isString(value.bookUid) &&
    typeof value.quantity === "number" &&
    isString(value.recipientName) &&
    isString(value.recipientPhone) &&
    isString(value.postalCode) &&
    isString(value.address1) &&
    isString(value.address2) &&
    isString(value.memo)
  );
}

export function loadCheckoutOrderDraft(): CheckoutOrderDraft | null {
  return readSessionValue(CHECKOUT_ORDER_DRAFT_KEY, isCheckoutOrderDraft);
}

export function saveCheckoutOrderDraft(draft: CheckoutOrderDraft) {
  if (typeof window === "undefined") {
    return;
  }

  window.sessionStorage.setItem(CHECKOUT_ORDER_DRAFT_KEY, JSON.stringify(draft));
}
