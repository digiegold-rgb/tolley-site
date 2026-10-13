/**
 * Public cleanout invoice lookup and payment choice.
 *
 * Customers can look up an invoice and agree to the terms. Card/bank continues
 * through the existing Stripe link or /pay/INV-####. Cash/check only appends a
 * note. Amount, total, and line items in the request are rejected.
 */

import { NextRequest, NextResponse } from "next/server";

import {
  applyCleanoutPaymentChoice,
  limitCleanoutPayment,
  lookupCleanoutInvoice,
  requestIp,
} from "@/lib/cleanouts/payment";
import {
  CK_PAYMENT_PATH,
  hasForbiddenAmountKey,
  normalizeInvoiceNumber,
  parsePaymentChoice,
  PAYMENT_COPY,
  termsWereAccepted,
} from "@/lib/legal-cleanouts";
import { rateLimited } from "@/lib/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function isJson(request: Request): boolean {
  return (request.headers.get("content-type") || "").includes("application/json");
}

function sameOrigin(request: Request): boolean {
  const host = request.headers.get("x-forwarded-host") || request.headers.get("host");
  if (!host) return false;
  const origin = request.headers.get("origin");
  const referer = request.headers.get("referer");
  const claimed = origin || referer;
  if (!claimed) return false;
  try {
    return new URL(claimed).host === host;
  } catch {
    return false;
  }
}

function honeypotTripped(fields: Record<string, unknown>): boolean {
  const company = typeof fields.company === "string" ? fields.company.trim() : "";
  const website = typeof fields.website === "string" ? fields.website.trim() : "";
  return Boolean(company || website);
}

function paymentRedirect(request: Request, params: Record<string, string>): NextResponse {
  const url = new URL(CK_PAYMENT_PATH, request.url);
  for (const [key, value] of Object.entries(params)) url.searchParams.set(key, value);
  return NextResponse.redirect(url, 303);
}

function fail(
  request: Request,
  status: number,
  code: string,
  message: string,
  invoiceNumber?: string | null,
) {
  if (isJson(request)) {
    return NextResponse.json({ error: message, code }, { status });
  }
  const params: Record<string, string> = { error: code };
  if (invoiceNumber) params.invoice = invoiceNumber;
  return paymentRedirect(request, params);
}

async function readFields(request: NextRequest): Promise<Record<string, unknown>> {
  if (isJson(request)) {
    const body = await request.json().catch(() => null);
    if (!body || typeof body !== "object" || Array.isArray(body)) return {};
    return body as Record<string, unknown>;
  }
  const form = await request.formData();
  const fields: Record<string, unknown> = {};
  for (const [key, value] of form.entries()) {
    if (typeof value === "string") fields[key] = value;
  }
  return fields;
}

function text(fields: Record<string, unknown>, key: string): string {
  const value = fields[key];
  return typeof value === "string" ? value : value == null ? "" : String(value);
}

export async function GET(request: NextRequest) {
  const ip = requestIp(request.headers);
  const limited = await limitCleanoutPayment(ip);
  if (!limited.allowed) return rateLimited(limited);

  const raw = request.nextUrl.searchParams.get("invoice") || "";
  if (request.nextUrl.searchParams.get("company") || request.nextUrl.searchParams.get("website")) {
    return NextResponse.json({ error: PAYMENT_COPY.notFound }, { status: 404 });
  }
  const result = await lookupCleanoutInvoice(raw);
  if (!result.ok) {
    const message = result.error === "invalid" ? PAYMENT_COPY.invalidNumber : PAYMENT_COPY.notFound;
    return NextResponse.json({ error: message }, { status: result.error === "invalid" ? 400 : 404 });
  }
  return NextResponse.json({ invoice: result.invoice }, { headers: { "Cache-Control": "no-store" } });
}

export async function POST(request: NextRequest) {
  const fields = await readFields(request);
  const invoiceNumber = normalizeInvoiceNumber(text(fields, "invoiceNumber"));
  const ip = requestIp(request.headers);
  const limited = await limitCleanoutPayment(ip);
  if (!limited.allowed) {
    if (isJson(request)) return rateLimited(limited);
    const params: Record<string, string> = { error: "rate" };
    if (invoiceNumber) params.invoice = invoiceNumber;
    return paymentRedirect(request, params);
  }

  if (honeypotTripped(fields)) {
    if (isJson(request)) return NextResponse.json({ ok: true });
    return paymentRedirect(request, invoiceNumber ? { invoice: invoiceNumber } : {});
  }

  if (!sameOrigin(request)) {
    return fail(request, 403, "origin", PAYMENT_COPY.originError, invoiceNumber);
  }

  if (hasForbiddenAmountKey(Object.keys(fields))) {
    return fail(request, 400, "amount", PAYMENT_COPY.amountRejected, invoiceNumber);
  }

  const choice = parsePaymentChoice(text(fields, "choice"));
  if (!choice) {
    return fail(request, 400, "choice", PAYMENT_COPY.choiceInvalid, invoiceNumber);
  }
  if (!termsWereAccepted(text(fields, "termsAccepted"))) {
    return fail(request, 400, "terms", PAYMENT_COPY.termsRequired, invoiceNumber);
  }
  if (!invoiceNumber) {
    return fail(request, 400, "invalid", PAYMENT_COPY.invalidNumber);
  }

  const result = await applyCleanoutPaymentChoice(invoiceNumber, choice);
  if (!result.ok) {
    const message = result.code === "paid" ? PAYMENT_COPY.paidTitle : PAYMENT_COPY.notFound;
    const status = result.code === "missing" ? 404 : 409;
    return fail(request, status, result.code, message, invoiceNumber);
  }

  if (isJson(request)) {
    if (result.kind === "card") return NextResponse.json({ ok: true, choice: "card", nextUrl: result.payPath });
    return NextResponse.json({ ok: true, choice: "cash", invoiceNumber: result.invoiceNumber });
  }

  if (result.kind === "card") {
    return NextResponse.redirect(new URL(result.payPath, request.url), 303);
  }
  return paymentRedirect(request, { invoice: result.invoiceNumber, choice: "cash" });
}
