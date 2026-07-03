/**
 * Build the Buckeye email packet: PDF of each NEW-era Buckeye invoice
 * + their uploaded attachments, dropped in the shared folder.
 *
 * No auth needed — renders directly from DB without going through the web UI.
 *
 *   npx tsx scripts/buckeye-export-packet.ts
 */
import { PrismaClient } from '@prisma/client';
import { chromium } from 'playwright';
import { mkdirSync, writeFileSync, createWriteStream } from 'fs';
import { join } from 'path';
import { pipeline } from 'stream/promises';
import { Readable } from 'stream';

const prisma = new PrismaClient();
const OUT_DIR = '/home/jelly/Shared/Buckeye-2026-05-12';
const TARGETS = ['INV-142', 'INV-143', 'INV-144', 'INV-145', 'INV-146'];

const fmt = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' });
const dateFmt = (d: Date | null | undefined) =>
  d ? new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '—';

function html(invoice: any): string {
  const lineRows = invoice.lineItems
    .map(
      (li: any) => `
      <tr>
        <td style="padding:8px 0;border-bottom:1px solid #eee;">${escapeHtml(li.description)}</td>
        <td style="padding:8px 0;border-bottom:1px solid #eee;text-align:center;">${li.quantity}</td>
        <td style="padding:8px 0;border-bottom:1px solid #eee;text-align:right;">${fmt.format(li.unitAmount)}</td>
        <td style="padding:8px 0;border-bottom:1px solid #eee;text-align:right;font-weight:600;">${fmt.format(li.lineAmount)}</td>
      </tr>`,
    )
    .join('');

  const statusBadge = (() => {
    const c = invoice.status === 'PAID' ? '#059669' : invoice.status === 'OVERDUE' ? '#dc2626' : '#0891b2';
    return `<span style="display:inline-block;padding:3px 10px;border-radius:6px;background:${c};color:#fff;font-size:12px;font-weight:700;letter-spacing:0.5px;">${invoice.status}</span>`;
  })();

  return `<!doctype html>
<html><head><meta charset="utf-8"><title>${invoice.invoiceNumber}</title></head>
<body style="margin:0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;color:#111;line-height:1.5;">
  <div style="max-width:760px;margin:0 auto;padding:40px;">
    <div style="display:flex;justify-content:space-between;margin-bottom:32px;">
      <div>
        <h1 style="font-size:22px;font-weight:700;margin:0;">Your KC Homes LLC</h1>
        <p style="color:#666;font-size:13px;margin:4px 0 0;">Independence, MO</p>
        <p style="color:#666;font-size:13px;margin:2px 0 0;">tolley.io</p>
      </div>
      <div style="text-align:right;">
        <h2 style="font-size:26px;font-weight:700;margin:0;color:#0891b2;">INVOICE</h2>
        <p style="font-size:16px;font-weight:600;font-family:ui-monospace,monospace;margin:6px 0 0;">${invoice.invoiceNumber}</p>
        <p style="margin:6px 0 0;">${statusBadge}</p>
      </div>
    </div>

    <div style="display:flex;justify-content:space-between;margin-bottom:24px;">
      <div>
        <p style="font-size:11px;text-transform:uppercase;color:#999;margin:0 0 4px;letter-spacing:0.5px;">Bill To</p>
        <p style="font-weight:600;margin:0;">${escapeHtml(invoice.contact?.name || '—')}</p>
        ${invoice.contact?.email ? `<p style="color:#666;font-size:13px;margin:2px 0 0;">${escapeHtml(invoice.contact.email)}</p>` : ''}
      </div>
      <div style="text-align:right;font-size:13px;">
        <p style="margin:0;"><strong>Issue:</strong> ${dateFmt(invoice.issueDate)}</p>
        <p style="margin:2px 0 0;"><strong>Due:</strong> ${dateFmt(invoice.dueDate)}</p>
        ${invoice.reference ? `<p style="margin:2px 0 0;"><strong>Reference:</strong> ${escapeHtml(invoice.reference)}</p>` : ''}
      </div>
    </div>

    <table style="width:100%;border-collapse:collapse;font-size:14px;">
      <thead>
        <tr style="border-bottom:2px solid #111;">
          <th style="text-align:left;padding:8px 0;font-size:11px;text-transform:uppercase;color:#666;">Description</th>
          <th style="text-align:center;padding:8px 0;font-size:11px;text-transform:uppercase;color:#666;width:60px;">Qty</th>
          <th style="text-align:right;padding:8px 0;font-size:11px;text-transform:uppercase;color:#666;width:100px;">Unit</th>
          <th style="text-align:right;padding:8px 0;font-size:11px;text-transform:uppercase;color:#666;width:110px;">Amount</th>
        </tr>
      </thead>
      <tbody>${lineRows}</tbody>
    </table>

    <div style="margin-top:20px;display:flex;justify-content:flex-end;">
      <table style="font-size:14px;">
        <tr><td style="padding:4px 16px 4px 0;color:#666;text-align:right;">Subtotal</td><td style="padding:4px 0;text-align:right;width:120px;">${fmt.format(invoice.subTotal)}</td></tr>
        <tr><td style="padding:4px 16px 4px 0;color:#666;text-align:right;font-weight:700;border-top:1px solid #111;">Total</td><td style="padding:4px 0;text-align:right;font-weight:700;border-top:1px solid #111;">${fmt.format(invoice.total)}</td></tr>
        <tr><td style="padding:4px 16px 4px 0;color:#666;text-align:right;">Paid</td><td style="padding:4px 0;text-align:right;">${fmt.format(invoice.amountPaid)}</td></tr>
        <tr><td style="padding:6px 16px 4px 0;color:#0891b2;text-align:right;font-weight:700;">Amount Due</td><td style="padding:6px 0;text-align:right;font-weight:700;color:#0891b2;font-size:16px;">${fmt.format(invoice.amountDue)}</td></tr>
      </table>
    </div>

    ${invoice.notes ? `<div style="margin-top:24px;padding:12px;background:#f5f5f5;border-radius:6px;font-size:13px;"><strong>Notes:</strong> ${escapeHtml(invoice.notes)}</div>` : ''}

    <p style="margin-top:40px;font-size:11px;color:#999;text-align:center;">
      Questions? Reply to this email or call.<br>
      Your KC Homes LLC · tolley.io
    </p>
  </div>
</body></html>`;
}

function escapeHtml(s: string | null | undefined): string {
  return (s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

async function downloadBlob(url: string, dest: string) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Download failed ${res.status} ${url}`);
  if (!res.body) throw new Error('No body');
  await pipeline(Readable.fromWeb(res.body as any), createWriteStream(dest));
}

async function main() {
  mkdirSync(OUT_DIR, { recursive: true });

  const browser = await chromium.launch();
  const ctx = await browser.newContext();
  const page = await ctx.newPage();

  const summary: any[] = [];

  for (const num of TARGETS) {
    const inv = await prisma.invoice.findUnique({
      where: { invoiceNumber: num },
      include: {
        lineItems: true,
        contact: { select: { name: true, email: true } },
        attachments: { select: { fileName: true, blobUrl: true, mimeType: true, size: true } },
        payments: true,
      },
    });
    if (!inv) {
      console.warn(`SKIP ${num} — not found`);
      continue;
    }

    const folder = join(OUT_DIR, num);
    mkdirSync(folder, { recursive: true });

    // 1. Render our invoice as PDF
    await page.setContent(html(inv), { waitUntil: 'load' });
    const pdfPath = join(folder, `${num}.pdf`);
    await page.pdf({ path: pdfPath, format: 'Letter', printBackground: true, margin: { top: '0.4in', bottom: '0.4in', left: '0.4in', right: '0.4in' } });
    console.log(`PDF  ${pdfPath}`);

    // 2. Download original customer-uploaded attachments
    for (const att of inv.attachments) {
      const safeName = att.fileName.replace(/[^a-zA-Z0-9._-]/g, '_');
      const attPath = join(folder, `attachment-${safeName}`);
      try {
        await downloadBlob(att.blobUrl, attPath);
        console.log(`ATT  ${attPath}`);
      } catch (e) {
        console.warn(`  attachment download failed for ${att.fileName}:`, e);
      }
    }

    summary.push({
      invoiceNumber: inv.invoiceNumber,
      reference: inv.reference,
      status: inv.status,
      total: inv.total,
      amountPaid: inv.amountPaid,
      amountDue: inv.amountDue,
      issueDate: inv.issueDate,
      attachments: inv.attachments.map((a) => a.fileName),
    });
  }

  await browser.close();

  writeFileSync(join(OUT_DIR, 'summary.json'), JSON.stringify(summary, null, 2));
  console.log(`\nSummary: ${join(OUT_DIR, 'summary.json')}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
