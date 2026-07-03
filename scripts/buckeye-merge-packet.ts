/**
 * Merge the 5 corrected invoice PDFs + their original customer-sent PDFs
 * into ONE clean attachment with a cover page summary.
 *
 * Output: /home/jelly/Shared/Buckeye-2026-05-12/Buckeye-Reconciliation-Packet.pdf
 *
 *   npx tsx scripts/buckeye-merge-packet.ts
 */
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import { readFileSync, writeFileSync, readdirSync } from 'fs';
import { join } from 'path';
import { chromium } from 'playwright';

const OUT_DIR = '/home/jelly/Shared/Buckeye-2026-05-12';
const ORDER = ['INV-142', 'INV-143', 'INV-144', 'INV-145', 'INV-146'];

const rows = [
  { num: 'INV-142', date: 'Apr 22', amt: 152.0, status: 'OPEN' },
  { num: 'INV-143', date: 'Apr 23', amt: 118.0, status: 'OPEN' },
  { num: 'INV-144', date: 'Apr 29', amt: 95.2, status: 'PAID 4/29 (ACH)' },
  { num: 'INV-145', date: 'Apr 30', amt: 264.0, status: 'OPEN' },
  { num: 'INV-146', date: 'May 4', amt: 240.8, status: 'OPEN' },
];

function coverHtml(): string {
  const fmt = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' });
  const tbody = rows
    .map(
      (r) => `
      <tr>
        <td style="padding:10px 8px;border-bottom:1px solid #e5e5e5;font-family:ui-monospace,monospace;font-weight:600;">${r.num}</td>
        <td style="padding:10px 8px;border-bottom:1px solid #e5e5e5;">${r.date}</td>
        <td style="padding:10px 8px;border-bottom:1px solid #e5e5e5;text-align:right;font-weight:600;">${fmt.format(r.amt)}</td>
        <td style="padding:10px 8px;border-bottom:1px solid #e5e5e5;color:${r.status === 'OPEN' ? '#dc2626' : '#059669'};font-weight:600;">${r.status}</td>
      </tr>`,
    )
    .join('');

  const due = rows.filter((r) => r.status === 'OPEN').reduce((s, r) => s + r.amt, 0);

  return `<!doctype html>
<html><head><meta charset="utf-8"></head>
<body style="margin:0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;color:#111;line-height:1.55;">
  <div style="max-width:720px;margin:0 auto;padding:60px 40px;">

    <div style="border-bottom:3px solid #111;padding-bottom:16px;margin-bottom:32px;">
      <h1 style="font-size:24px;font-weight:700;margin:0;">Your KC Homes LLC — Buckeye Reconciliation</h1>
      <p style="color:#666;font-size:13px;margin:6px 0 0;">Prepared for: Alicia Borden / Buckeye Cleaning AP &nbsp;·&nbsp; Date: May 12, 2026</p>
    </div>

    <p style="font-size:14px;">Hi Alicia,</p>

    <p style="font-size:14px;">This single PDF replaces the loose invoice attachments from prior emails. When I migrated billing off Xero, my system's auto-numbering diverged from the sequence on your invoices. I've corrected my records to match what you see — going forward we'll stay in sync.</p>

    <h2 style="font-size:15px;font-weight:700;margin:28px 0 10px;border-bottom:2px solid #111;padding-bottom:6px;">Open balance (Buckeye → Your KC Homes)</h2>

    <table style="width:100%;border-collapse:collapse;font-size:14px;margin-bottom:8px;">
      <thead>
        <tr style="border-bottom:2px solid #111;">
          <th style="text-align:left;padding:8px;font-size:11px;text-transform:uppercase;color:#666;">Invoice</th>
          <th style="text-align:left;padding:8px;font-size:11px;text-transform:uppercase;color:#666;">Issue Date</th>
          <th style="text-align:right;padding:8px;font-size:11px;text-transform:uppercase;color:#666;">Amount</th>
          <th style="text-align:left;padding:8px;font-size:11px;text-transform:uppercase;color:#666;">Status</th>
        </tr>
      </thead>
      <tbody>${tbody}</tbody>
      <tfoot>
        <tr>
          <td colspan="2" style="padding:14px 8px 4px;text-align:right;font-size:13px;color:#666;font-weight:600;">Currently owed:</td>
          <td style="padding:14px 8px 4px;text-align:right;font-size:18px;color:#0891b2;font-weight:700;">${fmt.format(due)}</td>
          <td></td>
        </tr>
      </tfoot>
    </table>

    <h2 style="font-size:15px;font-weight:700;margin:28px 0 10px;border-bottom:2px solid #111;padding-bottom:6px;">What's in this PDF</h2>
    <p style="font-size:14px;margin:0 0 6px;">For each of the five invoices below, you'll find two pages:</p>
    <ol style="font-size:14px;margin:6px 0 16px 22px;">
      <li><strong>Corrected invoice</strong> — my updated record showing the right number on top</li>
      <li><strong>Original PDF</strong> — the exact invoice document I previously emailed you, attached again here for cross-reference</li>
    </ol>

    <p style="font-size:14px;margin-top:24px;"><strong>Payment:</strong> if it's easier, a single ACH for $${due.toFixed(2)} with memo "INV-142, 143, 145, 146" works on my end — I'll split it on receipt.</p>

    <p style="font-size:14px;">If any of these are already paid and I'm missing the ACH on my end, just let me know the date(s) and I'll reconcile.</p>

    <p style="font-size:14px;margin-top:24px;">Thanks,<br>Jared Tolley<br>Your KC Homes LLC<br>tolley.io</p>
  </div>
</body></html>`;
}

function dividerHtml(num: string, label: string): string {
  return `<!doctype html>
<html><body style="margin:0;font-family:-apple-system,sans-serif;display:flex;align-items:center;justify-content:center;height:100vh;background:#f5f5f5;">
  <div style="text-align:center;">
    <p style="font-size:11px;color:#999;text-transform:uppercase;letter-spacing:2px;margin:0 0 12px;">Invoice</p>
    <h1 style="font-family:ui-monospace,monospace;font-size:64px;font-weight:700;margin:0;color:#111;">${num}</h1>
    <p style="font-size:14px;color:#666;margin:18px 0 0;">${label}</p>
  </div>
</body></html>`;
}

async function renderHtmlToPdfBytes(page: any, html: string): Promise<Uint8Array> {
  await page.setContent(html, { waitUntil: 'load' });
  return await page.pdf({
    format: 'Letter',
    printBackground: true,
    margin: { top: '0.4in', bottom: '0.4in', left: '0.4in', right: '0.4in' },
  });
}

async function main() {
  const browser = await chromium.launch();
  const ctx = await browser.newContext();
  const page = await ctx.newPage();

  const merged = await PDFDocument.create();

  // 1. Cover page
  const coverBytes = await renderHtmlToPdfBytes(page, coverHtml());
  const coverDoc = await PDFDocument.load(coverBytes);
  const coverPages = await merged.copyPages(coverDoc, coverDoc.getPageIndices());
  coverPages.forEach((p) => merged.addPage(p));

  // 2. Per-invoice: divider → corrected → divider → original
  for (const num of ORDER) {
    // Section header
    const headerBytes = await renderHtmlToPdfBytes(page, dividerHtml(num, 'Corrected invoice + original'));
    const headerDoc = await PDFDocument.load(headerBytes);
    (await merged.copyPages(headerDoc, headerDoc.getPageIndices())).forEach((p) => merged.addPage(p));

    // Corrected invoice
    const correctedPath = join(OUT_DIR, num, `${num}.pdf`);
    const correctedDoc = await PDFDocument.load(readFileSync(correctedPath));
    (await merged.copyPages(correctedDoc, correctedDoc.getPageIndices())).forEach((p) => merged.addPage(p));

    // Original customer-uploaded attachment
    const folder = join(OUT_DIR, num);
    const attFile = readdirSync(folder).find((f) => f.startsWith('attachment-'));
    if (attFile) {
      try {
        const origDoc = await PDFDocument.load(readFileSync(join(folder, attFile)), { ignoreEncryption: true });
        (await merged.copyPages(origDoc, origDoc.getPageIndices())).forEach((p) => merged.addPage(p));
      } catch (e) {
        console.warn(`  could not merge original ${num}/${attFile}:`, (e as Error).message);
      }
    }
  }

  await browser.close();

  const outPath = join(OUT_DIR, 'Buckeye-Reconciliation-Packet.pdf');
  writeFileSync(outPath, await merged.save());
  const sizeMB = (readFileSync(outPath).length / 1024 / 1024).toFixed(2);
  console.log(`\nWrote ${outPath} (${sizeMB} MB, ${merged.getPageCount()} pages)`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
