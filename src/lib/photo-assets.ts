const UPLOADS_API_PREFIX = "/api/uploads";

function normalizeAssetId(assetId: string) {
  return assetId
    .trim()
    .replace(/\\/g, "/")
    .split("/")
    .filter(Boolean);
}

export function buildUploadedPhotoSrc(assetId: string) {
  const segments = normalizeAssetId(assetId);
  if (segments.length === 0) {
    return null;
  }

  return `${UPLOADS_API_PREFIX}/${segments.map(encodeURIComponent).join("/")}`;
}

export function hasUploadedPhotoAssetId(assetId: unknown): assetId is string {
  return typeof assetId === "string" && normalizeAssetId(assetId).length > 0;
}
