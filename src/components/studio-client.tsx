"use client";

import Image from "next/image";
import Link from "next/link";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type KeyboardEvent as ReactKeyboardEvent,
  type PointerEvent as ReactPointerEvent,
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
} from "@/lib/demo-trip-draft";
import { buildUploadedPhotoSrc } from "@/lib/photo-assets";
import {
  buildPhotobookPreviewDocument,
  type PhotobookPreviewSpread,
} from "@/lib/photobook-preview";
import { isMeaningfulLocationLabel } from "@/lib/trip-grouping";
import { estimateRequestedTravelPages } from "@/lib/sweetbook-book-specs";
import {
  applyManualDateTagToDraft,
  applyManualLocationTagToDraft,
  applyThemeSelectionToDraft,
  clearTripDraft,
  removePhotosFromDraft,
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
  previewUrl: string | null;
  signature: string;
  duplicateKind: "none" | "existing" | "selection";
};

type UploadDiagnosticEntry = {
  id: string;
  message: string;
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

const stitchStepOneVisual =
  "https://lh3.googleusercontent.com/aida-public/AB6AXuBD98wdimewvmJ6ARaZBwvc8emZsFushy3D7wm8QtaElcVYT-JvkGbvWXvcAzVQbM2aoP8E6spQPOSc4ht0bBLk_sm5CyfbZc1XYU246fwuKFeETbOjLG4gXbT1H4KbFJMj_-iqZ-gVwkH_hwpivsz4F55ykz9yb5Z1h_71I0v8Ba4pjnuwTLphnvd3uxWMKwss1aB8JL2M8DAmwevrDKeqWBERKUr6sFgiNvxW_Ee-fH8GefKtS5syskR4vzDNCiYddQqZFbfvAHo";

const UPLOAD_DIAGNOSTICS_STORAGE_KEY = "triplogue:upload-diagnostics";
const NATIVE_FILE_SYNC_NOTE_KEY = "triplogue:native-file-sync-note";

function safeGetSessionStorageItem(key: string) {
  try {
    return window.sessionStorage.getItem(key);
  } catch {
    return null;
  }
}

function safeSetSessionStorageItem(key: string, value: string) {
  try {
    window.sessionStorage.setItem(key, value);
  } catch {
    // Ignore storage failures on restricted mobile browsers.
  }
}

function safeRemoveSessionStorageItem(key: string) {
  try {
    window.sessionStorage.removeItem(key);
  } catch {
    // Ignore storage failures on restricted mobile browsers.
  }
}

type NativePickerSnapshot = {
  value: string;
  fileCount: number;
  fileNames: string[];
  totalSize: number;
};

type ReviewSelectionKind = "date" | "location";

type ReviewSelectionBox = {
  kind: ReviewSelectionKind;
  left: number;
  top: number;
  width: number;
  height: number;
};

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

function getStudioStepHref(step: StudioStepId) {
  return `/studio?step=${step}`;
}

function getFileKey(file: File) {
  return `${file.name}:${file.size}:${file.lastModified}`;
}

function getUploadSignature(name: string, size: number) {
  return `${name}:${size}`;
}

function dedupeFilesByKey(files: File[]) {
  const seen = new Set<string>();
  return files.filter((file) => {
    const key = getFileKey(file);
    if (seen.has(key)) {
      return false;
    }
    seen.add(key);
    return true;
  });
}

function isAcceptedImageFile(file: File) {
  const normalizedName = file.name.trim().toLowerCase();
  const hasRealPayload = file.size > 0 || normalizedName.length > 0;
  const looksLikeImage =
    file.type.startsWith("image/") ||
    /\.(jpg|jpeg|png|webp|heic|heif)$/i.test(normalizedName);

  return hasRealPayload && looksLikeImage && file.size > 0;
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

function normalizeSelectedFile(
  file: File,
  index: number,
  duplicateKind: SelectedUploadFile["duplicateKind"] = "none",
) {
  const displayName =
    file.name.trim() ||
    `mobile-photo-${Date.now()}-${index + 1}${getFallbackImageExtension(file)}`;

  let previewUrl: string | null = null;

  try {
    previewUrl = URL.createObjectURL(file);
  } catch {
    previewUrl = null;
  }

  return {
    key: `${index}-${getFileKey(file) || displayName}`,
    file,
    displayName,
    previewUrl,
    signature: getUploadSignature(displayName, file.size),
    duplicateKind,
  } satisfies SelectedUploadFile;
}

function buildSelectedUploadItems(
  files: File[],
  existingUploadSignatures: Set<string>,
  currentSelections: SelectedUploadFile[] = [],
) {
  const selectionSignatures = new Set(currentSelections.map((item) => item.signature));

  const appended = files
    .map((file, index) => {
    const displayName =
      file.name.trim() ||
      `mobile-photo-${Date.now()}-${index + 1}${getFallbackImageExtension(file)}`;
    const signature = getUploadSignature(displayName, file.size);
      if (selectionSignatures.has(signature)) {
        return null;
      }
      const duplicateKind: SelectedUploadFile["duplicateKind"] = existingUploadSignatures.has(signature)
        ? "existing"
        : "none";

    selectionSignatures.add(signature);
    return normalizeSelectedFile(file, currentSelections.length + index, duplicateKind);
    })
    .filter((item): item is SelectedUploadFile => Boolean(item));

  return [...currentSelections, ...appended];
}

function formatDateKeyBadge(dateKey: string) {
  if (dateKey === "undated") {
    return "미지정";
  }

  const date = new Date(`${dateKey}T00:00:00`);
  if (Number.isNaN(date.getTime())) {
    return dateKey;
  }

  const month = date.getMonth() + 1;
  const day = date.getDate();
  return `${month}/${day}`;
}

function clampSelectionValue(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
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
  showOverlay = true,
}: {
  photo: TripDraftPhoto | undefined;
  className?: string;
  subtitle?: string;
  showOverlay?: boolean;
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
      {showOverlay ? (
        <div className="absolute inset-x-0 bottom-0 bg-[linear-gradient(180deg,_transparent,_rgba(15,23,42,0.72))] p-4 text-white">
          <p className="text-sm font-semibold">{photo.locationLabel ?? "위치 확인 필요"}</p>
          <p className="mt-1 text-xs text-white/78">
            {subtitle ?? formatDateLabel(photo.capturedAt)}
          </p>
        </div>
      ) : null}
    </div>
  );
}

function SelectablePhotoCard({
  photo,
  selected,
  onToggle,
  suppressClicksUntil,
  badge,
  helper,
}: {
  photo: TripDraftPhoto;
  selected: boolean;
  onToggle: () => void;
  suppressClicksUntil: number;
  badge?: string | null;
  helper?: string | null;
}) {
  const src = getPhotoSource(photo);

  function handleClick() {
    if (Date.now() < suppressClicksUntil) {
      return;
    }

    onToggle();
  }

  function handleKeyDown(event: ReactKeyboardEvent<HTMLButtonElement>) {
    if (event.key !== "Enter" && event.key !== " ") {
      return;
    }

    event.preventDefault();
    onToggle();
  }

  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={selected}
      aria-label={`${photo.originalName} 선택`}
      data-selectable-photo-id={photo.id}
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      className={`group relative block w-full cursor-pointer overflow-hidden rounded-[22px] border bg-transparent p-0 text-left transition duration-200 ${
        selected
          ? "border-[rgba(0,52,43,0.3)] ring-2 ring-[rgba(0,52,43,0.18)] shadow-[0_14px_32px_rgba(0,52,43,0.08)]"
          : "border-[rgba(191,201,196,0.18)] hover:-translate-y-1 hover:border-[rgba(0,52,43,0.24)] hover:shadow-[0_14px_28px_rgba(15,23,42,0.08)]"
      }`}
    >
      <div className="relative aspect-[9/10] bg-[var(--sand)]">
        {src ? (
          <Image
            src={src}
            alt={photo.originalName}
            fill
            unoptimized
            draggable={false}
            sizes="(max-width: 768px) 45vw, 20vw"
            className="pointer-events-none select-none object-cover"
          />
        ) : (
          <div className="flex h-full items-center justify-center px-4 text-center text-xs font-semibold text-slate-500">
            이미지 미리보기 없음
          </div>
        )}
        <div className="absolute inset-x-0 bottom-0 bg-[linear-gradient(180deg,_transparent,_rgba(15,23,42,0.78))] px-3 py-3 text-white">
          <p className="truncate text-xs font-semibold">{photo.originalName}</p>
          <p className="mt-1 text-[10px] text-white/78">
            {helper ?? formatDateLabel(photo.capturedAt)}
          </p>
        </div>
        <div className="pointer-events-none absolute inset-x-3 bottom-14 rounded-full bg-[rgba(255,255,255,0.9)] px-3 py-2 text-center text-[10px] font-semibold text-[var(--accent)] opacity-0 transition group-hover:opacity-100">
          클릭하거나 드래그해서 선택
        </div>
        <div className="absolute left-3 top-3 flex items-center gap-2">
          <span
            className={`inline-flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold ${
              selected ? "bg-[var(--accent)] text-white" : "bg-white/88 text-slate-700"
            }`}
          >
            {selected ? "✓" : ""}
          </span>
          {badge ? (
            <span className="rounded-full bg-[rgba(15,23,42,0.72)] px-2.5 py-1 text-[10px] font-bold text-white">
              {badge}
            </span>
          ) : null}
        </div>
      </div>
    </button>
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
  const firstSupportingPhoto = supportingPhotos[0];
  const secondSupportingPhoto = supportingPhotos[1];

  if (spread.layoutKind === "photo-essay") {
    return (
      <article className="space-y-8 rounded-[32px] bg-transparent py-2">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.28em] text-[var(--accent-secondary)]">
              Issue No. 03
            </p>
            <h3 className="mt-3 text-[clamp(2rem,4vw,4.8rem)] font-semibold tracking-[-0.06em] text-[var(--accent)]">
              {spread.placeLabel}
            </h3>
          </div>
          <p className="text-sm italic text-slate-500">{spread.dayLabel}</p>
        </div>
        <PhotoSurface
          photo={leadPhoto}
          showOverlay={false}
          className="min-h-[22rem] rounded-[28px] border border-[rgba(191,201,196,0.18)] bg-[var(--surface-strong)]"
        />
        <div className="mx-auto max-w-3xl text-center">
          <p className="text-[clamp(1.4rem,2.8vw,2.2rem)] italic leading-[1.7] tracking-[-0.03em] text-slate-700">
            “{spread.caption}”
          </p>
          <p className="mt-5 text-xs uppercase tracking-[0.26em] text-slate-500">
            {spread.placeLabel} · {spread.dayLabel}
          </p>
        </div>
        <div className="grid gap-8 md:grid-cols-[minmax(0,0.84fr)_minmax(0,1.16fr)] md:items-start">
          <div className="space-y-6 md:pt-8">
            <div className="rounded-[28px] bg-white px-6 py-6 shadow-[0_8px_32px_rgba(27,28,25,0.04)]">
              <p className="text-sm leading-7 text-slate-600">
                찰나의 기록을 길게 늘어뜨리기보다, 대표 장면 하나와 짧은 문장으로 감정선을 남기는 포맷입니다.
              </p>
            </div>
            {firstSupportingPhoto ? (
              <PhotoSurface
                photo={firstSupportingPhoto}
                showOverlay={false}
                className="min-h-[15rem] rounded-[24px]"
              />
            ) : null}
          </div>
          <div className="space-y-5">
            {secondSupportingPhoto ? (
              <PhotoSurface
                photo={secondSupportingPhoto}
                showOverlay={false}
                className="min-h-[18rem] rounded-[24px]"
              />
            ) : null}
            <div className="rounded-[30px] bg-[var(--sand)] px-6 py-8 text-center">
              <p className="text-2xl font-semibold tracking-[-0.05em] text-[var(--accent)]">
                사진은 침묵으로 기록하는 가장 뜨거운 문장입니다.
              </p>
            </div>
          </div>
        </div>
      </article>
    );
  }

  if (spread.layoutKind === "timeline-classic") {
    return (
      <article className="grid gap-8 py-4 md:grid-cols-12 md:items-start">
        <div className="space-y-4 md:col-span-3 md:sticky md:top-28">
          <span className="block text-5xl font-semibold tracking-[-0.06em] text-[var(--accent)]">
            {spread.dayLabel.split("-").pop() ?? spread.dayLabel}
          </span>
          <span className="block text-xs font-semibold uppercase tracking-[0.24em] text-slate-500">
            Timeline Classic
          </span>
          <h3 className="text-2xl font-semibold tracking-[-0.05em] text-slate-950">
            {spread.chapterTitle}
          </h3>
          <p className="text-sm leading-7 text-slate-600">{spread.caption}</p>
          <div className="rounded-[24px] bg-white px-4 py-4 shadow-[0_8px_32px_rgba(27,28,25,0.04)]">
            <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-500">
              {spread.placeLabel}
            </p>
            <p className="mt-3 text-sm leading-6 text-slate-600">
              {spread.coordinateLabel ?? "좌표 태그가 있는 사진을 중심으로 같은 장소를 하나의 챕터로 묶었습니다."}
            </p>
          </div>
        </div>
        <div className="grid gap-4 md:col-span-9 md:grid-cols-2">
          <PhotoSurface
            photo={leadPhoto}
            showOverlay={false}
            className="min-h-[17rem] rounded-[26px] md:col-span-2"
          />
          {supportingPhotos.map((photo) => (
            <PhotoSurface
              key={photo.id}
              photo={photo}
              showOverlay={false}
              className="min-h-[11rem] rounded-[22px]"
            />
          ))}
        </div>
      </article>
    );
  }

  return (
    <article className="grid gap-8 py-4 md:grid-cols-12 md:items-start">
      <div className="md:col-span-7">
        <div className="rotate-[-2deg] rounded-[28px] border border-[rgba(191,201,196,0.16)] bg-white p-5 shadow-[0_8px_32px_rgba(27,28,25,0.04)]">
          <div className="flex items-center justify-between gap-3">
            <p className="text-sm font-semibold uppercase tracking-[0.2em] text-[var(--accent)]">
              Route Illustration
            </p>
            <span className="rounded-full border border-[rgba(191,201,196,0.18)] px-3 py-1 text-[11px] uppercase tracking-[0.2em] text-slate-500">
              stamp
            </span>
          </div>
          <div className="relative mt-5 overflow-hidden rounded-[22px] border border-[rgba(191,201,196,0.16)] bg-[var(--sand)]">
            <PhotoSurface
              photo={leadPhoto}
              showOverlay={false}
              className="min-h-[18rem] rounded-none border-0"
            />
            <div className="pointer-events-none absolute inset-0">
              <svg className="h-full w-full" viewBox="0 0 800 460" preserveAspectRatio="none">
                <path
                  d="M180,120 Q360,170 610,300"
                  fill="none"
                  stroke="#00342b"
                  strokeDasharray="10 10"
                  strokeWidth="3"
                />
              </svg>
              <span className="absolute left-[24%] top-[24%] h-4 w-4 rounded-full bg-[var(--accent)] shadow-[0_0_0_10px_rgba(0,52,43,0.12)]" />
              <span className="absolute right-[20%] top-[62%] h-4 w-4 rounded-full bg-[var(--accent-secondary)] shadow-[0_0_0_10px_rgba(160,62,64,0.12)]" />
            </div>
          </div>
          <div className="mt-5 flex items-end justify-between gap-4">
            <div>
              <p className="text-base font-semibold tracking-[-0.04em] text-slate-950">
                {spread.placeLabel}
              </p>
              <p className="mt-1 text-xs uppercase tracking-[0.2em] text-slate-500">
                {spread.dayLabel}
              </p>
            </div>
            <p className="max-w-[14rem] text-right text-xs leading-5 text-slate-500">
              {spread.coordinateLabel ?? "위치 태그가 없는 컷은 수동 보정 기준으로 경로에 합류시켰습니다."}
            </p>
          </div>
        </div>
      </div>

      <div className="space-y-6 md:col-span-5 md:pt-10">
        <div className="rotate-[3deg] rounded-[24px] border border-[rgba(191,201,196,0.16)] bg-white p-4 shadow-[0_8px_32px_rgba(27,28,25,0.04)]">
          <PhotoSurface
            photo={firstSupportingPhoto ?? leadPhoto}
            showOverlay={false}
            className="min-h-[16rem] rounded-[18px] border-0"
          />
          <p className="mt-4 text-sm italic leading-6 text-slate-600">{spread.caption}</p>
        </div>

        <div className="rounded-[28px] bg-[var(--accent)] px-6 py-6 text-white">
          <p className="text-sm font-semibold uppercase tracking-[0.22em] text-white/72">
            Traveler&apos;s note
          </p>
          <p className="mt-4 text-sm leading-7 text-white/88">
            지도를 따라 이동한 장소와 대표 컷을 포스트카드처럼 쌓아서 남기는 포맷입니다. 여행의 흐름이 먼저 보이고, 사진은 그 위에 메모처럼 붙습니다.
          </p>
        </div>

        {secondSupportingPhoto ? (
          <PhotoSurface
            photo={secondSupportingPhoto}
            showOverlay={false}
            className="min-h-[13rem] rounded-[22px]"
          />
        ) : null}
      </div>
    </article>
  );
}

type StudioClientProps = {
  initialStep?: StudioStepId;
  loadDemoOnStart?: boolean;
};

export function StudioClient({
  initialStep = "trip",
  loadDemoOnStart = false,
}: StudioClientProps) {
  const { draft } = useTripDraft();
  const uploadFormRef = useRef<HTMLFormElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const dateSelectionGridRef = useRef<HTMLDivElement | null>(null);
  const locationSelectionGridRef = useRef<HTMLDivElement | null>(null);
  const uploadStepLogSeededRef = useRef(false);
  const [selectedUploads, setSelectedUploads] = useState<SelectedUploadFile[]>([]);
  const [, setLastSelectedAt] = useState<string | null>(null);
  const [tripName, setTripName] = useState("새 여행");
  const [travelStart, setTravelStart] = useState("");
  const [travelEnd, setTravelEnd] = useState("");
  const [manualLocationLabel, setManualLocationLabel] = useState("");
  const [selectedPhotoIds, setSelectedPhotoIds] = useState<string[]>([]);
  const [manualDateLabel, setManualDateLabel] = useState("");
  const [selectedDatePhotoIds, setSelectedDatePhotoIds] = useState<string[]>([]);
  const [reviewDateFilter, setReviewDateFilter] = useState<string>("all");
  const [reviewLocationFilter, setReviewLocationFilter] = useState<string>("all");
  const [reviewSelectionBox, setReviewSelectionBox] = useState<ReviewSelectionBox | null>(null);
  const [suppressSelectableClicksUntil, setSuppressSelectableClicksUntil] = useState(0);
  const [activeStepState, setActiveStep] = useState<StudioStepId>(initialStep);
  const [isStepDrawerOpen, setIsStepDrawerOpen] = useState(false);
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
  const [, setUploadDiagnostics] = useState<UploadDiagnosticEntry[]>([]);
  const [, setNativeFileSyncNote] = useState<string | null>(null);
  const [nativePickerSnapshot, setNativePickerSnapshot] = useState<NativePickerSnapshot>({
    value: "",
    fileCount: 0,
    fileNames: [],
    totalSize: 0,
  });

  useEffect(() => {
    return () => {
      selectedUploads.forEach((item) => {
        if (item.previewUrl) {
          URL.revokeObjectURL(item.previewUrl);
        }
      });
    };
  }, [selectedUploads]);

  useEffect(() => {
    setComposeResult(loadCheckoutComposeResult());
    setOrderResult(loadCheckoutOrderResult());
    setOrderDraft(loadCheckoutOrderDraft() ?? emptyOrderDraft);
    if (typeof window !== "undefined") {
      const savedDiagnostics = safeGetSessionStorageItem(UPLOAD_DIAGNOSTICS_STORAGE_KEY);
      if (savedDiagnostics) {
        try {
          const parsed = JSON.parse(savedDiagnostics) as UploadDiagnosticEntry[];
          setUploadDiagnostics(Array.isArray(parsed) ? parsed : []);
        } catch {
          setUploadDiagnostics([]);
        }
      }

      const savedSyncNote = safeGetSessionStorageItem(NATIVE_FILE_SYNC_NOTE_KEY);
      if (savedSyncNote) {
        setNativeFileSyncNote(savedSyncNote);
      }
    }
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
    if (loadDemoOnStart) {
      saveTripDraft(createDemoTripDraft());
      clearCheckoutComposeResult();
      clearCheckoutOrderDraft();
      clearCheckoutOrderResult();
      setComposeResult(null);
      setOrderResult(null);
      setOrderDraft(emptyOrderDraft);
      setActiveStep("review");
      return;
    }

    setActiveStep(initialStep);
  }, [initialStep, loadDemoOnStart]);

  useEffect(() => {
    setIsStepDrawerOpen(false);
  }, [activeStepState]);

  useEffect(() => {
    if (!isStepDrawerOpen || typeof window === "undefined") {
      return undefined;
    }

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setIsStepDrawerOpen(false);
      }
    };

    window.addEventListener("keydown", handleEscape);
    return () => {
      window.removeEventListener("keydown", handleEscape);
    };
  }, [isStepDrawerOpen]);

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

  const pushUploadDiagnostic = useCallback((message: string) => {
    setUploadDiagnostics((current) => {
      const next = [
        ...current.slice(-7),
        {
          id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
          message,
        },
      ];

      if (typeof window !== "undefined") {
        safeSetSessionStorageItem(UPLOAD_DIAGNOSTICS_STORAGE_KEY, JSON.stringify(next));
      }

      return next;
    });
  }, []);

  const resolvedTheme = resolveTravelTheme(draft?.selectedThemeId);
  const totalUploadSize = useMemo(
    () => selectedUploads.reduce((sum, item) => sum + item.file.size, 0),
    [selectedUploads],
  );
  const draftPhotoById = useMemo(
    () => new Map((draft?.photos ?? []).map((photo) => [photo.id, photo])),
    [draft?.photos],
  );
  const dateEditablePhotos = useMemo(() => draft?.photos ?? [], [draft]);
  const locationEditablePhotos = useMemo(
    () =>
      draft?.photos.filter(
        (photo) =>
          photo.requiresManualLocationTagging || !isMeaningfulLocationLabel(photo.locationLabel),
      ) ?? [],
    [draft],
  );
  const existingUploadSignatures = useMemo(
    () =>
      new Set(
        (draft?.photos ?? []).map((photo) => getUploadSignature(photo.originalName, photo.size)),
      ),
    [draft],
  );
  const travelDateChoices = useMemo(() => {
    if (!travelStart || !travelEnd) {
      return [];
    }

    const start = new Date(`${travelStart}T00:00:00`);
    const end = new Date(`${travelEnd}T00:00:00`);

    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end < start) {
      return [];
    }

    const days = [] as string[];
    const cursor = new Date(start);

    while (cursor <= end && days.length < 31) {
      const year = cursor.getFullYear();
      const month = `${cursor.getMonth() + 1}`.padStart(2, "0");
      const day = `${cursor.getDate()}`.padStart(2, "0");
      days.push(`${year}-${month}-${day}`);
      cursor.setDate(cursor.getDate() + 1);
    }

    return days;
  }, [travelEnd, travelStart]);
  const availableDateFilters = useMemo(() => {
    const values = new Set(
      (draft?.photos ?? [])
        .map((photo) => photo.dateKey)
        .filter((dateKey) => dateKey !== "undated"),
    );
    return Array.from(values).sort();
  }, [draft]);
  const filteredDateEditablePhotos = useMemo(() => {
    if (reviewDateFilter === "all") {
      return dateEditablePhotos;
    }

    if (reviewDateFilter === "undated") {
      return dateEditablePhotos.filter((photo) => photo.dateKey === "undated");
    }

    return dateEditablePhotos.filter((photo) => photo.dateKey === reviewDateFilter);
  }, [dateEditablePhotos, reviewDateFilter]);
  const availableLocationFilters = useMemo(() => {
    const values = new Set(
      (draft?.photos ?? [])
        .map((photo) => photo.locationLabel)
        .filter((value): value is string => isMeaningfulLocationLabel(value)),
    );
    return Array.from(values).sort((left, right) => left.localeCompare(right, "ko-KR"));
  }, [draft]);
  const filteredLocationEditablePhotos = useMemo(() => {
    if (reviewLocationFilter === "all") {
      return draft?.photos ?? [];
    }

    if (reviewLocationFilter === "unresolved") {
      return locationEditablePhotos;
    }

    return (draft?.photos ?? []).filter((photo) => photo.locationLabel === reviewLocationFilter);
  }, [draft, locationEditablePhotos, reviewLocationFilter]);
  const suggestedLocations = useMemo(() => {
    const values = new Set(
      (draft?.photos ?? [])
        .map((photo) => photo.locationLabel)
        .filter((value): value is string => isMeaningfulLocationLabel(value)),
    );
    return Array.from(values).slice(0, 8);
  }, [draft]);

  useEffect(() => {
    const draftPhotoIds = new Set((draft?.photos ?? []).map((photo) => photo.id));

    setSelectedPhotoIds((current) => current.filter((photoId) => draftPhotoIds.has(photoId)));
    setSelectedDatePhotoIds((current) =>
      current.filter((photoId) => draftPhotoIds.has(photoId)),
    );
  }, [draft]);

  useEffect(() => {
    if (reviewDateFilter === "all" || reviewDateFilter === "undated") {
      return;
    }

    if (!availableDateFilters.includes(reviewDateFilter)) {
      setReviewDateFilter("all");
    }
  }, [availableDateFilters, reviewDateFilter]);

  useEffect(() => {
    if (reviewLocationFilter === "all" || reviewLocationFilter === "unresolved") {
      return;
    }

    if (!availableLocationFilters.includes(reviewLocationFilter)) {
      setReviewLocationFilter("all");
    }
  }, [availableLocationFilters, reviewLocationFilter]);
  const previewDocument = useMemo(
    () => (draft ? buildPhotobookPreviewDocument(draft) : null),
    [draft],
  );
  const coverPreviewPhoto = useMemo(() => {
    if (!draft) {
      return undefined;
    }

    const previewCoverPhotoId = previewDocument?.spreads[0]?.leadPhotoId;
    return (
      (previewCoverPhotoId ? draftPhotoById.get(previewCoverPhotoId) : undefined) ??
      draft.photos[0]
    );
  }, [draft, draftPhotoById, previewDocument]);
  const coverPreviewSrc = coverPreviewPhoto ? getPhotoSource(coverPreviewPhoto) : null;
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
  const activeStep = activeStepState;

  function moveToStep(step: StudioStepId) {
    if (typeof document !== "undefined") {
      const activeElement = document.activeElement;
      if (activeElement instanceof HTMLElement) {
        activeElement.blur();
      }
    }
    setActiveStep(step);

    if (typeof window !== "undefined") {
      try {
        window.scrollTo(0, 0);
      } catch {
        // Ignore browsers with partial scrollTo options support.
      }
    }
  }

  const toggleReviewSelection = useCallback((kind: ReviewSelectionKind, photoId: string) => {
    if (kind === "date") {
      setSelectedDatePhotoIds((current) =>
        current.includes(photoId)
          ? current.filter((item) => item !== photoId)
          : [...current, photoId],
      );
      return;
    }

    setSelectedPhotoIds((current) =>
      current.includes(photoId)
        ? current.filter((item) => item !== photoId)
        : [...current, photoId],
    );
  }, []);

  const setReviewSelectionIds = useCallback((kind: ReviewSelectionKind, photoIds: string[]) => {
    if (kind === "date") {
      setSelectedDatePhotoIds(photoIds);
      return;
    }

    setSelectedPhotoIds(photoIds);
  }, []);

  const getReviewSelectionGridRef = useCallback(
    (kind: ReviewSelectionKind) =>
      kind === "date" ? dateSelectionGridRef.current : locationSelectionGridRef.current,
    [],
  );

  const collectMarqueeSelectedPhotoIds = useCallback(
    (kind: ReviewSelectionKind, box: ReviewSelectionBox) => {
      const container = getReviewSelectionGridRef(kind);
      if (!container) {
        return [] as string[];
      }

      const selectionRect = {
        left: box.left,
        top: box.top,
        right: box.left + box.width,
        bottom: box.top + box.height,
      };

      return Array.from(
        container.querySelectorAll<HTMLButtonElement>("[data-selectable-photo-id]"),
      )
        .filter((card) => {
          const left = card.offsetLeft;
          const top = card.offsetTop;
          const right = left + card.offsetWidth;
          const bottom = top + card.offsetHeight;

          return !(
            right < selectionRect.left ||
            left > selectionRect.right ||
            bottom < selectionRect.top ||
            top > selectionRect.bottom
          );
        })
        .map((card) => card.dataset.selectablePhotoId)
        .filter((photoId): photoId is string => Boolean(photoId));
    },
    [getReviewSelectionGridRef],
  );

  const startReviewMarqueeSelection = useCallback(
    (kind: ReviewSelectionKind, event: ReactPointerEvent<HTMLDivElement>) => {
      if (event.pointerType !== "mouse" || event.button !== 0) {
        return;
      }

      const container = getReviewSelectionGridRef(kind);
      if (!container) {
        return;
      }

      const startRect = container.getBoundingClientRect();
      const startX = clampSelectionValue(
        event.clientX - startRect.left,
        0,
        startRect.width,
      );
      const startY = clampSelectionValue(
        event.clientY - startRect.top,
        0,
        startRect.height,
      );
      let hasMoved = false;
      let lastClientX = event.clientX;
      let lastClientY = event.clientY;

      const updateSelectionBox = (clientX: number, clientY: number) => {
        const currentRect = container.getBoundingClientRect();
        const currentX = clampSelectionValue(
          clientX - currentRect.left,
          0,
          currentRect.width,
        );
        const currentY = clampSelectionValue(
          clientY - currentRect.top,
          0,
          currentRect.height,
        );
        const nextBox = {
          kind,
          left: Math.min(startX, currentX),
          top: Math.min(startY, currentY),
          width: Math.abs(currentX - startX),
          height: Math.abs(currentY - startY),
        } satisfies ReviewSelectionBox;

        if (nextBox.width < 4 && nextBox.height < 4) {
          return;
        }

        hasMoved = true;
        setReviewSelectionBox(nextBox);
        setReviewSelectionIds(kind, collectMarqueeSelectedPhotoIds(kind, nextBox));
      };

      const handlePointerMove = (moveEvent: PointerEvent) => {
        lastClientX = moveEvent.clientX;
        lastClientY = moveEvent.clientY;
        updateSelectionBox(moveEvent.clientX, moveEvent.clientY);
      };

      const handleScroll = () => {
        updateSelectionBox(lastClientX, lastClientY);
      };

      const handlePointerUp = () => {
        window.removeEventListener("pointermove", handlePointerMove);
        window.removeEventListener("pointerup", handlePointerUp);
        window.removeEventListener("scroll", handleScroll, true);
        setReviewSelectionBox(null);

        if (hasMoved) {
          setSuppressSelectableClicksUntil(Date.now() + 250);
        }
      };

      window.addEventListener("pointermove", handlePointerMove);
      window.addEventListener("pointerup", handlePointerUp);
      window.addEventListener("scroll", handleScroll, true);
    },
    [collectMarqueeSelectedPhotoIds, getReviewSelectionGridRef, setReviewSelectionIds],
  );

  const openStepDrawer = useCallback(() => {
    setIsStepDrawerOpen(true);
  }, []);

  const closeStepDrawer = useCallback(() => {
    setIsStepDrawerOpen(false);
  }, []);

  const syncSnapshotFromSelections = useCallback((items: SelectedUploadFile[]) => {
    setNativePickerSnapshot({
      value: items.map((item) => item.displayName).join(", "),
      fileCount: items.length,
      fileNames: items.map((item) => item.displayName),
      totalSize: items.reduce((sum, item) => sum + item.file.size, 0),
    });
  }, []);

  const handleSelectFiles = useCallback(
    (nextFiles: FileList | File[]) => {
      const rawFiles = Array.from(nextFiles);
      const accepted = rawFiles.filter(isAcceptedImageFile);
      if (accepted.length === 0) {
        setUploadError(
          rawFiles.length > 0
            ? "브라우저가 실제 이미지 데이터 없이 빈 파일만 전달했습니다. 다시 선택해 주세요."
            : "선택된 파일을 읽지 못했습니다. 갤러리에서 다시 골라 주세요.",
        );
        pushUploadDiagnostic(`handleSelectFiles: 허용 파일 0개 / 원본 ${rawFiles.length}개`);
        return;
      }

      const selectedAt = new Date().toISOString();
      pushUploadDiagnostic(`handleSelectFiles: 허용 파일 ${accepted.length}개`);

      const nextSelections = buildSelectedUploadItems(accepted, existingUploadSignatures);
      setSelectedUploads(nextSelections);
      syncSnapshotFromSelections(nextSelections);
      setLastSelectedAt(selectedAt);
      setUploadError(null);
    },
    [existingUploadSignatures, pushUploadDiagnostic, syncSnapshotFromSelections],
  );

  function openFilePicker() {
    pushUploadDiagnostic("picker-open: 모바일 파일 선택기 열기");
    const picker = fileInputRef.current as (HTMLInputElement & { showPicker?: () => void }) | null;
    if (picker?.showPicker) {
      picker.showPicker();
      return;
    }
    picker?.click();
  }

  function runBottomAction(action?: (() => void) | null) {
    if (!action) {
      return;
    }

    if (typeof document !== "undefined") {
      const activeElement = document.activeElement;
      if (activeElement instanceof HTMLElement) {
        activeElement.blur();
      }
    }
    action();
  }

  const consumeSelectedFiles = useCallback(
    (nextFiles: FileList | File[], source: string) => {
      const files = Array.from(nextFiles);
      pushUploadDiagnostic(`${source}: ${files.length}개`);
      if (files.length === 0) {
        return;
      }
      pushUploadDiagnostic(
        `${source}-detail: ${files
          .map((file) => `${file.name || "unnamed"}:${file.size}B`)
          .join(", ")}`,
      );
      handleSelectFiles(files);
    },
    [handleSelectFiles, pushUploadDiagnostic],
  );

  const getFilesFromUploadForm = useCallback(() => {
    if (!uploadFormRef.current) {
      return [] as File[];
    }

    const entries = new FormData(uploadFormRef.current).getAll("files");
    return entries.filter((entry): entry is File => entry instanceof File && isAcceptedImageFile(entry));
  }, []);

  const syncFilesFromInputElement = useCallback(
    (input: HTMLInputElement | null, source: string) => {
      if (!input) {
        return false;
      }

      const files = Array.from(input.files ?? []);
      if (files.length === 0) {
        return false;
      }

      setNativePickerSnapshot({
        value: input.value ?? "",
        fileCount: files.length,
        fileNames: files.map((file) => file.name || "unnamed"),
        totalSize: files.reduce((sum, file) => sum + file.size, 0),
      });
      consumeSelectedFiles(files, source);
      return true;
    },
    [consumeSelectedFiles],
  );

  const syncNativePickerSnapshot = useCallback(() => {
    const input = fileInputRef.current;
    const formFiles = getFilesFromUploadForm();
    const files = formFiles.length > 0 ? formFiles : Array.from(input?.files ?? []);

    setNativePickerSnapshot({
      value: input?.value ?? "",
      fileCount: files.length,
      fileNames: files.map((file) => file.name || "unnamed"),
      totalSize: files.reduce((sum, file) => sum + file.size, 0),
    });
  }, [getFilesFromUploadForm]);

  useEffect(() => {
    if (activeStep !== "upload") {
      uploadStepLogSeededRef.current = false;
      return;
    }

    if (!uploadStepLogSeededRef.current) {
      pushUploadDiagnostic("upload-step-open: 업로드 단계 진입");
      uploadStepLogSeededRef.current = true;
    }
    syncNativePickerSnapshot();
  }, [activeStep, pushUploadDiagnostic, syncNativePickerSnapshot]);

  useEffect(() => {
    const input = fileInputRef.current;
    if (!input) {
      return;
    }

    const handleNativeChange = () => {
      syncFilesFromInputElement(input, "native-change");
    };

    const handleNativeInput = () => {
      syncFilesFromInputElement(input, "native-input");
    };

    input.addEventListener("change", handleNativeChange);
    input.addEventListener("input", handleNativeInput);
    return () => {
      input.removeEventListener("change", handleNativeChange);
      input.removeEventListener("input", handleNativeInput);
    };
  }, [syncFilesFromInputElement]);

  function handleFileInputChange(event: ChangeEvent<HTMLInputElement>) {
    const files = event.currentTarget.files ?? [];
    if (files.length === 0) {
      syncNativePickerSnapshot();
      pushUploadDiagnostic("react-change: 0개(취소 또는 미반영)");
      return;
    }
    setNativePickerSnapshot({
      value: event.currentTarget.value ?? "",
      fileCount: files.length,
      fileNames: Array.from(files).map((file) => file.name || "unnamed"),
      totalSize: Array.from(files).reduce((sum, file) => sum + file.size, 0),
    });
    consumeSelectedFiles(event.currentTarget.files ?? [], "react-change");
  }

  function handleClearSelectedUploads() {
    setSelectedUploads([]);
    setLastSelectedAt(null);
    setUploadError(null);
    pushUploadDiagnostic("selection-clear: 선택 파일 비움");
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
    setNativeFileSyncNote(null);
    setNativePickerSnapshot({ value: "", fileCount: 0, fileNames: [], totalSize: 0 });
    if (typeof window !== "undefined") {
      safeRemoveSessionStorageItem(NATIVE_FILE_SYNC_NOTE_KEY);
    }
  }

  function handleRemoveSelectedUpload(key: string) {
    const target = selectedUploads.find((item) => item.key === key);
    if (target?.previewUrl) {
      URL.revokeObjectURL(target.previewUrl);
    }

    const next = selectedUploads.filter((item) => item.key !== key);
    setSelectedUploads(next);
    if (fileInputRef.current && next.length === 0) {
      fileInputRef.current.value = "";
    }
    setNativeFileSyncNote(null);
    syncSnapshotFromSelections(next);
    if (typeof window !== "undefined") {
      safeRemoveSessionStorageItem(NATIVE_FILE_SYNC_NOTE_KEY);
    }
    if (next.length === 0) {
      setLastSelectedAt(null);
    }
    pushUploadDiagnostic(`selection-remove: ${target?.displayName ?? key}`);
  }

  async function handleUpload() {
    setUploadError(null);
    let effectiveSelections = selectedUploads;

    if (effectiveSelections.length === 0) {
      const fallbackFiles = dedupeFilesByKey([
        ...getFilesFromUploadForm(),
        ...Array.from(fileInputRef.current?.files ?? []),
      ].filter(isAcceptedImageFile));
      pushUploadDiagnostic(`upload-fallback-check: input에 ${fallbackFiles.length}개`);

      if (fallbackFiles.length > 0) {
        effectiveSelections = buildSelectedUploadItems(fallbackFiles, existingUploadSignatures);
        setSelectedUploads(effectiveSelections);
        setLastSelectedAt(new Date().toISOString());
        pushUploadDiagnostic(`upload-fallback-restore: DOM input에서 ${fallbackFiles.length}개 복구`);
      }
    }

    const uploadableSelections = effectiveSelections.filter((item) => item.duplicateKind === "none");
    const duplicateSelections = effectiveSelections.filter((item) => item.duplicateKind !== "none");

    if (!tripName.trim()) {
      setUploadError("여행 이름을 먼저 입력해 주세요.");
      moveToStep("trip");
      return;
    }

    if (effectiveSelections.length === 0) {
      setUploadError("사진을 한 장 이상 선택해 주세요.");
      moveToStep("upload");
      return;
    }

    if (uploadableSelections.length === 0) {
      setUploadError("새로 추가할 사진이 없습니다. 기존과 중복되는 선택만 남아 있습니다.");
      moveToStep("upload");
      return;
    }

    const emptyFiles = uploadableSelections.filter((item) => item.file.size === 0);
    if (emptyFiles.length > 0) {
      setUploadError(
        "선택한 사진 중 일부가 실제 파일 데이터 없이 들어왔습니다. 갤러리에서 원본 파일로 다시 골라 주세요.",
      );
      moveToStep("upload");
      return;
    }

    const formData = new FormData();
    uploadableSelections.forEach((item) =>
      formData.append("files", item.file, item.displayName),
    );
    formData.append("tripName", tripName.trim());
    formData.append("travelStart", travelStart);
    formData.append("travelEnd", travelEnd);
    if (draft) {
      formData.append("existingDraft", JSON.stringify(draft));
    }

    setIsUploading(true);
    pushUploadDiagnostic(
      `upload-start: 신규 ${uploadableSelections.length}개, 중복 ${duplicateSelections.length}개`,
    );

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
      setSelectedUploads([]);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
      pushUploadDiagnostic(`upload-success: 서버가 ${payload.photos.length}장 draft 반환`);
      setReviewFeedback(
        duplicateSelections.length > 0
          ? `${uploadableSelections.length}장을 추가하고 ${duplicateSelections.length}장은 중복 가능 사진으로 제외했습니다. 날짜와 장소 단위로 다시 정리했습니다.`
          : `${uploadableSelections.length}장을 읽어 자동으로 날짜와 장소 단위로 정리했습니다.`,
      );
      setSelectedPhotoIds([]);
      setSelectedDatePhotoIds([]);
      setManualDateLabel("");
      setManualLocationLabel("");
      setReviewLocationFilter("all");
      setReviewDateFilter("all");
      moveToStep("review");
    } catch (error) {
      pushUploadDiagnostic(
        `upload-error: ${error instanceof Error ? error.message : "알 수 없는 오류"}`,
      );
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
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
    setNativeFileSyncNote(null);
    setNativePickerSnapshot({ value: "", fileCount: 0, fileNames: [], totalSize: 0 });
    if (typeof window !== "undefined") {
      safeRemoveSessionStorageItem(NATIVE_FILE_SYNC_NOTE_KEY);
    }
    setSelectedDatePhotoIds([]);
    setManualDateLabel("");
    setSelectedPhotoIds([]);
    setManualLocationLabel("");
    setReviewDateFilter("all");
    setReviewLocationFilter("all");
    setReviewFeedback("샘플 초안을 불러왔습니다. 실제 플로우를 바로 확인할 수 있습니다.");
    pushUploadDiagnostic("demo-load: 샘플 초안 불러오기");
    moveToStep("review");
  }

  function handleResetAll() {
    clearTripDraft();
    clearCheckoutComposeResult();
    clearCheckoutOrderDraft();
    clearCheckoutOrderResult();
    setSelectedUploads([]);
    setLastSelectedAt(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
    setComposeResult(null);
    setOrderResult(null);
    setOrderDraft(emptyOrderDraft);
    setSelectedPhotoIds([]);
    setManualLocationLabel("");
    setUploadError(null);
    setReviewFeedback(null);
    setComposeError(null);
    setOrderError(null);
    setManualDateLabel("");
    setSelectedDatePhotoIds([]);
    setReviewDateFilter("all");
    setReviewLocationFilter("all");
    setUploadDiagnostics([]);
    if (typeof window !== "undefined") {
      safeRemoveSessionStorageItem(UPLOAD_DIAGNOSTICS_STORAGE_KEY);
      safeRemoveSessionStorageItem(NATIVE_FILE_SYNC_NOTE_KEY);
    }
    setNativeFileSyncNote(null);
    setNativePickerSnapshot({ value: "", fileCount: 0, fileNames: [], totalSize: 0 });
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

  function handleApplyManualDateTag() {
    if (!draft) {
      return;
    }

    const normalizedDate = manualDateLabel.trim();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(normalizedDate) || selectedDatePhotoIds.length === 0) {
      setReviewFeedback("날짜와 사진 선택을 먼저 확인해 주세요.");
      return;
    }

    const nextDraft = applyManualDateTagToDraft(draft, selectedDatePhotoIds, normalizedDate);
    saveTripDraft(nextDraft);
    setSelectedDatePhotoIds([]);
    setManualDateLabel("");
    setReviewFeedback(`${normalizedDate} 날짜를 ${selectedDatePhotoIds.length}장에 적용했습니다.`);
  }

  function handleRemoveSelectedPhotos(kind: ReviewSelectionKind) {
    if (!draft) {
      return;
    }

    const photoIds = kind === "date" ? selectedDatePhotoIds : selectedPhotoIds;
    if (photoIds.length === 0) {
      setReviewFeedback("삭제할 사진을 먼저 선택해 주세요.");
      return;
    }

    const nextDraft = removePhotosFromDraft(draft, photoIds);
    saveTripDraft(nextDraft);
    setSelectedDatePhotoIds([]);
    setSelectedPhotoIds([]);
    setReviewFeedback(`${photoIds.length}장을 포토북 초안에서 제거했습니다.`);
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

  const tripVisualPhoto = draft?.photos[0];
  const tripVisualSrc = tripVisualPhoto ? getPhotoSource(tripVisualPhoto) : null;
  const visibleUploadCards = selectedUploads.slice(0, 5);
  const hiddenUploadCount = Math.max(selectedUploads.length - visibleUploadCards.length, 0);
  const existingUploadCards = (draft?.photos ?? []).slice(0, 6);
  const nativeOnlySelectionCount =
    selectedUploads.length === 0 ? nativePickerSnapshot.fileCount : 0;
  const visibleNativeFileNames =
    selectedUploads.length === 0 ? nativePickerSnapshot.fileNames.slice(0, 6) : [];
  const currentStepIndex =
    studioSteps.find((step) => step.id === activeStep)?.index ?? studioSteps[0].index;
  const currentStepPosition = studioSteps.findIndex((step) => step.id === activeStep);
  const currentStepMeta = studioSteps[currentStepPosition] ?? studioSteps[0];
  const previousStep = currentStepPosition > 0 ? studioSteps[currentStepPosition - 1] : null;

  function getStepPanelClass(stepId: StudioStepId) {
    return `wizard-stage ${activeStep === stepId ? "is-active" : ""}`;
  }

  const mobilePrimaryAction = (() => {
    switch (activeStep) {
      case "trip":
        return {
          label: "사진 업로드하러 가기",
          onClick: () => moveToStep("upload"),
          disabled: false,
        };
      case "upload":
        if (selectedUploads.length > 0) {
          return {
            label: isUploading ? "사진 정리 중..." : "사진 읽고 정리하기",
            onClick: handleUpload,
            disabled: isUploading,
          };
        }

        if (draft) {
          return {
            label: "이전 정리 보기",
            onClick: () => moveToStep("review"),
            disabled: !canOpenReview,
          };
        }

        return {
          label: "사진 선택하기",
          onClick: openFilePicker,
          disabled: false,
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

  const bottomPrimaryAction =
    activeStep === "publish"
      ? composeResult
        ? {
            label: isOrdering ? "주문 생성 중..." : "주문 및 결제하기",
            onClick: handleCreateOrder,
            disabled: !composeResult || isOrdering,
          }
        : {
            label: isComposing ? "테스트 책 생성 중..." : "테스트 책 생성",
            onClick: handleComposeBook,
            disabled: !draft || isComposing,
          }
      : mobilePrimaryAction;

  const stepDrawerItems = studioSteps.map((step) => {
    const disabled =
      (step.id === "review" && !canOpenReview) ||
      (step.id === "preview" && !canOpenPreview) ||
      (step.id === "publish" && !canOpenPublish);

    return {
      ...step,
      disabled,
    };
  });

  const bottomNavigationHref =
    activeStep === "trip"
      ? getStudioStepHref("upload")
      : activeStep === "upload" && draft && selectedUploads.length === 0 && canOpenReview
        ? getStudioStepHref("review")
        : activeStep === "review" && canOpenPreview
          ? getStudioStepHref("preview")
          : activeStep === "preview" && canOpenPublish
            ? getStudioStepHref("publish")
            : null;

  const bottomNavigationLabel =
    activeStep === "trip"
      ? "사진 업로드하러 가기"
      : activeStep === "upload" && draft && selectedUploads.length === 0 && canOpenReview
        ? "이전 정리 보기"
        : activeStep === "review"
          ? "포토북 디자인으로"
          : activeStep === "preview"
            ? "Sweetbook 생성으로"
            : null;

  return (
    <div className="min-h-screen bg-[#fbf9f4] text-[var(--foreground)]">
      <header className="fixed top-0 z-50 h-16 w-full bg-[#fbf9f4]">
        <div className="mx-auto flex h-full w-full max-w-screen-xl items-center justify-between px-6">
          <button
            type="button"
            onClick={openStepDrawer}
            className="inline-flex h-10 w-10 items-center justify-center rounded-full text-[#00342b] transition hover:bg-[rgba(0,52,43,0.06)] hover:opacity-80 active:scale-95"
            aria-label="단계 메뉴 열기"
          >
            <span className="material-symbols-outlined">menu</span>
          </button>
          <div
            className={`fixed inset-0 z-[70] transition ${
              isStepDrawerOpen ? "pointer-events-auto" : "pointer-events-none"
            }`}
          >
            <button
              type="button"
              aria-label="단계 메뉴 닫기"
              className={`absolute inset-0 bg-[rgba(15,23,42,0.2)] transition duration-200 ${
                isStepDrawerOpen ? "opacity-100" : "opacity-0"
              }`}
              onClick={closeStepDrawer}
            />
            <aside
              className={`absolute left-0 top-0 flex h-full w-[min(22rem,84vw)] flex-col border-r border-[rgba(191,201,196,0.18)] bg-[#fbf9f4] px-5 py-5 shadow-[16px_0_40px_rgba(15,23,42,0.08)] transition duration-300 ease-out ${
                isStepDrawerOpen ? "translate-x-0" : "-translate-x-full"
              }`}
            >
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs font-bold uppercase tracking-[0.22em] text-[var(--accent)]">
                      Navigation
                    </p>
                    <p className="mt-2 text-lg font-semibold text-slate-950">원하는 단계로 이동</p>
                  </div>
                  <button
                    type="button"
                    onClick={closeStepDrawer}
                    className="inline-flex h-10 w-10 items-center justify-center rounded-full text-slate-500 transition hover:bg-[rgba(0,52,43,0.06)] hover:text-[var(--accent)]"
                    aria-label="단계 메뉴 닫기"
                  >
                    <span className="material-symbols-outlined">close</span>
                  </button>
                </div>

                <div className="mt-6 space-y-3">
                  {stepDrawerItems.map((step) =>
                    step.disabled ? (
                      <div
                        key={step.id}
                        className="flex w-full items-center gap-3 rounded-[20px] border border-[rgba(191,201,196,0.16)] bg-white px-4 py-4 text-left opacity-50"
                      >
                        <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-[var(--sand)] text-sm font-bold text-slate-700">
                          {step.index}
                        </span>
                        <span>
                          <span className="block text-sm font-semibold text-slate-900">{step.label}</span>
                          <span className="mt-1 block text-xs text-slate-500">
                            이전 단계를 마친 뒤 열립니다.
                          </span>
                        </span>
                      </div>
                    ) : (
                      <button
                        key={step.id}
                        type="button"
                        onClick={() => {
                          moveToStep(step.id);
                          closeStepDrawer();
                        }}
                        className={`flex w-full items-center gap-3 rounded-[20px] border px-4 py-4 text-left transition ${
                          step.id === activeStep
                            ? "border-[rgba(0,52,43,0.18)] bg-[rgba(0,52,43,0.06)]"
                            : "border-[rgba(191,201,196,0.16)] bg-white hover:border-[rgba(0,52,43,0.16)]"
                        }`}
                      >
                        <span
                          className={`inline-flex h-8 w-8 items-center justify-center rounded-full text-sm font-bold ${
                            step.id === activeStep
                              ? "bg-[var(--accent)] text-white"
                              : "bg-[var(--sand)] text-slate-700"
                          }`}
                        >
                          {step.index}
                        </span>
                        <span>
                          <span className="block text-sm font-semibold text-slate-900">{step.label}</span>
                          <span className="mt-1 block text-xs text-slate-500">{step.copy}</span>
                        </span>
                      </button>
                    ),
                  )}
                </div>

                <div className="mt-auto rounded-[22px] bg-white px-4 py-4 text-sm leading-6 text-slate-600">
                  상단 <span className="font-semibold text-[var(--accent)]">Triplogue Studio</span> 타이틀은
                  랜딩 홈으로 돌아가는 버튼입니다.
                </div>
            </aside>
          </div>
          <Link
            href="/"
            className="font-['Manrope'] text-lg font-bold tracking-tight text-[var(--accent)] transition-opacity hover:opacity-80"
          >
            Triplogue Studio
          </Link>
          <Link
            href="/ops/launchpad"
            className="text-[#00342b] transition-opacity duration-150 hover:opacity-80 active:scale-95"
            aria-label="운영 화면"
          >
            <span className="material-symbols-outlined">help_outline</span>
          </Link>
        </div>
      </header>

      <main
        className={`mx-auto min-h-screen w-full px-6 pb-32 pt-24 ${
          activeStep === "trip" ? "max-w-screen-md" : "max-w-screen-xl"
        }`}
      >
        {activeStep !== "trip" ? (
        <div className="mx-auto mb-12 w-full max-w-screen-md">
          <div className="mb-4 flex items-center justify-between">
            <span className="text-xs font-extrabold uppercase tracking-[0.24em] text-[var(--accent)]">
              Step {String(currentStepIndex).padStart(2, "0")} / {String(studioSteps.length).padStart(2, "0")}
            </span>
            <span className="text-xs font-medium text-slate-500">{currentStepMeta.label}</span>
          </div>
          <div className="flex h-1 w-full gap-2 rounded-full bg-[rgba(228,226,221,0.76)]">
            {studioSteps.map((step) => (
              <div
                key={step.id}
                className={`h-full w-1/5 rounded-full ${
                  step.id === activeStep
                    ? "bg-[var(--accent)]"
                    : step.index < currentStepIndex
                      ? "bg-[rgba(0,52,43,0.2)]"
                      : "bg-[rgba(228,226,221,1)]"
                }`}
              />
            ))}
          </div>
        </div>
        ) : null}

        <div className="mx-auto w-full">
            <section className={getStepPanelClass("trip")}>
              <div className="mb-12">
                <div className="mb-4 flex items-center justify-between">
                  <span className="text-xs font-bold uppercase tracking-widest text-[var(--accent)]">
                    Step 01 / 05
                  </span>
                  <span className="text-xs text-slate-500">여행 개요</span>
                </div>
                <div className="flex h-1 w-full gap-1 overflow-hidden rounded-full bg-[rgba(234,232,227,0.88)]">
                  <div className="h-full w-1/5 rounded-full bg-[var(--accent)]" />
                  <div className="h-full w-1/5 rounded-full bg-[rgba(228,226,221,1)]" />
                  <div className="h-full w-1/5 rounded-full bg-[rgba(228,226,221,1)]" />
                  <div className="h-full w-1/5 rounded-full bg-[rgba(228,226,221,1)]" />
                  <div className="h-full w-1/5 rounded-full bg-[rgba(228,226,221,1)]" />
                </div>
              </div>

              <div className="mb-12">
                <h2 className="mb-4 font-['Manrope'] text-3xl font-extrabold leading-tight text-slate-950 md:text-4xl">
                  기록의 시작,
                  <br />
                  여행의 정보를 입력해주세요
                </h2>
                <p className="text-lg leading-relaxed text-slate-600">
                  당신의 소중한 순간들을 정갈하게 담아낼 첫 페이지를 작성합니다.
                </p>
              </div>

              <form className="space-y-8">
                <div className="space-y-2">
                  <label
                    htmlFor="travel-title"
                    className="px-1 text-sm font-bold uppercase tracking-wider text-slate-500"
                  >
                    여행 제목
                  </label>
                  <input
                    id="travel-title"
                    value={tripName}
                    onChange={(event) => setTripName(event.target.value)}
                    className="w-full rounded-xl border-none bg-[rgba(234,232,227,0.9)] px-5 py-4 text-lg text-slate-950 outline-none transition focus:ring-1 focus:ring-[rgba(0,52,43,0.18)]"
                    placeholder="예: 파리에서의 열흘간의 기록"
                  />
                </div>

                <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                  <div className="space-y-2">
                    <label
                      htmlFor="start-date"
                      className="px-1 text-sm font-bold uppercase tracking-wider text-slate-500"
                    >
                      시작일
                    </label>
                    <div className="relative">
                      <input
                        id="start-date"
                        type="date"
                        value={travelStart}
                        onChange={(event) => setTravelStart(event.target.value)}
                        className="w-full rounded-xl border-none bg-[rgba(234,232,227,0.9)] px-5 py-4 text-slate-950 outline-none transition focus:ring-1 focus:ring-[rgba(0,52,43,0.18)]"
                      />
                      <span className="material-symbols-outlined pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-slate-500">
                        calendar_today
                      </span>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label
                      htmlFor="end-date"
                      className="px-1 text-sm font-bold uppercase tracking-wider text-slate-500"
                    >
                      종료일
                    </label>
                    <div className="relative">
                      <input
                        id="end-date"
                        type="date"
                        value={travelEnd}
                        onChange={(event) => setTravelEnd(event.target.value)}
                        className="w-full rounded-xl border-none bg-[rgba(234,232,227,0.9)] px-5 py-4 text-slate-950 outline-none transition focus:ring-1 focus:ring-[rgba(0,52,43,0.18)]"
                      />
                      <span className="material-symbols-outlined pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-slate-500">
                        calendar_today
                      </span>
                    </div>
                  </div>
                </div>

                <div className="group relative mt-12 aspect-[16/9] cursor-pointer overflow-hidden rounded-2xl border border-[rgba(191,201,196,0.14)] bg-[rgba(245,243,238,0.96)] p-1">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    alt="Scenic landscape"
                    src={tripVisualSrc ?? stitchStepOneVisual}
                    className="h-full w-full rounded-xl object-cover transition-transform duration-700 group-hover:scale-105"
                  />
                  <div className="absolute inset-1 rounded-xl bg-gradient-to-t from-[rgba(0,52,43,0.42)] to-transparent">
                    <div className="absolute inset-x-0 bottom-0 p-6 text-white">
                      <span className="mb-1 block text-xs font-bold uppercase tracking-widest text-white/80">
                        Journal Tip
                      </span>
                      <p className="font-medium">
                        정확한 날짜는 나중에 타임라인을 자동 생성하는 데 도움을 줍니다.
                      </p>
                    </div>
                  </div>
                </div>

                <div className="md:hidden">
                  <Link
                    href={getStudioStepHref("upload")}
                    className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-[#00342b] px-8 py-4 text-[14px] font-bold leading-none !text-white visited:!text-white hover:bg-[#004d40] hover:!text-white active:scale-[0.98] active:!text-white"
                  >
                    사진 업로드하러 가기
                    <span className="material-symbols-outlined text-[18px] leading-none">
                      arrow_forward
                    </span>
                  </Link>
                </div>
              </form>
            </section>

            <section className={getStepPanelClass("upload")}>
              <div className="space-y-8">
                <div className="space-y-4">
                  <p className="text-xs font-bold uppercase tracking-[0.24em] text-[var(--accent)]">
                    Step 02 / 05
                  </p>
                  <h2 className="max-w-3xl text-[clamp(2rem,5vw,3.4rem)] font-extrabold leading-[1.12] tracking-[-0.06em] text-slate-950">
                    여행의 순간들을
                    <br />
                    업로드하세요
                  </h2>
                  <p className="max-w-2xl text-lg leading-8 text-slate-600">
                    기록하고 싶은 사진들을 선택해주세요. Triplogue가 시간과 장소별로 자동 정리해 드립니다.
                  </p>
                </div>

                <form
                  ref={uploadFormRef}
                  className="space-y-6"
                  onSubmit={(event) => {
                    event.preventDefault();
                    void handleUpload();
                  }}
                >
                  <div className="space-y-6">
                    <div className="relative group">
                      <div className="w-full aspect-[16/9] rounded-xl border-2 border-dashed border-[rgba(191,201,196,0.3)] bg-[var(--surface-container-low,rgba(245,243,238,0.88))] md:aspect-[21/9]">
                        <div className="flex h-full flex-col items-center justify-center px-6 text-center transition-all group-hover:border-[rgba(0,52,43,0.4)] group-active:scale-[0.99]">
                          <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-[var(--accent)] text-white">
                            <span className="material-symbols-outlined text-3xl">add_a_photo</span>
                          </div>
                          <span className="font-bold text-[var(--accent)]">사진 선택하기</span>
                          <span className="mt-1 text-xs text-slate-500">
                            JPG, PNG, HEIC up to 20MB each
                          </span>
                        </div>
                      </div>
                      <input
                        ref={fileInputRef}
                        id="studio-photo-picker"
                        name="files"
                        type="file"
                        accept="image/*,.jpg,.jpeg,.png,.webp,.heic,.heif"
                        multiple
                        className="absolute inset-0 cursor-pointer opacity-0"
                        onClick={() => {
                          pushUploadDiagnostic("picker-open: 네이티브 파일 입력 열기");
                        }}
                        onChange={handleFileInputChange}
                      />
                    </div>

                  <div className="rounded-[24px] bg-white px-6 py-6 shadow-[0_8px_32px_rgba(27,28,25,0.04)]">
                    <div className="flex flex-wrap items-end justify-between gap-4">
                      <div>
                        <h3 className="text-sm font-bold text-slate-950">
                          선택한 사진 {selectedUploads.length || nativeOnlySelectionCount}장
                        </h3>
                        <p className="mt-1 text-[11px] uppercase tracking-[0.2em] text-slate-500">
                          Total Size: {formatBytes(
                            selectedUploads.length > 0 ? totalUploadSize : nativePickerSnapshot.totalSize,
                          )}
                        </p>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <button
                          type="button"
                          className="text-xs font-bold text-[var(--accent-secondary)] transition hover:underline"
                          onClick={handleClearSelectedUploads}
                          disabled={selectedUploads.length === 0 && nativeOnlySelectionCount === 0}
                        >
                          모두 삭제
                        </button>
                        <button
                          type="submit"
                          className="button-primary rounded-[18px] px-4 py-2.5 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
                          disabled={isUploading}
                        >
                          {isUploading ? "사진 정리 중..." : "사진 정리 시작하기"}
                        </button>
                      </div>
                    </div>

                    {selectedUploads.length > 0 ? (
                      <>
                        <div className="mt-6 grid grid-cols-4 gap-3 md:grid-cols-6">
                          {visibleUploadCards.map((item) => (
                            <div
                              key={item.key}
                              className="group relative aspect-square overflow-hidden rounded-lg bg-[var(--surface-container,rgba(240,238,233,0.96))]"
                            >
                              <button
                                type="button"
                                aria-label={`${item.displayName} 제거`}
                                className="absolute inset-0 z-10 flex items-center justify-center bg-[rgba(0,52,43,0.2)] opacity-0 transition-opacity group-hover:opacity-100"
                                onClick={() => handleRemoveSelectedUpload(item.key)}
                              >
                                <span className="material-symbols-outlined text-sm text-white">close</span>
                              </button>
                              {item.previewUrl ? (
                                <>
                                  {/* eslint-disable-next-line @next/next/no-img-element */}
                                  <img
                                    src={item.previewUrl}
                                    alt={item.displayName}
                                    className="h-full w-full object-cover"
                                  />
                                </>
                              ) : (
                                <div className="flex h-full w-full items-center justify-center px-3 text-center text-[11px] font-semibold leading-5 text-slate-500">
                                  미리보기를 지원하지 않는 형식
                                </div>
                              )}
                            </div>
                          ))}
                          {hiddenUploadCount > 0 ? (
                            <div className="flex aspect-square items-center justify-center rounded-lg bg-[rgba(228,226,221,0.92)] text-sm font-bold text-slate-600">
                              +{hiddenUploadCount}
                            </div>
                          ) : null}
                        </div>

                        <div className="mt-6 space-y-3">
                          <div className="flex items-center justify-between text-xs">
                            <span className="max-w-[220px] truncate text-slate-500">
                              {selectedUploads[0]?.displayName}
                            </span>
                            <span className="font-bold text-[var(--accent)]">
                              {isUploading ? "정리 중" : "준비 완료"}
                            </span>
                          </div>
                          <div className="h-1 overflow-hidden rounded-full bg-[rgba(228,226,221,0.92)]">
                            <div
                              className={`h-full rounded-full bg-[var(--accent)] transition-all duration-500 ${isUploading ? "w-4/5" : "w-full"}`}
                            />
                          </div>
                        </div>

                        <div className="mt-6 grid gap-2">
                          {selectedUploads.map((item, index) => (
                            <div
                              key={`name-${item.key}`}
                              className="flex items-center justify-between gap-3 rounded-[18px] bg-slate-50 px-3 py-2 text-sm text-slate-700"
                            >
                              <span className="min-w-0 truncate">
                                {index + 1}. {item.displayName}
                              </span>
                              <div className="flex shrink-0 items-center gap-2">
                                {item.duplicateKind !== "none" ? (
                                  <span className="rounded-full bg-[rgba(160,62,64,0.12)] px-2 py-1 text-[10px] font-bold text-[var(--accent-secondary)]">
                                    {item.duplicateKind === "existing" ? "중복 가능" : "선택 중복"}
                                  </span>
                                ) : null}
                                <span className="text-xs text-slate-500">
                                  {formatBytes(item.file.size)}
                                </span>
                              </div>
                            </div>
                          ))}
                        </div>
                      </>
                    ) : nativeOnlySelectionCount > 0 ? (
                      <div className="mt-6 space-y-4">
                        <div className="rounded-[18px] bg-[rgba(0,52,43,0.05)] px-4 py-4 text-sm leading-6 text-slate-700">
                          브라우저 입력창에는 {nativeOnlySelectionCount}장이 잡혀 있습니다. 현재 미리보기 상태 동기화가 늦어질 수 있지만, 아래 버튼으로 그대로 정리를 시도할 수 있습니다.
                        </div>
                        <div className="grid gap-2">
                          {visibleNativeFileNames.map((fileName, index) => (
                            <div
                              key={`native-name-${fileName}-${index}`}
                              className="flex items-center justify-between gap-3 rounded-[18px] bg-slate-50 px-3 py-2 text-sm text-slate-700"
                            >
                              <span className="min-w-0 truncate">
                                {index + 1}. {fileName}
                              </span>
                              <span className="rounded-full bg-[rgba(0,52,43,0.08)] px-2 py-1 text-[10px] font-bold text-[var(--accent)]">
                                DOM input
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                  ) : (
                      <div className="mt-6 rounded-[18px] bg-[rgba(245,243,238,0.72)] px-4 py-4 text-sm leading-6 text-slate-500">
                        아직 새로 추가할 사진이 없습니다. 위 카드에서 사진을 고르면 이곳에 썸네일과 파일 목록이 바로 나타납니다.
                      </div>
                    )}
                  </div>
                  </div>

                  {draft ? (
                    <div className="rounded-[24px] bg-white px-6 py-6 shadow-[0_8px_32px_rgba(27,28,25,0.04)]">
                      <div className="flex flex-wrap items-end justify-between gap-3">
                        <div>
                          <h3 className="text-sm font-bold text-slate-950">
                            이미 정리된 사진 {draft.photos.length}장
                          </h3>
                          <p className="mt-1 text-[11px] uppercase tracking-[0.2em] text-slate-500">
                            기존 draft에 포함된 사진
                          </p>
                        </div>
                        <button
                          type="button"
                          className="rounded-full border border-[var(--line)] bg-white px-3 py-2 text-xs font-semibold text-slate-700 transition hover:border-slate-400"
                          onClick={() => moveToStep("review")}
                        >
                          현재 정리 상태 보기
                        </button>
                      </div>

                      <div className="mt-6 grid grid-cols-3 gap-3 md:grid-cols-6">
                        {existingUploadCards.map((photo) => (
                          <PhotoSurface
                            key={photo.id}
                            photo={photo}
                            showOverlay={false}
                            className="min-h-[6rem] rounded-[18px]"
                          />
                        ))}
                      </div>
                    </div>
                  ) : null}

                  <div className="flex items-start gap-3 px-2">
                    <span
                      className="material-symbols-outlined text-[var(--accent-secondary)] text-lg"
                      style={{ fontVariationSettings: "'FILL' 1" }}
                    >
                      info
                    </span>
                    <p className="text-xs leading-6 text-slate-500">
                      위치 태그가 포함된 사진은 더 정확하게 정리됩니다. 개인정보 보호를 위해 위치 정보는 정리 후 즉시 암호화됩니다.
                    </p>
                  </div>

                  <div className="flex flex-wrap gap-3">
                    <button
                      type="button"
                      className="button-secondary rounded-[18px] px-5 py-3 text-sm font-semibold text-slate-900"
                      onClick={handleLoadDemo}
                    >
                      샘플 초안으로 바로 보기
                    </button>
                  </div>

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
                </form>
              </div>
            </section>

            <section className={getStepPanelClass("review")}>
              <div className="flex flex-col gap-4 border-b border-[var(--line)] pb-5 lg:flex-row lg:items-end lg:justify-between">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-500">
                    3. 사진 정리
                  </p>
                  <h2 className="mt-3 text-[clamp(1.8rem,3vw,2.6rem)] font-semibold tracking-[-0.05em] text-slate-950">
                    자동으로 정리된 여행의 순간들입니다.
                  </h2>
                  <p className="mt-3 max-w-2xl text-sm leading-7 text-slate-600">
                    촬영 시간과 위치 흐름을 바탕으로 챕터를 만들었습니다. 위치 정보가 비는 사진만 보정하면 바로 포토북 레이아웃으로 넘어갈 수 있습니다.
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
                  <div className="space-y-12">
                    {draft.chapters.map((chapter) => {
                      const chapterPhotos = chapter.photoIds
                        .map((photoId) => draftPhotoById.get(photoId))
                        .filter((photo): photo is TripDraftPhoto => Boolean(photo))
                        .slice(0, 3);

                      return (
                        <section key={chapter.id}>
                          <div className="mb-6 flex items-baseline justify-between gap-4">
                            <div>
                              <h3 className="text-xl font-semibold tracking-[-0.04em] text-slate-950">
                                {chapter.dayLabel} - {chapter.placeLabel}
                              </h3>
                              <p className="mt-2 text-sm text-slate-500">{chapter.groupingReason}</p>
                            </div>
                            <span className="text-sm font-medium text-slate-500">
                              {chapter.photoCount}장
                            </span>
                          </div>
                          <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
                            {chapterPhotos.map((photo, index) => (
                              <PhotoSurface
                                key={photo.id}
                                photo={photo}
                                showOverlay={false}
                                className={`${index === 2 ? "hidden md:block" : ""} min-h-[13rem] rounded-[20px]`}
                              />
                            ))}
                          </div>
                        </section>
                      );
                    })}

                    <section className="rounded-[28px] border border-[rgba(191,201,196,0.12)] bg-white px-6 py-6">
                      <div className="flex items-center gap-4">
                        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[rgba(0,52,43,0.08)] text-[var(--accent)]">
                          <span className="text-xl">#</span>
                        </div>
                        <div>
                          <h3 className="text-lg font-semibold tracking-[-0.03em] text-slate-950">
                            날짜 라벨 수정
                          </h3>
                          <p className="text-sm text-slate-500">
                            포토북엔 실제 날짜가 더 자연스럽습니다. 필요한 사진을 골라 날짜를 직접 수정할 수 있습니다.
                          </p>
                        </div>
                      </div>

                      <div className="mt-6 grid gap-4 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end">
                        <div className="space-y-4">
                          <label className="grid gap-2">
                            <span className="text-sm font-semibold text-slate-900">날짜 선택</span>
                            <input
                              type="date"
                              value={manualDateLabel}
                              onChange={(event) => setManualDateLabel(event.target.value)}
                              className="rounded-[18px] border border-[var(--line)] bg-[var(--sand)] px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-[var(--accent)]"
                            />
                          </label>

                          {travelDateChoices.length > 0 ? (
                            <div className="flex flex-wrap gap-2">
                              {travelDateChoices.map((dateKey) => (
                                <button
                                  key={dateKey}
                                  type="button"
                                  className="rounded-full bg-[var(--sand)] px-3 py-2 text-xs font-semibold text-slate-700 transition duration-200 hover:-translate-y-0.5 hover:bg-[rgba(0,52,43,0.08)] hover:text-[var(--accent)] hover:shadow-[0_8px_18px_rgba(15,23,42,0.06)]"
                                  onClick={() => setManualDateLabel(dateKey)}
                                >
                                  {formatDateKeyBadge(dateKey)}
                                </button>
                              ))}
                            </div>
                          ) : null}
                        </div>

                        <div className="flex flex-wrap gap-3 lg:justify-end lg:self-end">
                          <button
                            type="button"
                            className="button-secondary rounded-[18px] px-5 py-3 text-sm font-semibold text-slate-900"
                            onClick={() =>
                              setSelectedDatePhotoIds(
                                dateEditablePhotos.map((photo) => photo.id),
                              )
                            }
                          >
                            전체 선택
                          </button>
                          <button
                            type="button"
                            className="rounded-[18px] border border-[rgba(160,62,64,0.18)] bg-white px-5 py-3 text-sm font-semibold text-[var(--accent-secondary)] transition hover:bg-[rgba(160,62,64,0.06)]"
                            onClick={() => handleRemoveSelectedPhotos("date")}
                          >
                            선택 사진 삭제
                          </button>
                          <button
                            type="button"
                            className="button-primary rounded-[18px] px-5 py-3 text-sm font-semibold text-white"
                            onClick={handleApplyManualDateTag}
                          >
                            선택 사진 날짜 수정
                          </button>
                        </div>
                      </div>

                      <div className="mt-5 flex flex-wrap gap-2">
                        {[
                          { value: "all", label: "전체" },
                          { value: "undated", label: "미지정" },
                          ...availableDateFilters.map((dateKey) => ({
                            value: dateKey,
                            label: formatDateKeyBadge(dateKey),
                          })),
                        ].map((item) => {
                          const isActive = reviewDateFilter === item.value;
                          return (
                            <button
                              key={`filter-${item.value}`}
                              type="button"
                              className={`rounded-full px-3 py-2 text-xs font-semibold transition ${
                                isActive
                                  ? "bg-[var(--accent)] text-white"
                                  : "bg-white text-slate-700 hover:-translate-y-0.5 hover:bg-[rgba(0,52,43,0.06)] hover:text-[var(--accent)] hover:shadow-[0_8px_18px_rgba(15,23,42,0.06)]"
                              }`}
                              onClick={() => setReviewDateFilter(item.value)}
                            >
                              {item.label}
                            </button>
                          );
                        })}
                      </div>

                      <div
                        ref={dateSelectionGridRef}
                        className="relative mt-5 grid select-none grid-cols-2 gap-2.5 md:grid-cols-3 xl:grid-cols-5"
                        onPointerDown={(event) => startReviewMarqueeSelection("date", event)}
                      >
                        {filteredDateEditablePhotos.length > 0 ? (
                          filteredDateEditablePhotos.map((photo) => {
                            const isSelected = selectedDatePhotoIds.includes(photo.id);

                            return (
                              <SelectablePhotoCard
                                key={`date-${photo.id}`}
                                photo={photo}
                                selected={isSelected}
                                onToggle={() => toggleReviewSelection("date", photo.id)}
                                suppressClicksUntil={suppressSelectableClicksUntil}
                                badge={formatDateKeyBadge(photo.dateKey)}
                                helper={`현재 날짜: ${photo.dateKey === "undated" ? "미정" : photo.dateKey}`}
                              />
                            );
                          })
                        ) : (
                          <div className="col-span-full rounded-[20px] bg-[var(--sand)] px-4 py-4 text-sm leading-6 text-slate-600">
                            선택한 필터에 해당하는 사진이 없습니다.
                          </div>
                        )}
                        {reviewSelectionBox?.kind === "date" ? (
                          <div
                            className="pointer-events-none absolute rounded-[18px] border border-[rgba(0,52,43,0.28)] bg-[rgba(0,52,43,0.08)]"
                            style={{
                              left: reviewSelectionBox.left,
                              top: reviewSelectionBox.top,
                              width: reviewSelectionBox.width,
                              height: reviewSelectionBox.height,
                            }}
                          />
                        ) : null}
                      </div>

                    </section>

                    <section className="rounded-[28px] border border-[rgba(191,201,196,0.12)] bg-[var(--sand)] px-6 py-6">
                      <div className="flex items-center gap-4">
                        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[rgba(160,62,64,0.12)] text-[var(--accent-secondary)]">
                          <span className="text-xl">+</span>
                        </div>
                        <div>
                          <h3 className="text-lg font-semibold tracking-[-0.03em] text-slate-950">
                            위치 라벨 수정
                          </h3>
                          <p className="text-sm text-slate-500">
                            위치가 비어 있거나 임시 스팟으로 남은 사진을 골라 실제 장소 이름으로 바꿀 수 있습니다.
                          </p>
                        </div>
                      </div>

                      <div className="mt-6 grid gap-4 lg:grid-cols-[minmax(0,0.92fr)_auto] lg:items-end">
                        <div className="space-y-4">
                          <label className="grid gap-2">
                            <span className="text-sm font-semibold text-slate-900">장소 이름</span>
                            <input
                              value={manualLocationLabel}
                              onChange={(event) => setManualLocationLabel(event.target.value)}
                              className="rounded-[18px] border border-[var(--line)] bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-[var(--accent)]"
                              placeholder="예: 아사쿠사 센소지"
                            />
                          </label>

                          {suggestedLocations.length > 0 ? (
                            <div className="flex flex-wrap gap-2">
                              {suggestedLocations.map((label) => (
                                <button
                                  key={label}
                                  type="button"
                                  className="rounded-full bg-white px-3 py-2 text-xs font-semibold text-slate-700 transition hover:-translate-y-0.5 hover:text-[var(--accent)] hover:shadow-[0_8px_18px_rgba(15,23,42,0.06)]"
                                  onClick={() => setManualLocationLabel(label)}
                                >
                                  {label}
                                </button>
                              ))}
                            </div>
                          ) : null}
                        </div>

                        <div className="flex flex-wrap gap-3 lg:justify-end lg:self-end">
                          <button
                            type="button"
                            className="button-secondary rounded-[18px] px-5 py-3 text-sm font-semibold text-slate-900"
                            onClick={() =>
                              setSelectedPhotoIds(
                                filteredLocationEditablePhotos.map((photo) => photo.id),
                              )
                            }
                          >
                            전체 선택
                          </button>
                          <button
                            type="button"
                            className="rounded-[18px] border border-[rgba(160,62,64,0.18)] bg-white px-5 py-3 text-sm font-semibold text-[var(--accent-secondary)] transition hover:bg-[rgba(160,62,64,0.06)]"
                            onClick={() => handleRemoveSelectedPhotos("location")}
                          >
                            선택 사진 삭제
                          </button>
                          <button
                            type="button"
                            className="button-primary rounded-[18px] px-5 py-3 text-sm font-semibold text-white"
                            onClick={handleApplyManualTag}
                          >
                            선택 사진 위치 저장
                          </button>
                        </div>
                      </div>

                      <div className="mt-5 flex flex-wrap gap-2">
                        {[
                          { value: "all", label: "전체" },
                          { value: "unresolved", label: "미지정" },
                          ...availableLocationFilters.map((label) => ({
                            value: label,
                            label,
                          })),
                        ].map((item) => {
                          const isActive = reviewLocationFilter === item.value;
                          return (
                            <button
                              key={`location-filter-${item.value}`}
                              type="button"
                              className={`rounded-full px-3 py-2 text-xs font-semibold transition ${
                                isActive
                                  ? "bg-[var(--accent)] text-white"
                                  : "bg-white text-slate-700 hover:-translate-y-0.5 hover:bg-[rgba(0,52,43,0.06)] hover:text-[var(--accent)] hover:shadow-[0_8px_18px_rgba(15,23,42,0.06)]"
                              }`}
                              onClick={() => setReviewLocationFilter(item.value)}
                            >
                              {item.label}
                            </button>
                          );
                        })}
                      </div>

                      <div
                        ref={locationSelectionGridRef}
                        className="relative mt-5 grid select-none grid-cols-2 gap-2.5 md:grid-cols-3 xl:grid-cols-5"
                        onPointerDown={(event) => startReviewMarqueeSelection("location", event)}
                      >
                        {filteredLocationEditablePhotos.length > 0 ? (
                          filteredLocationEditablePhotos.map((photo) => {
                            const isSelected = selectedPhotoIds.includes(photo.id);

                            return (
                              <SelectablePhotoCard
                                key={photo.id}
                                photo={photo}
                                selected={isSelected}
                                onToggle={() => toggleReviewSelection("location", photo.id)}
                                suppressClicksUntil={suppressSelectableClicksUntil}
                                badge={photo.locationLabel && isMeaningfulLocationLabel(photo.locationLabel) ? photo.locationLabel : "위치 추가"}
                                helper={
                                  photo.dateKey === "undated"
                                    ? "날짜 미정"
                                    : `${formatDateKeyBadge(photo.dateKey)} · ${formatDateLabel(photo.capturedAt)}`
                                }
                              />
                            );
                          })
                        ) : (
                          <div className="col-span-full rounded-[20px] bg-white px-4 py-4 text-sm leading-6 text-slate-600">
                            선택한 위치 필터에 해당하는 사진이 없습니다.
                          </div>
                        )}
                        {reviewSelectionBox?.kind === "location" ? (
                          <div
                            className="pointer-events-none absolute rounded-[18px] border border-[rgba(0,52,43,0.28)] bg-[rgba(0,52,43,0.08)]"
                            style={{
                              left: reviewSelectionBox.left,
                              top: reviewSelectionBox.top,
                              width: reviewSelectionBox.width,
                              height: reviewSelectionBox.height,
                            }}
                          />
                        ) : null}
                      </div>

                      {reviewFeedback ? (
                        <div className="mt-4 rounded-[18px] bg-white px-4 py-3 text-sm text-[var(--accent)]">
                          {reviewFeedback}
                        </div>
                      ) : null}
                    </section>
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
                          className={`group text-left transition ${isSelected ? "-translate-y-1" : "hover:-translate-y-0.5"}`}
                          onClick={() => handleThemeChange(theme.id)}
                        >
                          <article
                            className={`overflow-hidden rounded-[24px] bg-[var(--surface-container-low,rgba(245,243,238,0.96))] p-6 ${isSelected ? "ring-2 ring-[rgba(0,52,43,0.24)]" : "ring-1 ring-[rgba(191,201,196,0.2)]"}`}
                          >
                            <div className="relative mb-6">
                              {isSelected ? (
                                <div className="absolute right-0 top-0 z-10 flex h-8 w-8 items-center justify-center rounded-full bg-[var(--accent)] text-white shadow-lg">
                                  <span className="text-sm font-semibold">✓</span>
                                </div>
                              ) : null}
                              <div className="flex justify-center py-4 [perspective:1000px]">
                                <div className="overflow-hidden rounded-[6px] border-l-4 border-white/20 shadow-[10px_20px_40px_rgba(0,0,0,0.08)] transition duration-500 [transform:rotateY(-20deg)_rotateX(5deg)] group-hover:scale-[1.03]">
                                  <div className="h-64 w-48 bg-white p-4">
                                    {theme.id === "timeline-classic" ? (
                                      <div className="flex h-full flex-col">
                                        <div className="overflow-hidden rounded-[4px]">
                                          {coverPreviewSrc ? (
                                            <Image
                                              src={coverPreviewSrc}
                                              alt={theme.name}
                                              width={192}
                                              height={160}
                                              unoptimized
                                              className="h-40 w-full object-cover"
                                            />
                                          ) : (
                                            <div className="h-40 w-full bg-[var(--sand)]" />
                                          )}
                                        </div>
                                        <div className="mt-4 flex-1">
                                          <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[var(--accent-secondary)]">
                                            Chapter 01
                                          </p>
                                          <p className="mt-3 text-lg font-semibold tracking-[-0.04em] text-[var(--accent)]">
                                            {draft?.tripName ?? "Triplogue"}
                                          </p>
                                          <div className="mt-4 h-1.5 w-16 rounded-full bg-[var(--sand)]" />
                                        </div>
                                      </div>
                                    ) : theme.id === "postcard-map" ? (
                                      <div className="flex h-full flex-col">
                                        <div className="relative overflow-hidden rounded-[4px] bg-[var(--sand)]">
                                          {coverPreviewSrc ? (
                                            <Image
                                              src={coverPreviewSrc}
                                              alt={theme.name}
                                              width={192}
                                              height={128}
                                              unoptimized
                                              className="h-32 w-full object-cover opacity-45 mix-blend-multiply"
                                            />
                                          ) : (
                                            <div className="h-32 w-full bg-[var(--sand)]" />
                                          )}
                                          <svg className="absolute inset-0 h-full w-full" viewBox="0 0 200 120">
                                            <path
                                              d="M30,24 Q96,42 152,88"
                                              fill="none"
                                              stroke="#00342b"
                                              strokeDasharray="6 6"
                                              strokeWidth="2"
                                            />
                                          </svg>
                                          <span className="absolute left-8 top-6 h-3 w-3 rounded-full bg-[var(--accent)] shadow-[0_0_0_8px_rgba(0,52,43,0.12)]" />
                                          <span className="absolute bottom-6 right-10 h-3 w-3 rounded-full bg-[var(--accent-secondary)] shadow-[0_0_0_8px_rgba(160,62,64,0.12)]" />
                                        </div>
                                        <div className="mt-4 space-y-2">
                                          <div className="h-2 w-24 rounded-full bg-[var(--sand)]" />
                                          <div className="h-2 w-16 rounded-full bg-[var(--sand)]" />
                                        </div>
                                      </div>
                                    ) : (
                                      <div className="flex h-full flex-col items-center justify-center text-center">
                                        <div className="overflow-hidden rounded-[4px]">
                                          {coverPreviewSrc ? (
                                            <Image
                                              src={coverPreviewSrc}
                                              alt={theme.name}
                                              width={192}
                                              height={160}
                                              unoptimized
                                              className="h-40 w-full object-cover"
                                            />
                                          ) : (
                                            <div className="h-40 w-full bg-[var(--sand)]" />
                                          )}
                                        </div>
                                        <div className="mt-4 space-y-2">
                                          <div className="mx-auto h-1.5 w-16 rounded-full bg-[var(--sand)]" />
                                          <div className="mx-auto h-1.5 w-12 rounded-full bg-[var(--sand)]" />
                                        </div>
                                      </div>
                                    )}
                                  </div>
                                </div>
                              </div>
                            </div>
                            <h3 className={`text-xl font-semibold ${isSelected ? "text-[var(--accent)]" : "text-slate-950"}`}>
                              {theme.name}
                            </h3>
                            <p className="mt-2 text-sm leading-6 text-slate-600">{theme.note}</p>
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
                    마지막으로 주문 정보를 확인해주세요.
                  </h2>
                  <p className="mt-3 max-w-2xl text-sm leading-7 text-slate-600">
                    거의 다 왔습니다. 테스트 책을 만들고 배송 정보를 확인한 뒤 주문 흐름까지 한 번에 마무리합니다.
                  </p>
                </div>
              </div>

              <div className="mt-8 space-y-8">
                <div className="rounded-[28px] bg-[var(--surface-container-low,rgba(245,243,238,0.96))] px-6 py-6 md:px-8 md:py-8">
                  <div className="flex flex-col gap-8 md:flex-row md:items-start">
                    <div className="w-full md:w-[13rem]">
                      <div className="overflow-hidden rounded-[20px] bg-white shadow-[0_8px_32px_rgba(27,28,25,0.04)]">
                        <PhotoSurface
                          photo={coverPreviewPhoto}
                          showOverlay={false}
                          className="min-h-[16rem] rounded-none border-0"
                        />
                      </div>
                    </div>
                    <div className="flex-1 space-y-6">
                      <div>
                        <h3 className="text-xl font-semibold tracking-[-0.04em] text-slate-950">
                          {previewDocument?.cover.title ?? draft?.tripName ?? "Triplogue"}
                        </h3>
                        <p className="mt-2 text-sm text-slate-500">
                          {resolvedTheme.name} · {productLabel}
                        </p>
                      </div>
                      <div className="grid grid-cols-2 gap-x-8 gap-y-4">
                        <div>
                          <span className="block text-[10px] uppercase tracking-[0.2em] text-slate-500">
                            Photo Count
                          </span>
                          <span className="mt-1 block font-medium text-slate-950">
                            {draft?.stats.totalPhotos ?? 0}장
                          </span>
                        </div>
                        <div>
                          <span className="block text-[10px] uppercase tracking-[0.2em] text-slate-500">
                            Selected Date
                          </span>
                          <span className="mt-1 block font-medium text-slate-950">
                            {draft?.travelStart ?? "미정"}
                          </span>
                        </div>
                        <div className="col-span-2">
                          <span className="block text-[10px] uppercase tracking-[0.2em] text-slate-500">
                            Format
                          </span>
                          <span className="mt-1 block font-medium text-slate-950">
                            {productLabel} / {productDimension}
                          </span>
                        </div>
                      </div>
                      <div className="flex flex-wrap gap-3">
                        <button
                          type="button"
                          className="button-primary rounded-[18px] px-5 py-3 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
                          onClick={handleComposeBook}
                          disabled={!draft || isComposing}
                        >
                          {isComposing ? "테스트 책 생성 중..." : "테스트 책 생성"}
                        </button>
                        <Link
                          href="/ops/webhooks"
                          className="button-secondary rounded-[18px] px-5 py-3 text-sm font-semibold text-slate-900"
                        >
                          웹훅 운영 보기
                        </Link>
                      </div>
                    </div>
                  </div>
                  {composeError ? (
                    <div className="mt-5 rounded-[18px] border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                      {composeError}
                    </div>
                  ) : null}
                </div>

                <div className="space-y-6">
                  <div className="flex items-center justify-between border-b border-[rgba(191,201,196,0.2)] pb-2">
                    <h3 className="text-lg font-semibold tracking-[-0.03em] text-slate-950">
                      배송 정보
                    </h3>
                    <span className="text-sm font-medium text-[var(--accent)]">
                      {composeResult ? "주문 가능" : "책 생성 후 활성화"}
                    </span>
                  </div>
                  <div className="grid gap-4">
                    {[
                      ["ordererName", "주문자 이름", "홍길동", "text"],
                      ["recipientName", "받는 사람", "홍길동", "text"],
                      ["recipientPhone", "연락처", "010-1234-5678", "text"],
                      ["postalCode", "우편번호", "06123", "text"],
                      ["address1", "주소", "서울시 강남구 테헤란로 123, 4층", "text"],
                      ["address2", "상세 주소", "5층 501호", "text"],
                      ["memo", "배송 메모", "문 앞에 놓아 주세요", "text"],
                    ].map(([key, label, placeholder, type]) => (
                      <label key={key} className="grid gap-1.5">
                        <span className="ml-1 text-[11px] font-bold uppercase tracking-[0.18em] text-slate-500">
                          {label}
                        </span>
                        <input
                          type={type}
                          value={String(orderDraft[key as keyof CheckoutOrderDraft])}
                          onChange={(event) =>
                            setOrderDraft((current) => ({
                              ...current,
                              [key]: event.target.value,
                            }))
                          }
                          className="rounded-[18px] border-none bg-[var(--sand)] px-4 py-3 text-sm text-slate-900 outline-none transition focus:ring-1 focus:ring-[rgba(0,52,43,0.18)]"
                          placeholder={placeholder}
                        />
                        {orderErrors[key as keyof CheckoutOrderDraft] ? (
                          <span className="text-xs text-rose-600">
                            {orderErrors[key as keyof CheckoutOrderDraft]}
                          </span>
                        ) : null}
                      </label>
                    ))}
                    <label className="grid gap-1.5">
                      <span className="ml-1 text-[11px] font-bold uppercase tracking-[0.18em] text-slate-500">
                        bookUid
                      </span>
                      <input
                        type="text"
                        value={orderDraft.bookUid}
                        disabled
                        className="rounded-[18px] border-none bg-[var(--sand)] px-4 py-3 text-sm text-slate-900 outline-none disabled:opacity-70"
                        placeholder="생성 후 자동 입력"
                      />
                    </label>
                    <label className="grid gap-1.5">
                      <span className="ml-1 text-[11px] font-bold uppercase tracking-[0.18em] text-slate-500">
                        수량
                      </span>
                      <input
                        type="number"
                        value={String(orderDraft.quantity)}
                        onChange={(event) =>
                          setOrderDraft((current) => ({
                            ...current,
                            quantity: Number(event.target.value || 1),
                          }))
                        }
                        className="rounded-[18px] border-none bg-[var(--sand)] px-4 py-3 text-sm text-slate-900 outline-none transition focus:ring-1 focus:ring-[rgba(0,52,43,0.18)]"
                        placeholder="1"
                      />
                    </label>
                  </div>
                </div>

                <div className="rounded-[24px] bg-[rgba(228,226,221,0.52)] px-6 py-6">
                  <div className="space-y-4">
                    <div className="flex items-center justify-between text-slate-600">
                      <span>포토북 제작 비용</span>
                      <span>{estimatedPrice.toLocaleString("ko-KR")}원</span>
                    </div>
                    <div className="flex items-center justify-between text-slate-600">
                      <span>배송비</span>
                      <span>3,000원</span>
                    </div>
                    <div className="flex items-end justify-between border-t border-[rgba(191,201,196,0.28)] pt-4">
                      <div>
                        <span className="text-sm text-slate-500">최종 결제 금액</span>
                        <h4 className="mt-1 text-3xl font-semibold tracking-[-0.05em] text-slate-950">
                          {(estimatedPrice + 3000).toLocaleString("ko-KR")}원
                        </h4>
                      </div>
                      <span className="text-xs font-medium text-[var(--accent-secondary)]">
                        배송비 포함
                      </span>
                    </div>
                  </div>
                </div>

                <label className="flex items-start gap-3 rounded-[18px] bg-white px-5 py-4">
                  <input type="checkbox" className="mt-1 h-4 w-4" />
                  <span className="text-xs leading-6 text-slate-600">
                    주문 내용을 확인했으며, 테스트 흐름상 결제 이후 제작 단계로 넘어간다고 가정합니다.
                  </span>
                </label>

                {composeResult ? (
                  <div className="rounded-[20px] bg-[rgba(15,118,110,0.06)] px-5 py-4 text-sm leading-6 text-slate-700">
                    bookUid {composeResult.bookUid} · {composeResult.operationCount ?? 0}개 조립 단계와{" "}
                    {composeResult.contentCount ?? 0}개 본문 처리가 완료됐습니다.
                  </div>
                ) : null}

                {orderResult ? (
                  <div className="rounded-[20px] bg-[rgba(160,62,64,0.08)] px-5 py-4 text-sm leading-6 text-slate-700">
                    orderUid {orderResult.orderUid ?? "확인 중"} · 상태{" "}
                    {orderResult.orderStatusDisplay ?? "확인 중"} · 금액{" "}
                    {orderResult.totalAmount
                      ? `${orderResult.totalAmount.toLocaleString("ko-KR")}원`
                      : "확인 중"}
                  </div>
                ) : null}

                {orderError ? (
                  <div className="rounded-[18px] border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                    {orderError}
                  </div>
                ) : null}

                <div className="flex flex-wrap gap-3">
                  <button
                    type="button"
                    className="button-primary rounded-[18px] px-5 py-3 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
                    onClick={handleCreateOrder}
                    disabled={!composeResult || isOrdering}
                  >
                    {isOrdering ? "주문 생성 중..." : "주문 및 결제하기"}
                  </button>
                  <button
                    type="button"
                    className="button-secondary rounded-[18px] px-5 py-3 text-sm font-semibold text-slate-900"
                    onClick={handleResetAll}
                  >
                    새 여행 다시 시작
                  </button>
                </div>
              </div>
            </section>
        </div>
      </main>

      <nav className="fixed bottom-0 left-0 z-50 flex w-full items-center justify-between border-t border-[rgba(191,201,196,0.2)] bg-[#fbf9f4] px-6 py-4">
        {previousStep ? (
          <Link
            href={getStudioStepHref(previousStep.id)}
            className="flex items-center justify-center px-6 py-3 text-[#3f4945] transition-all duration-200 hover:bg-[#004d40] hover:text-white active:scale-[0.98]"
          >
            <span className="material-symbols-outlined mr-2">arrow_back</span>
            <span className="text-[10px] font-medium uppercase tracking-[0.22em]">Back</span>
          </Link>
        ) : (
          <Link
            href="/"
            className="flex items-center justify-center px-6 py-3 text-[#3f4945] transition-all duration-200 hover:bg-[#004d40] hover:text-white active:scale-[0.98]"
          >
            <span className="material-symbols-outlined mr-2">arrow_back</span>
            <span className="text-[10px] font-medium uppercase tracking-[0.22em]">Back</span>
          </Link>
        )}

        {bottomNavigationHref && bottomNavigationLabel ? (
          <Link
            href={bottomNavigationHref}
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#00342b] px-8 py-3 text-[14px] font-bold leading-none !text-white visited:!text-white hover:bg-[#004d40] hover:!text-white active:scale-[0.98] active:!text-white"
          >
            {bottomNavigationLabel}
            <span className="material-symbols-outlined text-[18px] leading-none">arrow_forward</span>
          </Link>
        ) : (
          <button
            type="button"
            className="inline-flex touch-manipulation items-center justify-center gap-2 rounded-xl bg-[#00342b] px-8 py-3 text-[14px] font-bold leading-none text-white transition-all duration-200 hover:bg-[#004d40] active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60"
            onClick={() => runBottomAction(bottomPrimaryAction?.onClick ?? null)}
            disabled={bottomPrimaryAction?.disabled ?? true}
          >
            {bottomPrimaryAction?.label ?? "다음"}
            <span className="material-symbols-outlined text-[18px] leading-none">arrow_forward</span>
          </button>
        )}
      </nav>
    </div>
  );
}
