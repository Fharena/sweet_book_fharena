"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { flushSync } from "react-dom";
import {
  useEffect,
  useMemo,
  useRef,
  useState,
  useTransition,
  type ChangeEvent,
} from "react";

import type {
  CheckoutComposeResult,
  CheckoutOrderDraft,
  CheckoutOrderResult,
} from "@/lib/checkout-order";
import {
  clearCheckoutComposeResult,
  clearCheckoutOrderDraft,
  clearCheckoutOrderResult,
  loadCheckoutComposeResult,
  loadCheckoutOrderDraft,
  loadCheckoutOrderResult,
  saveCheckoutComposeResult,
  saveCheckoutOrderDraft,
  saveCheckoutOrderResult,
} from "@/lib/checkout-order";
import {
  createDemoTripDraft,
  demoTripQuickFacts,
  isDemoTripDraft,
} from "@/lib/demo-trip-draft";
import { buildUploadedPhotoSrc } from "@/lib/photo-assets";
import {
  buildPhotobookPreviewDocument,
  type PhotobookPreviewSpread,
} from "@/lib/photobook-preview";
import { estimateRequestedTravelPages } from "@/lib/sweetbook-book-specs";
import {
  applyManualLocationTagToDraft,
  applyThemeSelectionToDraft,
  clearTripDraft,
  saveTripDraft,
} from "@/lib/trip-draft";
import type { TripDraft, TripDraftPhoto } from "@/lib/trip-draft";
import { useSweetbookProductMeta } from "@/lib/use-sweetbook-product-meta";
import { useTripDraft } from "@/lib/use-trip-draft";
import {
  resolveTravelTheme,
  travelThemes,
  type TravelThemeId,
} from "@/lib/travel-themes";

type StudioStepId = "trip" | "upload" | "review" | "preview" | "publish";

type OrderPayload = {
  items: Array<{
    bookUid: string;
    quantity: number;
  }>;
  shipping: {
    recipientName: string;
    recipientPhone: string;
    postalCode: string;
    address1: string;
    address2?: string;
    memo?: string;
  };
  externalUserId?: string;
  externalRef?: string;
};

type SelectedUploadFile = {
  key: string;
  file: File;
  displayName: string;
};

const studioSteps: Array<{
  id: StudioStepId;
  index: number;
  label: string;
  title: string;
  copy: string;
}> = [
  {
    id: "trip",
    index: 1,
    label: "여행 설정",
    title: "이번 여행의 기본 정보를 정합니다.",
    copy: "여행 제목과 기간을 먼저 정해두면 업로드 이후 자동 정리가 더 읽기 쉬워집니다.",
  },
  {
    id: "upload",
    index: 2,
    label: "사진 업로드",
    title: "실제 사진을 올려 EXIF와 촬영 시간을 읽습니다.",
    copy: "갤럭시 위치 태그가 켜진 사진이면 날짜와 장소 흐름을 자동으로 더 잘 나눌 수 있습니다.",
  },
  {
    id: "review",
    index: 3,
    label: "사진 정리",
    title: "자동으로 묶인 장소와 날짜를 확인하고 필요한 것만 보정합니다.",
    copy: "위치 정보가 비는 사진만 태그하면 챕터가 다시 정리되고 바로 포토북 초안으로 넘어갑니다.",
  },
  {
    id: "preview",
    index: 4,
    label: "포토북 디자인",
    title: "세 가지 포토북 포맷 중 하나를 골라 실제 사진으로 미리봅니다.",
    copy: "포맷은 단순한 스킨이 아니라, 챕터를 어떤 톤으로 보여줄지까지 같이 바꿉니다.",
  },
  {
    id: "publish",
    index: 5,
    label: "Sweetbook 생성",
    title: "검토한 초안을 실제 Sweetbook 테스트 책과 주문 흐름으로 연결합니다.",
    copy: "책 생성 후 배송지까지 입력하면 제출용 데모 플로우가 한 번에 완성됩니다.",
  },
];

const emptyOrderDraft: CheckoutOrderDraft = {
  ordererName: "",
  bookUid: "",
  quantity: 1,
  recipientName: "",
  recipientPhone: "",
  postalCode: "",
  address1: "",
  address2: "",
  memo: "",
};

function formatBytes(bytes: number) {
  if (bytes < 1024) {
    return `${bytes} B`;
  }

  const units = ["KB", "MB", "GB"];
  let value = bytes / 1024;
  let unitIndex = 0;

  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024;
    unitIndex += 1;
  }

  return `${value.toFixed(value >= 10 ? 0 : 1)} ${units[unitIndex]}`;
}

function formatDateLabel(value: string | null) {
  if (!value) {
    return "날짜 정보 없음";
  }

  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return value;
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat("ko-KR", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function getRequestedStep(value: string | null): StudioStepId | null {
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
      return null;
  }
}

function getFileKey(file: File) {
  return `${file.name}:${file.size}:${file.lastModified}`;
}

function isAcceptedImageFile(file: File) {
  return file.size >= 0;
}

function getFallbackImageExtension(file: File) {
  if (file.type === "image/png") {
    return ".png";
  }

  if (file.type === "image/webp") {
    return ".webp";
  }

  if (file.type === "image/heic") {
    return ".heic";
  }

  if (file.type === "image/heif") {
    return ".heif";
  }

  return ".jpg";
}

function normalizeSelectedFile(file: File, index: number) {
  const displayName =
    file.name.trim() ||
    `mobile-photo-${Date.now()}-${index + 1}${getFallbackImageExtension(file)}`;

  return {
    key: `${index}-${getFileKey(file) || displayName}`,
    file,
    displayName,
  } satisfies SelectedUploadFile;
}

function formatSelectionTimestamp(value: string | null) {
  if (!value) {
    return "방금 선택";
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "방금 선택";
  }

  return new Intl.DateTimeFormat("ko-KR", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function buildOrderPayload(draft: CheckoutOrderDraft): OrderPayload {
  return {
    items: [
      {
        bookUid: draft.bookUid.trim(),
        quantity: draft.quantity,
      },
    ],
    shipping: {
      recipientName: draft.recipientName.trim(),
      recipientPhone: draft.recipientPhone.trim(),
      postalCode: draft.postalCode.trim(),
      address1: draft.address1.trim(),
      ...(draft.address2.trim() ? { address2: draft.address2.trim() } : {}),
      ...(draft.memo.trim() ? { memo: draft.memo.trim() } : {}),
    },
    ...(draft.ordererName.trim() ? { externalUserId: draft.ordererName.trim() } : {}),
    externalRef: `triplogue-${draft.bookUid.trim()}-${Date.now()}`,
  };
}

function validateOrderDraft(draft: CheckoutOrderDraft) {
  const errors: Partial<Record<keyof CheckoutOrderDraft, string>> = {};

  if (!draft.ordererName.trim()) {
    errors.ordererName = "주문자 이름이 필요합니다.";
  }

  if (!draft.bookUid.trim()) {
    errors.bookUid = "생성된 bookUid가 필요합니다.";
  }

  if (!draft.recipientName.trim()) {
    errors.recipientName = "받는 분 이름을 입력해 주세요.";
  }

  if (!draft.recipientPhone.trim()) {
    errors.recipientPhone = "연락처를 입력해 주세요.";
  }

  if (!draft.postalCode.trim()) {
    errors.postalCode = "우편번호를 입력해 주세요.";
  }

  if (!draft.address1.trim()) {
    errors.address1 = "기본 주소를 입력해 주세요.";
  }

  return errors;
}

function getPhotoSource(photo: TripDraftPhoto) {
  return photo.assetId ? buildUploadedPhotoSrc(photo.assetId) : null;
}

function PhotoSurface({
  photo,
  className,
  subtitle,
}: {
  photo: TripDraftPhoto | undefined;
  className?: string;
  subtitle?: string;
}) {
  const src = photo ? getPhotoSource(photo) : null;

  if (!photo) {
    return (
      <div
        className={`flex min-h-[10rem] items-center justify-center rounded-[28px] border border-dashed border-[var(--line)] bg-white/75 text-sm text-slate-400 ${className ?? ""}`.trim()}
      >
        사진이 아직 없습니다.
      </div>
    );
  }

  return (
    <div
      className={`relative overflow-hidden rounded-[28px] border border-[rgba(255,255,255,0.35)] bg-[linear-gradient(160deg,_rgba(15,23,42,0.88),_rgba(15,118,110,0.42))] ${className ?? ""}`.trim()}
    >
      {src ? (
        <Image
          src={src}
          alt={photo.originalName}
          fill
          unoptimized
          sizes="(max-width: 1024px) 100vw, 50vw"
          className="object-cover"
        />
      ) : (
        <div className="flex h-full min-h-[12rem] items-end bg-[linear-gradient(160deg,_rgba(15,23,42,0.88),_rgba(15,118,110,0.42))] p-4 text-white">
          <div>
            <p className="text-sm font-semibold">{photo.originalName}</p>
            <p className="mt-2 text-xs text-white/70">데모 초안에는 실제 이미지 대신 메타데이터만 있습니다.</p>
          </div>
        </div>
      )}
      <div className="absolute inset-x-0 bottom-0 bg-[linear-gradient(180deg,_transparent,_rgba(15,23,42,0.72))] p-4 text-white">
        <p className="text-sm font-semibold">{photo.locationLabel ?? "위치 확인 필요"}</p>
        <p className="mt-1 text-xs text-white/78">
          {subtitle ?? formatDateLabel(photo.capturedAt)}
        </p>
      </div>
    </div>
  );
}

function PreviewSpreadCard({
  spread,
  photoById,
}: {
  spread: PhotobookPreviewSpread;
  photoById: Map<string, TripDraftPhoto>;
}) {
  const leadPhoto = spread.leadPhotoId ? photoById.get(spread.leadPhotoId) : undefined;
  const supportingPhotos = spread.supportingPhotoIds
    .map((photoId) => photoById.get(photoId))
    .filter((photo): photo is TripDraftPhoto => Boolean(photo));

  if (spread.layoutKind === "photo-essay") {
    return (
      <article className="studio-card rounded-[32px] p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-500">
              {spread.dayLabel}
            </p>
            <h3 className="mt-2 text-2xl font-semibold tracking-[-0.04em] text-slate-950">
              {spread.placeLabel}
            </h3>
          </div>
          <span className="rounded-full bg-[var(--accent-soft)] px-3 py-1 text-xs font-semibold text-[var(--accent)]">
            포토 에세이
          </span>
        </div>
        <div className="mt-5 grid gap-4 xl:grid-cols-[minmax(0,1.1fr)_minmax(240px,0.9fr)]">
          <PhotoSurface photo={leadPhoto} className="min-h-[22rem]" subtitle={spread.caption} />
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-1">
            {supportingPhotos.length > 0 ? (
              supportingPhotos.map((photo) => (
                <PhotoSurface key={photo.id} photo={photo} className="min-h-[10rem]" />
              ))
            ) : (
              <div className="flex min-h-[10rem] items-center rounded-[28px] border border-dashed border-[var(--line)] px-5 py-4 text-sm text-slate-500">
                보조 컷은 자동으로 최대 네 장까지 배치됩니다.
              </div>
            )}
          </div>
        </div>
      </article>
    );
  }

  if (spread.layoutKind === "timeline-classic") {
    return (
      <article className="studio-card rounded-[32px] p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-500">
              {spread.dayLabel}
            </p>
            <h3 className="mt-2 text-2xl font-semibold tracking-[-0.04em] text-slate-950">
              {spread.chapterTitle}
            </h3>
          </div>
          <span className="rounded-full bg-[var(--accent-secondary-soft)] px-3 py-1 text-xs font-semibold text-[var(--accent-secondary)]">
            타임라인 클래식
          </span>
        </div>
        <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-600">{spread.caption}</p>
        <div className="mt-5 grid gap-4 xl:grid-cols-[minmax(0,0.92fr)_minmax(0,1.08fr)]">
          <div className="rounded-[28px] border border-[var(--line)] bg-white p-5">
            <div className="space-y-3">
              <div className="rounded-[22px] bg-[var(--accent-soft)] px-4 py-3">
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--accent)]">
                  날짜
                </p>
                <p className="mt-2 text-lg font-semibold text-slate-900">{spread.dayLabel}</p>
              </div>
              <div className="rounded-[22px] border border-[var(--line)] px-4 py-3">
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
                  장소
                </p>
                <p className="mt-2 text-lg font-semibold text-slate-900">{spread.placeLabel}</p>
              </div>
              <div className="rounded-[22px] border border-[var(--line)] px-4 py-3">
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
                  좌표 힌트
                </p>
                <p className="mt-2 text-sm leading-6 text-slate-700">
                  {spread.coordinateLabel ?? "좌표 없음"}
                </p>
              </div>
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <PhotoSurface photo={leadPhoto} className="sm:col-span-2 min-h-[16rem]" />
            {supportingPhotos.map((photo) => (
              <PhotoSurface key={photo.id} photo={photo} className="min-h-[10rem]" />
            ))}
          </div>
        </div>
      </article>
    );
  }

  return (
    <article className="studio-card rounded-[32px] p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-500">
            {spread.dayLabel}
          </p>
          <h3 className="mt-2 text-2xl font-semibold tracking-[-0.04em] text-slate-950">
            {spread.placeLabel}
          </h3>
        </div>
        <span className="rounded-full bg-[var(--accent-soft)] px-3 py-1 text-xs font-semibold text-[var(--accent)]">
          포스트카드 맵
        </span>
      </div>
      <div className="mt-5 grid gap-4 xl:grid-cols-[minmax(260px,0.72fr)_minmax(0,1.28fr)]">
        <div className="rounded-[28px] border border-[var(--line)] bg-white p-5">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
            장소 카드
          </p>
          <p className="mt-3 text-2xl font-semibold tracking-[-0.04em] text-slate-950">
            {spread.placeLabel}
          </p>
          <p className="mt-3 text-sm leading-6 text-slate-600">{spread.caption}</p>
          <div className="mt-5 grid gap-3">
            <div className="rounded-[22px] bg-[var(--accent-soft)] px-4 py-3">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--accent)]">
                날짜
              </p>
              <p className="mt-2 text-base font-semibold text-slate-900">{spread.dayLabel}</p>
            </div>
            <div className="rounded-[22px] border border-[var(--line)] px-4 py-3">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
                좌표
              </p>
              <p className="mt-2 text-sm leading-6 text-slate-700">
                {spread.coordinateLabel ?? "위치 태그가 없어 수동 보정 기준으로 정리했습니다."}
              </p>
            </div>
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <PhotoSurface photo={leadPhoto} className="sm:col-span-2 min-h-[17rem]" />
          {supportingPhotos.map((photo) => (
            <PhotoSurface key={photo.id} photo={photo} className="min-h-[10rem]" />
          ))}
        </div>
      </div>
    </article>
  );
}

export function StudioClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { draft } = useTripDraft();
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [selectedUploads, setSelectedUploads] = useState<SelectedUploadFile[]>([]);
  const [lastSelectedAt, setLastSelectedAt] = useState<string | null>(null);
  const [tripName, setTripName] = useState("새 여행");
  const [travelStart, setTravelStart] = useState("");
  const [travelEnd, setTravelEnd] = useState("");
  const [manualLocationLabel, setManualLocationLabel] = useState("");
  const [selectedPhotoIds, setSelectedPhotoIds] = useState<string[]>([]);
  const [activeStep, setActiveStep] = useState<StudioStepId>("trip");
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [reviewFeedback, setReviewFeedback] = useState<string | null>(null);
  const [composeError, setComposeError] = useState<string | null>(null);
  const [orderError, setOrderError] = useState<string | null>(null);
  const [composeResult, setComposeResult] = useState<CheckoutComposeResult | null>(null);
  const [orderDraft, setOrderDraft] = useState<CheckoutOrderDraft>(emptyOrderDraft);
  const [orderErrors, setOrderErrors] = useState<
    Partial<Record<keyof CheckoutOrderDraft, string>>
  >({});
  const [orderResult, setOrderResult] = useState<CheckoutOrderResult | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [isComposing, setIsComposing] = useState(false);
  const [isOrdering, setIsOrdering] = useState(false);
  const [, startTransition] = useTransition();

  const files = useMemo(
    () => selectedUploads.map((item) => item.file),
    [selectedUploads],
  );

  useEffect(() => {
    setComposeResult(loadCheckoutComposeResult());
    setOrderResult(loadCheckoutOrderResult());
    setOrderDraft(loadCheckoutOrderDraft() ?? emptyOrderDraft);
  }, []);

  useEffect(() => {
    if (!draft) {
      return;
    }

    setTripName(draft.tripName);
    setTravelStart(draft.travelStart ?? "");
    setTravelEnd(draft.travelEnd ?? "");
  }, [draft]);

  useEffect(() => {
    const hasDemoQuery = searchParams.get("demo") === "1";
    const requestedStep = getRequestedStep(searchParams.get("step"));

    if (!hasDemoQuery && !requestedStep) {
      return;
    }

    if (hasDemoQuery) {
      saveTripDraft(createDemoTripDraft());
      clearCheckoutComposeResult();
      clearCheckoutOrderDraft();
      clearCheckoutOrderResult();
      setComposeResult(null);
      setOrderResult(null);
      setOrderDraft(emptyOrderDraft);
      setActiveStep("review");
    } else if (requestedStep) {
      setActiveStep(requestedStep);
    }

    startTransition(() => {
      router.replace("/studio");
    });
  }, [router, searchParams]);

  useEffect(() => {
    if (!composeResult) {
      return;
    }

    setOrderDraft((current) => ({
      ...current,
      bookUid: composeResult.bookUid,
      ordererName: current.ordererName || "Triplogue User",
    }));
  }, [composeResult]);

  const isDemoSession = isDemoTripDraft(draft);
  const resolvedTheme = resolveTravelTheme(draft?.selectedThemeId);
  const totalUploadSize = useMemo(
    () => selectedUploads.reduce((sum, item) => sum + item.file.size, 0),
    [selectedUploads],
  );
  const draftPhotoById = useMemo(
    () => new Map((draft?.photos ?? []).map((photo) => [photo.id, photo])),
    [draft?.photos],
  );
  const photosNeedingManualTagging = useMemo(
    () => draft?.photos.filter((photo) => photo.requiresManualLocationTagging) ?? [],
    [draft],
  );
  const suggestedLocations = useMemo(() => {
    const values = new Set(
      (draft?.photos ?? [])
        .map((photo) => photo.locationLabel)
        .filter((value): value is string => Boolean(value)),
    );
    return Array.from(values).slice(0, 8);
  }, [draft]);
  const previewDocument = useMemo(
    () => (draft ? buildPhotobookPreviewDocument(draft) : null),
    [draft],
  );
  const requestedPageCount = draft
    ? estimateRequestedTravelPages(draft.stats.totalPhotos, draft.chapters.length)
    : 24;
  const {
    plan,
    productLabel,
    productDimension,
    pageRuleSummary,
    pageCount,
    estimatedPrice,
    isLoading: isLoadingProductMeta,
    error: productMetaError,
  } = useSweetbookProductMeta(draft, requestedPageCount);
  const canOpenReview = Boolean(draft);
  const canOpenPreview = Boolean(draft?.chapters.length);
  const canOpenPublish = Boolean(draft?.photos.length);

  function moveToStep(step: StudioStepId) {
    flushSync(() => {
      setActiveStep(step);
    });

    if (typeof window !== "undefined") {
      window.scrollTo({
        top: 0,
        behavior: "smooth",
      });
    }
  }

  function handleFileInputChange(event: ChangeEvent<HTMLInputElement>) {
    const nextFiles = Array.from(event.currentTarget.files ?? []);
    event.currentTarget.value = "";

    if (nextFiles.length === 0) {
      return;
    }

    handleSelectFiles(nextFiles);
  }

  function handleSelectFiles(nextFiles: FileList | File[]) {
    const accepted = Array.from(nextFiles).filter(isAcceptedImageFile);
    if (accepted.length === 0) {
      setUploadError("선택된 파일을 읽지 못했습니다. 갤러리에서 다시 골라 주세요.");
      return;
    }

    const selectedAt = new Date().toISOString();

    setSelectedUploads(
      accepted.map((file, index) => normalizeSelectedFile(file, index)),
    );
    setLastSelectedAt(selectedAt);
    setUploadError(null);
    moveToStep("upload");
  }

  async function handleUpload() {
    setUploadError(null);

    if (!tripName.trim()) {
      setUploadError("여행 이름을 먼저 입력해 주세요.");
      moveToStep("trip");
      return;
    }

    if (files.length === 0) {
      setUploadError("사진을 한 장 이상 선택해 주세요.");
      moveToStep("upload");
      return;
    }

    const emptyFiles = selectedUploads.filter((item) => item.file.size === 0);
    if (emptyFiles.length > 0) {
      setUploadError(
        "선택한 사진 중 일부가 실제 파일 데이터 없이 들어왔습니다. 갤러리에서 원본 파일로 다시 골라 주세요.",
      );
      moveToStep("upload");
      return;
    }

    const formData = new FormData();
    selectedUploads.forEach((item) =>
      formData.append("files", item.file, item.displayName),
    );
    formData.append("tripName", tripName.trim());
    formData.append("travelStart", travelStart);
    formData.append("travelEnd", travelEnd);

    setIsUploading(true);

    try {
      const response = await fetch("/api/trips/intake", {
        method: "POST",
        body: formData,
      });
      const payload = (await response.json()) as TripDraft & { error?: string };

      if (!response.ok) {
        throw new Error(payload.error ?? "사진 업로드 처리에 실패했습니다.");
      }

      saveTripDraft(payload);
      clearCheckoutComposeResult();
      clearCheckoutOrderDraft();
      clearCheckoutOrderResult();
      setComposeResult(null);
      setOrderResult(null);
      setOrderDraft(emptyOrderDraft);
      setReviewFeedback("사진을 읽어 자동으로 날짜와 장소 단위로 정리했습니다.");
      setSelectedPhotoIds([]);
      setManualLocationLabel("");
      moveToStep("review");
    } catch (error) {
      setUploadError(
        error instanceof Error ? error.message : "업로드 중 알 수 없는 오류가 발생했습니다.",
      );
    } finally {
      setIsUploading(false);
    }
  }

  function handleLoadDemo() {
    saveTripDraft(createDemoTripDraft());
    clearCheckoutComposeResult();
    clearCheckoutOrderDraft();
    clearCheckoutOrderResult();
    setComposeResult(null);
    setOrderResult(null);
    setOrderDraft(emptyOrderDraft);
    setSelectedUploads([]);
    setLastSelectedAt(null);
    setReviewFeedback("샘플 초안을 불러왔습니다. 실제 플로우를 바로 확인할 수 있습니다.");
    moveToStep("review");
  }

  function handleResetAll() {
    clearTripDraft();
    clearCheckoutComposeResult();
    clearCheckoutOrderDraft();
    clearCheckoutOrderResult();
    setSelectedUploads([]);
    setLastSelectedAt(null);
    setComposeResult(null);
    setOrderResult(null);
    setOrderDraft(emptyOrderDraft);
    setSelectedPhotoIds([]);
    setManualLocationLabel("");
    setUploadError(null);
    setReviewFeedback(null);
    setComposeError(null);
    setOrderError(null);
    setActiveStep("trip");
  }

  function handleApplyManualTag() {
    if (!draft) {
      return;
    }

    const normalizedLabel = manualLocationLabel.trim();
    if (!normalizedLabel || selectedPhotoIds.length === 0) {
      setReviewFeedback("장소 이름과 사진 선택을 먼저 확인해 주세요.");
      return;
    }

    const nextDraft = applyManualLocationTagToDraft(draft, selectedPhotoIds, normalizedLabel);
    saveTripDraft(nextDraft);
    setSelectedPhotoIds([]);
    setManualLocationLabel("");
    setReviewFeedback(`${normalizedLabel} 태그를 ${selectedPhotoIds.length}장에 적용했습니다.`);
  }

  function handleThemeChange(themeId: TravelThemeId) {
    if (!draft) {
      return;
    }

    saveTripDraft(applyThemeSelectionToDraft(draft, themeId));
  }

  async function handleComposeBook() {
    if (!draft) {
      return;
    }

    setComposeError(null);
    setIsComposing(true);

    try {
      const response = await fetch("/api/sweetbook/books/compose", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(draft),
      });
      const payload = (await response.json()) as {
        bookUid?: string;
        plan?: { themeLabel?: string; operations?: unknown[] };
        steps?: { contentResults?: unknown[]; finalizedBook?: unknown };
        error?: string;
      };

      if (!response.ok || !payload.bookUid) {
        throw new Error(payload.error ?? "Sweetbook 테스트 책 생성에 실패했습니다.");
      }

      const nextComposeResult = {
        bookUid: payload.bookUid,
        finalizedBook: payload.steps?.finalizedBook,
        themeLabel: payload.plan?.themeLabel,
        operationCount: payload.plan?.operations?.length ?? 0,
        contentCount: payload.steps?.contentResults?.length ?? 0,
        savedAt: new Date().toISOString(),
      } satisfies CheckoutComposeResult;

      saveCheckoutComposeResult(nextComposeResult);
      setComposeResult(nextComposeResult);
      setOrderDraft((current) => ({
        ...current,
        ordererName: current.ordererName || "Triplogue User",
        bookUid: payload.bookUid ?? "",
      }));
    } catch (error) {
      setComposeError(
        error instanceof Error ? error.message : "테스트 책 생성 중 오류가 발생했습니다.",
      );
    } finally {
      setIsComposing(false);
    }
  }

  async function handleCreateOrder() {
    const nextErrors = validateOrderDraft(orderDraft);
    setOrderErrors(nextErrors);
    setOrderError(null);

    if (Object.keys(nextErrors).length > 0) {
      return;
    }

    setIsOrdering(true);

    try {
      const response = await fetch("/api/sweetbook/orders", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(buildOrderPayload(orderDraft)),
      });
      const payload = (await response.json()) as {
        error?: string;
        data?: {
          orderUid?: string | null;
          totalAmount?: number | null;
          orderStatusDisplay?: string | null;
          paidCreditAmount?: number | null;
        };
        orderUid?: string | null;
        totalAmount?: number | null;
        orderStatusDisplay?: string | null;
        paidCreditAmount?: number | null;
      };

      if (!response.ok) {
        throw new Error(payload.error ?? "주문 생성에 실패했습니다.");
      }

      const nextOrderResult = {
        orderUid: payload.data?.orderUid ?? payload.orderUid ?? null,
        totalAmount: payload.data?.totalAmount ?? payload.totalAmount ?? null,
        orderStatusDisplay:
          payload.data?.orderStatusDisplay ?? payload.orderStatusDisplay ?? null,
        paidCreditAmount:
          payload.data?.paidCreditAmount ?? payload.paidCreditAmount ?? null,
        bookUid: orderDraft.bookUid,
        themeLabel: composeResult?.themeLabel ?? resolvedTheme.name,
        savedAt: new Date().toISOString(),
      } satisfies CheckoutOrderResult;

      saveCheckoutOrderDraft(orderDraft);
      saveCheckoutOrderResult(nextOrderResult);
      setOrderResult(nextOrderResult);
    } catch (error) {
      setOrderError(
        error instanceof Error ? error.message : "주문 생성 중 오류가 발생했습니다.",
      );
    } finally {
      setIsOrdering(false);
    }
  }

  const currentStepIndex =
    studioSteps.find((step) => step.id === activeStep)?.index ?? studioSteps[0].index;
  const currentStepPosition = studioSteps.findIndex((step) => step.id === activeStep);
  const currentStepMeta = studioSteps[currentStepPosition] ?? studioSteps[0];
  const previousStep = currentStepPosition > 0 ? studioSteps[currentStepPosition - 1] : null;

  function isStepAvailable(stepId: StudioStepId) {
    switch (stepId) {
      case "trip":
      case "upload":
        return true;
      case "review":
        return canOpenReview;
      case "preview":
        return canOpenPreview;
      case "publish":
        return canOpenPublish;
      default:
        return false;
    }
  }

  function getStepPanelClass(stepId: StudioStepId) {
    return `wizard-stage studio-card rounded-[30px] p-5 sm:p-6 ${activeStep === stepId ? "is-active ring-1 ring-[rgba(15,118,110,0.2)]" : ""}`;
  }

  const mobilePrimaryAction = (() => {
    switch (activeStep) {
      case "trip":
        return {
          label: "사진 업로드로",
          onClick: () => moveToStep("upload"),
          disabled: false,
        };
      case "upload":
        if (draft) {
          return {
            label: "사진 정리 보기",
            onClick: () => moveToStep("review"),
            disabled: !canOpenReview,
          };
        }

        return {
          label: isUploading ? "사진 정리 중..." : "사진 읽고 정리하기",
          onClick: handleUpload,
          disabled: isUploading || selectedUploads.length === 0,
        };
      case "review":
        return {
          label: "포토북 디자인으로",
          onClick: () => moveToStep("preview"),
          disabled: !canOpenPreview,
        };
      case "preview":
        return {
          label: "Sweetbook 생성으로",
          onClick: () => moveToStep("publish"),
          disabled: !canOpenPublish,
        };
      case "publish":
        return {
          label: "새 여행 시작",
          onClick: handleResetAll,
          disabled: false,
        };
      default:
        return null;
    }
  })();

  return (
    <div className="relative px-4 py-6 sm:px-6 lg:px-8">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-6">
        <section
          className={`studio-hero rounded-[32px] border border-white/70 px-5 py-6 sm:px-8 ${activeStep === "trip" ? "sm:py-10" : "sm:py-7"}`}
        >
          <div className="flex flex-col gap-8 xl:grid xl:grid-cols-[minmax(0,1.45fr)_minmax(260px,0.55fr)] xl:items-start">
            <div className="max-w-3xl space-y-6">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <span className="rounded-full bg-[var(--sand)] px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.24em] text-[var(--accent)]">
                  Triplogue Studio
                </span>
                <span className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-500">
                  Step {String(currentStepIndex).padStart(2, "0")} / {String(studioSteps.length).padStart(2, "0")}
                </span>
              </div>

              <div className="space-y-4">
                <h1
                  className={`max-w-3xl font-semibold tracking-[-0.06em] text-slate-950 ${activeStep === "trip" ? "text-[clamp(2rem,4.5vw,4.9rem)]" : "text-[clamp(1.55rem,4.8vw,2.2rem)] sm:text-[clamp(1.9rem,4vw,3rem)]"}`}
                >
                  {activeStep === "trip"
                    ? "사진을 올리면 날짜와 장소 흐름을 정리해서 포토북 초안을 바로 만듭니다."
                    : currentStepMeta.title}
                </h1>
                <p className="max-w-2xl text-sm leading-7 text-slate-600 sm:text-base sm:leading-8">
                  {activeStep === "trip"
                    ? "여행 설정, 업로드, 사진 정리, 포맷 선택, Sweetbook 생성까지 한 흐름으로 이어집니다. 모바일에서는 한 단계씩만 보이고, 아래 고정 액션으로 다음 단계로 이동합니다."
                    : currentStepMeta.copy}
                </p>
              </div>

              <div className={`flex flex-wrap gap-3 ${activeStep === "trip" ? "" : "hidden sm:flex"}`}>
                <button
                  type="button"
                  className="button-primary rounded-[18px] px-5 py-3 text-sm font-semibold text-white"
                  onClick={() => moveToStep("trip")}
                >
                  {draft ? "내 여행 이어서 보기" : "내 사진으로 시작"}
                </button>
                <button
                  type="button"
                  className="button-secondary rounded-[18px] px-5 py-3 text-sm font-semibold text-slate-900"
                  onClick={handleLoadDemo}
                >
                  샘플 초안 불러오기
                </button>
              </div>
              <div className="flex flex-wrap items-center gap-4 text-sm text-slate-600">
                <Link href="/ops/launchpad" className="font-medium text-[var(--accent)] underline-offset-4 hover:underline">
                  운영 화면 열기
                </Link>
                <span className="hidden h-1 w-1 rounded-full bg-slate-300 sm:inline-flex" />
                <p className="text-sm text-slate-500">
                  업로드, 정리, 포맷 선택, Sweetbook 생성까지 한 흐름으로 이어집니다.
                </p>
              </div>
            </div>

            <div className="studio-card hidden w-full gap-5 rounded-[28px] p-6 xl:grid">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-500">
                    진행 상태
                  </p>
                  <p className="mt-2 text-2xl font-semibold tracking-[-0.04em] text-slate-950">
                    {currentStepMeta.label}
                  </p>
                  <p className="mt-2 text-sm leading-6 text-slate-600">{currentStepMeta.copy}</p>
                </div>
                <span className="rounded-full bg-[var(--accent-soft)] px-3 py-1 text-xs font-semibold text-[var(--accent)]">
                  {draft ? (isDemoSession ? "샘플 세션" : "실사진 세션") : "세션 준비 전"}
                </span>
              </div>

              <div className="grid grid-cols-5 gap-2">
                {studioSteps.map((step) => {
                  const isCurrent = step.id === activeStep;
                  const isCompleted = step.index < currentStepIndex;

                  return (
                    <div
                      key={step.id}
                      className={`h-1.5 rounded-full ${
                        isCurrent
                          ? "bg-[var(--accent)]"
                          : isCompleted
                            ? "bg-[rgba(160,62,64,0.28)]"
                            : "bg-[var(--sand)]"
                      }`}
                    />
                  );
                })}
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div className="rounded-[22px] bg-[var(--sand)] px-4 py-4">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-500">
                    사진
                  </p>
                  <p className="mt-2 text-xl font-semibold tracking-[-0.04em] text-slate-950">
                    {draft?.stats.totalPhotos ?? 0}장
                  </p>
                </div>
                <div className="rounded-[22px] bg-white px-4 py-4">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-500">
                    챕터
                  </p>
                  <p className="mt-2 text-xl font-semibold tracking-[-0.04em] text-slate-950">
                    {draft?.chapters.length ?? 0}개
                  </p>
                </div>
              </div>
            </div>
          </div>
        </section>

        <nav className="wizard-rail rounded-[28px] px-4 py-4 sm:px-5">
          <div className="flex items-end justify-between gap-4">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[var(--accent)]">
                Step {String(currentStepIndex).padStart(2, "0")}
              </p>
              <p className="mt-1 text-base font-semibold tracking-[-0.03em] text-slate-950">
                {currentStepMeta.label}
              </p>
            </div>
            <p className="text-xs font-medium text-slate-500">
              {currentStepIndex} / {studioSteps.length}
            </p>
          </div>

          <div className="mt-4 grid grid-cols-5 gap-2">
            {studioSteps.map((step) => {
              const isCurrent = step.id === activeStep;
              const isCompleted = step.index < currentStepIndex;

              return (
                <div
                  key={step.id}
                  className={`h-1.5 rounded-full ${
                    isCurrent
                      ? "bg-[var(--accent)]"
                      : isCompleted
                        ? "bg-[rgba(160,62,64,0.26)]"
                        : "bg-[var(--sand)]"
                  }`}
                />
              );
            })}
          </div>

          <div className="scroll-row mt-4 flex gap-2 overflow-x-auto pb-1">
            {studioSteps.map((step) => {
              const isCurrent = step.id === activeStep;
              const isCompleted = step.index < currentStepIndex;
              const isAvailable = isStepAvailable(step.id);

              return (
                <button
                  key={step.id}
                  type="button"
                  className={`wizard-pill min-w-[8.4rem] rounded-[18px] px-3 py-3 text-left ${isCurrent ? "is-active" : ""} ${isCompleted ? "is-complete" : ""}`}
                  onClick={() => {
                    if (isAvailable) {
                      moveToStep(step.id);
                    }
                  }}
                  disabled={!isAvailable}
                >
                  <div className="flex items-center gap-3">
                    <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-black/5 text-[11px] font-semibold">
                      {step.index}
                    </span>
                    <div>
                      <p className="text-[11px] font-semibold uppercase tracking-[0.18em] opacity-70">
                        step
                      </p>
                      <p className="mt-1 text-sm font-semibold">{step.label}</p>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </nav>

        <div className="grid gap-6 xl:grid-cols-[minmax(0,1.42fr)_minmax(290px,0.78fr)]">
          <main className="space-y-6">
            <section className={getStepPanelClass("trip")}>
              <div className="flex flex-col gap-4 border-b border-[var(--line)] pb-5 lg:flex-row lg:items-end lg:justify-between">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-500">
                    1. 여행 설정
                  </p>
                  <h2 className="mt-3 text-[clamp(1.8rem,3vw,2.6rem)] font-semibold tracking-[-0.05em] text-slate-950">
                    포토북 제목과 여행 기간을 먼저 맞춥니다.
                  </h2>
                  <p className="mt-3 max-w-2xl text-sm leading-7 text-slate-600">
                    여행 정보는 챕터 제목, 표지 부제, 최종 Sweetbook 제목에 그대로 이어집니다. 처음부터 너무 많은 선택지를 주지 않고, 꼭 필요한 값만 먼저 정리합니다.
                  </p>
                </div>
                <button
                  type="button"
                  className="button-secondary rounded-full px-5 py-3 text-sm font-semibold text-slate-900"
                  onClick={() => moveToStep("upload")}
                >
                  여행 정보 확인 후 업로드로 이동
                </button>
              </div>

              <div className="mt-5 grid gap-4 lg:grid-cols-[minmax(0,1.2fr)_minmax(220px,0.8fr)]">
                <div className="grid gap-4 sm:grid-cols-2">
                  <label className="grid gap-2 sm:col-span-2">
                    <span className="text-sm font-semibold text-slate-900">여행 이름</span>
                    <input
                      value={tripName}
                      onChange={(event) => setTripName(event.target.value)}
                      className="rounded-[22px] border border-[var(--line)] bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-[var(--accent)]"
                      placeholder="예: 도쿄 나이트 앤 라이트"
                    />
                  </label>
                  <label className="grid gap-2">
                    <span className="text-sm font-semibold text-slate-900">출발일</span>
                    <input
                      type="date"
                      value={travelStart}
                      onChange={(event) => setTravelStart(event.target.value)}
                      className="rounded-[22px] border border-[var(--line)] bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-[var(--accent)]"
                    />
                  </label>
                  <label className="grid gap-2">
                    <span className="text-sm font-semibold text-slate-900">종료일</span>
                    <input
                      type="date"
                      value={travelEnd}
                      onChange={(event) => setTravelEnd(event.target.value)}
                      className="rounded-[22px] border border-[var(--line)] bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-[var(--accent)]"
                    />
                  </label>
                </div>

                <div className="rounded-[28px] border border-[rgba(15,118,110,0.18)] bg-[linear-gradient(180deg,_rgba(15,118,110,0.08),_rgba(255,255,255,0.94))] px-5 py-5">
                  <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--accent)]">
                    갤럭시 팁
                  </p>
                  <p className="mt-3 text-lg font-semibold tracking-[-0.03em] text-slate-950">
                    카메라 위치 태그를 켜두면 자동 정리가 가장 정확합니다.
                  </p>
                  <p className="mt-3 text-sm leading-6 text-slate-600">
                    위치 정보가 없는 사진도 괜찮습니다. 업로드 후 사진 몇 장만 선택해서 장소 태그를 넣으면 같은 시간대 컷까지 다시 묶습니다.
                  </p>
                </div>
              </div>
            </section>

            <section className={getStepPanelClass("upload")}>
              <div className="flex flex-col gap-4 border-b border-[var(--line)] pb-5 lg:flex-row lg:items-end lg:justify-between">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-500">
                    2. 사진 업로드
                  </p>
                  <h2 className="mt-3 text-[clamp(1.8rem,3vw,2.6rem)] font-semibold tracking-[-0.05em] text-slate-950">
                    사진을 고르면 바로 목록으로 반영되고 다음 단계로 이어집니다.
                  </h2>
                  <p className="mt-3 max-w-2xl text-sm leading-7 text-slate-600">
                    모바일 브라우저마다 다르게 보이는 기본 파일 입력 UI는 숨기고, 앱이 제어하는 선택 버튼과 상태 카드만 남겼습니다.
                  </p>
                </div>
                <div className="flex flex-wrap gap-3">
                  <button
                    type="button"
                    className="button-secondary rounded-full px-5 py-3 text-sm font-semibold text-slate-900"
                    onClick={handleLoadDemo}
                  >
                    샘플 초안으로 바로 보기
                  </button>
                  <button
                    type="button"
                    className="button-primary rounded-full px-5 py-3 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
                    onClick={handleUpload}
                    disabled={isUploading || selectedUploads.length === 0}
                  >
                    {isUploading ? "사진 정리 중..." : "사진 읽고 다음 단계로"}
                  </button>
                </div>
              </div>

              <div className="mt-5 grid gap-4 xl:grid-cols-[minmax(0,1.1fr)_minmax(260px,0.9fr)]">
                <div className="space-y-4">
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="flex min-h-[14rem] w-full cursor-pointer flex-col items-center justify-center rounded-[30px] border border-dashed border-[rgba(15,118,110,0.26)] bg-[linear-gradient(180deg,_rgba(255,255,255,0.96),_rgba(239,247,245,0.96))] px-6 py-8 text-center transition hover:border-[var(--accent)] hover:bg-white"
                  >
                    <span className="rounded-full bg-[var(--accent-soft)] px-4 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-[var(--accent)]">
                      사진 선택
                    </span>
                    <h3 className="mt-5 text-2xl font-semibold tracking-[-0.04em] text-slate-950">
                      갤러리에서 여행 사진을 여러 장 고르세요.
                    </h3>
                    <p className="mt-3 max-w-xl text-sm leading-6 text-slate-600">
                      선택 직후 아래에 파일명과 장수가 바로 보이고, 업로드하면 날짜별·장소별로 자동 정리됩니다.
                    </p>
                    <p className="mt-4 text-xs font-medium text-slate-500">
                      갤럭시 사진은 위치 태그가 켜져 있으면 자동 정리 정확도가 더 높습니다.
                    </p>
                  </button>
                  <input
                    ref={fileInputRef}
                    id="studio-photo-picker"
                    type="file"
                    accept="image/*,.jpg,.jpeg,.png,.webp,.heic,.heif"
                    multiple
                    className="sr-only"
                    onChange={handleFileInputChange}
                  />

                  <div className="flex flex-wrap gap-3">
                    <button
                      type="button"
                      className="button-secondary rounded-full px-5 py-3 text-sm font-semibold text-slate-900"
                      onClick={() => fileInputRef.current?.click()}
                    >
                      사진 다시 고르기
                    </button>
                    {selectedUploads.length > 0 ? (
                      <span className="rounded-full bg-[var(--accent-soft)] px-4 py-3 text-sm font-semibold text-[var(--accent)]">
                        {selectedUploads.length}장 선택됨
                      </span>
                    ) : null}
                  </div>

                  {selectedUploads.length > 0 ? (
                    <div className="space-y-4">
                      <div className="rounded-[24px] border border-[rgba(15,118,110,0.18)] bg-[rgba(15,118,110,0.06)] px-4 py-3 text-sm text-slate-700">
                        사진이 선택되면 아래 목록이 바로 보여야 정상입니다. 이 목록이 보이면 다음 버튼으로 업로드를 진행할 수 있습니다.
                      </div>
                      <div className="rounded-[24px] border border-[var(--line)] bg-white px-4 py-4">
                        <div className="flex flex-wrap items-center justify-between gap-3">
                          <div>
                            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
                              최근 선택
                            </p>
                            <p className="mt-2 text-lg font-semibold tracking-[-0.03em] text-slate-950">
                              {formatSelectionTimestamp(lastSelectedAt)}
                            </p>
                          </div>
                          <span className="rounded-full bg-[var(--accent-soft)] px-4 py-2 text-sm font-semibold text-[var(--accent)]">
                            총 {selectedUploads.length}장 / {formatBytes(totalUploadSize)}
                          </span>
                        </div>
                      </div>
                      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                        {selectedUploads.map((item) => (
                          <div key={item.key} className="overflow-hidden rounded-[26px] border border-[var(--line)] bg-white">
                            <div className="relative flex h-44 items-end bg-[linear-gradient(160deg,_rgba(15,23,42,0.94),_rgba(15,118,110,0.56))] p-4 text-white">
                              <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,_rgba(255,255,255,0.16),_transparent_42%)]" />
                              <div className="relative inset-x-0 bottom-0 text-white">
                                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-white/72">
                                  선택된 사진
                                </p>
                                <p className="mt-2 line-clamp-2 text-lg font-semibold tracking-[-0.03em]">
                                  {item.displayName}
                                </p>
                              </div>
                            </div>
                            <div className="px-4 py-4">
                              <p className="truncate text-sm font-semibold text-slate-900">
                                {item.displayName}
                              </p>
                              <p className="mt-1 text-xs text-slate-500">
                                {formatBytes(item.file.size)}
                                {item.file.type ? ` · ${item.file.type}` : ""}
                              </p>
                            </div>
                          </div>
                        ))}
                      </div>
                      <div className="rounded-[24px] border border-[var(--line)] bg-white px-4 py-4">
                        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
                          선택한 파일 목록
                        </p>
                        <div className="mt-3 grid gap-2">
                          {selectedUploads.map((item, index) => (
                            <div
                              key={`name-${item.key}`}
                              className="flex items-center justify-between gap-3 rounded-[18px] bg-slate-50 px-3 py-2 text-sm text-slate-700"
                            >
                              <span className="min-w-0 truncate">
                                {index + 1}. {item.displayName}
                              </span>
                              <span className="shrink-0 text-xs text-slate-500">
                                {formatBytes(item.file.size)}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  ) : null}

                  {uploadError ? (
                    <div className="rounded-[24px] border border-rose-200 bg-rose-50 px-5 py-4 text-sm text-rose-700">
                      {uploadError}
                    </div>
                  ) : null}
                  {reviewFeedback && draft ? (
                    <div className="rounded-[24px] border border-[rgba(15,118,110,0.2)] bg-[rgba(15,118,110,0.08)] px-5 py-4 text-sm text-slate-700">
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <span>{reviewFeedback}</span>
                        <button
                          type="button"
                          className="rounded-full border border-[rgba(15,118,110,0.2)] bg-white px-3 py-1 text-xs font-semibold text-[var(--accent)]"
                          onClick={() => moveToStep("review")}
                        >
                          검토 결과 보기
                        </button>
                      </div>
                    </div>
                  ) : null}
                </div>

                <div className="grid gap-3 sm:grid-cols-3 xl:grid-cols-1">
                  <div className="rounded-[24px] border border-[var(--line)] bg-white px-5 py-4">
                    <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
                      선택한 사진
                    </p>
                    <p className="mt-2 text-xl font-semibold tracking-[-0.03em] text-slate-950">
                      {selectedUploads.length}장
                    </p>
                  </div>
                  <div className="rounded-[24px] border border-[var(--line)] bg-white px-5 py-4">
                    <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
                      총 용량
                    </p>
                    <p className="mt-2 text-xl font-semibold tracking-[-0.03em] text-slate-950">
                      {formatBytes(totalUploadSize)}
                    </p>
                  </div>
                  <div className="rounded-[24px] border border-[var(--line)] bg-white px-5 py-4">
                    <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
                      현재 테마
                    </p>
                    <p className="mt-2 text-xl font-semibold tracking-[-0.03em] text-slate-950">
                      {resolvedTheme.name}
                    </p>
                  </div>
                  <div className="rounded-[24px] border border-[var(--line)] bg-[rgba(15,118,110,0.06)] px-5 py-4 sm:col-span-3 xl:col-span-1">
                    <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--accent)]">
                      샘플 데모도 가능
                    </p>
                    <p className="mt-2 text-sm leading-6 text-slate-700">
                      {demoTripQuickFacts.primaryNote}
                    </p>
                  </div>
                </div>
              </div>
            </section>

            <section className={getStepPanelClass("review")}>
              <div className="flex flex-col gap-4 border-b border-[var(--line)] pb-5 lg:flex-row lg:items-end lg:justify-between">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-500">
                    3. 사진 정리
                  </p>
                  <h2 className="mt-3 text-[clamp(1.8rem,3vw,2.6rem)] font-semibold tracking-[-0.05em] text-slate-950">
                    자동으로 묶인 챕터를 보고, 필요한 사진만 보정합니다.
                  </h2>
                  <p className="mt-3 max-w-2xl text-sm leading-7 text-slate-600">
                    GPS 좌표가 있는 사진은 같은 장소끼리 묶고, 없는 사진은 같은 날짜의 시간 흐름을 따라 가까운 그룹에 배치합니다. 위치가 확실치 않은 컷만 수동 태깅하면 됩니다.
                  </p>
                </div>
                <button
                  type="button"
                  className="button-primary rounded-full px-5 py-3 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
                  onClick={() => moveToStep("preview")}
                  disabled={!canOpenPreview}
                >
                  포토북 디자인 보기
                </button>
              </div>

              {!draft ? (
                <div className="mt-5 rounded-[28px] border border-dashed border-[var(--line)] bg-white/72 px-5 py-8 text-center text-sm text-slate-500">
                  사진을 업로드하면 이 자리에서 날짜/장소별 챕터와 보정이 필요한 사진이 바로 열립니다.
                </div>
              ) : (
                <div className="mt-5 space-y-5">
                  <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                    {[
                      ["총 사진", String(draft.stats.totalPhotos)],
                      ["자동 정리", String(draft.stats.withResolvedLocation)],
                      ["GPS 포함", String(draft.stats.withGpsCoordinates)],
                      ["수동 보정 필요", String(draft.stats.manualTaggingRequired)],
                    ].map(([label, value]) => (
                      <div key={label} className="rounded-[24px] border border-[var(--line)] bg-white px-4 py-4">
                        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
                          {label}
                        </p>
                        <p className="mt-2 text-2xl font-semibold tracking-[-0.04em] text-slate-950">
                          {value}
                        </p>
                      </div>
                    ))}
                  </div>

                  <div className="grid gap-4 xl:grid-cols-[minmax(0,1.05fr)_minmax(280px,0.95fr)]">
                    <div className="space-y-4">
                      <div className="grid gap-4 md:grid-cols-2">
                        {draft.chapters.map((chapter) => {
                          const leadPhoto = draftPhotoById.get(chapter.photoIds[0]);

                          return (
                            <div key={chapter.id} className="overflow-hidden rounded-[28px] border border-[var(--line)] bg-white">
                              <PhotoSurface
                                photo={leadPhoto}
                                className="min-h-[12rem] rounded-none border-0"
                                subtitle={`${chapter.dayLabel} · ${chapter.photoCount}장`}
                              />
                              <div className="px-4 py-4">
                                <p className="text-lg font-semibold tracking-[-0.04em] text-slate-950">
                                  {chapter.placeLabel}
                                </p>
                                <p className="mt-1 text-sm text-slate-600">{chapter.groupingReason}</p>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    <div className="space-y-4">
                      <div className="rounded-[28px] border border-[var(--line)] bg-[linear-gradient(180deg,_rgba(255,255,255,0.94),_rgba(244,250,249,0.98))] p-5">
                        <p className="text-sm font-semibold text-slate-950">위치 보정 패널</p>
                        <p className="mt-3 text-sm leading-6 text-slate-600">
                          자동 정리에서 빠진 사진만 골라 같은 장소 태그를 붙이면, 챕터가 즉시 다시 계산됩니다.
                        </p>

                        <label className="mt-4 grid gap-2">
                          <span className="text-sm font-semibold text-slate-900">장소 이름</span>
                          <input
                            value={manualLocationLabel}
                            onChange={(event) => setManualLocationLabel(event.target.value)}
                            className="rounded-[22px] border border-[var(--line)] bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-[var(--accent)]"
                            placeholder="예: 아사쿠사 센소지"
                          />
                        </label>

                        {suggestedLocations.length > 0 ? (
                          <div className="mt-4 flex flex-wrap gap-2">
                            {suggestedLocations.map((label) => (
                              <button
                                key={label}
                                type="button"
                                className="rounded-full border border-[var(--line)] bg-white px-3 py-2 text-xs font-semibold text-slate-700 transition hover:border-[var(--accent)]"
                                onClick={() => setManualLocationLabel(label)}
                              >
                                {label}
                              </button>
                            ))}
                          </div>
                        ) : null}

                        <div className="mt-4 flex flex-wrap gap-3">
                          <button
                            type="button"
                            className="button-primary rounded-full px-5 py-3 text-sm font-semibold text-white"
                            onClick={handleApplyManualTag}
                          >
                            선택 사진에 태그 적용
                          </button>
                          <button
                            type="button"
                            className="button-secondary rounded-full px-5 py-3 text-sm font-semibold text-slate-900"
                            onClick={() =>
                              setSelectedPhotoIds(
                                photosNeedingManualTagging.map((photo) => photo.id),
                              )
                            }
                          >
                            보정 필요 사진 전체 선택
                          </button>
                        </div>

                        {reviewFeedback ? (
                          <div className="mt-4 rounded-[22px] border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
                            {reviewFeedback}
                          </div>
                        ) : null}
                      </div>

                      <div className="space-y-3">
                        {photosNeedingManualTagging.length > 0 ? (
                          photosNeedingManualTagging.map((photo) => {
                            const isSelected = selectedPhotoIds.includes(photo.id);

                            return (
                              <label
                                key={photo.id}
                                className={`flex cursor-pointer gap-4 rounded-[24px] border px-4 py-4 transition ${
                                  isSelected
                                    ? "border-[var(--accent)] bg-[rgba(15,118,110,0.06)]"
                                    : "border-[var(--line)] bg-white hover:border-[rgba(15,118,110,0.3)]"
                                }`}
                              >
                                <input
                                  type="checkbox"
                                  className="mt-1"
                                  checked={isSelected}
                                  onChange={() =>
                                    setSelectedPhotoIds((current) =>
                                      current.includes(photo.id)
                                        ? current.filter((item) => item !== photo.id)
                                        : [...current, photo.id],
                                    )
                                  }
                                />
                                <div className="min-w-0 flex-1">
                                  <p className="truncate text-sm font-semibold text-slate-950">
                                    {photo.originalName}
                                  </p>
                                  <p className="mt-1 text-sm text-slate-600">{photo.groupingReason}</p>
                                  <p className="mt-2 text-xs text-slate-500">
                                    {formatDateLabel(photo.capturedAt)}
                                  </p>
                                </div>
                              </label>
                            );
                          })
                        ) : (
                          <div className="rounded-[24px] border border-[rgba(15,118,110,0.18)] bg-[rgba(15,118,110,0.06)] px-5 py-5 text-sm leading-6 text-slate-700">
                            위치가 비는 사진이 없습니다. 바로 포토북 디자인으로 넘어가도 됩니다.
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </section>
            <section className={getStepPanelClass("preview")}>
              <div className="flex flex-col gap-4 border-b border-[var(--line)] pb-5 lg:flex-row lg:items-end lg:justify-between">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-500">
                    4. 포토북 디자인
                  </p>
                  <h2 className="mt-3 text-[clamp(1.8rem,3vw,2.6rem)] font-semibold tracking-[-0.05em] text-slate-950">
                    사진이 실제 포토북 포맷에 맞게 정리되는 장면을 바로 보여줍니다.
                  </h2>
                  <p className="mt-3 max-w-2xl text-sm leading-7 text-slate-600">
                    여기에선 실제 업로드 사진을 기준으로 커버와 챕터 스프레드를 만듭니다. 포맷을 바꾸면 전체 무드가 즉시 달라지고, 선택한 포맷은 Sweetbook 생성 계획에도 반영됩니다.
                  </p>
                </div>
                <button
                  type="button"
                  className="button-primary rounded-full px-5 py-3 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
                  onClick={() => moveToStep("publish")}
                  disabled={!canOpenPublish}
                >
                  Sweetbook 생성 단계로 이동
                </button>
              </div>

              {!draft || !previewDocument ? (
                <div className="mt-5 rounded-[28px] border border-dashed border-[var(--line)] bg-white/72 px-5 py-8 text-center text-sm text-slate-500">
                  사진을 업로드하고 정리하면 실제 포토북 커버와 스프레드가 이 자리에서 생성됩니다.
                </div>
              ) : (
                <div className="mt-5 space-y-5">
                  <div className="grid gap-4 lg:grid-cols-3">
                    {travelThemes.map((theme) => {
                      const isSelected = theme.id === resolvedTheme.id;

                      return (
                        <button
                          key={theme.id}
                          type="button"
                          className={`text-left transition ${isSelected ? "-translate-y-1" : "hover:-translate-y-0.5"}`}
                          onClick={() => handleThemeChange(theme.id)}
                        >
                          <article
                            className={`overflow-hidden rounded-[28px] border bg-white p-5 shadow-[0_14px_30px_rgba(15,23,42,0.05)] ${isSelected ? "border-[rgba(15,118,110,0.32)] ring-2 ring-[rgba(15,118,110,0.14)]" : "border-[var(--line)]"}`}
                          >
                            <div className={`rounded-[24px] px-4 py-4 ${theme.spotlightClassName}`}>
                              <div className="flex items-center justify-between gap-3">
                                <p className="text-lg font-semibold tracking-[-0.04em] text-slate-950">
                                  {theme.name}
                                </p>
                                <span className={`rounded-full px-3 py-1 text-xs font-semibold ${theme.badgeClassName}`}>
                                  {theme.accentLabel}
                                </span>
                              </div>
                              <p className="mt-3 text-sm leading-6 text-slate-700">{theme.note}</p>
                            </div>
                            <p className="mt-4 text-sm leading-6 text-slate-600">
                              {theme.editorialNote}
                            </p>
                          </article>
                        </button>
                      );
                    })}
                  </div>

                  <div className="grid gap-4 xl:grid-cols-[minmax(0,0.92fr)_minmax(0,1.08fr)]">
                    <article className="overflow-hidden rounded-[32px] border border-[rgba(255,255,255,0.25)] bg-[linear-gradient(180deg,_rgba(15,23,42,0.92),_rgba(15,118,110,0.72))] p-6 text-white">
                      <div className="flex flex-wrap gap-2">
                        <span className="rounded-full bg-white/12 px-3 py-1 text-xs font-semibold tracking-[0.2em] text-white/80">
                          {previewDocument.cover.accent}
                        </span>
                        <span className="rounded-full bg-white/12 px-3 py-1 text-xs font-semibold tracking-[0.2em] text-white/80">
                          {productLabel}
                        </span>
                      </div>
                      <h3 className="mt-16 max-w-sm text-[clamp(2rem,4vw,3.2rem)] font-semibold tracking-[-0.06em] text-white">
                        {previewDocument.cover.title}
                      </h3>
                      <p className="mt-4 max-w-sm text-sm leading-6 text-white/78">
                        {previewDocument.cover.subtitle}
                      </p>
                      <div className="mt-8 grid gap-3 sm:grid-cols-2">
                        <div className="rounded-[22px] border border-white/12 bg-white/10 px-4 py-4">
                          <p className="text-[11px] uppercase tracking-[0.2em] text-white/60">
                            챕터
                          </p>
                          <p className="mt-2 text-lg font-semibold text-white">
                            {draft.chapters.length}개
                          </p>
                        </div>
                        <div className="rounded-[22px] border border-white/12 bg-white/10 px-4 py-4">
                          <p className="text-[11px] uppercase tracking-[0.2em] text-white/60">
                            예상 페이지
                          </p>
                          <p className="mt-2 text-lg font-semibold text-white">{pageCount}p</p>
                        </div>
                      </div>
                    </article>

                    <div className="grid gap-4">
                      <div className="rounded-[28px] border border-[var(--line)] bg-white px-5 py-5">
                        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
                          상품 규격
                        </p>
                        <p className="mt-2 text-2xl font-semibold tracking-[-0.04em] text-slate-950">
                          {productLabel}
                        </p>
                        <p className="mt-2 text-sm leading-6 text-slate-600">
                          {productDimension} · {pageRuleSummary}
                        </p>
                        <p className="mt-4 text-sm font-medium text-slate-700">
                          예상 금액 {estimatedPrice.toLocaleString("ko-KR")}원
                        </p>
                        {productMetaError ? (
                          <p className="mt-3 text-sm text-amber-700">{productMetaError}</p>
                        ) : null}
                        {isLoadingProductMeta ? (
                          <p className="mt-3 text-sm text-slate-500">상품 규격을 동기화하는 중입니다.</p>
                        ) : null}
                      </div>
                      <div className="rounded-[28px] border border-[var(--line)] bg-white px-5 py-5">
                        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
                          Sweetbook 계획 반영
                        </p>
                        <p className="mt-2 text-lg font-semibold tracking-[-0.04em] text-slate-950">
                          {plan?.themeLabel ?? resolvedTheme.name}
                        </p>
                        <p className="mt-3 text-sm leading-6 text-slate-600">
                          {plan
                            ? `${plan.operations.length}개 단계로 커버, 챕터, 발행 페이지를 자동 조립합니다.`
                            : "포맷 선택 결과를 바탕으로 Sweetbook 조립 계획을 계산합니다."}
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-4">
                    {previewDocument.spreads.map((spread) => (
                      <PreviewSpreadCard
                        key={spread.id}
                        spread={spread}
                        photoById={draftPhotoById}
                      />
                    ))}
                  </div>
                </div>
              )}
            </section>

            <section className={getStepPanelClass("publish")}>
              <div className="flex flex-col gap-4 border-b border-[var(--line)] pb-5 lg:flex-row lg:items-end lg:justify-between">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-500">
                    5. Sweetbook 생성
                  </p>
                  <h2 className="mt-3 text-[clamp(1.8rem,3vw,2.6rem)] font-semibold tracking-[-0.05em] text-slate-950">
                    검토한 초안을 실제 테스트 책과 주문으로 넘깁니다.
                  </h2>
                  <p className="mt-3 max-w-2xl text-sm leading-7 text-slate-600">
                    이 단계가 끝나면 bookUid와 orderUid가 생기고, 운영 화면에서 웹훅 이벤트까지 이어서 확인할 수 있습니다.
                  </p>
                </div>
                <div className="flex flex-wrap gap-3">
                  <button
                    type="button"
                    className="button-primary rounded-full px-5 py-3 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
                    onClick={handleComposeBook}
                    disabled={!draft || isComposing}
                  >
                    {isComposing ? "Sweetbook 테스트 책 생성 중..." : "Sweetbook 테스트 책 생성"}
                  </button>
                  <Link
                    href="/ops/webhooks"
                    className="button-secondary rounded-full px-5 py-3 text-sm font-semibold text-slate-900"
                  >
                    웹훅 운영 보기
                  </Link>
                </div>
              </div>

              <div className="mt-5 grid gap-4 xl:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
                <div className="space-y-4">
                  <div className="rounded-[28px] border border-[var(--line)] bg-white px-5 py-5">
                    <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
                      생성 전 요약
                    </p>
                    <div className="mt-4 grid gap-3 sm:grid-cols-2">
                      <div className="rounded-[22px] bg-[var(--accent-soft)] px-4 py-3">
                        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--accent)]">
                          사진
                        </p>
                        <p className="mt-2 text-lg font-semibold text-slate-950">
                          {draft?.stats.totalPhotos ?? 0}장
                        </p>
                      </div>
                      <div className="rounded-[22px] border border-[var(--line)] px-4 py-3">
                        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
                          챕터
                        </p>
                        <p className="mt-2 text-lg font-semibold text-slate-950">
                          {draft?.chapters.length ?? 0}개
                        </p>
                      </div>
                      <div className="rounded-[22px] border border-[var(--line)] px-4 py-3">
                        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
                          포맷
                        </p>
                        <p className="mt-2 text-lg font-semibold text-slate-950">
                          {resolvedTheme.name}
                        </p>
                      </div>
                      <div className="rounded-[22px] border border-[var(--line)] px-4 py-3">
                        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
                          예상 페이지
                        </p>
                        <p className="mt-2 text-lg font-semibold text-slate-950">
                          {pageCount}p
                        </p>
                      </div>
                    </div>
                    {composeError ? (
                      <div className="mt-4 rounded-[22px] border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                        {composeError}
                      </div>
                    ) : null}
                  </div>

                  {composeResult ? (
                    <div className="rounded-[28px] border border-[rgba(15,118,110,0.18)] bg-[rgba(15,118,110,0.06)] px-5 py-5">
                      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--accent)]">
                        생성 완료
                      </p>
                      <p className="mt-2 text-lg font-semibold tracking-[-0.03em] text-slate-950">
                        bookUid {composeResult.bookUid}
                      </p>
                      <p className="mt-3 text-sm leading-6 text-slate-700">
                        {composeResult.operationCount ?? 0}개 조립 단계와 {composeResult.contentCount ?? 0}개 본문 처리가 완료됐습니다.
                      </p>
                    </div>
                  ) : null}

                  {orderResult ? (
                    <div className="rounded-[28px] border border-[rgba(243,123,87,0.18)] bg-[rgba(243,123,87,0.08)] px-5 py-5">
                      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--accent-secondary)]">
                        주문 완료
                      </p>
                      <p className="mt-2 text-lg font-semibold tracking-[-0.03em] text-slate-950">
                        orderUid {orderResult.orderUid ?? "확인 중"}
                      </p>
                      <p className="mt-3 text-sm leading-6 text-slate-700">
                        상태 {orderResult.orderStatusDisplay ?? "확인 중"} · 금액{" "}
                        {orderResult.totalAmount
                          ? `${orderResult.totalAmount.toLocaleString("ko-KR")}원`
                          : "확인 중"}
                      </p>
                    </div>
                  ) : null}
                </div>

                <div className="rounded-[28px] border border-[var(--line)] bg-white px-5 py-5">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
                        배송지 입력
                      </p>
                      <p className="mt-2 text-lg font-semibold tracking-[-0.03em] text-slate-950">
                        테스트 책 생성 후 주문까지 이어갑니다.
                      </p>
                    </div>
                    <span className="rounded-full bg-[var(--accent-soft)] px-3 py-1 text-xs font-semibold text-[var(--accent)]">
                      {composeResult ? "주문 가능" : "책 생성 후 활성화"}
                    </span>
                  </div>
                  <div className="mt-5 grid gap-4 sm:grid-cols-2">
                    {[
                      ["ordererName", "주문자 이름", "홍길동", "text"],
                      ["bookUid", "bookUid", "생성 후 자동 입력", "text"],
                      ["recipientName", "받는 분 이름", "홍길동", "text"],
                      ["recipientPhone", "연락처", "010-1234-5678", "text"],
                      ["postalCode", "우편번호", "06123", "text"],
                      ["quantity", "수량", "1", "number"],
                      ["address1", "주소 1", "서울시 강남구 테헤란로 123", "text"],
                      ["address2", "주소 2", "5층 501호", "text"],
                      ["memo", "배송 메모", "문 앞에 놓아 주세요", "text"],
                    ].map(([key, label, placeholder, type]) => (
                      <label
                        key={key}
                        className={`grid gap-2 ${key === "address1" || key === "address2" || key === "memo" ? "sm:col-span-2" : ""}`}
                      >
                        <span className="text-sm font-semibold text-slate-900">{label}</span>
                        <input
                          type={type}
                          value={String(orderDraft[key as keyof CheckoutOrderDraft])}
                          disabled={!composeResult && key === "bookUid"}
                          onChange={(event) =>
                            setOrderDraft((current) => ({
                              ...current,
                              [key]:
                                key === "quantity"
                                  ? Number(event.target.value || 1)
                                  : event.target.value,
                            }))
                          }
                          className="rounded-[22px] border border-[var(--line)] bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-[var(--accent)] disabled:bg-slate-100"
                          placeholder={placeholder}
                        />
                        {orderErrors[key as keyof CheckoutOrderDraft] ? (
                          <span className="text-xs text-rose-600">
                            {orderErrors[key as keyof CheckoutOrderDraft]}
                          </span>
                        ) : null}
                      </label>
                    ))}
                  </div>

                  {orderError ? (
                    <div className="mt-4 rounded-[22px] border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                      {orderError}
                    </div>
                  ) : null}

                  <div className="mt-5 flex flex-wrap gap-3">
                    <button
                      type="button"
                      className="button-primary rounded-full px-5 py-3 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
                      onClick={handleCreateOrder}
                      disabled={!composeResult || isOrdering}
                    >
                      {isOrdering ? "주문 생성 중..." : "주문 생성"}
                    </button>
                    <button
                      type="button"
                      className="button-secondary rounded-full px-5 py-3 text-sm font-semibold text-slate-900"
                      onClick={handleResetAll}
                    >
                      새 여행 다시 시작
                    </button>
                  </div>
                </div>
              </div>
            </section>
          </main>

          <aside className="hidden space-y-6 xl:block">
            <div className="studio-card rounded-[32px] p-5">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
                지금 상태
              </p>
              <p className="mt-3 text-2xl font-semibold tracking-[-0.04em] text-slate-950">
                {draft ? draft.tripName : "아직 여행 초안이 없습니다"}
              </p>
              <p className="mt-3 text-sm leading-6 text-slate-600">
                {draft
                  ? `${draft.stats.totalPhotos}장 중 ${draft.stats.withResolvedLocation}장이 자동 정리됐고 ${draft.stats.manualTaggingRequired}장은 보정 대기 중입니다.`
                  : "여행 설정과 사진 업로드를 마치면 자동 그룹핑 상태가 이 영역에 요약됩니다."}
              </p>
            </div>

            <div className="studio-card rounded-[32px] p-5">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
                빠른 이동
              </p>
              <div className="mt-4 grid gap-3">
                <button
                  type="button"
                  className="button-secondary rounded-full px-4 py-3 text-left text-sm font-semibold text-slate-900"
                  onClick={() => moveToStep("trip")}
                >
                  여행 설정 보기
                </button>
                <button
                  type="button"
                  className="button-secondary rounded-full px-4 py-3 text-left text-sm font-semibold text-slate-900"
                  onClick={() => moveToStep("upload")}
                >
                  사진 업로드 보기
                </button>
                <button
                  type="button"
                  className="button-secondary rounded-full px-4 py-3 text-left text-sm font-semibold text-slate-900 disabled:cursor-not-allowed disabled:opacity-50"
                  onClick={() => moveToStep("review")}
                  disabled={!canOpenReview}
                >
                  사진 정리 보기
                </button>
                <button
                  type="button"
                  className="button-secondary rounded-full px-4 py-3 text-left text-sm font-semibold text-slate-900 disabled:cursor-not-allowed disabled:opacity-50"
                  onClick={() => moveToStep("preview")}
                  disabled={!canOpenPreview}
                >
                  포토북 디자인 보기
                </button>
                <button
                  type="button"
                  className="button-secondary rounded-full px-4 py-3 text-left text-sm font-semibold text-slate-900 disabled:cursor-not-allowed disabled:opacity-50"
                  onClick={() => moveToStep("publish")}
                  disabled={!canOpenPublish}
                >
                  Sweetbook 생성 보기
                </button>
              </div>
            </div>

            <div className="studio-card rounded-[32px] p-5">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
                제출 메모
              </p>
              <ul className="mt-4 space-y-3 text-sm leading-6 text-slate-600">
                <li>실사진 흐름은 이 스튜디오 페이지 하나에서 설명할 수 있도록 정리했습니다.</li>
                <li>포맷은 타임라인, 포스트카드 맵, 포토 에세이 세 가지로 고정했습니다.</li>
                <li>Gemini 연결 전까지는 GPS와 시간대 기반으로 장소 그룹을 만들고, 필요한 것만 수동 보정합니다.</li>
              </ul>
            </div>
          </aside>
        </div>

        <div className="mobile-step-dock rounded-[24px] p-3 xl:mx-auto xl:w-full xl:max-w-[52rem]">
          <div className="flex items-center gap-3">
            <button
              type="button"
              className="button-secondary min-h-12 shrink-0 rounded-[16px] px-4 py-3 text-sm font-semibold text-slate-900 disabled:opacity-45"
              onClick={() => {
                if (previousStep) {
                  moveToStep(previousStep.id);
                }
              }}
              disabled={!previousStep}
            >
              이전
            </button>
            <div className="min-w-0 flex-1 rounded-[18px] border border-[var(--line)] bg-white px-4 py-3">
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                {currentStepIndex} / {studioSteps.length}
              </p>
              <p className="mt-1 truncate text-sm font-semibold text-slate-950">
                {studioSteps[currentStepIndex - 1]?.label}
              </p>
            </div>
            {mobilePrimaryAction ? (
              <button
                type="button"
                className="button-primary min-h-12 shrink-0 rounded-[16px] px-4 py-3 text-sm font-semibold text-white disabled:opacity-45"
                onClick={mobilePrimaryAction.onClick}
                disabled={mobilePrimaryAction.disabled}
              >
                {mobilePrimaryAction.label}
              </button>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}
