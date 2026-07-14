import nodemailer from "nodemailer";

const emailHost = process.env.EMAIL_SERVER_HOST || "localhost";
const emailPort = Number(process.env.EMAIL_SERVER_PORT || 587);
const emailUser = process.env.EMAIL_SERVER_USER || "";
const emailPass = process.env.EMAIL_SERVER_PASSWORD || "";
const emailFrom =
  process.env.EMAIL_INVOICE_FROM ||
  process.env.EMAIL_FROM ||
  "Your KC Homes LLC <billing@tolley.io>";
const appUrl =
  process.env.NEXT_PUBLIC_SITE_URL ||
  process.env.NEXTAUTH_URL ||
  "https://www.tolley.io";

let transporter: ReturnType<typeof nodemailer.createTransport> | null = null;

function getTransporter() {
  if (transporter) return transporter;
  transporter = nodemailer.createTransport({
    host: emailHost,
    port: Number.isFinite(emailPort) ? emailPort : 587,
    secure: emailPort === 465,
    auth: { user: emailUser, pass: emailPass },
  });
  return transporter;
}

interface LineItem {
  description: string;
  quantity: number;
  unitAmount: number;
  lineAmount: number;
}

export interface SendInvoiceEmailOptions {
  to: string;
  cc?: string | string[];
  contactName: string | null;
  invoiceNumber: string;
  issueDate: Date;
  dueDate: Date | null;
  lineItems: LineItem[];
  subTotal: number;
  total: number;
  amountDue: number;
  notes: string | null;
  paymentLinkUrl: string;
  attachmentCount?: number;
}

const fmt = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
});

function escape(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export async function sendInvoiceEmail(
  opts: SendInvoiceEmailOptions,
): Promise<void> {
  const {
    to,
    cc,
    contactName,
    invoiceNumber,
    issueDate,
    dueDate,
    lineItems,
    subTotal,
    total,
    amountDue,
    notes,
    paymentLinkUrl,
    attachmentCount = 0,
  } = opts;

  const payPageUrl = `${appUrl}/pay/${invoiceNumber}`;
  const issued = issueDate.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
  const due = dueDate
    ? dueDate.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
      })
    : "On receipt";

  const rows = lineItems
    .map(
      (li) => `
      <tr>
        <td style="padding:10px 8px;border-bottom:1px solid #eee;">${escape(li.description)}</td>
        <td align="right" style="padding:10px 8px;border-bottom:1px solid #eee;color:#666;">${li.quantity}</td>
        <td align="right" style="padding:10px 8px;border-bottom:1px solid #eee;color:#666;">${fmt.format(li.unitAmount)}</td>
        <td align="right" style="padding:10px 8px;border-bottom:1px solid #eee;font-weight:600;">${fmt.format(li.lineAmount)}</td>
      </tr>`,
    )
    .join("");

  const html = `<!doctype html>
<html>
<head><meta charset="utf-8"></head>
<body style="font-family:-apple-system,Segoe UI,Arial,sans-serif;background:#f6f6f6;margin:0;padding:24px;color:#222;">
  <table width="100%" cellpadding="0" cellspacing="0" role="presentation">
    <tr><td align="center">
      <table width="100%" style="max-width:600px;background:#fff;border:1px solid #e5e5e5;border-radius:12px;overflow:hidden;" role="presentation">
        <tr><td style="padding:28px 32px 12px;">
          <div style="font-size:13px;letter-spacing:0.12em;text-transform:uppercase;color:#888;">Your KC Homes LLC</div>
          <h1 style="font-size:24px;font-weight:700;margin:8px 0 0;">Invoice ${escape(invoiceNumber)}</h1>
          ${contactName ? `<p style="margin:4px 0 0;color:#666;">Bill to: ${escape(contactName)}</p>` : ""}
        </td></tr>
        <tr><td style="padding:0 32px 16px;">
          <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="font-size:14px;">
            <tr>
              <td style="color:#888;padding:4px 0;">Issue Date</td>
              <td align="right" style="padding:4px 0;">${issued}</td>
            </tr>
            <tr>
              <td style="color:#888;padding:4px 0;">Due Date</td>
              <td align="right" style="padding:4px 0;">${due}</td>
            </tr>
          </table>
        </td></tr>
        <tr><td style="padding:0 32px;">
          <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="font-size:14px;border-top:2px solid #222;">
            <thead>
              <tr>
                <th align="left" style="padding:10px 8px;font-weight:600;color:#888;font-size:12px;text-transform:uppercase;letter-spacing:0.05em;">Item</th>
                <th align="right" style="padding:10px 8px;font-weight:600;color:#888;font-size:12px;text-transform:uppercase;letter-spacing:0.05em;">Qty</th>
                <th align="right" style="padding:10px 8px;font-weight:600;color:#888;font-size:12px;text-transform:uppercase;letter-spacing:0.05em;">Rate</th>
                <th align="right" style="padding:10px 8px;font-weight:600;color:#888;font-size:12px;text-transform:uppercase;letter-spacing:0.05em;">Amount</th>
              </tr>
            </thead>
            <tbody>${rows}</tbody>
          </table>
        </td></tr>
        <tr><td style="padding:16px 32px;">
          <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="font-size:14px;">
            <tr>
              <td style="color:#888;padding:4px 0;">Subtotal</td>
              <td align="right" style="padding:4px 0;">${fmt.format(subTotal)}</td>
            </tr>
            <tr>
              <td style="padding:10px 0 4px;font-weight:700;font-size:16px;border-top:2px solid #222;">Amount Due</td>
              <td align="right" style="padding:10px 0 4px;font-weight:700;font-size:16px;border-top:2px solid #222;">${fmt.format(amountDue || total)}</td>
            </tr>
          </table>
        </td></tr>
        <tr><td style="padding:4px 32px 24px;text-align:center;">
          <a href="${escape(payPageUrl)}" style="display:inline-block;padding:14px 28px;background:#10b981;color:#fff;text-decoration:none;border-radius:8px;font-weight:600;font-size:15px;margin-right:8px;">Pay by Bank (ACH) →</a>
        </td></tr>
        <tr><td style="padding:0 32px 20px;text-align:center;">
          <a href="${escape(paymentLinkUrl)}" style="display:inline-block;padding:10px 24px;background:#fff;color:#6366f1;border:1px solid #6366f1;text-decoration:none;border-radius:8px;font-weight:600;font-size:14px;">Or pay by card</a>
        </td></tr>
        ${
          attachmentCount > 0
            ? `<tr><td style="padding:0 32px 20px;text-align:center;font-size:13px;color:#444;">
                📎 ${attachmentCount} supporting document${attachmentCount === 1 ? "" : "s"} attached —
                <a href="${escape(payPageUrl)}" style="color:#6366f1;text-decoration:underline;">view on the pay page</a>
              </td></tr>`
            : ""
        }
        ${
          notes
            ? `<tr><td style="padding:0 32px 20px;font-size:13px;color:#666;border-top:1px solid #eee;padding-top:16px;">${escape(notes)}</td></tr>`
            : ""
        }
        <tr><td style="padding:16px 32px 24px;border-top:1px solid #eee;font-size:12px;color:#888;text-align:center;">
          Your KC Homes LLC · Independence, MO · Reply to this email with any questions.
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;

  const text = `Invoice ${invoiceNumber}
${contactName ? `Bill to: ${contactName}\n` : ""}Issued: ${issued}
Due: ${due}

${lineItems.map((li) => `${li.description} — ${li.quantity} × ${fmt.format(li.unitAmount)} = ${fmt.format(li.lineAmount)}`).join("\n")}

Subtotal: ${fmt.format(subTotal)}
Amount Due: ${fmt.format(amountDue || total)}

Pay: ${payPageUrl}
${attachmentCount > 0 ? `\n${attachmentCount} supporting document${attachmentCount === 1 ? "" : "s"} attached — view at ${payPageUrl}\n` : ""}${notes ? `\nNotes: ${notes}\n` : ""}
— Your KC Homes LLC`;

  const ccList = (Array.isArray(cc) ? cc : cc ? [cc] : [])
    .flatMap((c) => c.split(/[,;]/))
    .map((c) => c.trim())
    .filter(Boolean);

  await getTransporter().sendMail({
    from: emailFrom,
    to,
    ...(ccList.length ? { cc: ccList } : {}),
    subject: `Invoice ${invoiceNumber} from Your KC Homes LLC — ${fmt.format(amountDue || total)}`,
    text,
    html,
  });
}
