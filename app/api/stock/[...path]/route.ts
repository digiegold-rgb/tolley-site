import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { authorize, boundedBody, failure, json } from "@/lib/stock/http";
import {
  dashboard,
  purchaseDeal,
  receiveLot,
  recordSale,
  saveDeal,
} from "@/lib/stock/service";
import {
  parseEmail,
  parseManifest,
  processImports,
  queueImport,
} from "@/lib/stock/imports";
import { sourceUrl } from "@/lib/stock/core";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;
type Context = { params: Promise<{ path: string[] }> };

export async function GET(req: Request, ctx: Context) {
  const { path } = await ctx.params;
  const worker = path[0] === "worker";
  if (!(await authorize(req, worker)))
    return json({ error: "Unauthorized" }, 401);
  try {
    if (path.join("/") === "worker/watchlist")
      return json(
        await prisma.stockOpportunity.findMany({
          where: {
            watched: true,
            historical: false,
            sourceUrl: {
              startsWith: "https://bstock.com/buy/listings/details/",
            },
            OR: [{ endsAt: null }, { endsAt: { gt: new Date() } }],
          },
          select: { id: true, sourceUrl: true },
          take: 10,
        }),
      );
    if (path.join("/") === "dashboard") return json(await dashboard());
    if (path[0] === "imports" && path[1]) {
      const item = await prisma.stockImport.findUnique({
        where: { id: path[1] },
        select: { name: true, payload: true, error: true },
      });
      return item ? json(item) : json({ error: "Not found" }, 404);
    }
    return json({ error: "Not found" }, 404);
  } catch (e) {
    return failure(e);
  }
}

export async function POST(req: Request, ctx: Context) {
  const { path } = await ctx.params;
  const worker = path[0] === "worker";
  if (!(await authorize(req, worker)))
    return json({ error: "Unauthorized" }, 401);
  try {
    const bytes = await boundedBody(req);
    if (
      path[0] === "imports" &&
      (req.headers.get("content-type") || "").includes("multipart/form-data")
    ) {
      const form = await new Response(bytes, {
        headers: { "content-type": req.headers.get("content-type")! },
      }).formData();
      const file = form.get("file");
      if (!(file instanceof File))
        throw new Error("Select a CSV, XLSX, or text email file");
      const manifest = /\.(csv|xlsx)$/i.test(file.name);
      if (!manifest && !/\.(txt|eml)$/i.test(file.name))
        throw new Error("Use CSV, XLSX, TXT, or EML");
      const payload = manifest
        ? {
            sourceUrl: sourceUrl(String(form.get("sourceUrl") || "")),
            rows: parseManifest(Buffer.from(await file.arrayBuffer())),
          }
        : await parseEmail(Buffer.from(await file.arrayBuffer()), file.name);
      const result = await queueImport(
        file.name,
        manifest ? "manifest" : "email",
        payload,
      );
      await processImports();
      return json(
        await prisma.stockImport.findUnique({ where: { id: result.id } }),
      );
    }
    const body = bytes.length ? JSON.parse(Buffer.from(bytes).toString()) : {};
    if (path[0] === "worker") {
      if (path[1] === "email") {
        const input = z
          .object({
            key: z.string().min(1).max(300),
            subject: z.string().max(500),
            text: z.string().max(1800000),
            observedAt: z.string().datetime(),
          })
          .parse(body);
        return json(
          await queueImport(input.subject, "email", input, input.key),
        );
      }
      if (path[1] === "process")
        return json({ processed: await processImports() });
      if (path[1] === "status") {
        const input = z
          .object({
            id: z.enum(["mail", "browser"]),
            status: z.enum(["ok", "error", "reconnect", "disabled"]),
            message: z.string().max(500).optional(),
          })
          .parse(body);
        return json(
          await prisma.stockSync.upsert({
            where: { id: input.id },
            create: { ...input, checkedAt: new Date() },
            update: { ...input, checkedAt: new Date() },
          }),
        );
      }
      if (path[1] === "observation") {
        const input = z
          .object({
            id: z.string(),
            title: z.string().min(1).max(500),
            notes: z.string().max(5000),
            bidCents: z.number().int().min(0).nullable(),
            endsAt: z.string().datetime().nullable().optional(),
          })
          .parse(body);
        const previous = await prisma.stockOpportunity.findUniqueOrThrow({
          where: { id: input.id },
        });
        return json(
          await prisma.stockOpportunity.update({
            where: { id: input.id },
            data: {
              title: input.title,
              notes: previous.notes || input.notes,
              bidCents: input.bidCents,
              ...(previous.bidCents !== input.bidCents
                ? { feesCents: null }
                : {}),
              ...(input.endsAt !== undefined
                ? { endsAt: input.endsAt ? new Date(input.endsAt) : null }
                : {}),
              observedAt: new Date(),
            },
          }),
        );
      }
      return json({ error: "Not found" }, 404);
    }
    if (path[0] === "deals" && path.length === 1)
      return json(await saveDeal(body));
    if (path[0] === "deals" && path[2] === "watch")
      return json(
        await prisma.stockOpportunity.update({
          where: { id: path[1] },
          data: z.object({ watched: z.boolean() }).parse(body),
        }),
      );
    if (path[0] === "deals" && path[2] === "purchase")
      return json(await purchaseDeal(path[1], body));
    if (path[0] === "purchases" && path[2] === "receive")
      return json(await receiveLot(path[1], body));
    if (path[0] === "products" && path[2] === "sale")
      return json(await recordSale(path[1], body));
    if (path[0] === "imports" && path[1] === "retry") {
      const { id } = z.object({ id: z.string() }).parse(body);
      await prisma.stockImport.updateMany({
        where: { id, status: { in: ["error", "review"] } },
        data: { status: "queued", error: null },
      });
      await processImports();
      return json({ ok: true });
    }
    if (path[0] === "imports") {
      const input = z
        .object({
          text: z.string().min(1).max(1800000),
          subject: z.string().max(500).default("Pasted supplier email"),
        })
        .parse(body);
      const result = await queueImport(input.subject, "email", input);
      await processImports();
      return json(
        await prisma.stockImport.findUnique({ where: { id: result.id } }),
      );
    }
    return json({ error: "Not found" }, 404);
  } catch (e) {
    return failure(e);
  }
}
