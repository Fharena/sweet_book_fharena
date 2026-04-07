export type CheckoutComposeResult = {
  bookUid: string;
  finalizedBook?: unknown;
  themeLabel?: string;
  operationCount?: number;
  contentCount?: number;
  savedAt: string;
};

export type CheckoutOrderResult = {
  orderUid: string | null;
  totalAmount: number | null;
  orderStatusDisplay: string | null;
  paidCreditAmount: number | null;
  bookUid: string;
  themeLabel?: string;
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
export const CHECKOUT_ORDER_RESULT_KEY = "triplogue:checkout-order-result";
export const CHECKOUT_SESSION_STORAGE_EVENT = "triplogue:checkout-changed";

const sessionSnapshotCache = new Map<
  string,
  {
    rawValue: string | null | undefined;
    parsedValue: unknown;
  }
>();

function safeGetSessionItem(key: string) {
  try {
    return window.sessionStorage.getItem(key);
  } catch {
    return null;
  }
}

function safeSetSessionItem(key: string, value: string) {
  try {
    window.sessionStorage.setItem(key, value);
    return true;
  } catch {
    return false;
  }
}

function safeRemoveSessionItem(key: string) {
  try {
    window.sessionStorage.removeItem(key);
    return true;
  } catch {
    return false;
  }
}

function safeDispatchCheckoutChanged() {
  try {
    window.dispatchEvent(new Event(CHECKOUT_SESSION_STORAGE_EVENT));
  } catch {
    // Ignore environments where custom window events are restricted.
  }
}

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

  const rawValue = safeGetSessionItem(key);
  const cachedEntry = sessionSnapshotCache.get(key);

  if (cachedEntry && cachedEntry.rawValue === rawValue) {
    return validator(cachedEntry.parsedValue) ? (cachedEntry.parsedValue as T) : null;
  }

  if (!rawValue) {
    sessionSnapshotCache.set(key, {
      rawValue,
      parsedValue: null,
    });
    return null;
  }

  try {
    const parsed = JSON.parse(rawValue) as unknown;
    sessionSnapshotCache.set(key, {
      rawValue,
      parsedValue: parsed,
    });
    return validator(parsed) ? parsed : null;
  } catch {
    sessionSnapshotCache.set(key, {
      rawValue,
      parsedValue: null,
    });
    return null;
  }
}

export function isCheckoutComposeResult(value: unknown): value is CheckoutComposeResult {
  return (
    isObject(value) &&
    isString(value.bookUid) &&
    (typeof value.finalizedBook === "undefined" || value.finalizedBook !== null) &&
    (typeof value.themeLabel === "undefined" || isString(value.themeLabel)) &&
    (typeof value.operationCount === "undefined" || typeof value.operationCount === "number") &&
    (typeof value.contentCount === "undefined" || typeof value.contentCount === "number") &&
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

  if (
    safeSetSessionItem(
      CHECKOUT_COMPOSE_RESULT_KEY,
      JSON.stringify(result),
    )
  ) {
    safeDispatchCheckoutChanged();
  }
}

export function clearCheckoutComposeResult() {
  if (typeof window === "undefined") {
    return;
  }

  if (safeRemoveSessionItem(CHECKOUT_COMPOSE_RESULT_KEY)) {
    safeDispatchCheckoutChanged();
  }
}

export function isCheckoutOrderResult(value: unknown): value is CheckoutOrderResult {
  return (
    isObject(value) &&
    (value.orderUid === null || isString(value.orderUid)) &&
    (value.totalAmount === null || typeof value.totalAmount === "number") &&
    (value.orderStatusDisplay === null || isString(value.orderStatusDisplay)) &&
    (value.paidCreditAmount === null || typeof value.paidCreditAmount === "number") &&
    isString(value.bookUid) &&
    (typeof value.themeLabel === "undefined" || isString(value.themeLabel)) &&
    isString(value.savedAt)
  );
}

export function loadCheckoutOrderResult(): CheckoutOrderResult | null {
  return readSessionValue(CHECKOUT_ORDER_RESULT_KEY, isCheckoutOrderResult);
}

export function saveCheckoutOrderResult(result: CheckoutOrderResult) {
  if (typeof window === "undefined") {
    return;
  }

  if (safeSetSessionItem(CHECKOUT_ORDER_RESULT_KEY, JSON.stringify(result))) {
    safeDispatchCheckoutChanged();
  }
}

export function clearCheckoutOrderResult() {
  if (typeof window === "undefined") {
    return;
  }

  if (safeRemoveSessionItem(CHECKOUT_ORDER_RESULT_KEY)) {
    safeDispatchCheckoutChanged();
  }
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

  if (safeSetSessionItem(CHECKOUT_ORDER_DRAFT_KEY, JSON.stringify(draft))) {
    safeDispatchCheckoutChanged();
  }
}

export function clearCheckoutOrderDraft() {
  if (typeof window === "undefined") {
    return;
  }

  if (safeRemoveSessionItem(CHECKOUT_ORDER_DRAFT_KEY)) {
    safeDispatchCheckoutChanged();
  }
}
