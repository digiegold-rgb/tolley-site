import { NextRequest, NextResponse } from "next/server";
import crypto from "node:crypto";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { prisma } from "@/lib/prisma";
import { validateShopAdmin } from "@/lib/shop-auth";
import { revalidatePath } from "next/cache";

interface ImportRequestBody {
  folder?: unknown;
  dryRun?: unknown;
}

interface ParsedReview {
  reviewerName: string;
  body: string;
  rating: number | null;
  source: string;
  sourceUrl: string | null;
  reviewedAt: Date | null;
  productId: string | null;
  notableTags: string[];
  externalId: string | null;
  reviewerAvatar: string | null;
}

interface ImportError {
  file: string;
  line?: number;
  message: string;
}

interface ImportStats {
  scanned: number;
  created: number;
  deduped: number;
  errors: ImportError[];
  files: string[];
  message?: string;
}

function hashBody(body: string): string {
  return crypto
    .createHash("sha256")
    .update(body.trim().toLowerCase())
    .digest("hex");
}

function parseDate(raw: unknown): Date | null {
  if (!raw) return null;
  if (typeof raw !== "string" && !(raw instanceof Date)) return null;
  const d = raw instanceof Date ? raw : new Date(raw);
  if (Number.isNaN(d.getTime())) return null;
  return d;
}

function coerceRating(raw: unknown): number | null {
  const n =
    typeof raw === "number" ? raw : typeof raw === "string" ? parseFloat(raw) : NaN;
  if (!Number.isFinite(n) || n < 1 || n > 5) return null;
  return Math.round(n);
}

function coerceTags(raw: unknown): string[] {
  if (Array.isArray(raw)) {
    return raw
      .filter((t): t is string => typeof t === "string" && t.trim().length > 0)
      .map((t) => t.trim());
  }
  if (typeof raw === "string") {
    return raw
      .split(";")
      .map((t) => t.trim())
      .filter((t) => t.length > 0);
  }
  return [];
}

function rowToReview(
  row: Record<string, unknown>
): { ok: true; review: ParsedReview } | { ok: false; error: string } {
  const reviewerName =
    typeof row.reviewerName === "string"
      ? row.reviewerName.trim()
      : typeof row.reviewer_name === "string"
        ? (row.reviewer_name as string).trim()
        : "";
  const body = typeof row.body === "string" ? row.body.trim() : "";

  if (!reviewerName) return { ok: false, error: "missing reviewerName" };
  if (!body) return { ok: false, error: "missing body" };

  return {
    ok: true,
    review: {
      reviewerName,
      body,
      rating: coerceRating(row.rating),
      source:
        typeof row.source === "string" && row.source.trim()
          ? row.source.trim()
          : "manual",
      sourceUrl:
        typeof row.sourceUrl === "string"
          ? row.sourceUrl || null
          : typeof row.source_url === "string"
            ? (row.source_url as string) || null
            : null,
      reviewedAt: parseDate(row.reviewedAt ?? row.reviewed_at),
      productId:
        typeof row.productId === "string"
          ? row.productId || null
          : typeof row.product_id === "string"
            ? (row.product_id as string) || null
            : null,
      notableTags: coerceTags(row.notableTags ?? row.notable_tags),
      externalId:
        typeof row.externalId === "string"
          ? row.externalId || null
          : typeof row.external_id === "string"
            ? (row.external_id as string) || null
            : null,
      reviewerAvatar:
        typeof row.reviewerAvatar === "string"
          ? row.reviewerAvatar || null
          : typeof row.reviewer_avatar === "string"
            ? (row.reviewer_avatar as string) || null
            : null,
    },
  };
}

function parseJsonFile(
  content: string,
  file: string,
  errors: ImportError[]
): ParsedReview[] {
  let data: unknown;
  try {
    data = JSON.parse(content);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "JSON parse failed";
    errors.push({ file, message: msg });
    return [];
  }

  let rows: unknown[] = [];
  if (Array.isArray(data)) {
    rows = data;
  } else if (data && typeof data === "object" && Array.isArray((data as { reviews?: unknown[] }).reviews)) {
    rows = (data as { reviews: unknown[] }).reviews;
  } else {
    errors.push({
      file,
      message: "expected array or { reviews: [...] }",
    });
    return [];
  }

  const out: ParsedReview[] = [];
  rows.forEach((row, idx) => {
    if (!row || typeof row !== "object") {
      errors.push({ file, line: idx + 1, message: "row is not an object" });
      return;
    }
    const result = rowToReview(row as Record<string, unknown>);
    if (!result.ok) {
      errors.push({ file, line: idx + 1, message: result.error });
      return;
    }
    out.push(result.review);
  });
  return out;
}

function parseCsvFile(
  content: string,
  file: string,
  errors: ImportError[]
): ParsedReview[] {
  const lines = content.split(/\r?\n/).filter((l) => l.trim().length > 0);
  if (lines.length === 0) return [];

  const header = lines[0]!.split(",").map((h) => h.trim());
  // Required columns per the task spec
  if (!header.includes("reviewer_name") || !header.includes("body")) {
    errors.push({
      file,
      line: 1,
      message: "CSV must include reviewer_name,body headers",
    });
    return [];
  }

  const out: ParsedReview[] = [];
  for (let i = 1; i < lines.length; i++) {
    const cells = lines[i]!.split(",").map((c) => c.trim());
    const row: Record<string, unknown> = {};
    header.forEach((h, idx) => {
      row[h] = cells[idx] ?? "";
    });
    const result = rowToReview(row);
    if (!result.ok) {
      errors.push({ file, line: i + 1, message: result.error });
      continue;
    }
    out.push(result.review);
  }
  return out;
}

function parseTextFile(
  content: string,
  file: string,
  errors: ImportError[]
): ParsedReview[] {
  const blocks = content
    .split(/^---\s*$/m)
    .map((b) => b.trim())
    .filter((b) => b.length > 0);

  const out: ParsedReview[] = [];
  let lineCursor = 1;

  for (const block of blocks) {
    const lines = block.split(/\r?\n/);
    const firstNonEmpty = lines.findIndex((l) => l.trim().length > 0);
    if (firstNonEmpty === -1) {
      lineCursor += lines.length + 1;
      continue;
    }
    const header = lines[firstNonEmpty]!.trim();
    const m = header.match(/^(.+?)\s*(?:\((\d)★?\))?\s*$/);
    if (!m) {
      errors.push({
        file,
        line: lineCursor + firstNonEmpty,
        message: "could not parse reviewer header line",
      });
      lineCursor += lines.length + 1;
      continue;
    }
    const reviewerName = m[1]!.trim();
    const rating = m[2] ? coerceRating(m[2]) : null;
    const body = lines
      .slice(firstNonEmpty + 1)
      .join("\n")
      .trim();

    if (!reviewerName || !body) {
      errors.push({
        file,
        line: lineCursor + firstNonEmpty,
        message: "missing reviewerName or body in block",
      });
      lineCursor += lines.length + 1;
      continue;
    }

    out.push({
      reviewerName,
      body,
      rating,
      source: "manual",
      sourceUrl: null,
      reviewedAt: null,
      productId: null,
      notableTags: [],
      externalId: null,
      reviewerAvatar: null,
    });
    lineCursor += lines.length + 1;
  }

  return out;
}

export async function POST(req: NextRequest) {
  const isAdmin = await validateShopAdmin();
  if (!isAdmin) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  let payload: ImportRequestBody = {};
  try {
    // Body is optional.
    const text = await req.text();
    if (text.trim()) payload = JSON.parse(text) as ImportRequestBody;
  } catch (err) {
    return NextResponse.json(
      { error: `invalid json body: ${err instanceof Error ? err.message : "parse error"}` },
      { status: 400 }
    );
  }

  const homedir = os.homedir();
  const requestedFolder =
    typeof payload.folder === "string" && payload.folder
      ? payload.folder
      : path.join(homedir, "Shared", "shop-reviews");
  const dryRun = !!payload.dryRun;

  // SECURITY: refuse paths outside the user's home dir.
  const resolvedFolder = path.resolve(requestedFolder);
  const resolvedHome = path.resolve(homedir);
  if (
    resolvedFolder !== resolvedHome &&
    !resolvedFolder.startsWith(resolvedHome + path.sep)
  ) {
    return NextResponse.json(
      { error: `folder must be inside ${resolvedHome}` },
      { status: 400 }
    );
  }

  // If folder doesn't exist or is empty, return success with stats
  let dirEntries: string[] = [];
  try {
    const stat = await fs.stat(resolvedFolder);
    if (!stat.isDirectory()) {
      return NextResponse.json(
        { error: "path is not a directory" },
        { status: 400 }
      );
    }
    dirEntries = await fs.readdir(resolvedFolder);
  } catch {
    const stats: ImportStats = {
      scanned: 0,
      created: 0,
      deduped: 0,
      errors: [],
      files: [],
      message: "folder missing or empty",
    };
    return NextResponse.json(stats);
  }

  const eligibleFiles = dirEntries.filter((name) =>
    /\.(json|csv|txt|md)$/i.test(name)
  );

  if (eligibleFiles.length === 0) {
    const stats: ImportStats = {
      scanned: 0,
      created: 0,
      deduped: 0,
      errors: [],
      files: [],
      message: "folder missing or empty",
    };
    return NextResponse.json(stats);
  }

  const errors: ImportError[] = [];
  const allReviews: ParsedReview[] = [];

  for (const name of eligibleFiles) {
    const fullPath = path.join(resolvedFolder, name);
    let content: string;
    try {
      content = await fs.readFile(fullPath, "utf8");
    } catch (err) {
      errors.push({
        file: name,
        message: `read failed: ${err instanceof Error ? err.message : "unknown"}`,
      });
      continue;
    }

    try {
      let parsed: ParsedReview[] = [];
      if (/\.json$/i.test(name)) {
        parsed = parseJsonFile(content, name, errors);
      } else if (/\.csv$/i.test(name)) {
        parsed = parseCsvFile(content, name, errors);
      } else {
        // .txt or .md
        parsed = parseTextFile(content, name, errors);
      }
      allReviews.push(...parsed);
    } catch (err) {
      // Per-file try/catch — never let one bad file kill the whole import.
      errors.push({
        file: name,
        message:
          err instanceof Error ? err.message : "unknown parser exception",
      });
    }
  }

  // Compute hashes & dedupe within the batch
  const hashed = allReviews.map((r) => ({ ...r, bodyHash: hashBody(r.body) }));
  const uniqueByHash = new Map<string, (typeof hashed)[number]>();
  for (const r of hashed) {
    if (!uniqueByHash.has(r.bodyHash)) uniqueByHash.set(r.bodyHash, r);
  }

  const scanned = hashed.length;
  let created = 0;
  let deduped = scanned - uniqueByHash.size;

  if (dryRun) {
    // Check DB for existing hashes to compute would-create counts
    const hashes = Array.from(uniqueByHash.keys());
    const existing = hashes.length
      ? await prisma.review.findMany({
          where: { bodyHash: { in: hashes } },
          select: { bodyHash: true },
        })
      : [];
    const existingSet = new Set(existing.map((e) => e.bodyHash));
    for (const hash of hashes) {
      if (existingSet.has(hash)) deduped += 1;
      else created += 1;
    }

    const stats: ImportStats = {
      scanned,
      created,
      deduped,
      errors,
      files: eligibleFiles,
      message: "dry run — no DB writes",
    };
    return NextResponse.json(stats);
  }

  // Real write path
  for (const r of uniqueByHash.values()) {
    try {
      const existed = await prisma.review.findUnique({
        where: { bodyHash: r.bodyHash },
        select: { id: true },
      });
      if (existed) {
        deduped += 1;
        continue;
      }
      await prisma.review.create({
        data: {
          source: r.source,
          externalId: r.externalId,
          reviewerName: r.reviewerName,
          reviewerAvatar: r.reviewerAvatar,
          rating: r.rating,
          body: r.body,
          notableTags: r.notableTags,
          productId: r.productId,
          sourceUrl: r.sourceUrl,
          reviewedAt: r.reviewedAt,
          bodyHash: r.bodyHash,
        },
      });
      created += 1;
    } catch (err) {
      errors.push({
        file: "<db>",
        message: `create failed for ${r.reviewerName}: ${
          err instanceof Error ? err.message : "unknown"
        }`,
      });
    }
  }

  if (created > 0) {
    revalidatePath("/shop");
    revalidatePath("/shop/reviews");
  }

  const stats: ImportStats = {
    scanned,
    created,
    deduped,
    errors,
    files: eligibleFiles,
  };
  return NextResponse.json(stats);
}
