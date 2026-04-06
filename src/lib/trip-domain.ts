import type { TravelThemeId } from "@/lib/travel-themes";

export type PhotoLocationSource = "exif" | "manual" | "time-cluster" | "unknown";

export type GeoPoint = {
  latitude: number;
  longitude: number;
};

export type ImportedPhoto = {
  id: string;
  assetId: string | null;
  fileName: string;
  originalName: string;
  mimeType: string;
  size: number;
  capturedAt: string | null;
  dateKey: string;
  coordinates: GeoPoint | null;
  locationLabel: string | null;
  locationSource: PhotoLocationSource;
  requiresManualLocationTagging: boolean;
  groupingReason: string;
};

export type TripChapter = {
  id: string;
  title: string;
  dayLabel: string;
  dateKey: string;
  placeLabel: string;
  photoIds: string[];
  photoCount: number;
  locationSource: PhotoLocationSource;
  groupingReason: string;
};

export type TripIntakeStats = {
  totalPhotos: number;
  withCaptureTime: number;
  withGpsCoordinates: number;
  withResolvedLocation: number;
  manualTaggingRequired: number;
};

export type TripIntakeResult = {
  tripName: string;
  travelStart: string | null;
  travelEnd: string | null;
  selectedThemeId: TravelThemeId;
  photos: ImportedPhoto[];
  chapters: TripChapter[];
  stats: TripIntakeStats;
};

export type SweetbookBookPlanOperation =
  | {
      kind: "cover";
      templateUid: string;
      parameters: Record<string, unknown>;
    }
  | {
      kind: "divider" | "content" | "publish";
      templateUid: string;
      parameters: Record<string, unknown>;
      photoIds?: string[];
    };

export type SweetbookBookPlan = {
  title: string;
  subtitle: string;
  dateRange: string;
  bookSpecUid: string;
  themeLabel: string;
  selectedThemeId: TravelThemeId;
  operations: SweetbookBookPlanOperation[];
};

export type ManualLocationOverride = {
  fileName: string;
  locationLabel: string;
  latitude?: number;
  longitude?: number;
};

export type SweetbookWebhookEvent =
  | "order.created"
  | "order.cancelled"
  | "order.restored"
  | "production.confirmed"
  | "production.started"
  | "production.completed"
  | "shipping.departed"
  | "shipping.delivered"
  | "webhook.exhausted";

export type SweetbookWebhookVerificationStatus =
  | "verified"
  | "invalid-signature"
  | "missing-secret";

export type SweetbookWebhookReceipt = {
  receiptUid: string;
  eventType: string | null;
  deliveryUid: string | null;
  verificationStatus: SweetbookWebhookVerificationStatus;
  receivedAt: string;
  orderUid: string | null;
  bookUid: string | null;
  payloadPreview: string | null;
};
