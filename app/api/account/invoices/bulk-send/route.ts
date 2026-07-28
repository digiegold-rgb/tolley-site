export const runtime = 'nodejs';
// Sending N invoices is sequential and email-bound; give it room past the
// default 10s so a 20-invoice resend doesn't get cut off mid-batch.
export const maxDuration = 300;

import { NextRequest, NextResponse } from 'next/server';
import { requireAdminApiSession } from '@/lib/admin-auth';
import { sendInvoiceById } from '@/lib/account/send-invoice';

/** Hard cap per request — keeps one stray "select all" from blasting the world. */
const MAX_BATCH = 50;

interface BulkResult {
  id: string;
  invoiceNumber: string | null;
  emailSent: boolean;
  error: string | null;
  contactEmail: string | null;
}

export async function POST(request: NextRequest) {
  try {
    const check = await requireAdminApiSession();
    if (!check.ok) return check.response;

    const body = await request.json().catch(() => ({}));
    const ids: string[] = Array.isArray(body?.ids)
      ? body.ids.filter((v: unknown): v is string => typeof v === 'string' && v.length > 0)
      : [];

    if (ids.length === 0) {
      return NextResponse.json({ error: 'No invoices selected' }, { status: 400 });
    }
    if (ids.length > MAX_BATCH) {
      return NextResponse.json(
        { error: `Too many invoices selected (${ids.length}). Max ${MAX_BATCH} per batch.` },
        { status: 400 },
      );
    }

    // Sequential on purpose: parallel sends trip provider rate limits and make
    // partial failures impossible to attribute.
    const results: BulkResult[] = [];
    for (const id of ids) {
      try {
        const r = await sendInvoiceById(id);
        results.push({
          id,
          invoiceNumber: r.invoiceNumber,
          emailSent: r.emailSent,
          error: r.emailError,
          contactEmail: r.contactEmail,
        });
      } catch (err) {
        results.push({
          id,
          invoiceNumber: null,
          emailSent: false,
          error: err instanceof Error ? err.message : 'Send failed',
          contactEmail: null,
        });
      }
    }

    const sent = results.filter((r) => r.emailSent).length;
    return NextResponse.json({
      sent,
      failed: results.length - sent,
      results,
    });
  } catch (error: unknown) {
    if (error instanceof Response) throw error;
    const message = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
