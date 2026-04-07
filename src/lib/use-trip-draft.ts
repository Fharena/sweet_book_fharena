"use client";

import { useSyncExternalStore } from "react";

import {
  loadTripDraft,
  TRIP_DRAFT_STORAGE_EVENT,
} from "@/lib/trip-draft";

export function useTripDraft() {
  const draft = useSyncExternalStore(
    (onStoreChange) => {
      if (typeof window === "undefined") {
        return () => {};
      }

      window.addEventListener(TRIP_DRAFT_STORAGE_EVENT, onStoreChange);
      window.addEventListener("storage", onStoreChange);

      return () => {
        window.removeEventListener(TRIP_DRAFT_STORAGE_EVENT, onStoreChange);
        window.removeEventListener("storage", onStoreChange);
      };
    },
    loadTripDraft,
    () => null,
  );

  return { draft, hydrated: true };
}
