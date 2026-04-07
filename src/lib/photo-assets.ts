const UPLOADS_API_PREFIX = "/api/uploads";
const DEMO_ASSETS_PREFIX = "demo-assets/";

function normalizeAssetId(assetId: string) {
  return assetId
    .trim()
    .replace(/\\/g, "/")
    .split("/")
    .filter(Boolean);
}

export function buildUploadedPhotoSrc(assetId: string) {
  if (assetId.startsWith(DEMO_ASSETS_PREFIX)) {
    return `/${assetId}`;
  }

  const segments = normalizeAssetId(assetId);
  if (segments.length === 0) {
    return null;
  }

  return `${UPLOADS_API_PREFIX}/${segments.map(encodeURIComponent).join("/")}`;
}

export function hasUploadedPhotoAssetId(assetId: unknown): assetId is string {
  return typeof assetId === "string" && normalizeAssetId(assetId).length > 0;
}

export function isBundledDemoAssetId(assetId: unknown): assetId is string {
  return typeof assetId === "string" && assetId.startsWith(DEMO_ASSETS_PREFIX);
}
