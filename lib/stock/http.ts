import { NextResponse } from "next/server";
import { z } from "zod";
import { validateWdAdmin } from "@/lib/wd-auth";
import { secretEquals } from "@/lib/secret-compare";
import { MAX_UPLOAD } from "./core";

export const json = (data: unknown, status = 200) =>
  NextResponse.json(data, {
    status,
    headers: {
      "Cache-Control": "no-store",
      "X-Robots-Tag": "noindex, nofollow",
    },
  });
export async function authorize(req: Request, worker = false) {
  if (worker)
    return (
      secretEquals(
        req.headers.get("authorization"),
        `Bearer ${process.env.STOCK_WORKER_TOKEN || ""}`,
      ) && !!process.env.STOCK_WORKER_TOKEN
    );
  if (req.method !== "GET") {
    const origin = req.headers.get("origin");
    if (origin && origin !== new URL(req.url).origin) return false;
  }
  return (await validateWdAdmin()).authed;
}
export async function boundedBody(req: Request) {
  if (Number(req.headers.get("content-length") || 0) > MAX_UPLOAD)
    throw new Error("Upload exceeds 2 MB");
  const reader = req.body?.getReader();
  if (!reader) return new Uint8Array();
  const chunks: Uint8Array[] = [];
  let total = 0;
  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    total += value.length;
    if (total > MAX_UPLOAD) {
      await reader.cancel();
      throw new Error("Upload exceeds 2 MB");
    }
    chunks.push(value);
  }
  return Buffer.concat(chunks);
}
export function failure(e: unknown) {
  if (e instanceof z.ZodError)
    return json(
      {
        error: e.issues
          .map((i) => `${i.path.join(".")}: ${i.message}`)
          .join("; "),
      },
      400,
    );
  const message = e instanceof Error ? e.message : "Request failed";
  if (message.includes("prisma") || message.includes("database")) {
    console.error("Stock request database failure");
    return json({ error: "Stock storage is unavailable. Please retry." }, 503);
  }
  return json({ error: message.slice(0, 300) }, 400);
}
