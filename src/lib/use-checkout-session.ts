"use client";

import { useSyncExternalStore } from "react";

import {
  CHECKOUT_SESSION_STORAGE_EVENT,
  loadCheckoutComposeResult,
  loadCheckoutOrderDraft,
  loadCheckoutOrderResult,
} from "@/lib/checkout-order";

function subscribe(onStoreChange: () => void) {
  if (typeof window === "undefined") {
    return () => {};
  }

  window.addEventListener(CHECKOUT_SESSION_STORAGE_EVENT, onStoreChange);
  window.addEventListener("storage", onStoreChange);

  return () => {
    window.removeEventListener(CHECKOUT_SESSION_STORAGE_EVENT, onStoreChange);
    window.removeEventListener("storage", onStoreChange);
  };
}

export function useCheckoutSession() {
  const composeResult = useSyncExternalStore(
    subscribe,
    loadCheckoutComposeResult,
    () => null,
  );
  const orderResult = useSyncExternalStore(
    subscribe,
    loadCheckoutOrderResult,
    () => null,
  );
  const orderDraft = useSyncExternalStore(
    subscribe,
    loadCheckoutOrderDraft,
    () => null,
  );

  return {
    composeResult,
    orderResult,
    orderDraft,
    hydrated: true,
  };
}
