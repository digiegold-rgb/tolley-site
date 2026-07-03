#!/usr/bin/env node
// One-off seed: read /home/jelly/Shared/shop-reviews/*.json and upsert into Review table.
// Idempotent via bodyHash unique index.
import { PrismaClient } from "@prisma/client";
import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import crypto from "node:crypto";

const prisma = new PrismaClient();
const folder = path.join(os.homedir(), "Shared", "shop-reviews");

function hashBody(body) {
  return crypto.createHash("sha256").update(body.trim().toLowerCase()).digest("hex");
}

const files = (await readdir(folder)).filter((f) => f.endsWith(".json"));
let scanned = 0, created = 0, deduped = 0, errors = [];

for (const file of files) {
  const full = path.join(folder, file);
  try {
    const raw = await readFile(full, "utf8");
    const parsed = JSON.parse(raw);
    const rows = Array.isArray(parsed) ? parsed : parsed.reviews;
    if (!Array.isArray(rows)) { errors.push({ file, message: "not an array" }); continue; }
    for (const r of rows) {
      scanned++;
      if (!r.reviewerName || !r.body) { errors.push({ file, message: "missing reviewerName/body" }); continue; }
      const bodyHash = hashBody(r.body);
      const existing = await prisma.review.findUnique({ where: { bodyHash } });
      if (existing) { deduped++; continue; }
      await prisma.review.create({
        data: {
          source: r.source ?? "manual",
          reviewerName: r.reviewerName,
          body: r.body.trim(),
          rating: typeof r.rating === "number" ? r.rating : null,
          notableTags: Array.isArray(r.notableTags) ? r.notableTags : [],
          reviewedAt: r.reviewedAt ? new Date(r.reviewedAt) : null,
          sourceUrl: r.sourceUrl ?? null,
          productId: r.productId ?? null,
          bodyHash,
        },
      });
      created++;
    }
  } catch (e) {
    errors.push({ file, message: String(e?.message || e) });
  }
}

console.log(JSON.stringify({ folder, files, scanned, created, deduped, errors }, null, 2));
await prisma.$disconnect();
