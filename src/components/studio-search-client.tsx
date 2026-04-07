"use client";

import { useSearchParams } from "next/navigation";

import { StudioClient } from "@/components/studio-client";

function parseInitialStep(value: string | null) {
  switch (value) {
    case "trip":
    case "upload":
    case "review":
    case "preview":
    case "publish":
      return value;
    case "new":
      return "upload";
    default:
      return "trip";
  }
}

export function StudioSearchClient() {
  const searchParams = useSearchParams();
  const initialStep = parseInitialStep(searchParams.get("step"));
  const loadDemoOnStart = searchParams.get("demo") === "1";

  return <StudioClient initialStep={initialStep} loadDemoOnStart={loadDemoOnStart} />;
}
