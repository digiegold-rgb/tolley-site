import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { LaundryError, requireThat } from "./validation";
export const reply = (data: unknown, status = 200) =>
  NextResponse.json(data, {
    status,
    headers: { "Cache-Control": "private, no-store" },
  });
export async function handle(fn: () => Promise<unknown>) {
  try {
    return reply(await fn());
  } catch (e) {
    if (e instanceof ZodError)
      return reply(
        {
          error: e.issues
            .map((i) => `${i.path.join(".")}: ${i.message}`)
            .join("; "),
        },
        400,
      );
    if (e instanceof LaundryError) return reply({ error: e.message }, e.status);
    console.error(
      "[laundry] request failed",
      e instanceof Error ? e.name : "unknown",
    );
    return reply(
      { error: "We could not complete this request. Please try again." },
      500,
    );
  }
}
export async function body(req: Request) {
  const origin = req.headers.get("origin");
  const origins = [
    new URL(req.url).origin,
    process.env.LAUNDRY_PUBLIC_ORIGIN,
    process.env.APP_URL,
  ]
    .filter(Boolean)
    .map((v) => new URL(v!).origin);
  requireThat(
    !origin || origins.includes(origin),
    "Request origin is not allowed.",
    403,
  );
  requireThat(
    req.headers.get("sec-fetch-site") !== "cross-site",
    "Request origin is not allowed.",
    403,
  );
  requireThat(
    req.headers.get("content-type")?.includes("application/json"),
    "JSON request required.",
    415,
  );
  const text = await req.text();
  requireThat(text.length <= 40000, "Request is too large.", 413);
  try {
    return JSON.parse(text);
  } catch {
    throw new LaundryError("Invalid JSON.");
  }
}
