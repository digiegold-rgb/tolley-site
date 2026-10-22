import { NextRequest, NextResponse } from "next/server";
import nodemailer from "nodemailer";
import { validateTwilioSignature } from "@/lib/twilio";

/**
 * Tolley Clean Outs inbound SMS (+1 816-357-8080).
 * Separate from the Wash & Dry handler (/api/sms/webhook) on purpose:
 * no DB writes, no auto-replies, no outbound SMS. It only emails each
 * incoming text to the owner. Outbound SMS waits for a cleanout A2P campaign.
 */
export const dynamic = "force-dynamic";

const NOTIFY_TO = process.env.CLEANOUTS_SMS_NOTIFY_EMAIL || "jared@yourkchomes.com";
const WEBHOOK_URL =
  process.env.CLEANOUTS_SMS_WEBHOOK_URL || "https://www.tolley.io/api/cleanouts/sms";

function twiml() {
  return new NextResponse('<?xml version="1.0" encoding="UTF-8"?><Response></Response>', {
    status: 200,
    headers: { "Content-Type": "text/xml" },
  });
}

export async function POST(request: NextRequest) {
  const form = await request.formData();
  const params: Record<string, string> = {};
  for (const [k, v] of form.entries()) params[k] = String(v);

  const signature = request.headers.get("x-twilio-signature") || "";
  if (process.env.TWILIO_AUTH_TOKEN) {
    if (!signature || !validateTwilioSignature(WEBHOOK_URL, params, signature)) {
      return NextResponse.json({ error: "Invalid signature" }, { status: 403 });
    }
  }

  const from = params.From || "unknown";
  const body = (params.Body || "").trim();
  const numMedia = parseInt(params.NumMedia || "0", 10) || 0;
  if (!body && !numMedia) return twiml(); // status callbacks etc.

  const time = new Date().toLocaleString("en-US", { timeZone: "America/Chicago" }) + " CT";
  const media: string[] = [];
  for (let i = 0; i < numMedia; i++) if (params[`MediaUrl${i}`]) media.push(params[`MediaUrl${i}`]);

  const text = [
    `New text to Tolley Clean Outs (${params.To || "+18163578080"})`,
    `From: ${from}`,
    `Time: ${time}`,
    "",
    body || "(no text)",
    ...(media.length ? ["", "Media:", ...media] : []),
    "",
    `SID: ${params.MessageSid || ""}`,
  ].join("\n");

  try {
    const port = Number(process.env.EMAIL_SERVER_PORT || 587);
    const t = nodemailer.createTransport({
      host: process.env.EMAIL_SERVER_HOST || "localhost",
      port,
      secure: port === 465,
      connectionTimeout: 8000, greetingTimeout: 8000, socketTimeout: 10000,
      auth: { user: process.env.EMAIL_SERVER_USER || "", pass: process.env.EMAIL_SERVER_PASSWORD || "" },
    });
    await t.sendMail({
      from: process.env.EMAIL_FROM || "Tolley.io <leads@tolley.io>",
      to: NOTIFY_TO,
      subject: `Clean Outs text from ${from}`,
      text,
    });
  } catch (err) {
    console.error("[cleanouts-sms] email failed:", err);
  }
  return twiml();
}
