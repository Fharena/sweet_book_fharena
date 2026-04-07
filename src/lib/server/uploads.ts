import { mkdir, readFile, stat, writeFile } from "node:fs/promises";
import path from "node:path";

const uploadsRoot = path.join(process.cwd(), "tmp", "uploads");
const publicRoot = path.join(process.cwd(), "public");
const mimeTypeByExtension: Record<string, string> = {
  ".avif": "image/avif",
  ".bmp": "image/bmp",
  ".gif": "image/gif",
  ".heic": "image/heic",
  ".heif": "image/heif",
  ".jpeg": "image/jpeg",
  ".jpg": "image/jpeg",
  ".png": "image/png",
  ".tif": "image/tiff",
  ".tiff": "image/tiff",
  ".webp": "image/webp",
};

function sanitizeFileName(fileName: string) {
  return fileName.replace(/[^a-zA-Z0-9._-]/g, "_");
}

export function resolveUploadPath(assetId: string) {
  const absolutePath = path.resolve(uploadsRoot, assetId);
  const normalizedRoot = path.resolve(uploadsRoot);

  const relativePath = path.relative(normalizedRoot, absolutePath);
  if (relativePath.startsWith("..") || path.isAbsolute(relativePath)) {
    throw new Error("Invalid asset path.");
  }

  return absolutePath;
}

export function resolvePublicAssetPath(assetId: string) {
  const absolutePath = path.resolve(publicRoot, assetId);
  const normalizedRoot = path.resolve(publicRoot);
  const relativePath = path.relative(normalizedRoot, absolutePath);

  if (relativePath.startsWith("..") || path.isAbsolute(relativePath)) {
    throw new Error("Invalid public asset path.");
  }

  return absolutePath;
}

export function inferUploadedMimeType(fileName: string, fallback = "application/octet-stream") {
  const extension = path.extname(fileName).toLowerCase();
  return mimeTypeByExtension[extension] ?? fallback;
}

export async function readUploadedAsset(assetId: string) {
  const absolutePath = resolveUploadPath(assetId);
  const fileStats = await stat(absolutePath);

  if (!fileStats.isFile()) {
    throw new Error("Uploaded asset is not a file.");
  }

  const buffer = await readFile(absolutePath);
  const fileName = path.basename(assetId);

  return {
    buffer,
    fileName,
    mimeType: inferUploadedMimeType(fileName),
  };
}

export async function persistUploadedFile(
  file: File,
  options: { draftId: string; index: number },
) {
  const folderPath = path.join(uploadsRoot, options.draftId);
  await mkdir(folderPath, { recursive: true });

  const sanitizedName = `${String(options.index + 1).padStart(3, "0")}-${sanitizeFileName(
    file.name,
  )}`;
  const relativePath = path.join(options.draftId, sanitizedName);
  const absolutePath = resolveUploadPath(relativePath);
  const buffer = Buffer.from(await file.arrayBuffer());

  await writeFile(absolutePath, buffer);
  return relativePath;
}

export async function loadUploadedFile(
  assetId: string,
  options: { fileName: string; mimeType: string },
) {
  const isDemoAsset = assetId.startsWith("demo-assets/");
  const absolutePath = isDemoAsset ? resolvePublicAssetPath(assetId) : resolveUploadPath(assetId);
  const fileStats = await stat(absolutePath);

  if (!fileStats.isFile()) {
    throw new Error("Uploaded asset is not a file.");
  }

  const buffer = await readFile(absolutePath);
  const asset = {
    buffer,
    fileName: path.basename(assetId),
    mimeType: inferUploadedMimeType(path.basename(assetId)),
  };

  return new File([asset.buffer], isDemoAsset ? asset.fileName : options.fileName, {
    type: isDemoAsset
      ? asset.mimeType || "application/octet-stream"
      : options.mimeType || asset.mimeType || "application/octet-stream",
  });
}
