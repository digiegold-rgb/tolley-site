/**
 * Gated /generate media serving — stills and MP4 clips.
 *
 * The studio loads `/api/generate/jobs/:id/image?i=0` (and the /media alias).
 * Video must be `video/mp4` with Range support so `<video controls>` can seek
 * while HQ-logged-in. Never default a clip to image/png.
 */

export const MP4_CONTENT_TYPE = "video/mp4";
export const PNG_CONTENT_TYPE = "image/png";

const VIDEO_TYPES = new Set([
  "video/mp4",
  "video/webm",
  "video/quicktime",
  "application/mp4",
]);

export function isVideoContentType(value: string | null | undefined): boolean {
  const raw = (value || "").split(";")[0].trim().toLowerCase();
  return VIDEO_TYPES.has(raw);
}

/** ISO-BMFF / MP4: bytes 4–7 are `ftyp`. */
export function bufferLooksLikeMp4(buf: Buffer): boolean {
  return buf.length >= 12 && buf.toString("ascii", 4, 8) === "ftyp";
}

export function bufferLooksLikePng(buf: Buffer): boolean {
  return (
    buf.length >= 8 &&
    buf[0] === 0x89 &&
    buf[1] === 0x50 &&
    buf[2] === 0x4e &&
    buf[3] === 0x47
  );
}

export function inferMediaContentType(opts: {
  stored?: string | null;
  fetchedType?: string | null;
  body?: Buffer | null;
}): string {
  const fetched = (opts.fetchedType || "").split(";")[0].trim();
  if (isVideoContentType(fetched)) {
    return fetched === "application/mp4" ? MP4_CONTENT_TYPE : fetched;
  }
  if (opts.body && bufferLooksLikeMp4(opts.body)) return MP4_CONTENT_TYPE;
  if (opts.body && bufferLooksLikePng(opts.body)) return PNG_CONTENT_TYPE;
  const stored = (opts.stored || "").trim();
  if (/\.(mp4|webm|mov)(\?|#|$)/i.test(stored) || /fal\.media/i.test(stored)) {
    return MP4_CONTENT_TYPE;
  }
  if (stored.startsWith("spark:") && stored.endsWith(".mp4")) return MP4_CONTENT_TYPE;
  if (stored.startsWith("blob:") && /\.mp4$/i.test(stored)) return MP4_CONTENT_TYPE;
  if (fetched.startsWith("image/")) return fetched;
  return fetched || PNG_CONTENT_TYPE;
}

export type ByteRange = { start: number; end: number };

/** Parse `Range: bytes=start-end` (single range). Null = serve the whole body. */
export function parseBytesRange(header: string | null | undefined, size: number): ByteRange | null {
  if (!header || size <= 0) return null;
  const m = /^bytes=(\d*)-(\d*)$/i.exec(header.trim());
  if (!m) return null;
  const hasStart = m[1] !== "";
  const hasEnd = m[2] !== "";
  if (!hasStart && !hasEnd) return null;
  let start: number;
  let end: number;
  if (!hasStart) {
    const suffix = Number(m[2]);
    if (!Number.isInteger(suffix) || suffix <= 0) return null;
    start = Math.max(0, size - suffix);
    end = size - 1;
  } else {
    start = Number(m[1]);
    end = hasEnd ? Number(m[2]) : size - 1;
    if (!Number.isInteger(start) || start < 0 || start >= size) return null;
    if (!Number.isInteger(end) || end < start) return null;
    end = Math.min(end, size - 1);
  }
  return { start, end };
}

export type MediaServeResult = {
  status: number;
  body: Buffer;
  headers: Record<string, string>;
};

export function serveMediaBytes(opts: {
  body: Buffer;
  contentType: string;
  rangeHeader?: string | null;
  cacheControl?: string;
}): MediaServeResult {
  const size = opts.body.length;
  const type = opts.contentType || PNG_CONTENT_TYPE;
  const base: Record<string, string> = {
    "Content-Type": type,
    "X-Content-Type-Options": "nosniff",
    "Cache-Control": opts.cacheControl || "private, no-store",
    "Accept-Ranges": "bytes",
  };
  const range = parseBytesRange(opts.rangeHeader, size);
  if (!range) {
    return {
      status: 200,
      body: opts.body,
      headers: { ...base, "Content-Length": String(size) },
    };
  }
  const slice = opts.body.subarray(range.start, range.end + 1);
  return {
    status: 206,
    body: slice,
    headers: {
      ...base,
      "Content-Length": String(slice.length),
      "Content-Range": `bytes ${range.start}-${range.end}/${size}`,
    },
  };
}

export async function readableToBuffer(
  body: ReadableStream<Uint8Array> | Buffer,
): Promise<Buffer> {
  if (Buffer.isBuffer(body)) return body;
  const reader = body.getReader();
  const chunks: Buffer[] = [];
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    if (value) chunks.push(Buffer.from(value));
  }
  return Buffer.concat(chunks);
}
