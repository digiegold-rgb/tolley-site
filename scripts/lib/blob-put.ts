/**
 * Remux an MP4 with +faststart and upload to Vercel Blob.
 * Extracted from scripts/vater-blob-upload.ts so DGX library-sync can reuse it.
 */
import { put } from "@vercel/blob";
import { spawnSync } from "child_process";
import { existsSync, readFileSync, unlinkSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";

const CONTENT_TYPES: Record<string, string> = {
  mp4: "video/mp4",
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  webp: "image/webp",
  txt: "text/plain; charset=utf-8",
  json: "application/json",
};

export function remuxFaststart(filePath: string, tag = "blob"): string {
  if (!existsSync(filePath)) throw new Error(`missing file: ${filePath}`);
  const tmp = join(tmpdir(), `vater-faststart-${tag}-${process.pid}-${Date.now()}.mp4`);
  const ff = spawnSync(
    "ffmpeg",
    ["-y", "-i", filePath, "-c", "copy", "-movflags", "+faststart", tmp],
    { stdio: ["ignore", "ignore", "pipe"], timeout: 300_000 },
  );
  if (ff.status !== 0 || !existsSync(tmp)) {
    throw new Error(
      `faststart remux failed (${ff.status}): ${String(ff.stderr).slice(-300)}`,
    );
  }
  return tmp;
}

export async function putPublicBlob(
  key: string,
  body: Buffer,
  contentType: string,
): Promise<string> {
  const blob = await put(key.replace(/^\/+/, ""), body, {
    access: "public",
    addRandomSuffix: false,
    allowOverwrite: true,
    contentType,
  });
  return `${blob.url}?v=${Date.now()}`;
}

/** Upload a file. mp4s are remuxed with +faststart first. */
export async function uploadFileToBlob(
  filePath: string,
  key: string,
  contentType?: string | null,
): Promise<string> {
  if (!existsSync(filePath)) throw new Error(`missing file: ${filePath}`);
  const ext = (filePath.split(".").pop() ?? "").toLowerCase();
  const ct = contentType || CONTENT_TYPES[ext] || "application/octet-stream";
  let body = readFileSync(filePath);
  let tmp: string | null = null;
  if (ext === "mp4") {
    tmp = remuxFaststart(filePath, key.replace(/[^a-z0-9]/gi, "").slice(-12) || "mp4");
    body = readFileSync(tmp);
  }
  try {
    return await putPublicBlob(key, body, ct);
  } finally {
    if (tmp) {
      try {
        unlinkSync(tmp);
      } catch {
        /* tmp cleanup best-effort */
      }
    }
  }
}

export async function uploadVaterFinal(filePath: string, projectId: string): Promise<string> {
  return uploadFileToBlob(filePath, `vater-finals/${projectId}.mp4`, "video/mp4");
}
