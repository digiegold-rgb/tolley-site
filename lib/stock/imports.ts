import { createHash } from "node:crypto";
import * as XLSX from "xlsx";
import { simpleParser } from "mailparser";
import { prisma } from "@/lib/prisma";
import { MAX_UPLOAD, manifestRow, sourceUrl } from "./core";

export function parseManifest(bytes: Buffer) {
  if (bytes.length > MAX_UPLOAD) throw new Error("Manifest exceeds 2 MB");
  const book = XLSX.read(bytes, { type: "buffer", sheetRows: 1002, raw: true });
  if (!book.SheetNames.length) throw new Error("Empty workbook");
  const records = XLSX.utils.sheet_to_json<Record<string, unknown>>(
    book.Sheets[book.SheetNames[0]],
    { defval: "", raw: false },
  );
  if (!records.length || records.length > 1000)
    throw new Error("Use a manifest containing 1–1,000 rows");
  return records.map((raw, i) => {
    const row = Object.fromEntries(
      Object.entries(raw).map(([k, v]) => [
        k.toLowerCase().replace(/[^a-z0-9]/g, ""),
        v,
      ]),
    );
    const pick = (...keys: string[]) =>
      keys.map((k) => row[k]).find((v) => v !== undefined && v !== "");
    const retail = pick("unitretail", "retail", "msrp");
    const result = manifestRow.safeParse({
      title: String(
        pick(
          "title",
          "itemdescription",
          "description",
          "productname",
          "name",
        ) ?? "",
      ),
      quantity: Number(pick("qty", "quantity", "units") ?? 1),
      sku: String(pick("sku", "upc", "item", "itemnumber") ?? ""),
      retailCents:
        retail === undefined
          ? null
          : Math.round(Number(String(retail).replace(/[$,]/g, "")) * 100),
    });
    if (!result.success)
      throw new Error(
        `Manifest row ${i + 2}: a title, valid quantity, and valid retail amount are required`,
      );
    return result.data;
  });
}

export async function parseEmail(bytes: Buffer, name: string) {
  if (bytes.length > MAX_UPLOAD) throw new Error("Email exceeds 2 MB");
  if (!/\.eml$/i.test(name))
    return { text: bytes.toString("utf8"), subject: name };
  const email = await simpleParser(bytes, {
    skipHtmlToText: true,
    skipTextToHtml: true,
  });
  return {
    text: [email.text || "", email.html || ""].join("\n"),
    subject: (email.subject || name).slice(0, 500),
    ...(email.date && Number.isFinite(email.date.getTime())
      ? { observedAt: email.date.toISOString() }
      : {}),
  };
}

// Only retain direct supplier listing URLs. Tracking URLs are not fetched or guessed.
export function emailLinks(text: string) {
  const found = new Set<string>();
  for (const hit of text.matchAll(/https:\/\/[^\s<>"']+/g)) {
    try {
      const url = sourceUrl(
        hit[0].replace(/&amp;/g, "&").replace(/[).,]+$/, ""),
      );
      const u = new URL(url);
      if (
        (/(^|\.)bstock\.com$/.test(u.hostname) &&
          /\/buy\/listings\/details\/[a-z0-9]+/i.test(u.pathname)) ||
        (/(^|\.)equip-bid\.com$/.test(u.hostname) &&
          /^\/auction\/\d+/.test(u.pathname)) ||
        (/(^|\.)directliquidation\.com$/.test(u.hostname) &&
          /\/auction\//.test(u.pathname))
      )
        found.add(url);
    } catch {
      /* Ignore malformed or non-public links. */
    }
  }
  return [...found].slice(0, 100);
}
export async function queueImport(
  name: string,
  kind: string,
  payload: object,
  key?: string,
) {
  const dedupeKey = createHash("sha256")
    .update(key || JSON.stringify({ kind, payload }))
    .digest("hex");
  return prisma.stockImport.upsert({
    where: { dedupeKey },
    create: {
      dedupeKey,
      name: name.slice(0, 250),
      kind,
      payload: JSON.parse(JSON.stringify(payload)),
    },
    update: {},
  });
}
export async function processImports() {
  const pending = await prisma.stockImport.findMany({
    where: { status: "queued" },
    orderBy: { createdAt: "asc" },
    take: 20,
  });
  for (const item of pending) {
    try {
      await prisma.$transaction(
        async (tx) => {
          await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtext(${item.id}))::text`;
          const current = await tx.stockImport.findUniqueOrThrow({
            where: { id: item.id },
          });
          if (current.status !== "queued") return;
          const p = current.payload as {
            text?: string;
            subject?: string;
            sourceUrl?: string;
            rows?: unknown;
            observedAt?: string;
          };
          let count = 0;
          if (item.kind === "manifest") {
            const rows = manifestRow.array().min(1).max(1000).parse(p.rows);
            const deal = await tx.stockOpportunity.findUnique({
              where: { sourceUrl: sourceUrl(p.sourceUrl || "") },
            });
            if (!deal)
              throw new Error("Add the listing before attaching its manifest");
            await tx.stockOpportunity.update({
              where: { id: deal.id },
              data: {
                manifest: rows,
                quantity: rows.reduce((n, r) => n + r.quantity, 0),
              },
            });
            count = rows.length;
          } else {
            for (const url of emailLinks(p.text || "")) {
              await tx.stockOpportunity.upsert({
                where: { sourceUrl: url },
                update: {},
                create: {
                  sourceUrl: url,
                  supplier: new URL(url).hostname,
                  title: (p.subject || item.name).slice(0, 500),
                  observedAt: new Date(p.observedAt || item.createdAt),
                  notes:
                    "Discovered in supplier email. Open the source to verify contents, price, fees, and availability.",
                },
              });
              count++;
            }
          }
          await tx.stockImport.update({
            where: { id: item.id },
            data: {
              status: count ? "processed" : "review",
              resultCount: count,
              processedAt: new Date(),
              error: count
                ? null
                : "No direct listing links found. Review the message and add the listing manually.",
            },
          });
        },
        { timeout: 25000 },
      );
    } catch (e) {
      await prisma.stockImport.updateMany({
        // A competing worker may already have committed this import successfully.
        where: { id: item.id, status: "queued" },
        data: {
          status: "error",
          error:
            e instanceof Error && !e.message.includes("prisma")
              ? e.message.slice(0, 300)
              : "Import failed; check worker logs",
          processedAt: new Date(),
        },
      });
    }
  }
  await prisma.stockSync.upsert({
    where: { id: "imports" },
    create: { id: "imports", status: "ok", checkedAt: new Date() },
    update: { status: "ok", checkedAt: new Date() },
  });
  return pending.length;
}
