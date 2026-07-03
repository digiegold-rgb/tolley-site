export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import nodemailer from "nodemailer";

export async function POST(request: NextRequest) {
  const expected = process.env.SMTP_HEALTH_TOKEN;
  if (!expected) {
    return NextResponse.json(
      { ok: false, error: "SMTP_HEALTH_TOKEN not configured" },
      { status: 500 },
    );
  }

  const auth = request.headers.get("authorization") || "";
  const provided = auth.startsWith("Bearer ") ? auth.slice(7) : "";
  if (provided !== expected) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  const host = process.env.EMAIL_SERVER_HOST || "";
  const port = Number(process.env.EMAIL_SERVER_PORT || 587);
  const user = process.env.EMAIL_SERVER_USER || "";
  const pass = process.env.EMAIL_SERVER_PASSWORD || "";
  const from =
    process.env.EMAIL_INVOICE_FROM ||
    process.env.EMAIL_FROM ||
    "Your KC Homes LLC <jared@yourkchomes.com>";
  const to = "digiegold@gmail.com";

  const sentAt = new Date().toISOString();

  try {
    const transporter = nodemailer.createTransport({
      host,
      port,
      secure: port === 465,
      auth: { user, pass },
    });
    await transporter.verify();
    const info = await transporter.sendMail({
      from,
      to,
      subject: "[SMTP HEALTH] tolley-site invoice transport OK",
      text: `SMTP transport healthy.\n\nHost: ${host}:${port}\nUser: ${user}\nFrom: ${from}\nSent at (UTC): ${sentAt}\n\nIf you stop receiving this weekly, the Gmail app password may have been revoked or 2FA reset.`,
    });
    return NextResponse.json({
      ok: true,
      sentAt,
      messageId: info.messageId,
      host,
      user,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json(
      { ok: false, sentAt, host, user, error: msg },
      { status: 500 },
    );
  }
}
