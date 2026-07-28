export const runtime = 'nodejs';

import { NextRequest, NextResponse } from 'next/server';
import { requireAdminApiSession } from '@/lib/admin-auth';
import { sendInvoiceById } from '@/lib/account/send-invoice';

type RouteContext = { params: Promise<{ id: string }> };

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function POST(_request: NextRequest, context: RouteContext) {
  try {
    const check = await requireAdminApiSession();
    if (!check.ok) return check.response;
    const { id } = await context.params;

    // Optional per-send overrides from the UI: edit the recipient, add CC.
    // Body may be empty (cron / resend button) — default to the contact email.
    const body = await _request.json().catch(() => ({}));
    const toOverride =
      typeof body?.to === 'string' && body.to.trim() ? body.to.trim() : null;
    const ccList: string[] = (
      typeof body?.cc === 'string'
        ? body.cc
        : Array.isArray(body?.cc)
          ? body.cc.join(',')
          : ''
    )
      .split(/[,;]/)
      .map((s: string) => s.trim())
      .filter(Boolean);

    const badEmails = [
      ...(toOverride ? [toOverride] : []),
      ...ccList,
    ].filter((e) => !EMAIL_RE.test(e));
    if (badEmails.length) {
      return NextResponse.json(
        { error: `Invalid email address: ${badEmails.join(', ')}` },
        { status: 400 },
      );
    }

    const result = await sendInvoiceById(id, { to: toOverride, cc: ccList });

    return NextResponse.json({
      paymentLinkUrl: result.paymentLinkUrl,
      emailSent: result.emailSent,
      emailError: result.emailError,
      contactEmail: result.contactEmail,
      cc: result.cc,
    });
  } catch (error: unknown) {
    if (error instanceof Response) throw error;
    const message = error instanceof Error ? error.message : 'Internal server error';
    const status = message === 'Invoice not found' ? 404
      : message === 'Invoice already paid' || message === 'Cannot send a voided invoice' ? 400
      : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
