import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const uploadsRoot = path.join(process.cwd(), "tmp", "uploads");

function sanitizeFileName(fileName: string) {
  return fileName.replace(/[^a-zA-Z0-9._-]/g, "_");
}

function resolveUploadPath(assetId: string) {
  const absolutePath = path.resolve(uploadsRoot, assetId);
  const normalizedRoot = path.resolve(uploadsRoot);

  if (!absolutePath.startsWith(normalizedRoot)) {
    throw new Error("Invalid asset path.");
  }

  return absolutePath;
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
  const absolutePath = resolveUploadPath(assetId);
  const buffer = await readFile(absolutePath);

  return new File([buffer], options.fileName, {
    type: options.mimeType || "application/octet-stream",
  });
}
